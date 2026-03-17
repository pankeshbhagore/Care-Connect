const Hospital       = require("../models/Hospital");
const PatientTransfer= require("../models/PatientTransfer");
const ResourceAlert  = require("../models/ResourceAlert");
const calcDistance   = require("../utils/distance");

// ── AI Hospital Scoring ──────────────────────────────────────
function scoreHospital(h, pLat, pLng, specialty) {
  const dist    = calcDistance(pLat, pLng, h.location.lat, h.location.lng);
  const r       = h.resources;
  const icuA    = r.icuBeds.total    > 0 ? r.icuBeds.available    / r.icuBeds.total    : 0;
  const bedA    = r.generalBeds.total> 0 ? r.generalBeds.available/ r.generalBeds.total: 0;
  const ventA   = r.ventilators.total> 0 ? r.ventilators.available/ r.ventilators.total: 0;
  const oxyOk   = (r.oxygenLevel || 100) > 30 ? 1 : 0;
  const statOk  = h.status === "Active" ? 1 : h.status === "Overwhelmed" ? 0.3 : 0;
  const specB   = specialty && h.specialties?.includes(specialty) ? 0.15 : 0;
  const distS   = Math.max(0, 1 - dist / 50);
  const score   = (distS*0.40 + icuA*0.25 + bedA*0.15 + ventA*0.10 + oxyOk*0.05 + specB) * statOk;
  return { score: parseFloat(score.toFixed(3)), distKm: parseFloat(dist.toFixed(1)) };
}

// ── Auto-generate resource alerts ────────────────────────────
async function checkAlerts(hospital, io) {
  const r = hospital.resources;
  const checks = [
    { cond: r.icuBeds.available === 0,          type:"BedShortage",       sev:"Critical", msg:`${hospital.name}: ICU beds FULL` },
    { cond: r.icuBeds.available>0 && r.icuBeds.available<=2, type:"BedShortage", sev:"High", msg:`${hospital.name}: Only ${r.icuBeds.available} ICU beds left` },
    { cond: (r.oxygenLevel||100) < 20,          type:"OxygenLow",         sev:"Critical", msg:`${hospital.name}: Oxygen critically low (${r.oxygenLevel}%)` },
    { cond: (r.oxygenLevel||100)>=20&&(r.oxygenLevel||100)<35, type:"OxygenLow", sev:"High", msg:`${hospital.name}: Oxygen low (${r.oxygenLevel}%)` },
    { cond: r.ventilators.available===0&&r.ventilators.total>0, type:"VentilatorShortage", sev:"High", msg:`${hospital.name}: No ventilators available` },
    { cond: r.doctorsOnDuty < 2,                type:"StaffShortage",     sev:"High",     msg:`${hospital.name}: Critical doctor shortage` },
    { cond: hospital.status === "Overwhelmed",  type:"Overload",          sev:"Critical", msg:`${hospital.name}: Hospital overwhelmed` },
  ];
  for (const c of checks) {
    if (!c.cond) continue;
    const exists = await ResourceAlert.findOne({ hospital: hospital._id, alertType: c.type, resolved: false });
    if (exists) continue;
    const alert = await ResourceAlert.create({ hospital: hospital._id, alertType: c.type, severity: c.sev, resource: c.type, message: c.msg });
    if (io) io.emit("resourceAlert", { hospitalId: hospital._id, hospitalName: hospital.name, ...alert.toObject() });
  }
}

// ── GET ALL ──────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.city)  filter["location.city"] = new RegExp(req.query.city, "i");
    if (req.query.status) filter.status = req.query.status;
    if (req.query.alert)  filter.alertLevel = req.query.alert;
    res.json(await Hospital.find(filter).sort({ name: 1 }).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── GET ONE ──────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const h = await Hospital.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ message: "Not found" });
    res.json(h);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── CREATE ───────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const count = await Hospital.countDocuments();
    const hospitalId = `HOSP-${String(count + 1).padStart(4, "0")}`;
    const hospital = await Hospital.create({ ...req.body, hospitalId, registeredBy: req.user?.id || null });
    req.app.get("io")?.emit("hospitalAdded", hospital);
    res.status(201).json(hospital);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// ── UPDATE RESOURCES (live) ──────────────────────────────────
