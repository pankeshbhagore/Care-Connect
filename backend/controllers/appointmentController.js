const Appointment = require("../models/Appointment");
const Hospital    = require("../models/Hospital");

// Public: book appointment (no auth required)
exports.book = async (req, res) => {
  try {
    const { hospitalId, patientName, patientPhone, patientAge, patientGender, specialty, doctor, appointmentDate, appointmentTime, reason } = req.body;
    if (!hospitalId||!patientName||!patientPhone||!appointmentDate||!appointmentTime)
      return res.status(400).json({ message:"hospitalId, patientName, patientPhone, appointmentDate, appointmentTime required" });
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message:"Hospital not found" });
    const count = await Appointment.countDocuments();
    const appointmentId = `APT-${String(count+1).padStart(5,"0")}`;
    const apt = await Appointment.create({
      appointmentId, hospital:hospitalId, patientName, patientPhone, patientAge:+patientAge||0,
      patientGender:patientGender||"Other", specialty:specialty||"General", doctor:doctor||"",
      appointmentDate:new Date(appointmentDate), appointmentTime, reason:reason||"",
      bookedBy: req.user?.id||null,
    });
    await apt.populate("hospital","name location.city contact.phone");
    req.app.get("io")?.emit(`hospital:${hospitalId}:newAppointment`, { appointment:apt.toObject(), hospitalName:hospital.name });
    res.status(201).json(apt);
  } catch(e){ res.status(400).json({ error:e.message }); }
};

exports.getByHospital = async (req, res) => {
  try {
    const filter = { hospital:req.params.hospitalId };
    if (req.query.status) filter.status = req.query.status;
    const date = req.query.date ? new Date(req.query.date) : null;
    if (date) { const next=new Date(date); next.setDate(next.getDate()+1); filter.appointmentDate={$gte:date,$lt:next}; }
    const apts = await Appointment.find(filter).sort({appointmentDate:1,appointmentTime:1}).limit(200).lean();
    res.json(apts);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const apt = await Appointment.findByIdAndUpdate(req.params.id,
      { status, notes:notes||"", ...(status==="Confirmed"?{confirmedAt:new Date()}:{}), ...(status==="Cancelled"?{cancelledAt:new Date()}:{}) },
      { new:true }).populate("hospital","name");
    if (!apt) return res.status(404).json({ message:"Not found" });
    req.app.get("io")?.emit(`hospital:${apt.hospital._id}:appointmentUpdate`, apt.toObject());
    res.json(apt);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const all = await Appointment.find({hospital:hospitalId}).lean();
    const today = new Date(); today.setHours(0,0,0,0);
    res.json({
      total:all.length, today:all.filter(a=>new Date(a.appointmentDate)>=today).length,
      pending:all.filter(a=>a.status==="Pending").length, confirmed:all.filter(a=>a.status==="Confirmed").length,
      completed:all.filter(a=>a.status==="Completed").length, cancelled:all.filter(a=>a.status==="Cancelled").length,
    });
  } catch(e){ res.status(500).json({ error:e.message }); }
};
