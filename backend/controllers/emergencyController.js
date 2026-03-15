/**
 * EMERGENCY CONTROLLER — Smart Ambulance Dispatch Flow
 */
const EmergencyRequest = require("../models/EmergencyRequest");
const Hospital         = require("../models/Hospital");
const Ambulance        = require("../models/Ambulance");
const calcDistance     = require("../utils/distance");

const AI_RECS = {
  Cardiac:     "ALS ambulance. Nearest cath lab. Aspirin if conscious. 12-lead ECG en route.",
  Stroke:      "Time critical — nearest stroke center. CT scan essential. Golden hour protocol.",
  Trauma:      "Trauma center required. Stabilize first. Multiple units if critical.",
  Respiratory: "Oxygen en route. ICU with ventilators. Check anaphylaxis.",
  Obstetric:   "Maternity unit. ALS + midwife. Check gestation week.",
  Pediatric:   "Pediatric ICU preferred. Weight-based dosing. Pediatric ALS.",
  Burns:       "Burns unit preferred. IV fluids en route. Cool water not ice.",
  Other:       "General assessment. Route to nearest available hospital.",
};

function scoreHosp(h, lat, lng, facs=[]) {
  const d = calcDistance(lat, lng, h.location.lat, h.location.lng);
  const r = h.resources||{};
  const icuA  = r.icuBeds?.total>0   ? r.icuBeds.available/r.icuBeds.total   : 0;
  const bedA  = r.generalBeds?.total>0? r.generalBeds.available/r.generalBeds.total: 0;
  const ventA = r.ventilators?.total>0? r.ventilators.available/r.ventilators.total: 0;
  const oxyOk = (r.oxygenLevel||100)>30 ? 1:0;
  const ok    = h.status==="Active"?1:h.status==="Overwhelmed"?0.3:0;
  const ds    = Math.max(0,1-d/50);
  let fb = 0;
  if(facs.includes("ICU")&&r.icuBeds?.available>0)      fb+=0.1;
  if(facs.includes("Ventilator")&&r.ventilators?.available>0) fb+=0.1;
  if(facs.includes("BloodBank")&&r.bloodBank)            fb+=0.05;
  if(facs.includes("Trauma")&&h.traumaCenter)            fb+=0.1;
  return { score:parseFloat((ds*0.4+icuA*0.2+bedA*0.1+ventA*0.1+oxyOk*0.05+fb)*ok).toFixed(3), distKm:parseFloat(d.toFixed(1)) };
}

async function nearestAmb(lat, lng) {
  const ambs = await Ambulance.find({ status:"Available" }).lean();
  if(!ambs.length) return null;
  return ambs.map(a=>({...a,dist:calcDistance(lat,lng,a.location?.lat||0,a.location?.lng||0)})).sort((a,b)=>a.dist-b.dist)[0];
}

