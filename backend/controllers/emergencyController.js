/**
 * EMERGENCY CONTROLLER — Full edge case handling
 * Edge cases: No ambulance (queue), no capacity (expand), duplicate detection,
 * AI triage upgrade, hospital rejection, patient not found
 */
const EmergencyRequest = require("../models/EmergencyRequest");
const Hospital         = require("../models/Hospital");
const Ambulance        = require("../models/Ambulance");
const calcDistance     = require("../utils/distance");
const geocoding        = require("../services/geocodingService");

const AI_RECS = {
  Cardiac:    "ALS ambulance. Nearest cath lab. Aspirin if conscious. 12-lead ECG en route.",
  Stroke:     "Time critical — nearest stroke center. CT scan essential. Golden hour protocol.",
  Trauma:     "Trauma center. Stabilize first. Multiple units if critical.",
  Respiratory:"Oxygen en route. ICU with ventilators. Check anaphylaxis.",
  Obstetric:  "Maternity unit. ALS + midwife. Check gestation week.",
  Pediatric:  "Pediatric ICU preferred. Weight-based dosing. Pediatric ALS.",
  Burns:      "Burns unit preferred. IV fluids en route. Cool water not ice.",
  Other:      "General assessment. Route to nearest available hospital.",
};

// AI triage: auto-upgrade severity based on description keywords
const CRITICAL_KEYWORDS = ["unconscious","not breathing","no pulse","cardiac arrest","stroke","seizure","drowning","gunshot","stabbed","bleeding heavily","unresponsive"];
const HIGH_KEYWORDS      = ["chest pain","difficulty breathing","severe pain","head injury","broken","fracture","vomiting blood","burn"];

function aiTriageSeverity(description, selectedSeverity) {
  const desc = (description||"").toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => desc.includes(k))) return "Critical";
  if (HIGH_KEYWORDS.some(k => desc.includes(k))) {
    if (selectedSeverity === "Low" || selectedSeverity === "Medium") return "High";
  }
  return selectedSeverity;
}

// Score hospital — Tiered routing (Tier1 first for Critical)
function scoreHosp(h, lat, lng, facs=[], severity="Medium") {
  const d = calcDistance(lat, lng, h.location.lat, h.location.lng);
  const r = h.resources||{};
  if (r.staleness > 12) return { score:0, distKm:parseFloat(d.toFixed(1)) }; // stale data
  const icuA  = r.icuBeds?.total>0   ? r.icuBeds.available/r.icuBeds.total   : 0;
  const bedA  = r.generalBeds?.total>0? r.generalBeds.available/r.generalBeds.total: 0;
  const ventA = r.ventilators?.total>0? r.ventilators.available/r.ventilators.total: 0;
  const oxyOk = (r.oxygenLevel||100)>30 ? 1:0;
  const statusMul = h.status==="Active"?1:h.status==="Overwhelmed"?0.2:0;
  const ds    = Math.max(0, 1-d/100);
  let fb = 0;
  if(facs.includes("ICU")&&r.icuBeds?.available>0)           fb+=0.12;
  if(facs.includes("Ventilator")&&r.ventilators?.available>0) fb+=0.12;
  if(facs.includes("BloodBank")&&r.bloodBank)                 fb+=0.06;
  if(facs.includes("Trauma")&&h.traumaCenter)                 fb+=0.12;
  // Tier bonus for critical
  const tierBonus = (severity==="Critical"&&h.tier==="Tier1")?0.15 : (h.tier==="Tier2")?0.05 : 0;
  // Trust score bonus
  const trustBonus = ((h.trustScore||75)-75)/1000;
  const score = (ds*0.38 + icuA*0.22 + bedA*0.10 + ventA*0.10 + oxyOk*0.05 + fb + tierBonus + trustBonus) * statusMul;
  return { score:parseFloat(score.toFixed(3)), distKm:parseFloat(d.toFixed(1)) };
}

// Find best hospital with expanding radius (Edge case: no nearby capacity)
async function findBestHospital(pLat, pLng, facs, severity) {
  const hospitals = await Hospital.find({ status:{$ne:"Offline"} }).lean();
  if (!hospitals.length) return null;
  // Initial scoring
  let scored = hospitals
    .map(h=>{ const {score,distKm}=scoreHosp(h,pLat,pLng,facs,severity); return{...h,_score:score,_distKm:distKm}; })
    .filter(h=>h._score>0)
    .sort((a,b)=>b._score-a._score);
  if (scored.length) return scored[0];
  // Edge case: no hospital with capacity — expand search, accept any active
  return hospitals.map(h=>({...h,_distKm:calcDistance(pLat,pLng,h.location.lat,h.location.lng)})).sort((a,b)=>a._distKm-b._distKm)[0];
}

