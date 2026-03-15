import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

const pct = (a, t) => t > 0 ? Math.round((a/t)*100) : 0;
const barClr = p => p>50?"var(--green)":p>25?"var(--yellow)":"var(--red)";

function ResCard({ label, icon, available, total, color }) {
  const p = pct(available, total);
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-label">{icon} {label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, margin:"8px 0" }}>
        <span className="stat-value" style={{ color, fontSize:32 }}>{available}</span>
        <span style={{ fontSize:14, color:"var(--text-muted)" }}>/ {total}</span>
      </div>
      <div style={{ height:5, background:"var(--bg-primary)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${p}%`, height:"100%", background:barClr(p), borderRadius:3, transition:"width .4s" }}/>
      </div>
      <div className="stat-sub" style={{ marginTop:5 }}>{p}% available</div>
    </div>
  );
}

export default function HospitalOperatorDashboard({ hospitalId, onBack }) {
  const [hospital, setHospital]   = useState(null);
  const [emergencies, setEmergencies] = useState([]);
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("dashboard");
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [resources, setResources] = useState({});
  const [toast, setToast]         = useState(null);
  const [incomingAlert, setIncomingAlert] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const loadHospital = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const [h, e, a] = await Promise.all([
        api.get(`/hospitals/${hospitalId}`),
        api.get(`/emergencies?hospitalId=${hospitalId}`),
        api.get(`/hospitals/alerts?hospitalId=${hospitalId}`),
      ]);
      setHospital(h.data);
      setResources(h.data.resources || {});
      setEmergencies(e.data);
      setAlerts(a.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [hospitalId]);

  useEffect(() => { loadHospital(); const t=setInterval(loadHospital,30000); return()=>clearInterval(t); }, [loadHospital]);

  useEffect(() => {
    if (!hospitalId) return;
    socket.on("hospitalResourceUpdate", d => { if(d.hospitalId===hospitalId||d.hospitalId?.toString()===hospitalId) { loadHospital(); } });
    socket.on("resourceAlert", d => { if(d.hospitalId===hospitalId||d.hospitalId?.toString()===hospitalId) { loadHospital(); showToast("⚠️ "+d.message,"error"); } });
    socket.on(`hospital:${hospitalId}:alert`, d => {
      setIncomingAlert(d);
      showToast("🚨 " + d.message, "error");
    });
    socket.on("emergencyUpdate", d => { if(d.assignedHospital?._id===hospitalId||d.assignedHospital?.toString()===hospitalId) loadHospital(); });
    return()=>{ socket.off("hospitalResourceUpdate"); socket.off("resourceAlert"); socket.off(`hospital:${hospitalId}:alert`); socket.off("emergencyUpdate"); };
  }, [hospitalId, loadHospital]);

  const saveResources = async () => {
    setSaving(true);
    try {
      await api.put(`/hospitals/${hospitalId}/resources`, { resources, updatedBy: localStorage.getItem("name")||"Operator" });
      showToast("Resources updated ✓");
      setEditing(false);
      loadHospital();
    } catch(e) { showToast(e.message,"error"); }
    setSaving(false);
  };

  const setRes = (key, field, val) => setResources(p => ({ ...p, [key]: typeof p[key]==="object" ? {...p[key],[field]:+val} : +val }));

  const resolveAlert = async (id) => { try { await api.patch(`/hospitals/alerts/${id}/resolve`); loadHospital(); } catch(e) {} };

  if (loading) return <div style={{ textAlign:"center",padding:80,color:"var(--text-muted)" }}>Loading hospital dashboard…</div>;
  if (!hospital) return <div style={{ textAlign:"center",padding:80,color:"var(--red)" }}>Hospital not found or not assigned</div>;

  const r = hospital.resources || {};
  const ALERT_C = { Red:"var(--red)", Orange:"var(--orange)", Yellow:"var(--yellow)", Normal:"var(--green)" };
  const alertColor = ALERT_C[hospital.alertLevel] || "var(--green)";

  return (
    <div>
      {toast && <div style={{ position:"fixed",top:20,right:24,zIndex:9999,background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 18px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13 }}>{toast.msg}</div>}

      {/* Incoming patient alert */}
      {incomingAlert && (
        <div style={{ background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:"var(--radius-md)",padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:14 }}>🚨 INCOMING PATIENT ALERT</div>
            <div style={{ fontSize:12,color:"var(--text-secondary)",marginTop:4 }}>{incomingAlert.message}</div>
            {incomingAlert.eta&&<div style={{ fontSize:12,color:"var(--orange)",marginTop:3 }}>ETA: ~{incomingAlert.eta} minutes</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setIncomingAlert(null)}>Dismiss</button>
        </div>
      )}

      {/* Hospital header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div>
          <h2 style={{ fontFamily:"var(--font-display)",fontSize:22,color:"var(--text-primary)",marginBottom:4 }}>{hospital.name}</h2>
          <div style={{ fontSize:12,color:"var(--text-muted)" }}>📍 {hospital.location?.address}, {hospital.location?.city} · {hospital.type} · {hospital.level}</div>
          <div style={{ display:"flex",gap:8,marginTop:8,flexWrap:"wrap" }}>
            <span style={{ background:`${alertColor}22`,color:alertColor,border:`1px solid ${alertColor}44`,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700 }}>{hospital.alertLevel} ALERT</span>
            <span className={`badge ${hospital.status==="Active"?"badge-green":hospital.status==="Overwhelmed"?"badge-red":"badge-muted"}`}>{hospital.status}</span>
            <span className="badge badge-muted">Updated: {hospital.lastUpdated?new Date(hospital.lastUpdated).toLocaleTimeString():"—"}</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditing(true);setTab("resources")}}>📊 Update Resources</button>
          <button className="btn btn-ghost btn-sm" onClick={loadHospital}>↺</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-20" style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
        {[["dashboard","📊 Dashboard"],["resources","⚙ Resources"],["emergencies","🚨 Emergencies"],["alerts","🔔 Alerts"]].map(([id,lbl])=>(
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
            {lbl}
            {id==="alerts"&&alerts.length>0&&<span style={{ display:"inline-flex",width:16,height:16,borderRadius:"50%",background:"#FF2050",color:"#fff",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,marginLeft:5 }}>{alerts.length}</span>}
            {id==="emergencies"&&emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status)).length>0&&<span style={{ display:"inline-flex",width:16,height:16,borderRadius:"50%",background:"var(--orange)",color:"#fff",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,marginLeft:5 }}>{emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status)).length}</span>}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab==="dashboard"&&(
        <>
          <div className="stat-grid" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",marginBottom:20 }}>
            <ResCard label="ICU Beds"     icon="🛏" available={r.icuBeds?.available||0}    total={r.icuBeds?.total||0}    color="var(--accent)"/>
            <ResCard label="General Beds" icon="🏨" available={r.generalBeds?.available||0} total={r.generalBeds?.total||0} color="var(--purple)"/>
            <ResCard label="Ventilators"  icon="💨" available={r.ventilators?.available||0} total={r.ventilators?.total||0} color="var(--green)"/>
            <ResCard label="Ambulances"   icon="🚑" available={r.ambulancesAvailable||0}    total={r.ambulancesTotal||0}    color="var(--orange)"/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:20 }}>
            {[["O₂ Level",`${r.oxygenLevel||0}%`,(r.oxygenLevel||0)>50?"var(--green)":"var(--red)","💧"],["Blood Units",r.bloodUnitsAvailable||0,"var(--red)","🩸"],["Doctors",r.doctorsOnDuty||0,"var(--accent)","👨‍⚕️"],["Nurses",r.nursesOnDuty||0,"var(--green)","👩‍⚕️"],["Active Alerts",alerts.length,alerts.length>0?"var(--red)":"var(--green)","⚠️"],["Active Emergencies",emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status)).length,"var(--orange)","🚨"]].map(([lbl,val,clr,ic])=>(
              <div key={lbl} className="stat-card">
                <div className="stat-label">{ic} {lbl}</div>
                <div className="stat-value" style={{ color:clr,fontSize:28 }}>{val}</div>
              </div>
            ))}
          </div>
          {r.specialistsAvailable?.length>0&&(
            <div className="card card-sm" style={{ marginBottom:14 }}>
              <div style={{ fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--accent)",marginBottom:8 }}>🩺 Specialists On Duty</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {r.specialistsAvailable.map(s=><span key={s} className="badge badge-accent">{s}</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Resources Tab */}
      {tab==="resources"&&(
        <div>
          {!editing&&(
            <div style={{ marginBottom:14 }}>
              <button className="btn btn-primary" onClick={()=>setEditing(true)}>✎ Edit Resources</button>
            </div>
          )}
          {editing&&(
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ fontFamily:"var(--font-display)",fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:16 }}>📊 Update Live Resources</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
                {[["ICU Beds","icuBeds"],["General Beds","generalBeds"],["Emergency Beds","emergencyBeds"],["Ventilators","ventilators"],["Oxygen Beds","oxygenBeds"],["Dialysis","dialysisMachines"]].map(([lbl,key])=>(
                  <div key={key} style={{ background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8 }}>{lbl}</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                      <div><label className="form-label" style={{ fontSize:9 }}>Available</label><input className="input" type="number" min={0} value={resources[key]?.available||0} onChange={e=>setRes(key,"available",e.target.value)}/></div>
                      <div><label className="form-label" style={{ fontSize:9 }}>Total</label><input className="input" type="number" min={0} value={resources[key]?.total||0} onChange={e=>setRes(key,"total",e.target.value)}/></div>
                    </div>
                  </div>
                ))}
                <div style={{ background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8 }}>Oxygen Level %</div>
                  <input className="input" type="number" min={0} max={100} value={resources.oxygenLevel||100} onChange={e=>setRes("oxygenLevel",null,e.target.value)}/>
                </div>
                <div style={{ background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8 }}>Doctors on Duty</div>
                  <input className="input" type="number" min={0} value={resources.doctorsOnDuty||0} onChange={e=>setRes("doctorsOnDuty",null,e.target.value)}/>
                </div>
                <div style={{ background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8 }}>Nurses on Duty</div>
                  <input className="input" type="number" min={0} value={resources.nursesOnDuty||0} onChange={e=>setRes("nursesOnDuty",null,e.target.value)}/>
                </div>
              </div>
              <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid var(--border)" }}>
                <button className="btn btn-ghost" onClick={()=>setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={saveResources}>{saving?"Saving…":"💾 Save Resources"}</button>
              </div>
            </div>
          )}
          {!editing&&(
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12 }}>
              {[["ICU Beds",r.icuBeds,"var(--accent)"],["General Beds",r.generalBeds,"var(--purple)"],["Emergency Beds",r.emergencyBeds,"var(--orange)"],["Ventilators",r.ventilators,"var(--green)"],["Dialysis",r.dialysisMachines,"var(--yellow)"]].map(([lbl,b,c])=>b&&(
                <div key={lbl} className="card card-sm">
                  <div style={{ fontSize:11,color:"var(--text-muted)",marginBottom:4 }}>{lbl}</div>
                  <div style={{ fontFamily:"var(--font-display)",fontSize:22,fontWeight:700,color:c }}>{b.available||0}<span style={{ fontSize:13,color:"var(--text-muted)" }}>/{b.total||0}</span></div>
                  <div style={{ height:4,background:"var(--bg-primary)",borderRadius:2,marginTop:6,overflow:"hidden" }}>
                    <div style={{ width:`${pct(b.available,b.total)}%`,height:"100%",background:barClr(pct(b.available,b.total)),borderRadius:2 }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Emergencies Tab */}
      {tab==="emergencies"&&(
        <div>
          {emergencies.length===0&&<div style={{ textAlign:"center",padding:60,color:"var(--text-muted)" }}>No emergencies assigned to this hospital</div>}
          {emergencies.map(em=>(
            <div key={em._id} className="card card-sm" style={{ marginBottom:10,borderLeft:`3px solid ${em.severity==="Critical"?"var(--red)":em.severity==="High"?"var(--orange)":"var(--yellow)"}` }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5 }}>
                <div>
                  <span style={{ fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)" }}>{em.type}</span>
                  <span className={`badge ${em.severity==="Critical"?"badge-red":em.severity==="High"?"badge-orange":"badge-yellow"}`} style={{ marginLeft:8 }}>{em.severity}</span>
                </div>
                <span style={{ fontSize:10,color:"var(--text-dim)" }}>{new Date(em.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize:12,color:"var(--text-secondary)" }}>Patient: {em.patientName} · {em.status}</div>
              {em.assignedAmbulance&&<div style={{ fontSize:11,color:"var(--text-muted)",marginTop:3 }}>🚑 {em.assignedAmbulance.ambulanceId} · {em.estimatedArrivalTime>0?`ETA ~${em.estimatedArrivalTime}min`:""}</div>}
              {em.aiRecommendation&&<div style={{ fontSize:11,color:"var(--accent)",marginTop:4,lineHeight:1.5 }}>🤖 {em.aiRecommendation}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Alerts Tab */}
      {tab==="alerts"&&(
        <div>
          {alerts.length===0&&<div style={{ textAlign:"center",padding:60 }}><div style={{ fontSize:36,marginBottom:10 }}>✅</div><div style={{ color:"var(--green)" }}>No active alerts</div></div>}
          {alerts.map(a=>(
            <div key={a._id} className="card card-sm" style={{ marginBottom:10,borderLeft:`3px solid ${a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}`,display:"flex",gap:12,alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:13,color:a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)" }}>{a.alertType} — {a.resource}</div>
                <div style={{ fontSize:12,color:"var(--text-secondary)" }}>{a.message}</div>
                <div style={{ fontSize:10,color:"var(--text-dim)",marginTop:3 }}>{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>resolveAlert(a._id)}>✓ Resolve</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