exports.create = async (req, res) => {
  try {
    const { type, severity, patientName, patientAge, patientPhone, description, lat, lng, address, requiredFacilities, reporterName, reporterPhone } = req.body;
    if (!lat||!lng) return res.status(400).json({ message:"Location required" });
    const pLat=parseFloat(lat), pLng=parseFloat(lng);
    const count = await EmergencyRequest.countDocuments();
    const requestId = `EMG-${String(count+1).padStart(5,"0")}`;
    const aiRec = AI_RECS[type]||AI_RECS.Other;
    const facs = Array.isArray(requiredFacilities)?requiredFacilities:[];

    const hospitals = await Hospital.find({ status:{$ne:"Offline"} }).lean();
    const bestH = hospitals.map(h=>{ const {score,distKm}=scoreHosp(h,pLat,pLng,facs); return{...h,_score:+score,_distKm:distKm}; }).sort((a,b)=>b._score-a._score)[0];
    const amb   = await nearestAmb(pLat, pLng);

    const em = await EmergencyRequest.create({
      requestId, type:type||"Other", severity:severity||"Medium",
      patientName:patientName||"Unknown", patientAge:+patientAge||0,
      patientPhone:patientPhone||"", description:description||"",
      requiredFacilities:facs,
      location:{lat:pLat,lng:pLng,address:address||""},
      reportedBy:req.user?.id||null, reporterName:reporterName||req.user?.name||"", reporterPhone:reporterPhone||"",
      assignedHospital:bestH?._id||null, assignedAmbulance:amb?._id||null,
      status: amb?"AmbulanceRequested":"Reported",
      aiRecommendation:aiRec,
    });
    await em.populate(["assignedHospital","assignedAmbulance"]);

    const io = req.app.get("io");
    io?.emit("newEmergencyRequest",{ request:em.toObject(), bestHospital:bestH?.name, nearestAmbulance:amb?.ambulanceId });
    if(amb) io?.emit(`ambulance:${amb.ambulanceId}:dispatch`,{ emergency:em.toObject(), hospital:bestH, instruction:"New emergency — accept to confirm" });
    if(bestH) {
      const eta = amb ? Math.round((amb.dist/60)*60) : null;
      io?.emit(`hospital:${bestH._id}:alert`,{ type:"INCOMING_PATIENT", emergency:em.toObject(), eta, message:`🚨 Incoming ${type||"emergency"} patient. ETA: ~${eta||"?"}min. ${aiRec}` });
    }
    res.status(201).json(em);
  } catch(e){ res.status(400).json({ error:e.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const filter={};
    if(req.query.status)     filter.status=req.query.status;
    if(req.query.severity)   filter.severity=req.query.severity;
    if(req.query.hospitalId) filter.assignedHospital=req.query.hospitalId;
    const list = await EmergencyRequest.find(filter)
      .populate("assignedHospital","name location.city contact.emergency")
      .populate("assignedAmbulance","ambulanceId name driver driverPhone location status")
      .sort({createdAt:-1}).limit(200).lean();
    res.json(list);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const em = await EmergencyRequest.findById(req.params.id).populate("assignedHospital").populate("assignedAmbulance");
    if(!em) return res.status(404).json({ message:"Not found" });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.ambulanceAccept = async (req, res) => {
  try {
    const em = await EmergencyRequest.findById(req.params.id);
    if(!em) return res.status(404).json({ message:"Not found" });
    em.status="AmbulanceAccepted"; em.ambulanceAcceptedAt=new Date();
    if(req.body.ambulanceObjectId) {
      em.assignedAmbulance=req.body.ambulanceObjectId;
      await Ambulance.findByIdAndUpdate(req.body.ambulanceObjectId,{status:"Dispatched"});
    }
    await em.save(); await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("emergencyUpdate",em.toObject());
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.dispatch = async (req, res) => {
  try {
    const { hospitalId, ambulanceId } = req.body;
    const em = await EmergencyRequest.findById(req.params.id);
    if(!em) return res.status(404).json({ message:"Not found" });
    if(hospitalId)  em.assignedHospital=hospitalId;
    if(ambulanceId){ em.assignedAmbulance=ambulanceId; await Ambulance.findByIdAndUpdate(ambulanceId,{status:"Dispatched"}); }
    em.status="AmbulanceAccepted"; em.dispatchedAt=new Date();
    await em.save(); await em.populate(["assignedHospital","assignedAmbulance"]);
    const io=req.app.get("io");
    io?.emit("emergencyUpdate",em.toObject());
    if(hospitalId) io?.emit(`hospital:${hospitalId}:alert`,{ type:"INCOMING_PATIENT", emergency:em.toObject(), eta:15, message:`🚨 Incoming ${em.type} patient ~15min. ${em.aiRecommendation}` });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const em = await EmergencyRequest.findById(req.params.id);
    if(!em) return res.status(404).json({ message:"Not found" });
    em.status=status;
    if(status==="EnRoute")               em.dispatchedAt=new Date();
    if(status==="OnScene")               em.arrivedAtPatientAt=new Date();
    if(status==="TransportingToHospital")
      req.app.get("io")?.emit(`hospital:${em.assignedHospital}:alert`,{ type:"AMBULANCE_ARRIVING", emergency:em.toObject(), eta:10, message:`🚑 Ambulance arriving ~10min with ${em.type} patient (${em.severity})` });
    if(status==="Resolved"){ em.resolvedAt=new Date(); em.responseTimeMinutes=em.dispatchedAt?Math.round((Date.now()-em.dispatchedAt)/60000):0; if(em.assignedAmbulance) await Ambulance.findByIdAndUpdate(em.assignedAmbulance,{status:"Available"}); }
    if(notes) em.notes.push({text:notes,by:req.user?.name||"System"});
    await em.save(); await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("emergencyUpdate",em.toObject());
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getNearbyHospitals = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if(!lat||!lng) return res.status(400).json({ message:"lat, lng required" });
    const hospitals = await Hospital.find({ status:{$ne:"Offline"} }).lean();
    const nearby = hospitals.map(h=>({...h,distKm:parseFloat(calcDistance(+lat,+lng,h.location.lat,h.location.lng).toFixed(1))})).sort((a,b)=>a.distKm-b.distKm).slice(0,20);
    res.json(nearby);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.trackEmergency = async (req, res) => {
  try {
    const em = await EmergencyRequest.findOne({ requestId:req.params.requestId })
      .populate("assignedHospital","name location contact")
      .populate("assignedAmbulance","ambulanceId name location status speed driver driverPhone");
    if(!em) return res.status(404).json({ message:"Not found" });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};
