import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

const P_BADGE = { Critical:"badge-red", High:"badge-orange", Medium:"badge-yellow", Normal:"badge-accent" };
const S_COLOR  = { Requested:"#ffd600", Accepted:"#00c8ff", InTransit:"#ff8f00", Completed:"#00e676", Cancelled:"#4e7090", Rejected:"#ff4060" };
const fmtDt = dt => dt ? new Date(dt).toLocaleString() : "—";

function NewTransferModal({ hospitals, onClose, onSave }) {
  const [f,setF]=useState({ fromHospitalId:"", toHospitalId:"", patientName:"", patientAge:"", patientGender:"Male", bloodGroup:"", condition:"", priority:"Normal", notes:"" });
  const [sugg,setSugg]=useState([]);
  const [saving,setSaving]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    if(!f.fromHospitalId) return;
    api.get(`/transfers/suggest?fromHospitalId=${f.fromHospitalId}&priority=${f.priority}`)
      .then(r=>setSugg(r.data.suggestions||[])).catch(()=>{});
  },[f.fromHospitalId,f.priority]);

  const submit=async e=>{
    e.preventDefault(); setSaving(true);
    try { await onSave(f); onClose(); }
    catch(e){ alert("Error: "+e.message); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:600,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>🚑 New Patient Transfer</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{marginBottom:12}}><label className="form-label">Patient Name</label><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Anonymous"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Age</label><input className="input" type="number" value={f.patientAge} onChange={e=>s("patientAge",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Gender</label><select className="select" value={f.patientGender} onChange={e=>s("patientGender",e.target.value)}>{["Male","Female","Other"].map(g=><option key={g}>{g}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Blood Group</label><select className="select" value={f.bloodGroup} onChange={e=>s("bloodGroup",e.target.value)}><option value="">Unknown</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g}>{g}</option>)}</select></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Condition / Diagnosis *</label><input className="input" value={f.condition} onChange={e=>s("condition",e.target.value)} placeholder="e.g. Acute MI, Stroke, Trauma…" required/></div>
            <div style={{marginBottom:12}}><label className="form-label">Priority</label><select className="select" value={f.priority} onChange={e=>s("priority",e.target.value)}>{["Critical","High","Medium","Normal"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">From Hospital *</label><select className="select" value={f.fromHospitalId} onChange={e=>s("fromHospitalId",e.target.value)} required><option value="">Select…</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
          </div>

          {sugg.length>0&&(
            <div style={{background:"var(--accent-dim)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:14,marginBottom:14}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🤖 AI Recommended Hospitals</div>
              {sugg.slice(0,3).map((sg,i)=>(
                <div key={i} onClick={()=>s("toHospitalId",sg.hospital._id)} style={{background:f.toHospitalId===sg.hospital._id?"var(--accent-dim)":"var(--bg-elevated)",border:`1px solid ${f.toHospitalId===sg.hospital._id?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-md)",padding:"10px 12px",marginBottom:6,cursor:"pointer",transition:"all .15s"}}>
                  <div style={{fontWeight:600,fontSize:13,color:"var(--text-primary)"}}>{sg.hospital.name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{sg.reason}</div>
                  <div style={{marginTop:5,display:"flex",gap:6}}>
                    <span className="badge badge-green">Score {Math.round(sg.score*100)}%</span>
                    <span className="badge badge-muted">~{sg.estMins} min</span>
                    <span className="badge badge-muted">{sg.distKm} km</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{marginBottom:12}}><label className="form-label">To Hospital *</label><select className="select" value={f.toHospitalId} onChange={e=>s("toHospitalId",e.target.value)} required><option value="">Select target…</option>{hospitals.filter(h=>h._id!==f.fromHospitalId).map(h=><option key={h._id} value={h._id}>{h.name} – {h.location?.city}</option>)}</select></div>
          <div style={{marginBottom:12}}><label className="form-label">Notes</label><textarea className="input" rows={2} value={f.notes} onChange={e=>s("notes",e.target.value)}/></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Submitting…":"Submit Request"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPanel() {
  const [transfers,setTransfers]=useState([]);
  const [hospitals,setHospitals]=useState([]);
  const [filter,setFilter]=useState("All");
  const [loading,setLoading]=useState(true);
  const [showNew,setShowNew]=useState(false);
  const [stats,setStats]=useState(null);

  const load=useCallback(async()=>{
    try {
      const [t,h,s]=await Promise.all([
        api.get("/transfers"+(filter!=="All"?`?status=${filter}`:"")),
        api.get("/hospitals"),
        api.get("/transfers/stats"),
      ]);
      setTransfers(t.data); setHospitals(h.data); setStats(s.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[filter]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{
    socket.on("newTransfer",()=>load());
    socket.on("transferUpdate",()=>load());
    return()=>{ socket.off("newTransfer"); socket.off("transferUpdate"); };
  },[load]);

  const updateStatus=async(id,status)=>{
    try { await api.patch(`/transfers/${id}/status`,{status}); load(); }
    catch(e){ alert(e.message); }
  };
  const createTransfer=async(form)=>{ await api.post("/transfers",form); load(); };

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading transfers…</div>;

  return (
    <div>
      {stats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(6,1fr)",marginBottom:20}}>
          {[["📋","Total",stats.total,"var(--text-primary)"],["📅","Today",stats.today,"var(--accent)"],["⏳","Pending",stats.pending,"var(--yellow)"],["🚑","In Transit",stats.inTransit,"var(--orange)"],["✅","Completed",stats.completed,"var(--green)"],["🚨","Critical",stats.critical,"var(--red)"]].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:28}}>{v}</div></div>
          ))}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["All","Requested","Accepted","InTransit","Completed","Rejected"].map(s=>(
            <button key={s} className={`tab-btn ${filter===s?"active":""}`} style={{padding:"6px 14px",fontSize:12}} onClick={()=>setFilter(s)}>{s}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ New Transfer</button>
      </div>

      {transfers.length===0&&<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>No transfers found</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {transfers.map(t=>(
          <div key={t._id} className="card card-sm" style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{t.patientName}</span>
                {t.patientAge>0&&<span style={{fontSize:11,color:"var(--text-muted)"}}>{t.patientAge}y</span>}
                {t.bloodGroup&&<span className="badge badge-muted">{t.bloodGroup}</span>}
                <span className={`badge ${P_BADGE[t.priority]||"badge-muted"}`}>{t.priority}</span>
                <span style={{background:`${S_COLOR[t.status]}22`,color:S_COLOR[t.status]||"#fff",border:`1px solid ${S_COLOR[t.status]}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{t.status}</span>
                <span className="badge badge-muted">{t.transferId}</span>
              </div>
              <div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:3}}>
                🏥 <b>{t.fromHospital?.name||"—"}</b> → <b>{t.toHospital?.name||"—"}</b>
              </div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>
                {t.condition} · {t.distanceKm}km · ~{t.estimatedMinutes}min
              </div>
              {t.notes&&<div style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>📝 {t.notes}</div>}
              <div style={{fontSize:10,color:"var(--text-dim)",marginTop:4}}>Requested: {fmtDt(t.requestedAt)}{t.acceptedAt?` · Accepted: ${fmtDt(t.acceptedAt)}`:""}{t.completedAt?` · Completed: ${fmtDt(t.completedAt)}`:""}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,minWidth:110,alignItems:"flex-end"}}>
              {t.status==="Requested"&&<>
                <button className="btn btn-primary btn-sm" onClick={()=>updateStatus(t._id,"Accepted")}>Accept</button>
                <button className="btn btn-ghost btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>updateStatus(t._id,"Rejected")}>Reject</button>
              </>}
              {t.status==="Accepted"&&<button className="btn btn-primary btn-sm" onClick={()=>updateStatus(t._id,"InTransit")}>🚑 Start Transit</button>}
              {t.status==="InTransit"&&<button className="btn btn-primary btn-sm" onClick={()=>updateStatus(t._id,"Completed")}>✓ Complete</button>}
              {(t.status==="Requested"||t.status==="Accepted")&&<button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={()=>updateStatus(t._id,"Cancelled")}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
      {showNew&&<NewTransferModal hospitals={hospitals} onClose={()=>setShowNew(false)} onSave={createTransfer}/>}
    </div>
  );
}