exports.updateResources = async (req, res) => {
  try {
    const { resources, status, updatedBy } = req.body;
    const h = await Hospital.findById(req.params.id);
    if (!h) return res.status(404).json({ message: "Not found" });

    if (resources) {
      for (const [key, val] of Object.entries(resources)) {
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
          for (const [k2, v2] of Object.entries(val)) {
            if (h.resources[key] !== undefined) h.resources[key][k2] = v2;
          }
        } else { h.resources[key] = val; }
      }
    }
    if (status) h.status = status;
    if (updatedBy) h.updatedBy = updatedBy;
    h.lastUpdated = new Date();

    // Auto alert level
    const r = h.resources;
    const util = r.icuBeds.total > 0 ? (r.icuBeds.total - r.icuBeds.available) / r.icuBeds.total : 0;
    if (h.status === "Overwhelmed" || util >= 1) h.alertLevel = "Red";
    else if (util >= 0.90) h.alertLevel = "Orange";
    else if (util >= 0.75) h.alertLevel = "Yellow";
    else h.alertLevel = "Normal";

    await h.save();
    const io = req.app.get("io");
    await checkAlerts(h, io);
    io?.emit("hospitalResourceUpdate", { hospitalId: h._id, name: h.name, resources: h.resources, status: h.status, alertLevel: h.alertLevel, lastUpdated: h.lastUpdated });
    res.json(h);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── FULL UPDATE ──────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const h = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!h) return res.status(404).json({ message: "Not found" });
    res.json(h);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// ── DELETE ───────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    await Hospital.findByIdAndDelete(req.params.id);
    req.app.get("io")?.emit("hospitalDeleted", { id: req.params.id });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── AI RECOMMEND ─────────────────────────────────────────────
