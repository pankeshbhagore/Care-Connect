const PatientTransfer = require("../models/PatientTransfer");
const Hospital        = require("../models/Hospital");
const calcDistance    = require("../utils/distance");

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.hospital) filter.$or = [{ fromHospital: req.query.hospital }, { toHospital: req.query.hospital }];
    const list = await PatientTransfer.find(filter)
      .populate("fromHospital", "name location.city")
      .populate("toHospital",   "name location.city")
      .sort({ createdAt: -1 }).limit(200).lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const t = await PatientTransfer.findById(req.params.id).populate("fromHospital").populate("toHospital");
    if (!t) return res.status(404).json({ message: "Not found" });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { fromHospitalId, toHospitalId, patientName, patientAge, patientGender, bloodGroup, condition, priority, notes } = req.body;
    if (!fromHospitalId || !toHospitalId) return res.status(400).json({ message: "fromHospitalId and toHospitalId required" });

    const [from, to] = await Promise.all([Hospital.findById(fromHospitalId), Hospital.findById(toHospitalId)]);
    if (!from || !to) return res.status(404).json({ message: "Hospital not found" });

    const distKm  = parseFloat(calcDistance(from.location.lat, from.location.lng, to.location.lat, to.location.lng).toFixed(1));
    const estMins = Math.round((distKm / 60) * 60);
    const count   = await PatientTransfer.countDocuments();
    const transferId = `TRF-${String(count + 1).padStart(5, "0")}`;

    const transfer = await PatientTransfer.create({
      transferId, fromHospital: fromHospitalId, toHospital: toHospitalId,
      patientName: patientName || "Anonymous", patientAge: parseInt(patientAge) || 0,
      patientGender: patientGender || "Other", bloodGroup: bloodGroup || "",
      condition: condition || "", priority: priority || "Normal",
      distanceKm: distKm, estimatedMinutes: estMins,
      requestedBy: req.user?.id || null, notes: notes || "",
    });

    await transfer.populate(["fromHospital","toHospital"]);
    req.app.get("io")?.emit("newTransfer", { transfer: transfer.toObject(), fromName: from.name, toName: to.name });
    res.status(201).json(transfer);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, rejectionReason, vehicleUsed } = req.body;
    const t = await PatientTransfer.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });
    t.status = status;
    if (status === "Accepted")  t.acceptedAt  = new Date();
    if (status === "Completed") t.completedAt = new Date();
    if (status === "Cancelled" || status === "Rejected") { t.cancelledAt = new Date(); t.rejectionReason = rejectionReason || ""; }
    if (vehicleUsed) t.vehicleUsed = vehicleUsed;
    await t.save();
    await t.populate(["fromHospital","toHospital"]);
    req.app.get("io")?.emit("transferUpdate", t.toObject());
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.suggest = async (req, res) => {
  try {
    const { fromHospitalId, specialty } = req.query;
    if (!fromHospitalId) return res.status(400).json({ message: "fromHospitalId required" });
    const from = await Hospital.findById(fromHospitalId).lean();
    if (!from) return res.status(404).json({ message: "Not found" });

    const hospitals = await Hospital.find({ _id: { $ne: fromHospitalId }, status: { $ne: "Offline" } }).lean();
    const scored = hospitals.map(h => {
      const dist  = calcDistance(from.location.lat, from.location.lng, h.location.lat, h.location.lng);
      const r     = h.resources;
      const icuA  = r.icuBeds.total    > 0 ? r.icuBeds.available    / r.icuBeds.total    : 0;
      const ventA = r.ventilators.total> 0 ? r.ventilators.available/ r.ventilators.total: 0;
      const specB = specialty && h.specialties?.includes(specialty) ? 0.2 : 0;
      const score = Math.max(0,1-dist/100)*0.45 + icuA*0.30 + ventA*0.15 + specB;
      return { hospital: h, distKm: parseFloat(dist.toFixed(1)), estMins: Math.round((dist/60)*60), score: parseFloat(score.toFixed(3)), reason: `${dist.toFixed(0)}km | ICU:${r.icuBeds.available}/${r.icuBeds.total} | Vent:${r.ventilators.available} | O₂:${r.oxygenLevel}%` };
    }).sort((a,b)=>b.score-a.score).slice(0,5);
    res.json({ suggestions: scored, from: from.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const all   = await PatientTransfer.find().lean();
    const today = new Date(); today.setHours(0,0,0,0);
    res.json({
      total:     all.length,
      today:     all.filter(t=>new Date(t.createdAt)>=today).length,
      pending:   all.filter(t=>t.status==="Requested").length,
      inTransit: all.filter(t=>t.status==="InTransit").length,
      completed: all.filter(t=>t.status==="Completed").length,
      critical:  all.filter(t=>t.priority==="Critical").length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
