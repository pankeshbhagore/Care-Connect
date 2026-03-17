import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

const STATUS_C = { Requested:"#ffd600", Approved:"#00c8ff", InTransit:"#ff8f00", Completed:"#00e676", Cancelled:"#4e7090", Rejected:"#ff4060" };
const PRI_C    = { Critical:"#ff4060", High:"#ff8f00", Medium:"#ffd600", Low:"#00e676" };
const fmtAgo   = dt => { if(!dt) return "—"; const m=Math.floor((Date.now()-new Date(dt))/60000); return m<1?"just now":m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

function SuggestModal({ onClose, hospitals }) {
  const [f,setF]=useState({ fromHospitalId:"", priority:"High" });
  const [suggestions,setSuggestions]=useState([]);
  const [loading,setLoading]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const getSuggestions=async()=>{
    if(!f.fromHospitalId) return;
    setLoading(true);
    try{ const r=await api.get(`/transfers/suggest?fromHospitalId=${f.fromHospitalId}&priority=${f.priority}`); setSuggestions(r.data.suggestions||[]); }
    catch(e){ alert(e.message); }
    finally{ setLoading(false); }
  };
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="modal-title" style={{margin:0}}>🤖 AI Transfer Suggestions</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label className="form-label">From Hospital</label><select className="select" value={f.fromHospitalId} onChange={e=>s("fromHospitalId",e.target.value)}><option value="">Select…</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
          <div><label className="form-label">Priority</label><select className="select" value={f.priority} onChange={e=>s("priority",e.target.value)}>{["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select></div>
        </div>
        <button className="btn btn-primary btn-sm" style={{width:"100%",justifyContent:"center",marginBottom:14}} onClick={getSuggestions} disabled={loading}>{loading?"Getting AI Suggestions…":"Get AI Suggestions"}</button>
        {suggestions.map((s,i)=>(
          <div key={i} className="card card-sm" style={{marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:3}}>🏥 {s.hospitalName}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>🤖 {s.reason}</div>
            <div style={{display:"flex",gap:6,fontSize:10}}>
              <span className="badge badge-green">ICU {s.icuAvailable}</span>
              <span className="badge badge-accent">{s.distKm}km away</span>
              <span className="badge badge-muted">Score {s.score}</span>
            </div>
          </div>
        ))}
        {suggestions.length===0&&!loading&&f.fromHospitalId&&<div style={{textAlign:"center",padding:20,color:"var(--text-muted)"}}>No suggestions — click button to get AI recommendations</div>}
      </div>
    </div>
  );
}

function NewTransferModal({ onClose, onSave, hospitals }) {
  const [f,setF]=useState({ fromHospitalId:"", toHospitalId:"", patientName:"", patientAge:"", patientCondition:"", priority:"High", transferReason:"", notes:"" });
  const [saving,setSaving]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=async e=>{
    e.preventDefault(); setSaving(true);
    try{ await onSave(f); onClose(); }
    catch(e){ alert(e.message); setSaving(false); }
  };
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>🚑 New Patient Transfer</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">From Hospital *</label><select className="select" value={f.fromHospitalId} onChange={e=>s("fromHospitalId",e.target.value)} required><option value="">Select from hospital…</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">To Hospital *</label><select className="select" value={f.toHospitalId} onChange={e=>s("toHospitalId",e.target.value)} required><option value="">Select to hospital…</option>{hospitals.filter(h=>h._id!==f.fromHospitalId).map(h=><option key={h._id} value={h._id}>{h.name} (ICU: {h.resources?.icuBeds?.available||0})</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Patient Name *</label><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} required/></div>
            <div style={{marginBottom:12}}><label className="form-label">Age</label><input className="input" type="number" value={f.patientAge} onChange={e=>s("patientAge",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Priority *</label><select className="select" value={f.priority} onChange={e=>s("priority",e.target.value)}>{["Critical","High","Medium","Low"].map(p=><option key={p}>{p}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Condition</label><input className="input" value={f.patientCondition} onChange={e=>s("patientCondition",e.target.value)} placeholder="e.g. Cardiac, Stroke…"/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Transfer Reason</label><textarea className="input" rows={2} value={f.transferReason} onChange={e=>s("transferReason",e.target.value)} placeholder="Why transferring…"/></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create Transfer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransfersPanel() {
  const [transfers,  setTransfers]  =useState([]);
  const [hospitals,  setHospitals]  =useState([]);
  const [stats,      setStats]      =useState(null);
  const [loading,    setLoading]    =useState(true);
  const [filter,     setFilter]     =useState("All");
  const [showNew,    setShowNew]    =useState(false);
  const [showSuggest,setShowSuggest]=useState(false);
  const [selected,   setSelected]   =useState(null);

  const load=useCallback(async()=>{
    try{
      const [t,h,s]=await Promise.all([
        api.get("/transfers"+(filter!=="All"?`?status=${filter}`:"")),
        api.get("/hospitals"),
        api.get("/transfers/stats"),
      ]);
      setTransfers(t.data); setHospitals(h.data); setStats(s.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{ load(); const t=setInterval(load,20000); return()=>clearInterval(t); },[load]);
  useEffect(()=>{
    socket.on("newTransfer",()=>load());
    socket.on("transferUpdate",()=>load());
    return()=>{ socket.off("newTransfer"); socket.off("transferUpdate"); };
  },[load]);

  const updateStatus=async(id,status)=>{ try{await api.patch(`/transfers/${id}/status`,{status}); load();}catch(e){alert(e.message);} };
  const createTransfer=async(data)=>{ await api.post("/transfers",data); load(); };

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      {stats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",marginBottom:20}}>
          {[["📋","Total",stats.total,"var(--accent)"],["📅","Today",stats.today,"var(--green)"],["⏳","Pending",stats.pending,"var(--yellow)"],["🚑","In Transit",stats.inTransit,"var(--orange)"],["✅","Completed",stats.completed,"var(--green)"],["🚨","Critical",stats.critical,"var(--red)"]].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:26}}>{v||0}</div></div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {["All","Requested","Approved","InTransit","Completed","Cancelled"].map(f=>(
            <button key={f} className={`tab-btn ${filter===f?"active":""}`} style={{padding:"5px 12px",fontSize:11}} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowSuggest(true)}>🤖 AI Suggest</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ Transfer</button>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {transfers.map(t=>{
          const sc=STATUS_C[t.status]||"#888"; const pc=PRI_C[t.priority]||"#888";
          return(
            <div key={t._id} className="card card-sm" style={{borderLeft:`3px solid ${pc}`,cursor:"pointer"}} onClick={()=>setSelected(p=>p?._id===t._id?null:t)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                    <span className="badge" style={{background:`${pc}22`,color:pc,border:`1px solid ${pc}44`,fontSize:9}}>{t.priority}</span>
                    <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{t.patientName}</span>
                    {t.patientAge>0&&<span style={{fontSize:11,color:"var(--text-muted)"}}>· {t.patientAge}y</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--text-secondary)"}}>
                    {t.fromHospital?.name?.slice(0,20)||"—"} → {t.toHospital?.name?.slice(0,20)||"—"}
                  </div>
                  {t.patientCondition&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>🩺 {t.patientCondition}</div>}
                  <div style={{fontSize:10,color:"var(--text-dim)",marginTop:2}}>{t.transferId||t._id?.slice(-6)} · {fmtAgo(t.createdAt)}</div>
                </div>
                <span style={{background:`${sc}22`,color:sc,border:`1px solid ${sc}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{t.status}</span>
              </div>
              {selected?._id===t._id&&(
                <div style={{paddingTop:10,borderTop:"1px solid var(--border)",marginTop:8,fontSize:11,lineHeight:1.9,color:"var(--text-muted)"}}>
                  {t.transferReason&&<div>📝 {t.transferReason}</div>}
                  {t.notes&&<div>💬 {t.notes}</div>}
                  <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                    {t.status==="Requested"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e=>{e.stopPropagation();updateStatus(t._id,"Approved");}}>✓ Approve</button>}
                    {t.status==="Approved"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e=>{e.stopPropagation();updateStatus(t._id,"InTransit");}}>🚑 In Transit</button>}
                    {t.status==="InTransit"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e=>{e.stopPropagation();updateStatus(t._id,"Completed");}}>✓ Complete</button>}
                    {!["Completed","Cancelled"].includes(t.status)&&<button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--red)"}} onClick={e=>{e.stopPropagation();updateStatus(t._id,"Cancelled");}}>Cancel</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {transfers.length===0&&<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>No transfers found</div>}
      </div>
      {showNew&&<NewTransferModal onClose={()=>setShowNew(false)} onSave={createTransfer} hospitals={hospitals}/>}
      {showSuggest&&<SuggestModal onClose={()=>setShowSuggest(false)} hospitals={hospitals}/>}
    </div>
  );
}