exports.recommend = async (req, res) => {
  try {
    const { lat, lng, specialty } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: "lat, lng required" });
    const pLat = parseFloat(lat), pLng = parseFloat(lng);
    const hospitals = await Hospital.find({ status: { $ne: "Offline" } }).lean();
    const scored = hospitals
      .map(h => { const { score, distKm } = scoreHospital(h, pLat, pLng, specialty); return { ...h, _score: score, _distKm: distKm }; })
      .sort((a, b) => b._score - a._score).slice(0, 5);
    res.json({ recommendations: scored, top: scored[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── NEARBY ───────────────────────────────────────────────────
exports.nearby = async (req, res) => {
  try {
    const { lat, lng, radius = 100 } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: "lat, lng required" });
    const hospitals = await Hospital.find({ status: { $ne: "Offline" } }).lean();
    const nearby = hospitals
      .map(h => ({ ...h, distKm: parseFloat(calcDistance(parseFloat(lat), parseFloat(lng), h.location.lat, h.location.lng).toFixed(1)) }))
      .filter(h => h.distKm <= parseFloat(radius))
      .sort((a, b) => a.distKm - b.distKm);
    res.json(nearby);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── DASHBOARD SUMMARY ────────────────────────────────────────
exports.summary = async (req, res) => {
  try {
    const hospitals = await Hospital.find().lean();
    let tICU=0,aICU=0,tBed=0,aBed=0,tVent=0,aVent=0,tAmb=0,aAmb=0,oxyLow=0;
    for (const h of hospitals) {
      const r = h.resources;
      tICU+=r.icuBeds.total||0;    aICU+=r.icuBeds.available||0;
      tBed+=r.generalBeds.total||0; aBed+=r.generalBeds.available||0;
      tVent+=r.ventilators.total||0; aVent+=r.ventilators.available||0;
      tAmb+=r.ambulancesTotal||0;   aAmb+=r.ambulancesAvailable||0;
      if ((r.oxygenLevel||100)<25) oxyLow++;
    }
    const activeAlerts     = await ResourceAlert.countDocuments({ resolved: false });
    const pendingTransfers = await PatientTransfer.countDocuments({ status: "Requested" });
    res.json({
      total: hospitals.length,
      active: hospitals.filter(h=>h.status==="Active").length,
      overwhelmed: hospitals.filter(h=>h.status==="Overwhelmed").length,
      icuBeds:    { total:tICU, available:aICU, utilization: tICU>0?parseFloat(((1-aICU/tICU)*100).toFixed(1)):0 },
      generalBeds:{ total:tBed, available:aBed, utilization: tBed>0?parseFloat(((1-aBed/tBed)*100).toFixed(1)):0 },
      ventilators:{ total:tVent, available:aVent },
      ambulances: { total:tAmb, available:aAmb },
      oxyLow, activeAlerts, pendingTransfers,
      alertBreakdown: {
        Red:    hospitals.filter(h=>h.alertLevel==="Red").length,
        Orange: hospitals.filter(h=>h.alertLevel==="Orange").length,
        Yellow: hospitals.filter(h=>h.alertLevel==="Yellow").length,
        Normal: hospitals.filter(h=>h.alertLevel==="Normal").length,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── ALERTS ───────────────────────────────────────────────────
exports.getAlerts = async (req, res) => {
  try {
    const alerts = await ResourceAlert.find({ resolved: false })
      .populate("hospital", "name location.city alertLevel")
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.resolveAlert = async (req, res) => {
  try {
    const a = await ResourceAlert.findByIdAndUpdate(req.params.id, { resolved: true, resolvedAt: new Date() }, { new: true });
    if (!a) return res.status(404).json({ message: "Not found" });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── PUBLIC: Citizens can see hospital list with resources ─────
exports.getPublicList = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ status:{ $ne:"Offline" } })
      .select("name type level location contact resources status alertLevel specialties traumaCenter lastUpdated")
      .sort({ name:1 }).lean();
    res.json(hospitals);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getPublicOne = async (req, res) => {
  try {
    const h = await Hospital.findById(req.params.id)
      .select("name type level location contact resources status alertLevel specialties traumaCenter avgPatientWait lastUpdated")
      .lean();
    if(!h) return res.status(404).json({ message:"Not found" });
    res.json(h);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// ── Hospital Trust Score ──────────────────────────────────────
exports.getTrustScores = async (req, res) => {
  try {
    const hospitals = await Hospital.find().select("name type tier trustScore acceptanceRate rejectionCount incentivePoints govRegistration alertLevel").lean();
    res.json(hospitals.sort((a,b)=>b.trustScore-a.trustScore));
  } catch(e){ res.status(500).json({ error:e.message }); }
};

// Resource staleness check and auto-alert
exports.checkStaleness = async () => {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const hospitals = await Hospital.find().lean();
  const stale = hospitals.filter(h => (Date.now()-new Date(h.lastUpdated||0)) > SIX_HOURS);
  return stale.map(h=>({ _id:h._id, name:h.name, lastUpdated:h.lastUpdated, hoursStale:Math.round((Date.now()-new Date(h.lastUpdated||0))/3600000) }));
};

// Government integration stats
exports.getGovStats = async (req, res) => {
  try {
    const hospitals = await Hospital.find().lean();
    res.json({
      total: hospitals.length,
      ayushmanEmpanelled: hospitals.filter(h=>h.govRegistration?.ayushmanEmpanelled).length,
      nhm:                hospitals.filter(h=>h.govRegistration?.nhm).length,
      emergencyService:   hospitals.filter(h=>h.govRegistration?.emergencyService).length,
      tier1:  hospitals.filter(h=>h.tier==="Tier1").length,
      tier2:  hospitals.filter(h=>h.tier==="Tier2").length,
      tier3:  hospitals.filter(h=>h.tier==="Tier3").length,
      avgTrustScore: Math.round(hospitals.reduce((a,h)=>a+(h.trustScore||75),0)/Math.max(1,hospitals.length)),
    });
  } catch(e){ res.status(500).json({ error:e.message }); }
};
