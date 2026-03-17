import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

// ── Gov Integration Tab ───────────────────────────────────────
function GovIntegrationTab() {
  const [govStats,    setGovStats]    = useState(null);
  const [trustScores, setTrustScores] = useState([]);
  const [loading,     setLoading]     = useState(true);
  useEffect(()=>{
    Promise.all([api.get("/hospitals/gov-stats"),api.get("/hospitals/trust-scores")])
      .then(([gs,ts])=>{ setGovStats(gs.data); setTrustScores(ts.data); })
      .catch(console.error).finally(()=>setLoading(false));
  },[]);
  const TIER_C={Tier1:"var(--green)",Tier2:"var(--accent)",Tier3:"var(--purple)"};
  const TIER_L={Tier1:"Government",Tier2:"Private Partner",Tier3:"Premium Private"};
  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;
  return(
    <div>
      {govStats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",marginBottom:20}}>
          {[["🏥","Total",govStats.total,"var(--accent)"],["🏛","Tier 1",govStats.tier1,"var(--green)"],["🤝","Tier 2",govStats.tier2,"var(--accent)"],["💎","Tier 3",govStats.tier3,"var(--purple)"],["💊","Ayushman",govStats.ayushmanEmpanelled,"var(--green)"],["🏥","NHM",govStats.nhm,"var(--accent)"],["🚨","Emergency",govStats.emergencyService,"var(--orange)"],["⭐","Avg Trust",`${govStats.avgTrustScore}/100`,"var(--yellow)"]].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:22}}>{v}</div></div>
          ))}
        </div>
      )}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"var(--bg-elevated)"}}>
            {["Hospital","Tier","Trust Score","Acceptance %","Ayushman","NHM","Emergency","Reg Code"].map(h=>(
              <th key={h} style={{padding:"8px 10px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {trustScores.map(h=>{
              const tc=TIER_C[h.tier]||"var(--text-muted)";
              return(
                <tr key={h._id} style={{borderBottom:"1px solid var(--border)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"8px 10px",fontWeight:600,color:"var(--text-primary)"}}>{(h.name||"").slice(0,26)}</td>
                  <td style={{padding:"8px 10px"}}><span style={{background:`${tc}22`,color:tc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{TIER_L[h.tier]||h.tier}</span></td>
                  <td style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:60,height:5,background:"var(--bg-primary)",borderRadius:3}}><div style={{width:`${h.trustScore||75}%`,height:"100%",background:(h.trustScore||75)>80?"var(--green)":(h.trustScore||75)>60?"var(--orange)":"var(--red)",borderRadius:3}}/></div>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:11}}>{h.trustScore||75}</span>
                    </div>
                  </td>
                  <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)"}}>{h.acceptanceRate||100}%</td>
                  <td style={{padding:"8px 10px"}}>{h.govRegistration?.ayushmanEmpanelled?<span className="badge badge-green">✓</span>:<span className="badge badge-muted">✗</span>}</td>
                  <td style={{padding:"8px 10px"}}>{h.govRegistration?.nhm?<span className="badge badge-green">✓</span>:<span className="badge badge-muted">✗</span>}</td>
                  <td style={{padding:"8px 10px"}}>{h.govRegistration?.emergencyService?<span className="badge badge-accent">✓</span>:<span className="badge badge-muted">✗</span>}</td>
                  <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-muted)"}}>{h.govRegistration?.registrationCode||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Hospital Registration Tab ─────────────────────────────────
function HospitalRegistrationTab() {
  const [pending,   setPending]  = useState([]);
  const [invited,   setInvited]  = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [showInvite,setShowInvite]=useState(false);
  const [sending,   setSending]  = useState({});
  const [toast,     setToast]    = useState(null);

  const showMsg=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),4000);};

  const load=useCallback(async()=>{
    try{
      const [p,i]=await Promise.all([
        api.get("/hospital-registration/status?status=pending"),
        api.get("/hospital-registration/status?status=email_sent"),
      ]);
      setPending(p.data);setInvited(i.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    socket.on("hospitalVerified",()=>load());
    socket.on("newHospitalRegistrationRequest",()=>load());
    return()=>{socket.off("hospitalVerified");socket.off("newHospitalRegistrationRequest");};
  },[load]);

  const approve=async(id)=>{
    setSending(p=>({...p,[id]:true}));
    try{const r=await api.post(`/hospital-registration/approve/${id}`,{action:"approve"}); showMsg(`✅ Approved! Email sent.${r.data.previewUrl?" Preview: "+r.data.previewUrl:""}`);}
    catch(e){showMsg(e.response?.data?.message||e.message,"error");}
    finally{setSending(p=>({...p,[id]:false}));load();}
  };
  const reject=async(id)=>{
    const reason=prompt("Rejection reason:");
    if(!reason) return;
    try{await api.post(`/hospital-registration/approve/${id}`,{action:"reject",rejectionReason:reason}); showMsg("Rejected"); load();}
    catch(e){showMsg(e.message,"error");}
  };
  const resend=async(id)=>{
    setSending(p=>({...p,[id]:"resend"}));
    try{const r=await api.post(`/hospital-registration/resend/${id}`); showMsg(`Email resent!${r.data.previewUrl?" Preview: "+r.data.previewUrl:""}`);}
    catch(e){showMsg(e.message,"error");}
    finally{setSending(p=>({...p,[id]:false}));load();}
  };

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      {toast&&<div style={{background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 16px",borderRadius:"var(--radius-md)",marginBottom:12,fontSize:12,fontWeight:600}}>{toast.msg}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowInvite(!showInvite)}>+ Invite Hospital</button>
      </div>
      {showInvite&&<InviteHospitalForm onClose={()=>setShowInvite(false)} onSuccess={()=>{setShowInvite(false);load();showMsg("Invitation sent!");}}/>}

      {pending.length>0&&(
        <>
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--yellow)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>⏳ Pending Approval ({pending.length})</div>
          {pending.map(h=>(
            <div key={h._id} className="card card-sm" style={{marginBottom:10,borderLeft:"3px solid var(--yellow)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--text-primary)",fontSize:14}}>{h.name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>📍 {h.location?.city}, {h.location?.district}, {h.location?.state}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>✉️ {h.contact?.email} · 📞 {h.contact?.phone}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>{h.type} · Self-registered {new Date(h.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-primary btn-sm" disabled={!!sending[h._id]} onClick={()=>approve(h._id)}>{sending[h._id]?"Sending…":"✓ Approve & Send Email"}</button>
                  <button className="btn btn-ghost btn-sm" style={{color:"var(--red)"}} onClick={()=>reject(h._id)}>✗ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {invited.length>0&&(
        <>
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--accent)",textTransform:"uppercase",letterSpacing:1,marginBottom:10,marginTop:16}}>📬 Email Sent — Awaiting Verification ({invited.length})</div>
          {invited.map(h=>(
            <div key={h._id} className="card card-sm" style={{marginBottom:10,borderLeft:"3px solid var(--accent)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--text-primary)",fontSize:14}}>{h.name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>✉️ {h.contact?.email} · 📍 {h.location?.city}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>Email sent: {h.emailSentAt?new Date(h.emailSentAt).toLocaleString():"—"} · Resent {h.emailResendCount||0}x</div>
                  <div style={{fontSize:10,color:"var(--orange)"}}>⏰ Expires: {h.tokenExpiry?new Date(h.tokenExpiry).toLocaleString():"—"}</div>
                </div>
                <button className="btn btn-ghost btn-sm" disabled={sending[h._id]==="resend"} onClick={()=>resend(h._id)}>{sending[h._id]==="resend"?"Sending…":"↺ Resend Email"}</button>
              </div>
            </div>
          ))}
        </>
      )}
      {pending.length===0&&invited.length===0&&!showInvite&&(
        <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
          <div style={{fontSize:36,marginBottom:10}}>✅</div>
          <div>No pending registrations. Use "Invite Hospital" to add a new hospital.</div>
        </div>
      )}
    </div>
  );
}

// ── Invite Hospital Form ──────────────────────────────────────
function InviteHospitalForm({ onClose, onSuccess }) {
  const [f,setF]=useState({name:"",email:"",phone:"",address:"",city:"",district:"",state:"",type:"Government",tier:"Tier2",lat:"",lng:""});
  const [saving,setSaving]=useState(false);
  const [locating,setLocating]=useState(false);
  const [locName,setLocName]=useState("");
  const [preview,setPreview]=useState(null);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  const detect=()=>{
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      s("lat",lat.toFixed(6));s("lng",lng.toFixed(6));setLocating(false);
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,{headers:{"User-Agent":"CareConnect/4.0"}});
        const d=await r.json();const a=d.address||{};
        s("address",[a.road,a.suburb,a.city||a.town].filter(Boolean).join(", "));
        s("city",a.city||a.town||a.municipality||"");
        s("district",a.county||a.city_district||"");
        s("state",a.state||"");
        setLocName([a.road,a.city||a.town].filter(Boolean).join(", "));
      }catch(e){}
    },()=>setLocating(false));
  };

  const submit=async e=>{
    e.preventDefault();setSaving(true);
    try{
      const r=await api.post("/hospital-registration/invite",f);
      if(r.data.previewUrl) setPreview(r.data.previewUrl);
      else onSuccess();
    }catch(e){alert(e.response?.data?.message||e.message);}
    finally{setSaving(false);}
  };

  if(preview) return(
    <div className="card" style={{marginBottom:16,background:"var(--green-dim)",border:"1px solid var(--green)",padding:20,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>✅</div>
      <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--green)",marginBottom:6}}>Hospital Invited!</div>
      <div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:10}}>
        Verification email sent. In development mode, preview the email here:
      </div>
      <a href={preview} target="_blank" rel="noreferrer" style={{color:"var(--accent)",fontSize:12}}>📧 Preview Email →</a>
      <div style={{marginTop:14}}><button className="btn btn-primary btn-sm" onClick={onSuccess}>Done</button></div>
    </div>
  );

  return(
    <div className="card" style={{marginBottom:16,padding:20}}>
      <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)",marginBottom:14}}>📬 Invite a Hospital</div>
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Hospital Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required placeholder="Full official name"/></div>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Contact Email * (verification link will be sent here)</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} required placeholder="hospital@example.com"/></div>
          <div style={{marginBottom:12}}><label className="form-label">Phone</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="+91 90000 00000"/></div>
          <div style={{marginBottom:12}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["Government","Private","Trust","Clinic","Trauma Center"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{marginBottom:12}}><label className="form-label">Tier</label><select className="select" value={f.tier} onChange={e=>s("tier",e.target.value)}>{["Tier1","Tier2","Tier3"].map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={detect} disabled={locating} style={{marginBottom:8,width:"100%",justifyContent:"center"}}>{locating?"Detecting…":"📍 Auto-Detect Location"}</button>
        {locName&&<div style={{fontSize:11,color:"var(--green)",marginBottom:8}}>📍 {locName}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Street, Area"/></div>
          <div style={{marginBottom:12}}><label className="form-label">City</label><input className="input" value={f.city} onChange={e=>s("city",e.target.value)} placeholder="e.g. Indore"/></div>
          <div style={{marginBottom:12}}><label className="form-label">District</label><input className="input" value={f.district} onChange={e=>s("district",e.target.value)} placeholder="e.g. Indore"/></div>
          <div style={{marginBottom:12}}><label className="form-label">State</label><input className="input" value={f.state} onChange={e=>s("state",e.target.value)} placeholder="e.g. Madhya Pradesh"/></div>
          <div style={{marginBottom:12}}><label className="form-label">Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)}/></div>
          <div style={{marginBottom:12}}><label className="form-label">Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Sending…":"📬 Send Invitation Email"}</button>
        </div>
      </form>
    </div>
  );
}

// ── User Management ───────────────────────────────────────────
function UsersTab({ hospitals, ambulances }) {
  const [users,    setUsers]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState("");
  const [showCreate,setShowCreate]=useState(false);

  const load=useCallback(async()=>{
    try{const r=await api.get("/admin/users");setUsers(r.data);}
    catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const toggleStatus=async(id,cur)=>{ try{await api.put(`/admin/users/${id}/status`,{status:cur==="active"?"suspended":"active"});load();}catch(e){alert(e.message);} };
  const deleteUser =async id=>{ if(!confirm("Delete?")) return; try{await api.delete(`/admin/users/${id}`);load();}catch(e){alert(e.message);} };
  const createUser =async data=>{ await api.post("/admin/users",data);load(); };

  const ROLE_C={Admin:"var(--red)",HospitalOperator:"var(--green)",AmbulanceOperator:"var(--orange)",Citizen:"var(--accent)"};
  const filtered=users.filter(u=>!search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase()));

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;
  return(
    <div>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <input className="input" style={{flex:1}} placeholder="🔍 Search users…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}>+ Create User</button>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
      </div>
      {showCreate&&<CreateUserModal onClose={()=>setShowCreate(false)} onSave={createUser} hospitals={hospitals} ambulances={ambulances}/>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"var(--bg-elevated)"}}>
            {["Name","Email","Role","Status","Actions"].map(h=>(<th key={h} style={{padding:"9px 12px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8}}>{h}</th>))}
          </tr></thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u._id} style={{borderBottom:"1px solid var(--border)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"9px 12px",fontWeight:600,color:"var(--text-primary)"}}>{u.name}</td>
                <td style={{padding:"9px 12px",color:"var(--text-secondary)",fontSize:11}}>{u.email}</td>
                <td style={{padding:"9px 12px"}}><span style={{background:`${ROLE_C[u.role]||"#4e7090"}22`,color:ROLE_C[u.role]||"var(--text-muted)",border:`1px solid ${ROLE_C[u.role]||"#4e7090"}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{u.role}</span></td>
                <td style={{padding:"9px 12px"}}><span className={`badge ${u.accountStatus==="active"?"badge-green":"badge-red"}`}>{u.accountStatus}</span></td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:5}}>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={()=>toggleStatus(u._id,u.accountStatus)}>{u.accountStatus==="active"?"Suspend":"Activate"}</button>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10,color:"var(--red)"}} onClick={()=>deleteUser(u._id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No users found</div>}
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onSave, hospitals, ambulances }) {
  const [f,setF]=useState({name:"",email:"",password:"",role:"HospitalOperator",phone:"",hospitalId:"",ambulanceId:""});
  const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=async e=>{e.preventDefault();setErr("");setSaving(true);try{await onSave(f);onClose();}catch(e){setErr(e.response?.data?.message||e.message);setSaving(false);}};
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div className="modal-title" style={{margin:0}}>➕ Create User</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Full Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Email *</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Password *</label><input className="input" type="password" value={f.password} onChange={e=>s("password",e.target.value)} required placeholder="Min 6 chars"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Role</label><select className="select" value={f.role} onChange={e=>s("role",e.target.value)}>{["HospitalOperator","Admin","Citizen"].map(r=><option key={r}>{r}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Phone</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)}/></div>
            {f.role==="HospitalOperator"&&(
              <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Assign Hospital</label>
                <select className="select" value={f.hospitalId} onChange={e=>s("hospitalId",e.target.value)}>
                  <option value="">Select hospital…</option>
                  {hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {err&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"9px 13px",borderRadius:"var(--radius-md)",fontSize:12,marginBottom:12}}>⚠️ {err}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create User"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN ADMIN PANEL ─────────────────────────────────────────
export default function AdminPanel() {
  const [hospitals,  setHospitals]  = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("registration");

  const load=useCallback(async()=>{
    try{
      const [h,a]=await Promise.all([api.get("/hospitals"),api.get("/ambulances")]);
      setHospitals(h.data);setAmbulances(a.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const TABS=[["registration","🏥 Hospital Registration"],["users","👥 Users"],["gov","🏛 Gov Integration"]];

  if(loading) return <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      <div className="tab-bar mb-20" style={{display:"flex",gap:4}}>
        {TABS.map(([id,lbl])=>(<button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{lbl}</button>))}
      </div>
      {tab==="registration" && <HospitalRegistrationTab/>}
      {tab==="users"        && <UsersTab hospitals={hospitals} ambulances={ambulances}/>}
      {tab==="gov"          && <GovIntegrationTab/>}
    </div>
  );
}
