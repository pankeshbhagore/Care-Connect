import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

// ── Model-correct status enum ──────────────────────────────────────
// Model: Requested | Accepted | InTransit | Completed | Cancelled | Rejected
const STATUS_C = {
  Requested:"#ffd600", Accepted:"#00c8ff", InTransit:"#ff8f00",
  Completed:"#00e676", Cancelled:"#4e7090", Rejected:"#ff4060",
};
const PRI_C = { Critical:"#ff4060", High:"#ff8f00", Medium:"#ffd600", Normal:"#00e676" };
const fmtAgo = dt => {
  if(!dt) return "—";
  const m=Math.floor((Date.now()-new Date(dt))/60000);
  return m<1?"just now":m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`;
};

// ── Workflow Stepper ───────────────────────────────────────────────
function WorkflowStepper() {
  const steps = [
    {icon:"🏥", label:"Patient in Hospital"},
    {icon:"🔍", label:"Search Resources"},
    {icon:"📍", label:"Select Hospital"},
    {icon:"✉️",  label:"Send Request"},
    {icon:"🔔", label:"Request Received"},
    {icon:"🚑", label:"In Transit"},
    {icon:"✅", label:"Transfer Complete"},
  ];
  return (
    <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"12px 16px",marginBottom:16,overflowX:"auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:4,minWidth:700}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:4,flex:1}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:80}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"var(--accent-dim)",border:"1px solid var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginBottom:4}}>{s.icon}</div>
              <span style={{fontSize:9,color:"var(--text-muted)",textAlign:"center",fontWeight:500}}>{s.label}</span>
            </div>
            {i<steps.length-1&&<div style={{flex:1,height:2,background:"var(--border)",borderRadius:1,marginBottom:12,minWidth:12}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Suggest Modal ───────────────────────────────────────────────
function SuggestModal({ onClose, hospitals, onSelectHospital }) {
  const [fromId,setFromId]=useState("");
  const [suggestions,setSuggestions]=useState([]);
  const [loading,setLoading]=useState(false);
  const [specialty,setSpecialty]=useState("");

  const getSuggestions=async()=>{
    if(!fromId) return;
    setLoading(true);
    try{
      const r=await api.get(`/transfers/suggest?fromHospitalId=${fromId}${specialty?`&specialty=${specialty}`:""}`);
      setSuggestions(r.data.suggestions||[]);
    }catch(e){ alert("Failed to get suggestions: "+e.message); }
    finally{ setLoading(false); }
  };

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="modal-title" style={{margin:0}}>🤖 AI Transfer Suggestions</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <label className="form-label">From Hospital</label>
            <select className="select" value={fromId} onChange={e=>setFromId(e.target.value)}>
              <option value="">Select…</option>
              {hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Specialty (optional)</label>
            <input className="input" value={specialty} onChange={e=>setSpecialty(e.target.value)} placeholder="e.g. Cardiac, Neuro…"/>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" style={{width:"100%",justifyContent:"center",marginBottom:14}} onClick={getSuggestions} disabled={loading||!fromId}>
          {loading?"Getting AI Suggestions…":"🤖 Get Best Hospital Matches"}
        </button>
        {suggestions.length>0&&(
          <div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Top matches ranked by proximity + resource availability:</div>
            {suggestions.map((s,i)=>(
              <div key={i} className="card card-sm" style={{marginBottom:8,cursor:"pointer",border:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>
                    #{i+1} 🏥 {s.hospitalName}
                  </div>
                  <span style={{background:"var(--accent-dim)",color:"var(--accent)",border:"1px solid rgba(0,200,255,.2)",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>
                    Score {s.score}
                  </span>
                </div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6}}>{s.reason}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  <span className="badge badge-green">ICU {s.icuAvailable}/{s.icuTotal}</span>
                  <span className="badge badge-accent">{s.distKm}km · ~{s.estMins}min</span>
                  <span className="badge badge-muted">O₂ {s.oxygenLevel}%</span>
                  {s.alertLevel&&<span className={`badge ${s.alertLevel==="Red"?"badge-red":s.alertLevel==="Normal"?"badge-green":"badge-orange"}`}>{s.alertLevel}</span>}
                </div>
                {onSelectHospital&&(
                  <button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={()=>{onSelectHospital(s.hospitalId,s.hospitalName);onClose();}}>
                    Use This Hospital →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {suggestions.length===0&&!loading&&fromId&&(
          <div style={{textAlign:"center",padding:20,color:"var(--text-muted)"}}>Click the button to get AI-ranked hospital recommendations</div>
        )}
      </div>
    </div>
  );
}

// ── New Transfer Modal ─────────────────────────────────────────────
function NewTransferModal({ onClose, onSave, hospitals, defaultFromId, defaultToId }) {
  const [f,setF]=useState({
    fromHospitalId: defaultFromId||"",
    toHospitalId:   defaultToId||"",
    patientName:"", patientAge:"", patientGender:"Other",
    bloodGroup:"", patientCondition:"", priority:"High",
    transferReason:"", notes:"",
  });
  const [saving,setSaving]=useState(false);
  const [showSuggest,setShowSuggest]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  // Live ICU availability for the selected destination hospital
  const destHosp = hospitals.find(h=>h._id===f.toHospitalId);

  const submit=async e=>{
    e.preventDefault();
    if(!f.fromHospitalId||!f.toHospitalId||!f.patientName.trim())
      return alert("From hospital, To hospital and Patient name are required");
    setSaving(true);
    try{ await onSave(f); onClose(); }
    catch(err){ alert("Failed: "+err.response?.data?.message||err.message); setSaving(false); }
  };

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="modal-title" style={{margin:0}}>🚑 New Patient Transfer</div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowSuggest(true)}>🤖 AI Suggest</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <form onSubmit={submit}>
          {/* Hospital selectors */}
          <div style={{marginBottom:12}}>
            <label className="form-label">From Hospital *</label>
            <select className="select" value={f.fromHospitalId} onChange={e=>s("fromHospitalId",e.target.value)} required>
              <option value="">Select sending hospital…</option>
              {hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <label className="form-label">To Hospital *</label>
            <select className="select" value={f.toHospitalId} onChange={e=>s("toHospitalId",e.target.value)} required>
              <option value="">Select receiving hospital…</option>
              {hospitals.filter(h=>h._id!==f.fromHospitalId).map(h=>(
                <option key={h._id} value={h._id}>
                  {h.name} — ICU: {h.resources?.icuBeds?.available||0} free · {h.location?.city||""}
                </option>
              ))}
            </select>
          </div>

          {/* Destination hospital resource preview */}
          {destHosp&&(
            <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px 14px",marginBottom:14,display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:"var(--text-secondary)"}}>
              <span>🛏 ICU <b style={{color:(destHosp.resources?.icuBeds?.available||0)===0?"var(--red)":"var(--green)"}}>{destHosp.resources?.icuBeds?.available||0}/{destHosp.resources?.icuBeds?.total||0}</b></span>
              <span>💨 Vents <b style={{color:"var(--accent)"}}>{destHosp.resources?.ventilators?.available||0}</b></span>
              <span>💧 O₂ <b style={{color:(destHosp.resources?.oxygenLevel||0)<40?"var(--red)":"var(--green)"}}>{destHosp.resources?.oxygenLevel||0}%</b></span>
              <span>🚨 <b style={{color:destHosp.alertLevel==="Red"?"var(--red)":destHosp.alertLevel==="Normal"?"var(--green)":"var(--orange)"}}>{destHosp.alertLevel}</b></span>
            </div>
          )}

          {/* Patient details */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <div style={{marginBottom:12}}>
              <label className="form-label">Patient Name *</label>
              <input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Full name" required/>
            </div>
            <div style={{marginBottom:12}}>
              <label className="form-label">Age</label>
              <input className="input" type="number" min={0} max={150} value={f.patientAge} onChange={e=>s("patientAge",e.target.value)} placeholder="years"/>
            </div>
            <div style={{marginBottom:12}}>
              <label className="form-label">Gender</label>
              <select className="select" value={f.patientGender} onChange={e=>s("patientGender",e.target.value)}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="form-label">Blood Group</label>
              <select className="select" value={f.bloodGroup} onChange={e=>s("bloodGroup",e.target.value)}>
                <option value="">Unknown</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="form-label">Priority *</label>
              <select className="select" value={f.priority} onChange={e=>s("priority",e.target.value)}>
                {["Critical","High","Medium","Normal"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <label className="form-label">Condition</label>
              <input className="input" value={f.patientCondition} onChange={e=>s("patientCondition",e.target.value)} placeholder="e.g. Cardiac arrest, Stroke…"/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label className="form-label">Reason for Transfer</label>
            <textarea className="input" rows={2} value={f.transferReason} onChange={e=>s("transferReason",e.target.value)} placeholder="Clinical justification for transfer…"/>
          </div>
          <div style={{marginBottom:16}}>
            <label className="form-label">Additional Notes</label>
            <textarea className="input" rows={2} value={f.notes} onChange={e=>s("notes",e.target.value)} placeholder="Medications, special equipment needed, doctor instructions…"/>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{minWidth:140}}>
              {saving?"Creating Transfer…":"🚑 Create Transfer"}
            </button>
          </div>
        </form>

        {showSuggest&&(
          <SuggestModal
            onClose={()=>setShowSuggest(false)}
            hospitals={hospitals}
            onSelectHospital={(id,name)=>s("toHospitalId",id)}
          />
        )}
      </div>
    </div>
  );
}

// ── Transfer Detail Drawer ─────────────────────────────────────────
function TransferDetail({ transfer: t, onUpdateStatus, onClose, hospitalId }) {
  const pc = PRI_C[t.priority]||"#888";
  const sc = STATUS_C[t.status]||"#888";
  const isIncoming = t.toHospital?._id===hospitalId || t.toHospital===hospitalId;
  const isOutgoing = t.fromHospital?._id===hospitalId || t.fromHospital===hospitalId;

  return(
    <div style={{background:"var(--bg-elevated)",border:"1px solid var(--accent)",borderRadius:"var(--radius-lg)",padding:16,marginBottom:12}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:15,color:"var(--text-primary)",marginBottom:2}}>
            {t.patientName}
            {t.patientAge>0&&<span style={{fontSize:12,color:"var(--text-muted)",marginLeft:8}}>{t.patientAge}y</span>}
            {t.patientGender&&<span style={{fontSize:11,color:"var(--text-muted)",marginLeft:4}}>· {t.patientGender}</span>}
            {t.bloodGroup&&<span style={{fontSize:11,color:"var(--red)",marginLeft:6}}>🩸 {t.bloodGroup}</span>}
          </div>
          <div style={{fontSize:11,color:"var(--text-muted)"}}>
            {t.fromHospital?.name||"—"} → {t.toHospital?.name||"—"}
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:16}}>✕</button>
      </div>

      {/* Detail grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12,fontSize:12}}>
        <div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:8}}>
          <div style={{fontSize:9,color:"var(--text-dim)",marginBottom:2}}>PRIORITY</div>
          <span style={{fontWeight:700,color:pc}}>{t.priority}</span>
        </div>
        <div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:8}}>
          <div style={{fontSize:9,color:"var(--text-dim)",marginBottom:2}}>STATUS</div>
          <span style={{fontWeight:700,color:sc}}>{t.status}</span>
        </div>
        {t.distanceKm>0&&<div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:8}}>
          <div style={{fontSize:9,color:"var(--text-dim)",marginBottom:2}}>DISTANCE</div>
          <span style={{color:"var(--text-primary)"}}>{t.distanceKm} km</span>
        </div>}
        {t.estimatedMinutes>0&&<div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:8}}>
          <div style={{fontSize:9,color:"var(--text-dim)",marginBottom:2}}>EST. TIME</div>
          <span style={{color:"var(--text-primary)"}}>~{t.estimatedMinutes} min</span>
        </div>}
        {t.condition&&<div style={{background:"var(--bg-card)",borderRadius:"var(--radius-sm)",padding:8,gridColumn:"1/-1"}}>
          <div style={{fontSize:9,color:"var(--text-dim)",marginBottom:2}}>CONDITION</div>
          <span style={{color:"var(--text-primary)"}}>{t.condition}</span>
        </div>}
      </div>

      {t.notes&&<div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:8,padding:"8px 10px",background:"var(--bg-card)",borderRadius:"var(--radius-sm)"}}>📝 {t.notes}</div>}
      {t.rejectionReason&&<div style={{fontSize:12,color:"var(--red)",marginBottom:8,padding:"8px 10px",background:"var(--red-dim)",borderRadius:"var(--radius-sm)"}}>❌ Rejection reason: {t.rejectionReason}</div>}

      {/* Timeline */}
      <div style={{fontSize:10,color:"var(--text-dim)",marginBottom:12,fontFamily:"var(--font-mono)",display:"flex",gap:12,flexWrap:"wrap"}}>
        <span>Requested {fmtAgo(t.requestedAt||t.createdAt)}</span>
        {t.acceptedAt&&<span>Accepted {fmtAgo(t.acceptedAt)}</span>}
        {t.completedAt&&<span>Completed {fmtAgo(t.completedAt)}</span>}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {/* Incoming transfer actions */}
        {isIncoming&&t.status==="Requested"&&(
          <>
            <button className="btn btn-primary btn-sm" style={{background:"var(--green)",borderColor:"var(--green)"}}
              onClick={()=>onUpdateStatus(t._id,"Accepted")}>✓ Accept Transfer</button>
            <button className="btn btn-ghost btn-sm" style={{color:"var(--red)"}}
              onClick={()=>{const r=prompt("Reason for rejection?");if(r!==null)onUpdateStatus(t._id,"Rejected",r);}}>✗ Reject</button>
          </>
        )}
        {/* Outgoing transfer actions */}
        {isOutgoing&&t.status==="Accepted"&&(
          <button className="btn btn-primary btn-sm"
            onClick={()=>onUpdateStatus(t._id,"InTransit")}>🚑 Mark In Transit</button>
        )}
        {(isOutgoing||isIncoming)&&t.status==="InTransit"&&(
          <button className="btn btn-primary btn-sm" style={{background:"var(--green)",borderColor:"var(--green)"}}
            onClick={()=>onUpdateStatus(t._id,"Completed")}>✅ Mark Completed</button>
        )}
        {!["Completed","Cancelled","Rejected"].includes(t.status)&&(
          <button className="btn btn-ghost btn-sm" style={{color:"var(--red)"}}
            onClick={()=>onUpdateStatus(t._id,"Cancelled")}>Cancel</button>
        )}
      </div>

      {/* Label showing direction */}
      {isIncoming&&<div style={{fontSize:10,color:"var(--accent)",marginTop:6}}>📥 Incoming transfer to your hospital</div>}
      {isOutgoing&&<div style={{fontSize:10,color:"var(--yellow)",marginTop:6}}>📤 Outgoing transfer from your hospital</div>}
    </div>
  );
}

// ── Main TransfersPanel ────────────────────────────────────────────
export default function TransfersPanel({ hospitalId }) {
  const [transfers,   setTransfers]   = useState([]);
  const [hospitals,   setHospitals]   = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("All");
  const [dirFilter,   setDirFilter]   = useState("All"); // All | Incoming | Outgoing
  const [showNew,     setShowNew]     = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [toast,       setToast]       = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),4000); };

  const load = useCallback(async()=>{
    try{
      const params = new URLSearchParams();
      if(filter!=="All") params.set("status",filter);
      if(hospitalId)     params.set("hospital",hospitalId);
      const statsQ = hospitalId?`?hospital=${hospitalId}`:"";
      const [t,h,s] = await Promise.all([
        api.get(`/transfers?${params.toString()}`),
        api.get("/hospitals"),
        api.get(`/transfers/stats${statsQ}`),
      ]);
      setTransfers(t.data||[]);
      setHospitals(h.data||[]);
      setStats(s.data);
    }catch(e){ console.error("Transfer load error:",e.message); }
    finally{ setLoading(false); }
  },[filter, hospitalId]);

  useEffect(()=>{ load(); const t=setInterval(load,20000); return()=>clearInterval(t); },[load]);

  useEffect(()=>{
    socket.on("newTransfer", d=>{
      load();
      if(hospitalId && (d.toHospital===hospitalId||d.toHospital?._id===hospitalId)){
        showToast(`📥 Incoming transfer: ${d.patientName||"Patient"} from ${d.fromName||"another hospital"}`);
      }
    });
    socket.on("transferUpdate", ()=>load());
    return()=>{ socket.off("newTransfer"); socket.off("transferUpdate"); };
  },[load, hospitalId]);

  const updateStatus = async(id, status, rejectionReason) => {
    try{
      await api.patch(`/transfers/${id}/status`, { status, rejectionReason });
      setSelected(null);
      load();
      showToast(`Transfer updated: ${status}`);
    }catch(e){
      alert("Failed to update: "+(e.response?.data?.message||e.message));
    }
  };

  const createTransfer = async data => {
    await api.post("/transfers", data);
    load();
    showToast("Transfer request created successfully");
  };

  // Direction filter
  const visibleTransfers = transfers.filter(t=>{
    if(dirFilter==="Incoming") return t.toHospital?._id===hospitalId||t.toHospital===hospitalId;
    if(dirFilter==="Outgoing") return t.fromHospital?._id===hospitalId||t.fromHospital===hospitalId;
    return true;
  });

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading transfers…</div>;

  return(
    <div>
      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"var(--accent-dim)",border:"1px solid var(--accent)",color:"var(--accent)",padding:"10px 20px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
          {toast}
        </div>
      )}

      {/* Workflow stepper */}
      <WorkflowStepper/>

      {/* Stats */}
      {stats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",marginBottom:16}}>
          {[["📋","Total",stats.total,"var(--accent)"],["📅","Today",stats.today,"var(--green)"],
            ["⏳","Pending",stats.pending,"var(--yellow)"],["🚑","In Transit",stats.inTransit,"var(--orange)"],
            ["✅","Completed",stats.completed,"var(--green)"],["🚨","Critical",stats.critical,"var(--red)"]
          ].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:24}}>{v||0}</div></div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        {/* Status filter */}
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          {["All","Requested","Accepted","InTransit","Completed","Cancelled"].map(f=>(
            <button key={f} className={`tab-btn ${filter===f?"active":""}`} style={{padding:"4px 10px",fontSize:11}} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
        {/* Direction filter (only when hospital context) */}
        {hospitalId&&(
          <div style={{display:"flex",gap:3,marginLeft:8}}>
            {["All","Incoming","Outgoing"].map(d=>(
              <button key={d} className={`tab-btn ${dirFilter===d?"active":""}`} style={{padding:"4px 10px",fontSize:11,background:dirFilter===d?(d==="Incoming"?"var(--accent-dim)":d==="Outgoing"?"var(--yellow-dim)":""):""}} onClick={()=>setDirFilter(d)}>{d}</button>
            ))}
          </div>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowSuggest(true)}>🤖 AI Suggest</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ New Transfer</button>
        </div>
      </div>

      {/* Pending incoming banner */}
      {hospitalId&&visibleTransfers.filter(t=>(t.toHospital?._id===hospitalId||t.toHospital===hospitalId)&&t.status==="Requested").length>0&&(
        <div style={{background:"var(--orange-dim)",border:"1px solid var(--orange)",borderRadius:"var(--radius-md)",padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🔔</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:"var(--orange)",fontSize:13}}>
              {visibleTransfers.filter(t=>(t.toHospital?._id===hospitalId||t.toHospital===hospitalId)&&t.status==="Requested").length} incoming transfer request(s) waiting for your acceptance
            </div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>Click a transfer below to accept or reject</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setDirFilter("Incoming")}>View Incoming →</button>
        </div>
      )}

      {/* Transfer list */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visibleTransfers.map(t=>{
          const sc=STATUS_C[t.status]||"#888";
          const pc=PRI_C[t.priority]||"#888";
          const isIncoming = t.toHospital?._id===hospitalId||t.toHospital===hospitalId;
          const isSelected = selected?._id===t._id;
          return(
            <div key={t._id}>
              <div className="card card-sm" style={{borderLeft:`3px solid ${pc}`,cursor:"pointer",transition:"border-color .15s"}}
                onClick={()=>setSelected(p=>p?._id===t._id?null:t)}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=pc}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{background:`${pc}22`,color:pc,border:`1px solid ${pc}44`,padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:700}}>{t.priority}</span>
                      <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{t.patientName}</span>
                      {t.patientAge>0&&<span style={{fontSize:11,color:"var(--text-muted)"}}>· {t.patientAge}y</span>}
                      {t.bloodGroup&&<span style={{fontSize:10,color:"var(--red)"}}>🩸 {t.bloodGroup}</span>}
                      {hospitalId&&isIncoming&&<span style={{fontSize:9,background:"var(--accent-dim)",color:"var(--accent)",padding:"1px 6px",borderRadius:3}}>📥 Incoming</span>}
                      {hospitalId&&!isIncoming&&<span style={{fontSize:9,background:"var(--yellow-dim)",color:"var(--yellow)",padding:"1px 6px",borderRadius:3}}>📤 Outgoing</span>}
                    </div>
                    <div style={{fontSize:11,color:"var(--text-secondary)"}}>
                      🏥 {t.fromHospital?.name?.slice(0,22)||"—"} → {t.toHospital?.name?.slice(0,22)||"—"}
                    </div>
                    {t.condition&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>🩺 {t.condition}</div>}
                    <div style={{fontSize:10,color:"var(--text-dim)",marginTop:2,fontFamily:"var(--font-mono)"}}>
                      {t.transferId} · {fmtAgo(t.requestedAt||t.createdAt)}
                      {t.distanceKm>0&&` · ${t.distanceKm}km`}
                    </div>
                  </div>
                  <span style={{background:`${sc}22`,color:sc,border:`1px solid ${sc}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{t.status}</span>
                </div>
              </div>
              {isSelected&&(
                <TransferDetail
                  transfer={t}
                  onUpdateStatus={updateStatus}
                  onClose={()=>setSelected(null)}
                  hospitalId={hospitalId}
                />
              )}
            </div>
          );
        })}
        {visibleTransfers.length===0&&(
          <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
            <div style={{fontSize:36,marginBottom:10}}>🔄</div>
            No transfers found{filter!=="All"?` with status "${filter}"`:""}
          </div>
        )}
      </div>

      {showNew&&<NewTransferModal onClose={()=>setShowNew(false)} onSave={createTransfer} hospitals={hospitals} defaultFromId={hospitalId}/>}
      {showSuggest&&<SuggestModal onClose={()=>setShowSuggest(false)} hospitals={hospitals}/>}
    </div>
  );
}
