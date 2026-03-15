const EmergencyRequest = require("../models/EmergencyRequest");
const Hospital         = require("../models/Hospital");
const Ambulance        = require("../models/Ambulance");
const calcDistance     = require("../utils/distance");

const AI_RECS = {
  Cardiac:    "Dispatch ALS ambulance. Nearest cath lab hospital preferred. Aspirin if conscious.",
  Stroke:     "Time critical — nearest stroke center. CT scan availability essential.",
  Trauma:     "Trauma center required. Stabilize before transport. Multiple units if critical.",
  Respiratory:"Oxygen en route. Nearest ICU with ventilators. Check for anaphylaxis.",
  Obstetric:  "Maternity unit required. ALS + midwife if available.",
  Pediatric:  "Pediatric ICU preferred. Pediatric ALS team if available.",
  Burns:      "Burns unit preferred. Fluid resuscitation en route.",
  Other:      "General assessment. Route to nearest available hospital.",
};

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.severity) filter.severity = req.query.severity;
    const list = await EmergencyRequest.find(filter)
      .populate("assignedHospital","name location.city")
      .populate("assignedAmbulance","ambulanceId name location")
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { type, severity, patientName, patientAge, patientPhone, description, lat, lng, address } = req.body;
    if (!lat || !lng) return res.status(400).json({ message: "Location required" });

    const count = await EmergencyRequest.countDocuments();
    const requestId = `EMG-${String(count+1).padStart(5,"0")}`;
    const aiRec = AI_RECS[type] || AI_RECS.Other;

    const em = await EmergencyRequest.create({
      requestId, type: type||"Other", severity: severity||"Medium",
      patientName: patientName||"Unknown", patientAge: patientAge||0, patientPhone: patientPhone||"",
      description: description||"", location: { lat:parseFloat(lat), lng:parseFloat(lng), address:address||"" },
      reportedBy: req.user?.id||null, aiRecommendation: aiRec,
    });

    // Auto-find best hospital
    const hospitals = await Hospital.find({ status:{ $ne:"Offline" } }).lean();
    const best = hospitals
      .map(h => ({ ...h, dist: calcDistance(parseFloat(lat),parseFloat(lng),h.location.lat,h.location.lng) }))
      .filter(h => h.resources?.icuBeds?.available > 0 || h.resources?.generalBeds?.available > 0)
      .sort((a,b) => a.dist-b.dist)[0];

    if (best) { em.assignedHospital = best._id; await em.save(); }

    await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("newEmergencyRequest", { request: em.toObject(), hospital: best?.name });
    res.status(201).json(em);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const em = await EmergencyRequest.findById(req.params.id);
    if (!em) return res.status(404).json({ message: "Not found" });
    em.status = status;
    if (status==="Dispatched") em.dispatchedAt = new Date();
    if (status==="OnScene")    em.arrivedAt    = new Date();
    if (status==="Resolved")   { em.resolvedAt = new Date(); em.responseTimeMinutes = em.dispatchedAt ? Math.round((new Date()-em.dispatchedAt)/60000) : 0; }
    if (notes) em.notes.push({ text:notes, by:req.user?.name||"Operator" });
    await em.save();
    await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("emergencyUpdate", em.toObject());
    res.json(em);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.dispatch = async (req, res) => {
  try {
    const { hospitalId, ambulanceId } = req.body;
    const em = await EmergencyRequest.findById(req.params.id);
    if (!em) return res.status(404).json({ message: "Not found" });
    if (hospitalId)  em.assignedHospital  = hospitalId;
    if (ambulanceId) em.assignedAmbulance = ambulanceId;
    em.status = "Dispatched"; em.dispatchedAt = new Date();
    await em.save();
    if (ambulanceId) await Ambulance.findByIdAndUpdate(ambulanceId, { status:"Dispatched" });
    await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("emergencyDispatched", em.toObject());
    res.json(em);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