// Find nearest ambulance
async function findNearestAmb(lat, lng) {
  const ambs = await Ambulance.find({ status:"Available" }).lean();
  if(!ambs.length) return null;
  return ambs.map(a=>({...a,dist:calcDistance(lat,lng,a.location?.lat||0,a.location?.lng||0)})).sort((a,b)=>a.dist-b.dist)[0];
}

// Duplicate detection (Edge case: same user submits twice within 2 min)
async function checkDuplicate(lat, lng, phone, withinMs=120000) {
  const since = new Date(Date.now()-withinMs);
  const existing = await EmergencyRequest.findOne({
    $or:[
      { reporterPhone:phone, phone:{$ne:""}, createdAt:{$gte:since} },
      { "location.lat":{$gte:lat-0.001,$lte:lat+0.001}, "location.lng":{$gte:lng-0.001,$lte:lng+0.001}, createdAt:{$gte:since}, status:{$nin:["Resolved","Cancelled"]} },
    ]
  }).sort({createdAt:-1});
  return existing;
}

// ── PUBLIC: Create emergency ──────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { type, severity, patientName, patientAge, patientPhone, description,
            lat, lng, address, locationName, requiredFacilities, reporterName, reporterPhone } = req.body;
    if (!lat||!lng) return res.status(400).json({ message:"Location required" });
    const pLat=parseFloat(lat), pLng=parseFloat(lng);

    // Duplicate check (Edge case #5)
    const dup = await checkDuplicate(pLat, pLng, reporterPhone||"");
    if (dup) {
      return res.status(200).json({ 
        isDuplicate:true, existingRequest:dup, 
        message:"A similar emergency request was submitted recently. Track your existing request.",
        requestId: dup.requestId
      });
    }

    // AI Triage (Edge case #8 — auto-upgrade severity)
    const aiSeverity   = aiTriageSeverity(description, severity);
    const finalSeverity= aiSeverity;
    const aiRec        = AI_RECS[type]||AI_RECS.Other;
    const facs         = Array.isArray(requiredFacilities)?requiredFacilities:[];

    // Reverse geocode location name
    let resolvedLocationName = locationName || address || "";
    if (!resolvedLocationName && pLat && pLng) {
      try {
        const geo = await geocoding.reverseGeocode(pLat, pLng);
        resolvedLocationName = geo?.shortName || `${pLat.toFixed(4)},${pLng.toFixed(4)}`;
      } catch(e) {}
    }

    const count     = await EmergencyRequest.countDocuments();
    const requestId = `EMG-${String(count+1).padStart(5,"0")}`;
    const bestH     = await findBestHospital(pLat, pLng, facs, finalSeverity);
    const amb       = await findNearestAmb(pLat, pLng);

    // Edge case: No ambulance available — queue it
    let status = "Reported";
    let queuePos = 0;
    if (amb) {
      status = "AmbulanceRequested";
    } else {
      status   = "Queued";
      queuePos = await EmergencyRequest.countDocuments({ status:"Queued" }) + 1;
    }

    const em = await EmergencyRequest.create({
      requestId, type:type||"Other", severity:finalSeverity,
      aiTriageSeverity: aiSeverity !== severity ? aiSeverity : null,
      patientName:patientName||"Unknown", patientAge:+patientAge||0,
      patientPhone:patientPhone||"", description:description||"",
      requiredFacilities:facs,
      location:{ lat:pLat, lng:pLng, address:address||"", locationName:resolvedLocationName },
      reportedBy:req.user?.id||null, reporterName:reporterName||"", reporterPhone:reporterPhone||"",
      assignedHospital:bestH?._id||null, assignedAmbulance:amb?._id||null,
      status, queuePosition:queuePos, queuedAt:queuePos?new Date():null,
      aiRecommendation:aiRec,
    });

    await em.populate(["assignedHospital","assignedAmbulance"]);

    const io = req.app.get("io");
    io?.emit("newEmergencyRequest",{ request:em.toObject(), bestHospital:bestH?.name, nearestAmbulance:amb?.ambulanceId, queued:!amb });

    if (amb) io?.emit(`ambulance:${amb.ambulanceId}:dispatch`,{ emergency:em.toObject(), hospital:bestH, instruction:"New emergency dispatch" });
    if (bestH) {
      const eta = amb ? Math.round((amb.dist||5)/60*60) : null;
      io?.emit(`hospital:${bestH._id}:alert`,{
        type:"INCOMING_PATIENT", emergency:em.toObject(), eta,
        message:`🚨 Incoming ${finalSeverity} ${type} patient${eta?` ETA ~${eta}min`:""} · ${resolvedLocationName}`
      });
      // Notify admin if hospital data stale (Edge case #7)
      if ((Date.now()-new Date(bestH.lastUpdated||0))/3600000 > 6) {
        io?.emit("resourceAlert",{ hospitalId:bestH._id, hospitalName:bestH.name, message:`⚠ Resource data outdated (${Math.round((Date.now()-new Date(bestH.lastUpdated))/3600000)}h old). Please update.`, severity:"High", alertType:"StaleData" });
      }
    }

    // Notify admin if queued
    if (!amb) {
      io?.emit("adminAlert",{ type:"NO_AMBULANCE", message:`⚠ Emergency ${requestId} queued — no ambulances available. Queue position: ${queuePos}`, severity:"Critical", requestId });
    }

    res.status(201).json({ ...em.toObject(), wasTriageUpgraded: aiSeverity !== severity, queuePosition:queuePos });
  } catch(e){ res.status(400).json({ error:e.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const filter={};
    if(req.query.status)     filter.status=req.query.status;
    if(req.query.severity)   filter.severity=req.query.severity;
    if(req.query.hospitalId) filter.assignedHospital=req.query.hospitalId;
    const list = await EmergencyRequest.find(filter)
      .populate("assignedHospital","name location.city location.address contact.emergency")
      .populate("assignedAmbulance","ambulanceId name driver driverPhone location status speed")
      .sort({createdAt:-1}).limit(200).lean();
    res.json(list);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const em = await EmergencyRequest.findById(req.params.id)
      .populate("assignedHospital").populate("assignedAmbulance");
    if(!em) return res.status(404).json({ message:"Not found" });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Ambulance accepts dispatch
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

// Manual dispatch by operator
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
    if(hospitalId) io?.emit(`hospital:${hospitalId}:alert`,{ type:"INCOMING_PATIENT", emergency:em.toObject(), eta:15, message:`🚨 Incoming ${em.severity} ${em.type} patient ~15min. ${em.aiRecommendation}` });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Hospital rejects patient → AI reassigns (Edge case #13)
exports.hospitalReject = async (req, res) => {
  try {
    const { reason } = req.body;
    const em = await EmergencyRequest.findById(req.params.id).populate("assignedHospital");
    if(!em) return res.status(404).json({ message:"Not found" });
    const io = req.app.get("io");

    // Log rejection — affects trust score
    const rejH = em.assignedHospital;
    if (rejH) {
      em.rejectedByHospitals.push({ hospitalId:rejH._id.toString(), hospitalName:rejH.name, reason:reason||"Capacity", at:new Date() });
      // Decrease trust score for rejection
      await require("../models/Hospital").findByIdAndUpdate(rejH._id, { $inc:{rejectionCount:1,trustScore:-3,incentivePoints:-2} });
      io?.emit("adminAlert",{ type:"HOSPITAL_REJECTION", message:`🚫 ${rejH.name} rejected ${em.type} patient — AI reassigning`, severity:"High", requestId:em.requestId });
    }

    // Find next best hospital excluding rejected ones
    const rejected = em.rejectedByHospitals.map(r=>r.hospitalId);
    const hospitals = await require("../models/Hospital").find({ status:{$ne:"Offline"}, _id:{$nin:rejected} }).lean();
    const next = hospitals.map(h=>{ const {score,distKm}=scoreHosp(h,em.location.lat,em.location.lng,[],em.severity); return{...h,_score:score,_distKm:distKm}; }).sort((a,b)=>b._score-a._score)[0];
    if (next) {
      em.assignedHospital=next._id;
      io?.emit(`hospital:${next._id}:alert`,{ type:"INCOMING_PATIENT", emergency:em.toObject(), message:`🚨 Patient redirected to you. ${rejH?.name||""} was full. ${em.aiRecommendation}` });
    }
    await em.save(); await em.populate(["assignedHospital","assignedAmbulance"]);
    io?.emit("emergencyUpdate",em.toObject());
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Patient not found (Edge case #12)
exports.patientNotFound = async (req, res) => {
  try {
    const em = await EmergencyRequest.findById(req.params.id);
    if(!em) return res.status(404).json({ message:"Not found" });
    em.status="PatientNotFound";
    em.notes.push({text:"Driver reported patient not found. Awaiting citizen location confirmation.",by:"Ambulance Driver"});
    await em.save();
    req.app.get("io")?.emit("emergencyUpdate",em.toObject());
    req.app.get("io")?.emit("citizenAlert",{ requestId:em.requestId, message:"🚑 Ambulance arrived but couldn't find you. Please confirm your exact location.", type:"PATIENT_NOT_FOUND" });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Generic status update
exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const em = await EmergencyRequest.findById(req.params.id);
    if(!em) return res.status(404).json({ message:"Not found" });
    em.status=status;
    if(status==="EnRoute")   em.dispatchedAt=new Date();
    if(status==="OnScene")   em.arrivedAtPatientAt=new Date();
    if(status==="TransportingToHospital")
      req.app.get("io")?.emit(`hospital:${em.assignedHospital}:alert`,{ type:"AMBULANCE_ARRIVING", emergency:em.toObject(), eta:10, message:`🚑 Ambulance arriving ~10min with ${em.severity} ${em.type} patient` });
    if(status==="Resolved"){
      em.resolvedAt=new Date();
      em.responseTimeMinutes=em.dispatchedAt?Math.round((Date.now()-em.dispatchedAt)/60000):0;
      if(em.assignedAmbulance) await Ambulance.findByIdAndUpdate(em.assignedAmbulance,{status:"Available"});
      // Update hospital trust score — positive for successful acceptance
      if(em.assignedHospital) await require("../models/Hospital").findByIdAndUpdate(em.assignedHospital,{$inc:{incentivePoints:5,trustScore:1}});
      // Process queue — dispatch next queued emergency
      const nextQueued = await EmergencyRequest.findOne({status:"Queued"}).sort({queuedAt:1});
      if (nextQueued) {
        const nextAmb = await findNearestAmb(nextQueued.location.lat, nextQueued.location.lng);
        if (nextAmb) {
          nextQueued.assignedAmbulance=nextAmb._id; nextQueued.status="AmbulanceRequested"; nextQueued.queuePosition=0;
          await nextQueued.save();
          req.app.get("io")?.emit("queueUpdate",{ requestId:nextQueued.requestId, message:"Ambulance now available and assigned to your request!" });
          req.app.get("io")?.emit(`ambulance:${nextAmb.ambulanceId}:dispatch`,{ emergency:nextQueued.toObject(), instruction:"Queued emergency now dispatching" });
        }
      }
    }
    if(notes) em.notes.push({text:notes,by:req.user?.name||"System"});
    await em.save(); await em.populate(["assignedHospital","assignedAmbulance"]);
    req.app.get("io")?.emit("emergencyUpdate",em.toObject());
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Public: nearby hospitals with location names
exports.getNearbyHospitals = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if(!lat||!lng) return res.status(400).json({ message:"lat, lng required" });
    const hospitals = await Hospital.find({ status:{$ne:"Offline"} }).lean();
    const nearby = hospitals
      .map(h=>({...h, distKm:parseFloat(calcDistance(+lat,+lng,h.location.lat,h.location.lng).toFixed(1))}))
      .sort((a,b)=>a.distKm-b.distKm).slice(0,20);
    res.json(nearby);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Public: track by requestId (shareable URL)
exports.trackEmergency = async (req, res) => {
  try {
    const em = await EmergencyRequest.findOne({ requestId:req.params.requestId })
      .populate("assignedHospital","name location contact")
      .populate("assignedAmbulance","ambulanceId name location status speed driver driverPhone");
    if(!em) return res.status(404).json({ message:"Emergency not found. Check your Request ID." });
    res.json(em);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Geocode a lat/lng to location name (public)
exports.geocodeLocation = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if(!lat||!lng) return res.status(400).json({ message:"lat,lng required" });
    const geo = await geocoding.reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json(geo || { shortName:`${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}` });
  } catch(e){ res.status(200).json({ shortName:`${lat},${lng}` }); }
};
