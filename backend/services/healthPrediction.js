const Hospital        = require("../models/Hospital");
const PatientTransfer = require("../models/PatientTransfer");
const ResourceAlert   = require("../models/ResourceAlert");
const EmergencyRequest= require("../models/EmergencyRequest");

async function predictICUDemand() {
  const hospitals = await Hospital.find().lean();
  return hospitals.map(h => {
    const r    = h.resources;
    const util = r.icuBeds.total > 0 ? ((r.icuBeds.total - r.icuBeds.available) / r.icuBeds.total) * 100 : 0;
    let risk = "Low", hrs = null, rec = "";
    if (util >= 100) { risk = "Critical"; rec = "ICU at capacity — initiate transfer protocol immediately."; }
    else if (util >= 90) { risk = "High"; hrs = Math.max(1, Math.round((100-util)/2)); rec = `ICU nearly full (~${hrs}h to capacity). Prepare transfer list.`; }
    else if (util >= 75) { risk = "Medium"; rec = "ICU above 75%. Monitor closely, prepare contingency."; }
    else { rec = "ICU capacity stable."; }
    return {
      hospitalId: h._id, hospitalName: h.name, city: h.location?.city||"",
      icuUtilization: parseFloat(util.toFixed(1)), riskLevel: risk, hoursToCapacity: hrs,
      recommendation: rec, alertLevel: h.alertLevel,
      oxygenRisk:  (r.oxygenLevel||100)<20?"Critical":(r.oxygenLevel||100)<40?"High":"Low",
      ventRisk:    r.ventilators.total>0&&r.ventilators.available===0?"Critical":r.ventilators.available<=2?"High":"Low",
    };
  }).sort((a,b)=>({Critical:0,High:1,Medium:2,Low:3})[a.riskLevel]-({Critical:0,High:1,Medium:2,Low:3})[b.riskLevel]);
}

async function getCityHealth() {
  const [hospitals, transfers, alerts, emergencies] = await Promise.all([
    Hospital.find().lean(),
    PatientTransfer.find({ createdAt:{ $gte: new Date(Date.now()-86400000) } }).lean(),
    ResourceAlert.find({ resolved:false }).lean(),
    EmergencyRequest.find({ createdAt:{ $gte: new Date(Date.now()-86400000) } }).lean(),
  ]);
  let tICU=0,aICU=0,tBed=0,aBed=0,critH=0;
  for (const h of hospitals) {
    tICU+=h.resources.icuBeds.total||0; aICU+=h.resources.icuBeds.available||0;
    tBed+=h.resources.generalBeds.total||0; aBed+=h.resources.generalBeds.available||0;
    if (h.alertLevel==="Red") critH++;
  }
  const icuP  = tICU>0  ? parseFloat(((1-aICU/tICU)*100).toFixed(1))  : 0;
  const bedP  = tBed>0  ? parseFloat(((1-aBed/tBed)*100).toFixed(1))  : 0;
  const score = Math.max(0, Math.round(100 - icuP*0.4 - bedP*0.2 - critH*10 - alerts.length*2));
  return {
    healthScore: score, icuPressure: icuP, bedPressure: bedP,
    criticalHospitals: critH, activeAlerts: alerts.length,
    transfersToday: transfers.length, emergenciesToday: emergencies.length,
    totalHospitals: hospitals.length,
    overwhelmed: hospitals.filter(h=>h.status==="Overwhelmed").length,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { predictICUDemand, getCityHealth };
