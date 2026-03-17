import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

// ── Shared toast hook ─────────────────────────────────────────
function useToast() {
  const [toast,setToast]=useState(null);
  const show=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),5000);};
  const ToastEl = toast?(
    <div style={{background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 16px",borderRadius:"var(--radius-md)",marginBottom:12,fontSize:12,fontWeight:600,display:"flex",gap:10,alignItems:"center"}}>
      <span style={{flex:1}}>{toast.msg}</span>
      <button onClick={()=>setToast(null)} style={{background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:14}}>✕</button>
    </div>
  ):null;
  return {show,ToastEl};
}

// ── Gov Integration Tab ───────────────────────────────────────
function GovIntegrationTab() {
  const [govStats,    setGovStats]   = useState(null);
  const [trustScores, setTrustScores]= useState([]);
  const [loading,     setLoading]    = useState(true);
  const {show,ToastEl}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [gs,ts]=await Promise.all([api.get("/hospitals/gov-stats"),api.get("/hospitals/trust-scores")]);
      setGovStats(gs.data);setTrustScores(ts.data);
    }catch(e){show("Failed to load: "+e.message,"error");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const TIER_C={Tier1:"var(--green)",Tier2:"var(--accent)",Tier3:"var(--purple)"};
  const TIER_L={Tier1:"Government",Tier2:"Private Partner",Tier3:"Premium Private"};

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading Gov Integration data…</div>;

  return(
    <div>
      {ToastEl}
      {govStats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",marginBottom:20}}>
          {[["🏥","Total Hospitals",govStats.total,"var(--accent)"],
            ["🏛","Tier 1 (Govt)",govStats.tier1,"var(--green)"],
            ["🤝","Tier 2",govStats.tier2,"var(--accent)"],
            ["💎","Tier 3",govStats.tier3,"var(--purple)"],
            ["💊","Ayushman",govStats.ayushmanEmpanelled,"var(--green)"],
            ["🏥","NHM",govStats.nhm,"var(--accent)"],
            ["🚨","Emergency Svc",govStats.emergencyService,"var(--orange)"],
            ["⭐","Avg Trust",`${govStats.avgTrustScore}/100`,"var(--yellow)"],
          ].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:22}}>{v}</div></div>
          ))}
        </div>
      )}
      {trustScores.length===0?(
        <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No hospital data. Run <code style={{fontFamily:"var(--font-mono)"}}>node scripts/seedAll.js</code></div>
      ):(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"var(--bg-elevated)"}}>
              {["Hospital","City","Tier","Trust Score","Acceptance","Ayushman","NHM","Emergency","Code"].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {trustScores.map(h=>{
                const tc=TIER_C[h.tier]||"var(--text-muted)";
                return(
                  <tr key={h._id} style={{borderBottom:"1px solid var(--border)"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={{padding:"8px 10px",fontWeight:600,color:"var(--text-primary)",maxWidth:180}}>{(h.name||"").slice(0,26)}</td>
                    <td style={{padding:"8px 10px",color:"var(--text-muted)",fontSize:11}}>{h.location?.city||"—"}</td>
                    <td style={{padding:"8px 10px"}}><span style={{background:`${tc}22`,color:tc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{TIER_L[h.tier]||h.tier||"—"}</span></td>
                    <td style={{padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:60,height:5,background:"var(--bg-primary)",borderRadius:3}}>
                          <div style={{width:`${h.trustScore||75}%`,height:"100%",background:(h.trustScore||75)>80?"var(--green)":(h.trustScore||75)>60?"var(--orange)":"var(--red)",borderRadius:3}}/>
                        </div>
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
      )}
    </div>
  );
}

// ── Invite Hospital Form ──────────────────────────────────────
function InviteHospitalForm({ onClose, onSuccess }) {
  const [f,setF]=useState({name:"",email:"",phone:"",address:"",city:"",district:"",state:"",type:"Government",tier:"Tier2",lat:"",lng:""});
  const [saving, setSaving] =useState(false);
  const [locating,setLocating]=useState(false);
  const [locName, setLocName]=useState("");
  const [preview, setPreview]=useState(null);
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
      if(r.data.previewUrl){ setPreview(r.data.previewUrl); }
      else { onSuccess(); }
    }catch(e){ alert(e.response?.data?.message||e.message); }
    finally{setSaving(false);}
  };

  if(preview) return(
    <div className="card" style={{marginBottom:16,background:"var(--green-dim)",border:"1px solid var(--green)",padding:20,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>✅</div>
      <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--green)",marginBottom:6}}>Invitation Sent!</div>
      <div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:10}}>
        In dev mode (EMAIL_PASS not set), use Ethereal preview:
      </div>
      <a href={preview} target="_blank" rel="noreferrer" style={{color:"var(--accent)",fontSize:12,wordBreak:"break-all"}}>📧 Preview Email →</a>
      <div style={{marginTop:14,display:"flex",gap:8,justifyContent:"center"}}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        <button className="btn btn-primary btn-sm" onClick={onSuccess}>Done ✓</button>
      </div>
    </div>
  );

  return(
    <div className="card" style={{marginBottom:16,padding:20}}>
      <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)",marginBottom:14}}>📬 Invite Hospital via Email</div>
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Hospital Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required placeholder="Full official name"/></div>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Contact Email * (verification link sent here)</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} required placeholder="hospital@example.com"/></div>
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

// ── Hospital Registration Tab ─────────────────────────────────
function HospitalRegistrationTab() {
  const [allHospitals,setAllHospitals]=useState([]);
  const [pending,     setPending]    =useState([]);
  const [invited,     setInvited]    =useState([]);
  const [loading,     setLoading]    =useState(true);
  const [showInvite,  setShowInvite] =useState(false);
  const [sending,     setSending]    =useState({});
  const [subTab,      setSubTab]     =useState("all"); // all|pending|invited
  const {show,ToastEl}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [all,pend,inv]=await Promise.all([
        api.get("/hospitals"),
        api.get("/hospital-registration/status?status=pending"),
        api.get("/hospital-registration/status?status=email_sent"),
      ]);
      setAllHospitals(all.data);
      setPending(pend.data);
      setInvited(inv.data);
    }catch(e){show("Load failed: "+e.message,"error");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    socket.on("hospitalVerified",()=>{ load(); show("Hospital verified!"); });
    socket.on("newHospitalRegistrationRequest",d=>{ load(); show(`New request: ${d.hospital?.name}`); });
    return()=>{ socket.off("hospitalVerified"); socket.off("newHospitalRegistrationRequest"); };
  },[load]);

  const approve=async id=>{
    setSending(p=>({...p,[id]:true}));
    try{
      const r=await api.post(`/hospital-registration/approve/${id}`,{action:"approve"});
      show(`Approved! Email sent.${r.data.previewUrl?" (Check console for preview URL)":""}`);
      if(r.data.previewUrl) console.log("📧 Email preview:",r.data.previewUrl);
    }catch(e){show(e.response?.data?.message||e.message,"error");}
    finally{setSending(p=>({...p,[id]:false}));load();}
  };
  const reject=async id=>{
    const reason=window.prompt("Rejection reason:");
    if(!reason) return;
    try{await api.post(`/hospital-registration/approve/${id}`,{action:"reject",rejectionReason:reason}); show("Rejected"); load();}
    catch(e){show(e.message,"error");}
  };
  const resend=async id=>{
    setSending(p=>({...p,[id]:"resend"}));
    try{
      const r=await api.post(`/hospital-registration/resend/${id}`);
      show(`Resent!${r.data.previewUrl?" (Check console for preview)":""}`);
      if(r.data.previewUrl) console.log("📧 Email preview:",r.data.previewUrl);
    }catch(e){show(e.message,"error");}
    finally{setSending(p=>({...p,[id]:false}));load();}
  };
  const deleteHosp=async id=>{
    if(!window.confirm("Delete this hospital permanently?")) return;
    try{await api.delete(`/hospitals/${id}`); show("Hospital deleted"); load();}
    catch(e){show(e.message,"error");}
  };

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;

  const STATUS_C={approved:"var(--green)",verified:"var(--green)",email_sent:"var(--accent)",pending:"var(--yellow)",rejected:"var(--red)"};

  return(
    <div>
      {ToastEl}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {[["all",`All Hospitals (${allHospitals.length})`],["pending",`⏳ Pending (${pending.length})`],["invited",`📬 Email Sent (${invited.length})`]].map(([id,lbl])=>(
            <button key={id} className={`tab-btn ${subTab===id?"active":""}`} onClick={()=>setSubTab(id)} style={{fontSize:11}}>{lbl}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} style={{marginLeft:"auto"}}>↺ Refresh</button>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowInvite(!showInvite)}>+ Invite Hospital</button>
      </div>

      {showInvite&&<InviteHospitalForm onClose={()=>setShowInvite(false)} onSuccess={()=>{setShowInvite(false);load();show("Invitation sent!");}}/>}

      {/* ALL HOSPITALS */}
      {subTab==="all"&&(
        <div style={{overflowX:"auto"}}>
          {allHospitals.length===0?(
            <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
              <div style={{fontSize:36,marginBottom:10}}>🏥</div>
              <div>No hospitals found.</div>
              <div style={{fontSize:12,marginTop:8}}>Run <code>node scripts/seedAll.js</code> in backend to populate.</div>
            </div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:"var(--bg-elevated)"}}>
                {["Hospital","City/District","Type","Tier","Status","Reg Status","Actions"].map(h=>(
                  <th key={h} style={{padding:"8px 10px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allHospitals.map(h=>{
                  const sc=STATUS_C[h.registrationStatus]||"var(--text-muted)";
                  return(
                    <tr key={h._id} style={{borderBottom:"1px solid var(--border)"}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{padding:"8px 10px",fontWeight:600,color:"var(--text-primary)",maxWidth:180}}>
                        <div>{h.name?.slice(0,24)}</div>
                        <div style={{fontSize:10,color:"var(--text-muted)",fontFamily:"var(--font-mono)"}}>{h.hospitalId}</div>
                      </td>
                      <td style={{padding:"8px 10px",color:"var(--text-muted)",fontSize:11}}>{h.location?.city||"—"}<br/><span style={{fontSize:10}}>{h.location?.district||""}</span></td>
                      <td style={{padding:"8px 10px",fontSize:11}}>{h.type}</td>
                      <td style={{padding:"8px 10px"}}><span style={{fontSize:10,fontWeight:600,color:h.tier==="Tier1"?"var(--green)":h.tier==="Tier2"?"var(--accent)":"var(--purple)"}}>{h.tier||"—"}</span></td>
                      <td style={{padding:"8px 10px"}}><span className={`badge ${h.status==="Active"?"badge-green":h.status==="Overwhelmed"?"badge-red":"badge-muted"}`}>{h.status}</span></td>
                      <td style={{padding:"8px 10px"}}><span style={{background:`${sc}22`,color:sc,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{h.registrationStatus||"approved"}</span></td>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{display:"flex",gap:4}}>
                          {h.registrationStatus==="pending"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} disabled={!!sending[h._id]} onClick={()=>approve(h._id)}>{sending[h._id]?"…":"✓ Approve"}</button>}
                          {h.registrationStatus==="email_sent"&&<button className="btn btn-ghost btn-sm" style={{fontSize:9}} disabled={sending[h._id]==="resend"} onClick={()=>resend(h._id)}>{sending[h._id]==="resend"?"…":"↺ Resend"}</button>}
                          <button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--red)"}} onClick={()=>deleteHosp(h._id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PENDING */}
      {subTab==="pending"&&(
        pending.length===0?(
          <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
            <div style={{fontSize:36,marginBottom:10}}>✅</div>
            No pending registrations.
          </div>
        ):(
          pending.map(h=>(
            <div key={h._id} className="card card-sm" style={{marginBottom:10,borderLeft:"3px solid var(--yellow)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--text-primary)",fontSize:14}}>{h.name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>📍 {h.location?.city}, {h.location?.district}, {h.location?.state}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>✉️ {h.contact?.email} · 📞 {h.contact?.phone}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>{h.type} · Self-registered {new Date(h.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-primary btn-sm" disabled={!!sending[h._id]} onClick={()=>approve(h._id)}>{sending[h._id]?"Sending…":"✓ Approve & Email"}</button>
                  <button className="btn btn-ghost btn-sm" style={{color:"var(--red)"}} onClick={()=>reject(h._id)}>✗ Reject</button>
                </div>
              </div>
            </div>
          ))
        )
      )}

      {/* INVITED (email_sent) */}
      {subTab==="invited"&&(
        invited.length===0?(
          <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
            <div style={{fontSize:36,marginBottom:10}}>📬</div>
            No hospitals awaiting verification.
          </div>
        ):(
          invited.map(h=>(
            <div key={h._id} className="card card-sm" style={{marginBottom:10,borderLeft:"3px solid var(--accent)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--text-primary)",fontSize:14}}>{h.name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>✉️ {h.contact?.email} · 📍 {h.location?.city}</div>
                  <div style={{fontSize:10,color:"var(--text-dim)"}}>Email sent: {h.emailSentAt?new Date(h.emailSentAt).toLocaleString():"—"} · Resent {h.emailResendCount||0}×</div>
                  <div style={{fontSize:10,color:"var(--orange)"}}>⏰ Expires: {h.tokenExpiry?new Date(h.tokenExpiry).toLocaleString():"—"}</div>
                </div>
                <button className="btn btn-ghost btn-sm" disabled={sending[h._id]==="resend"} onClick={()=>resend(h._id)}>
                  {sending[h._id]==="resend"?"Sending…":"↺ Resend Email"}
                </button>
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}

// ── User Management ───────────────────────────────────────────
function UsersTab({ hospitals }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [roleFilter,setRoleFilter]=useState("All");
  const [showCreate,setShowCreate]=useState(false);
  const {show,ToastEl}=useToast();

  const load=useCallback(async()=>{
    try{const r=await api.get("/admin/users");setUsers(r.data);}
    catch(e){show("Failed: "+e.message,"error");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{load();},[load]);

  const toggleStatus=async(id,cur)=>{
    try{await api.put(`/admin/users/${id}/status`,{status:cur==="active"?"suspended":"active"});load();}
    catch(e){show(e.message,"error");}
  };
  const deleteUser=async id=>{
    if(!window.confirm("Delete this user?")) return;
    try{await api.delete(`/admin/users/${id}`);load();}
    catch(e){show(e.message,"error");}
  };
  const createUser=async data=>{await api.post("/admin/users",data);load();};

  const ROLE_C={Admin:"var(--red)",HospitalOperator:"var(--green)",AmbulanceOperator:"var(--orange)",Citizen:"var(--accent)"};
  const filtered=users.filter(u=>{
    if(roleFilter!=="All"&&u.role!==roleFilter) return false;
    if(search){const q=search.toLowerCase();if(!u.name?.toLowerCase().includes(q)&&!u.email?.toLowerCase().includes(q)) return false;}
    return true;
  });

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      {ToastEl}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input className="input" style={{flex:1,minWidth:160}} placeholder="🔍 Search users…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{minWidth:140}}>
          <option value="All">All Roles</option>
          {["Admin","HospitalOperator","AmbulanceOperator","Citizen"].map(r=><option key={r}>{r}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}>+ Create User</button>
      </div>
      {showCreate&&<CreateUserModal onClose={()=>setShowCreate(false)} onSave={createUser} hospitals={hospitals}/>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"var(--bg-elevated)"}}>
            {["Name","Email","Role","Hospital","Status","Actions"].map(h=>(
              <th key={h} style={{padding:"9px 12px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u._id} style={{borderBottom:"1px solid var(--border)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"}
                onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"9px 12px",fontWeight:600,color:"var(--text-primary)"}}>{u.name}</td>
                <td style={{padding:"9px 12px",color:"var(--text-secondary)",fontSize:11}}>{u.email}</td>
                <td style={{padding:"9px 12px"}}><span style={{background:`${ROLE_C[u.role]||"#4e7090"}22`,color:ROLE_C[u.role]||"var(--text-muted)",border:`1px solid ${ROLE_C[u.role]||"#4e7090"}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{u.role}</span></td>
                <td style={{padding:"9px 12px",fontSize:11,color:"var(--text-muted)"}}>{u.hospitalId||"—"}</td>
                <td style={{padding:"9px 12px"}}><span className={`badge ${u.accountStatus==="active"?"badge-green":"badge-red"}`}>{u.accountStatus}</span></td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:5}}>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={()=>toggleStatus(u._id,u.accountStatus)}>
                      {u.accountStatus==="active"?"Suspend":"Activate"}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10,color:"var(--red)"}} onClick={()=>deleteUser(u._id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No users found</div>}
      </div>
      <div style={{marginTop:10,fontSize:11,color:"var(--text-muted)"}}>{filtered.length} of {users.length} users</div>
    </div>
  );
}

function CreateUserModal({ onClose, onSave, hospitals }) {
  const [f,setF]=useState({name:"",email:"",password:"",role:"HospitalOperator",phone:"",hospitalId:""});
  const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=async e=>{
    e.preventDefault();setErr("");setSaving(true);
    try{await onSave(f);onClose();}
    catch(e){setErr(e.response?.data?.message||e.message);setSaving(false);}
  };
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div className="modal-title" style={{margin:0}}>➕ Create Staff Account</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Full Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Email *</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Password *</label><input className="input" type="password" value={f.password} onChange={e=>s("password",e.target.value)} required placeholder="Min 6 chars"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Role</label>
              <select className="select" value={f.role} onChange={e=>s("role",e.target.value)}>
                {["HospitalOperator","Admin","Citizen"].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}><label className="form-label">Phone</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)}/></div>
            {f.role==="HospitalOperator"&&(
              <div style={{gridColumn:"1/-1",marginBottom:12}}>
                <label className="form-label">Assign to Hospital</label>
                <select className="select" value={f.hospitalId} onChange={e=>s("hospitalId",e.target.value)}>
                  <option value="">Select hospital…</option>
                  {hospitals.map(h=><option key={h._id} value={h._id}>{h.name} — {h.location?.city}</option>)}
                </select>
              </div>
            )}
          </div>
          {err&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"9px 13px",borderRadius:"var(--radius-md)",fontSize:12,marginBottom:12}}>⚠️ {err}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create Account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN ADMIN PANEL ─────────────────────────────────────────
export default function AdminPanel() {
  const [hospitals,  setHospitals] = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [tab,        setTab]       = useState("registration");

  const load=useCallback(async()=>{
    try{ const r=await api.get("/hospitals"); setHospitals(r.data); }
    catch(e){ console.error(e); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{load();},[load]);

  const TABS=[
    ["registration","🏥 Hospitals"],
    ["users","👥 Users"],
    ["gov","🏛 Gov Integration"],
  ];

  if(loading) return <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      <div className="tab-bar mb-20" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {TABS.map(([id,lbl])=>(
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>
      {tab==="registration" && <HospitalRegistrationTab/>}
      {tab==="users"        && <UsersTab hospitals={hospitals}/>}
      {tab==="gov"          && <GovIntegrationTab/>}
    </div>
  );
}
