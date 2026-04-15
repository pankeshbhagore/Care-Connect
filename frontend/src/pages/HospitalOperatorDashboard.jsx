import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import socket from "../services/socket";
import { AppointmentsPanel } from "../components/AppointmentBooking";
import TransfersPanel from "../components/TransfersPanel";
import StatsRow from "../components/StatsRow";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const TILE_URLS = {
  street:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark:"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  smooth:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

const pct = (a,t) => t>0?Math.round((a/t)*100):0;
const barClr = p => p>50?"var(--green)":p>25?"var(--yellow)":"var(--red)";
const ALERT_C = {Red:"var(--red)",Orange:"var(--orange)",Yellow:"var(--yellow)",Normal:"var(--green)"};
const TIER_C  = {Tier1:"var(--green)",Tier2:"var(--accent)",Tier3:"var(--purple)"};
const TIER_L  = {Tier1:"Government",Tier2:"Private Partner",Tier3:"Premium Private"};

function ResCard({ label, icon, available, total, color }) {
  const p = pct(available,total);
  return(
    <div className="stat-card" style={{borderLeft:`3px solid ${color}`}}>
      <div className="stat-label">{icon} {label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:6,margin:"8px 0"}}>
        <span className="stat-value" style={{color,fontSize:32}}>{available}</span>
        <span style={{fontSize:14,color:"var(--text-muted)"}}>/ {total}</span>
      </div>
      <div style={{height:5,background:"var(--bg-primary)",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${p}%`,height:"100%",background:barClr(p),borderRadius:3,transition:"width .4s"}}/>
      </div>
      <div className="stat-sub" style={{marginTop:5}}>{p}% available</div>
    </div>
  );
}

// ── Ambulance Dispatch Modal ──────────────────────────────────
function DispatchModal({ hospitalId, onClose, onSuccess }) {
  const [ambulances, setAmbulances] = useState([]);
  const [emergencies,setEmergencies]= useState([]);
  const [f, setF] = useState({ ambulanceId:"", emergencyId:"", lat:"", lng:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const s = (k,v) => setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    Promise.all([
      api.get("/ambulances?status=Available"),
      api.get("/emergencies?status=AmbulanceRequested,Reported,Queued"),
    ]).then(([a,e])=>{ setAmbulances(a.data); setEmergencies(e.data); }).catch(console.error);
  },[]);

  const dispatch = async () => {
    if(!f.ambulanceId) return alert("Select an ambulance");
    if(!f.emergencyId && (!f.lat||!f.lng)) return alert("Select an emergency OR enter coordinates");
    setSaving(true);
    try {
      let targetLat=f.lat, targetLng=f.lng;
      if(f.emergencyId) {
        const em = emergencies.find(e=>e._id===f.emergencyId);
        if(em) { targetLat=em.location.lat; targetLng=em.location.lng; }
      }
      await api.post(`/ambulances/${f.ambulanceId}/dispatch`, {
        targetLat:parseFloat(targetLat), targetLng:parseFloat(targetLng),
        emergencyRequestId:f.emergencyId||null, priority:"High",
      });
      setMsg("✅ Ambulance dispatched successfully!");
      setTimeout(()=>{ onSuccess(); onClose(); },1500);
    } catch(e) { setMsg("❌ "+e.message); setSaving(false); }
  };

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div className="modal-title" style={{margin:0}}>🚑 Dispatch Ambulance</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {msg&&<div style={{background:msg.startsWith("✅")?"var(--green-dim)":"var(--red-dim)",border:`1px solid ${msg.startsWith("✅")?"var(--green)":"var(--red)"}`,color:msg.startsWith("✅")?"var(--green)":"var(--red)",padding:"9px 12px",borderRadius:"var(--radius-md)",marginBottom:14,fontSize:12,fontWeight:600}}>{msg}</div>}
        <div style={{marginBottom:12}}>
          <label className="form-label">Select Ambulance *</label>
          <select className="select" value={f.ambulanceId} onChange={e=>s("ambulanceId",e.target.value)}>
            <option value="">Choose available ambulance…</option>
            {ambulances.filter(a=>a.status==="Available").map(a=>(
              <option key={a._id} value={a._id}>{a.name||a.ambulanceId} — {a.type} ({a.status})</option>
            ))}
          </select>
          {ambulances.filter(a=>a.status==="Available").length===0&&<div style={{fontSize:11,color:"var(--orange)",marginTop:5}}>⚠️ No available ambulances right now</div>}
        </div>
        <div style={{marginBottom:12}}>
          <label className="form-label">Assign to Emergency Request (optional)</label>
          <select className="select" value={f.emergencyId} onChange={e=>s("emergencyId",e.target.value)}>
            <option value="">No specific emergency (use coords below)</option>
            {emergencies.map(em=>(
              <option key={em._id} value={em._id}>{em.requestId} — {em.type} ({em.severity}) — {em.patientName||"Unknown"}</option>
            ))}
          </select>
        </div>
        {!f.emergencyId&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><label className="form-label">Target Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)} placeholder="23.1815"/></div>
            <div><label className="form-label">Target Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)} placeholder="79.9864"/></div>
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={dispatch}>{saving?"Dispatching…":"🚑 Dispatch Now"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Other Hospitals (card view like citizen side) ─────────────
function OtherHospitalsResources({ currentHospitalId }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [cityFilter,setCityFilter]= useState("All");
  const [mapTile,   setMapTile]   = useState("smooth");
  const [view,      setView]      = useState("cards"); // cards | map

  const load = () => api.get("/hospitals/public")
    .then(r=>setHospitals(r.data.filter(h=>h._id!==currentHospitalId&&h._id?.toString()!==currentHospitalId)))
    .catch(console.error).finally(()=>setLoading(false));

  useEffect(()=>{ load(); const t=setInterval(load,30000); return()=>clearInterval(t); },[currentHospitalId]);

  const cities = ["All",...new Set(hospitals.map(h=>h.location?.city).filter(Boolean))].sort();
  const filtered = hospitals.filter(h=>{
    if(search) { const q=search.toLowerCase(); if(!h.name?.toLowerCase().includes(q)&&!h.location?.city?.toLowerCase().includes(q)) return false; }
    if(cityFilter!=="All"&&h.location?.city!==cityFilter) return false;
    return true;
  });

  function createHospIcon(h) {
    const c=ALERT_C[h.alertLevel]||"#4e7090";
    const r=h.resources||{};
    return L.divIcon({
      className:"",
      html:`<div style="background:#fff;border:2px solid ${c};border-radius:10px;padding:5px 9px;min-width:120px;box-shadow:0 3px 12px rgba(0,0,0,.18);font-family:system-ui">
        <div style="font-size:8px;color:${c};font-weight:800;letter-spacing:1px">${h.alertLevel}</div>
        <div style="font-size:10px;font-weight:700;color:#0d1e35;line-height:1.2">${(h.name||"").slice(0,20)}</div>
        <div style="font-size:9px;color:#666">ICU <b style="color:${(r.icuBeds?.available||0)===0?"#ff4060":"#00a855"}">${r.icuBeds?.available||0}/${r.icuBeds?.total||0}</b></div>
      </div>`,
      iconAnchor:[60,0],
    });
  }

  if(loading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      {/* Controls */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input className="input" style={{flex:1,minWidth:160}} placeholder="🔍 Search hospitals…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="select" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} style={{minWidth:120}}>
          {cities.map(c=><option key={c}>{c}</option>)}
        </select>
        <div style={{display:"flex",gap:4}}>
          <button className={`btn btn-sm ${view==="cards"?"btn-primary":"btn-ghost"}`} onClick={()=>setView("cards")}>⊞ Cards</button>
          <button className={`btn btn-sm ${view==="map"?"btn-primary":"btn-ghost"}`} onClick={()=>setView("map")}>🗺 Map</button>
        </div>
        <span style={{fontSize:11,color:"var(--text-muted)",marginLeft:"auto"}}>🔄 30s · {filtered.length} hospitals</span>
      </div>

      {/* MAP VIEW */}
      {view==="map"&&(
        <div>
          <div style={{display:"flex",gap:5,marginBottom:8}}>
            {Object.entries({smooth:"🎨 Smooth",street:"🗺 Street",dark:"🌑 Dark"}).map(([k,l])=>(
              <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} onClick={()=>setMapTile(k)}>{l}</button>
            ))}
          </div>
          <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:480}}>
            <MapContainer center={[23.5,79.5]} zoom={7} style={{height:"100%",width:"100%"}}>
              <TileLayer url={TILE_URLS[mapTile]} attribution="© OpenStreetMap"/>
              {filtered.filter(h=>h.location?.lat).map(h=>(
                <Marker key={h._id} position={[h.location.lat,h.location.lng]} icon={createHospIcon(h)}>
                  <Popup>
                    <div style={{fontFamily:"system-ui",fontSize:13,minWidth:200}}>
                      <b>{h.name}</b><br/>
                      <span style={{fontSize:11,color:"#666"}}>{h.location?.city} · {TIER_L[h.tier]||h.tier}</span>
                      <div style={{marginTop:6,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 8px",fontSize:11}}>
                        <span>ICU <b style={{color:(h.resources?.icuBeds?.available||0)===0?"#ff4060":"#00a855"}}>{h.resources?.icuBeds?.available||0}/{h.resources?.icuBeds?.total||0}</b></span>
                        <span>O₂ <b style={{color:(h.resources?.oxygenLevel||100)<40?"#ff4060":"#00a855"}}>{h.resources?.oxygenLevel||100}%</b></span>
                        <span>Beds {h.resources?.generalBeds?.available||0}/{h.resources?.generalBeds?.total||0}</span>
                        <span>Docs {h.resources?.doctorsOnDuty||0}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* CARDS VIEW — same style as citizen portal */}
      {view==="cards"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {filtered.map(h=>{
            const r=h.resources||{};
            const ac=ALERT_C[h.alertLevel]||"#4e7090";
            const tc=TIER_C[h.tier]||"#4e7090";
            return(
              <div key={h._id} className="card" style={{borderTop:`3px solid ${ac}`,transition:"transform .15s"}}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e=>e.currentTarget.style.transform=""}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,marginRight:8}}>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)",lineHeight:1.3}}>{h.name}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>📍 {h.location?.address||h.location?.city}</div>
                    <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                      <span style={{background:`${tc}22`,color:tc,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{TIER_L[h.tier]||h.tier}</span>
                      <span style={{background:`${ac}22`,color:ac,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{h.alertLevel}</span>
                      <span className={`badge ${h.status==="Active"?"badge-green":h.status==="Overwhelmed"?"badge-red":"badge-muted"}`} style={{fontSize:9}}>{h.status}</span>
                    </div>
                  </div>
                </div>
                {/* Resource bars */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:10}}>
                  {[["ICU",r.icuBeds,"var(--accent)"],["Beds",r.generalBeds,"var(--purple)"],["Vents",r.ventilators,"var(--green)"]].map(([lbl,b,c])=>b&&(
                    <div key={lbl} style={{background:"var(--bg-elevated)",borderRadius:"var(--radius-sm)",padding:"6px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"var(--text-muted)",marginBottom:1}}>{lbl}</div>
                      <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:15,color:b.available===0?"var(--red)":c}}>
                        {b.available}<span style={{fontSize:9,color:"var(--text-muted)"}}>/{b.total}</span>
                      </div>
                      <div style={{height:3,background:"var(--bg-primary)",borderRadius:2,marginTop:3}}>
                        <div style={{width:`${pct(b.available,b.total)}%`,height:"100%",background:barClr(pct(b.available,b.total)),borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Stats row */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:7}}>
                  <span className={`badge ${(r.oxygenLevel||0)>50?"badge-green":"badge-red"}`}>O₂ {r.oxygenLevel||0}%</span>
                  {r.bloodBank&&<span className="badge badge-accent">🩸 Blood Bank</span>}
                  {h.traumaCenter&&<span className="badge badge-red">Trauma</span>}
                  {h.govRegistration?.ayushmanEmpanelled&&<span className="badge badge-green">Ayushman</span>}
                </div>
                {/* Trust bar */}
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                  <div style={{flex:1,height:3,background:"var(--bg-primary)",borderRadius:2}}>
                    <div style={{width:`${h.trustScore||75}%`,height:"100%",background:(h.trustScore||75)>80?"var(--green)":(h.trustScore||75)>60?"var(--orange)":"var(--red)",borderRadius:2}}/>
                  </div>
                  <span style={{fontSize:10,color:"var(--text-muted)"}}>Trust {h.trustScore||75}</span>
                </div>
                {h.contact?.emergency&&<div style={{fontSize:11,color:"var(--accent)"}}>📞 {h.contact.emergency}</div>}
                {h.specialties?.length>0&&(
                  <div style={{marginTop:7,display:"flex",gap:4,flexWrap:"wrap"}}>
                    {h.specialties.slice(0,4).map(s=><span key={s} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",color:"var(--text-secondary)",padding:"1px 7px",borderRadius:20,fontSize:9}}>{s}</span>)}
                    {h.specialties.length>4&&<span style={{fontSize:9,color:"var(--text-muted)"}}>+{h.specialties.length-4}</span>}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"var(--text-muted)"}}>No hospitals match your search</div>}
        </div>
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────

// ── Patients Tab (from reference project) ────────────────────────────
function PatientsTab({ hospitalId }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [wardFilter, setWardFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(()=>{
    api.get(`/appointments/hospital/${hospitalId}`)
      .then(r=>{
        // Convert appointments to a patient-like list
        const pts = (r.data||[]).filter(a=>a.status==="approved"||a.status==="pending").map(a=>({
          id:a._id, name:a.patientName||"Unknown", age:a.patientAge||"—",
          ward:a.appointmentType||"General", condition:"Scheduled",
          doctor:"Assigned", admittedAgo: new Date(a.createdAt||Date.now()).toLocaleDateString(),
          status:a.status,
        }));
        setPatients(pts);
      }).catch(()=>setPatients([]))
      .finally(()=>setLoading(false));
  },[hospitalId]);

  const condBadge = (c,s) => {
    const color = s==="approved"?"var(--green)":s==="pending"?"var(--yellow)":"var(--text-muted)";
    return <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:`${color}22`,color,border:`1px solid ${color}44`,fontWeight:600}}>{s?.toUpperCase()||c}</span>;
  };

  const filtered = patients.filter(p=>{
    if(wardFilter!=="All"&&p.ward!==wardFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  if(loading) return <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>Loading patients…</div>;

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>👥</span>
          <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:15,color:"var(--text-primary)"}}>Admitted / Scheduled Patients</span>
          <span style={{fontSize:11,background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:20,padding:"2px 10px",color:"var(--text-secondary)"}}>{filtered.length}</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          <select className="select" value={wardFilter} onChange={e=>setWardFilter(e.target.value)} style={{fontSize:12,padding:"5px 10px"}}>
            <option value="All">All Wards</option>
            <option>General</option><option>ICU</option><option>ER</option><option>Oxygen</option>
          </select>
          <input className="input" placeholder="Search patients…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:160,fontSize:12,padding:"5px 10px"}}/>
        </div>
      </div>
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>
          <div style={{fontSize:40,marginBottom:10}}>🏥</div>
          No patients yet. Approved appointments will appear here.
        </div>
      ):(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:"1px solid var(--border)"}}>
                {["Patient","Age","Ward","Status","Scheduled"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",color:"var(--text-muted)",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p=>(
                <tr key={p.id} style={{borderBottom:"1px solid var(--border)",transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--bg-elevated)"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{padding:"10px 12px",fontWeight:600,color:"var(--text-primary)"}}>{p.name}</td>
                  <td style={{padding:"10px 12px",color:"var(--text-secondary)"}}>{p.age}</td>
                  <td style={{padding:"10px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"var(--accent-dim)",color:"var(--accent)",border:"1px solid rgba(0,200,255,.2)"}}>{p.ward}</span></td>
                  <td style={{padding:"10px 12px"}}>{condBadge(p.condition,p.status)}</td>
                  <td style={{padding:"10px 12px",color:"var(--text-muted)",fontSize:11,fontFamily:"var(--font-mono)"}}>{p.admittedAgo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HospitalOperatorDashboard({ hospitalId, onBack }) {
  const [hospital,        setHospital]       = useState(null);
  const [emergencies,     setEmergencies]    = useState([]);
  const [alerts,          setAlerts]         = useState([]);
  const [ambulances,      setAmbulances]     = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [tab,             setTab]            = useState("dashboard");
  const [editing,         setEditing]        = useState(false);
  const [saving,          setSaving]         = useState(false);
  const [resources,       setResources]      = useState({});
  const [toast,           setToast]          = useState(null);
  const [incomingAlert,   setIncomingAlert]  = useState(null);
  const [resourceReminder,setResourceReminder]=useState(false);  // ← FIXED: declared here
  const [showDispatch,    setShowDispatch]   = useState(false);
  const [pendingTransfers,setPendingTransfers] = useState(0);

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const loadPendingTransfers = useCallback(async()=>{
    if(!hospitalId) return;
    try{
      const r = await api.get(`/transfers/stats?hospital=${hospitalId}`);
      setPendingTransfers(r.data?.pending || 0);
    }catch(e){}
  },[hospitalId]);

  const loadHospital = useCallback(async()=>{
    if(!hospitalId) return;
    try{
      const [h,e,a,ambs]=await Promise.all([
        api.get(`/hospitals/${hospitalId}`),
        api.get(`/emergencies?hospitalId=${hospitalId}`),
        api.get(`/hospitals/alerts`),
        api.get(`/ambulances`),
      ]);
      setHospital(h.data);
      setResources(h.data.resources||{});
      setEmergencies(e.data);
      setAlerts(a.data.filter(al=>al.hospital?._id===hospitalId||al.hospital?._id?.toString()===hospitalId));
      setAmbulances(ambs.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[hospitalId]);

  useEffect(()=>{ loadHospital(); const t=setInterval(loadHospital,30000); return()=>clearInterval(t); },[loadHospital]);
  useEffect(()=>{ loadPendingTransfers(); },[loadPendingTransfers]);

  // Resource reminder — check every 2 min, warn if stale >30 min
  useEffect(()=>{
    if(!hospitalId) return;
    const check=setInterval(()=>{
      if(hospital?.lastUpdated){
        const minsAgo=Math.floor((Date.now()-new Date(hospital.lastUpdated))/60000);
        if(minsAgo>=30) setResourceReminder(true);
      }
    },2*60*1000);
    return()=>clearInterval(check);
  },[hospital?.lastUpdated,hospitalId]);

  useEffect(()=>{
    if(!hospitalId) return;
    socket.on("hospitalResourceUpdate",()=>loadHospital());
    socket.on("resourceAlert",d=>{
      if(d.hospitalId?.toString()===hospitalId){ loadHospital(); showToast("⚠️ "+d.message,"error"); }
    });
    socket.on(`hospital:${hospitalId}:alert`,d=>{ setIncomingAlert(d); showToast("🚨 "+d.message,"error"); });
    socket.on(`hospital:${hospitalId}:newAppointment`,d=>{ showToast(`📅 New appointment: ${d.appointment?.patientName}`); });
    socket.on("newTransfer", d=>{
      // Only show toast if this hospital is destination
      if(d.toHospital===hospitalId || d.toHospitalId===hospitalId || d.toHospital?._id===hospitalId){
        showToast(`🔄 Incoming transfer: ${d.patientName||"Patient"} from ${d.fromName||"another hospital"}`,"error");
        loadPendingTransfers();
      }
    });
    socket.on("transferUpdate", ()=>loadPendingTransfers());
    socket.on("emergencyUpdate",()=>loadHospital());
    socket.on("ambulanceSimStarted",()=>loadHospital());
    socket.on("ambulanceArrived",()=>loadHospital());
    return()=>{
      ["hospitalResourceUpdate","resourceAlert","emergencyUpdate","ambulanceSimStarted","ambulanceArrived"].forEach(ev=>socket.off(ev));
      socket.off(`hospital:${hospitalId}:alert`);
      socket.off(`hospital:${hospitalId}:newAppointment`);
    };
  },[hospitalId,loadHospital]);

  const saveResources=async()=>{
    setSaving(true);
    try{
      await api.put(`/hospitals/${hospitalId}/resources`,{resources,updatedBy:localStorage.getItem("name")||"Operator"});
      showToast("Resources updated ✓"); setEditing(false); setResourceReminder(false); loadHospital();
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const setRes=(key,field,val)=>setResources(p=>({...p,[key]:field?{...(p[key]||{}),[field]:+val}:+val}));
  const resolveAlert=async id=>{ try{await api.patch(`/hospitals/alerts/${id}/resolve`);loadHospital();}catch(e){} };

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading hospital dashboard…</div>;
  if(!hospital) return (
    <div style={{textAlign:"center",padding:80}}>
      <div style={{fontSize:42,marginBottom:12}}>🏥</div>
      <div style={{color:"var(--red)",fontFamily:"var(--font-display)",fontSize:16,marginBottom:8}}>Hospital not found or not assigned</div>
      <div style={{fontSize:12,color:"var(--text-muted)"}}>Your account may not be linked to a hospital. Contact admin.</div>
      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>Hospital ID: {hospitalId||"none"}</div>
    </div>
  );

  const r=hospital.resources||{};
  const ac=ALERT_C[hospital.alertLevel]||"var(--green)";
  const activeEmgs = emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status));

  return(
    <div>
      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:20,right:24,zIndex:9999,background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 18px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13,boxShadow:"var(--shadow-md)"}}>{toast.msg}</div>}

      {/* Resource reminder */}
      {resourceReminder&&(
        <div style={{background:"var(--orange-dim)",border:"1px solid var(--orange)",borderRadius:"var(--radius-md)",padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>⏰</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--orange)",fontSize:13}}>Resource Update Reminder</div>
            <div style={{fontSize:11,color:"var(--text-secondary)"}}>Data is over 30 minutes old. Please update resource availability.</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditing(true);setTab("resources");setResourceReminder(false);}}>Update Now</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setResourceReminder(false)}>Later</button>
        </div>
      )}

      {/* Incoming patient alert */}
      {incomingAlert&&(
        <div style={{background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:"var(--radius-md)",padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:14}}>🚨 INCOMING PATIENT</div>
            <div style={{fontSize:12,color:"var(--text-secondary)",marginTop:4}}>{incomingAlert.message}</div>
            {incomingAlert.eta&&<div style={{fontSize:12,color:"var(--orange)",marginTop:3}}>ETA ~{incomingAlert.eta} min</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setIncomingAlert(null)}>Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontFamily:"var(--font-display)",fontSize:22,color:"var(--text-primary)",marginBottom:4}}>{hospital.name}</h2>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>{hospital.location?.address}, {hospital.location?.city} · {hospital.type} · {hospital.level}</div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <span style={{background:`${ac}22`,color:ac,border:`1px solid ${ac}44`,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700}}>{hospital.alertLevel} ALERT</span>
            <span className={`badge ${hospital.status==="Active"?"badge-green":hospital.status==="Overwhelmed"?"badge-red":"badge-muted"}`}>{hospital.status}</span>
            {hospital.govRegistration?.ayushmanEmpanelled&&<span className="badge badge-green">✓ Ayushman</span>}
            {hospital.tier&&<span className={`badge ${hospital.tier==="Tier1"?"badge-green":hospital.tier==="Tier2"?"badge-accent":"badge-purple"}`}>{hospital.tier}</span>}
            <span className="badge badge-muted">Updated: {hospital.lastUpdated?new Date(hospital.lastUpdated).toLocaleTimeString():"—"}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-primary btn-sm" style={{background:"var(--orange)",borderColor:"var(--orange)"}} onClick={()=>setShowDispatch(true)}>🚑 Dispatch Ambulance</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditing(true);setTab("resources");}}>📊 Update Resources</button>
          <button className="btn btn-ghost btn-sm" onClick={loadHospital}>↺</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-20" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[
          ["dashboard","📊 Dashboard"],
          ["resources","⚙ Resources"],
          ["others","🏥 Other Hospitals"],
          ["emergencies","🚨 Emergencies"],
          ["appointments","📅 Appointments"],
          ["alerts","🔔 Alerts"],
          ["transfers","🔄 Transfers"],
          ["patients","👥 Patients"],
        ].map(([id,lbl])=>(
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
            {lbl}
            {id==="alerts"&&alerts.length>0&&<span style={{display:"inline-flex",width:16,height:16,borderRadius:"50%",background:"var(--red)",color:"#fff",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,marginLeft:5}}>{alerts.length}</span>}
            {id==="emergencies"&&activeEmgs.length>0&&<span style={{display:"inline-flex",width:16,height:16,borderRadius:"50%",background:"var(--orange)",color:"#fff",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,marginLeft:5}}>{activeEmgs.length}</span>}
            {id==="transfers"&&pendingTransfers>0&&<span style={{display:"inline-flex",width:16,height:16,borderRadius:"50%",background:"var(--yellow)",color:"#000",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,marginLeft:5}}>{pendingTransfers}</span>}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────── */}
      {tab==="dashboard"&&(
        <>
          <StatsRow hospitals={hospital?[hospital]:[]} emergencies={activeEmgs}/>
          <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",marginBottom:20}}>
            <ResCard label="ICU Beds"     icon="🛏" available={r.icuBeds?.available||0}    total={r.icuBeds?.total||0}    color="var(--accent)"/>
            <ResCard label="General Beds" icon="🏨" available={r.generalBeds?.available||0} total={r.generalBeds?.total||0} color="var(--purple)"/>
            <ResCard label="Ventilators"  icon="💨" available={r.ventilators?.available||0} total={r.ventilators?.total||0} color="var(--green)"/>
            <ResCard label="Ambulances"   icon="🚑" available={r.ambulancesAvailable||0}    total={r.ambulancesTotal||0}    color="var(--orange)"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:14,marginBottom:20}}>
            {[["O₂ Level",`${r.oxygenLevel||0}%`,(r.oxygenLevel||0)>50?"var(--green)":"var(--red)","💧"],
              ["Blood Units",r.bloodUnitsAvailable||0,"var(--red)","🩸"],
              ["Doctors",r.doctorsOnDuty||0,"var(--accent)","👨‍⚕️"],
              ["Nurses",r.nursesOnDuty||0,"var(--green)","👩‍⚕️"],
              ["Active Alerts",alerts.length,alerts.length>0?"var(--red)":"var(--green)","⚠️"],
              ["Active Emg",activeEmgs.length,activeEmgs.length>0?"var(--orange)":"var(--green)","🚨"],
              ["Trust Score",`${hospital.trustScore||75}/100`,"var(--yellow)","⭐"],
              ["Acceptance",`${hospital.acceptanceRate||100}%`,"var(--green)","✅"],
            ].map(([lbl,val,clr,ic])=>(
              <div key={lbl} className="stat-card"><div className="stat-label">{ic} {lbl}</div><div className="stat-value" style={{color:clr,fontSize:24}}>{val}</div></div>
            ))}
          </div>
          {/* Ambulances list */}
          {ambulances.length>0&&(
            <div className="card card-sm" style={{marginBottom:14}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--orange)",marginBottom:8}}>🚑 Our Ambulances</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {ambulances.slice(0,8).map(a=>(
                  <div key={a._id} style={{background:"var(--bg-elevated)",border:`1px solid ${a.status==="Available"?"var(--green)":"var(--border)"}`,borderRadius:"var(--radius-md)",padding:"6px 12px",fontSize:11}}>
                    <div style={{fontWeight:600,color:"var(--text-primary)"}}>{a.ambulanceId}</div>
                    <div style={{color:a.status==="Available"?"var(--green)":a.status==="Dispatched"?"var(--orange)":"var(--text-muted)",fontSize:10}}>{a.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hospital.specialties?.length>0&&(
            <div className="card card-sm">
              <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>🏥 Specialties</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {hospital.specialties.map(s=><span key={s} className="badge badge-muted">{s}</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RESOURCES ─────────────────────────────────────────── */}
      {tab==="resources"&&(
        <div>
          {!editing&&<div style={{marginBottom:14}}><button className="btn btn-primary" onClick={()=>setEditing(true)}>✎ Edit Resources</button></div>}
          {editing&&(
            <div className="card" style={{marginBottom:14}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:16}}>📊 Update Live Resources</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
                {[["ICU Beds","icuBeds"],["General Beds","generalBeds"],["Emergency Beds","emergencyBeds"],["Ventilators","ventilators"],["Oxygen Beds","oxygenBeds"],["Dialysis","dialysisMachines"]].map(([lbl,key])=>(
                  <div key={key} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>{lbl}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><label className="form-label" style={{fontSize:9}}>Available</label><input className="input" type="number" min={0} value={resources[key]?.available||0} onChange={e=>setRes(key,"available",e.target.value)}/></div>
                      <div><label className="form-label" style={{fontSize:9}}>Total</label><input className="input" type="number" min={0} value={resources[key]?.total||0} onChange={e=>setRes(key,"total",e.target.value)}/></div>
                    </div>
                  </div>
                ))}
                {[["Oxygen Level %","oxygenLevel"],["Doctors on Duty","doctorsOnDuty"],["Nurses on Duty","nursesOnDuty"],["Blood Units","bloodUnitsAvailable"],["Ambulances Available","ambulancesAvailable"],["Ambulances Total","ambulancesTotal"]].map(([lbl,key])=>(
                  <div key={key} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:8}}>{lbl}</div>
                    <input className="input" type="number" min={0} max={key==="oxygenLevel"?100:undefined} value={resources[key]||0} onChange={e=>setRes(key,null,e.target.value)}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid var(--border)"}}>
                <button className="btn btn-ghost" onClick={()=>setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={saveResources}>{saving?"Saving…":"💾 Save Resources"}</button>
              </div>
            </div>
          )}
          {!editing&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
              {[["ICU Beds",r.icuBeds,"var(--accent)"],["General Beds",r.generalBeds,"var(--purple)"],["Emergency Beds",r.emergencyBeds,"var(--orange)"],["Ventilators",r.ventilators,"var(--green)"],["Dialysis",r.dialysisMachines,"var(--yellow)"]].map(([lbl,b,c])=>b&&(
                <div key={lbl} className="card card-sm">
                  <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>{lbl}</div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:700,color:c}}>{b.available||0}<span style={{fontSize:12,color:"var(--text-muted)"}}>/{b.total||0}</span></div>
                  <div style={{height:4,background:"var(--bg-primary)",borderRadius:2,marginTop:6}}>
                    <div style={{width:`${pct(b.available,b.total)}%`,height:"100%",background:barClr(pct(b.available,b.total)),borderRadius:2}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OTHER HOSPITALS ──────────────────────────────────── */}
      {tab==="others"&&<OtherHospitalsResources currentHospitalId={hospitalId}/>}

      {/* ── EMERGENCIES ───────────────────────────────────────── */}
      {tab==="emergencies"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:"var(--text-muted)"}}>{emergencies.length} total · {activeEmgs.length} active</div>
            <button className="btn btn-primary btn-sm" style={{background:"var(--orange)",borderColor:"var(--orange)"}} onClick={()=>setShowDispatch(true)}>🚑 Dispatch Ambulance</button>
          </div>
          {emergencies.length===0&&<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>No emergencies assigned to this hospital</div>}
          {emergencies.map(em=>(
            <div key={em._id} className="card card-sm" style={{marginBottom:10,borderLeft:`3px solid ${em.severity==="Critical"?"var(--red)":em.severity==="High"?"var(--orange)":"var(--yellow)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                <div>
                  <span className={`badge ${em.severity==="Critical"?"badge-red":em.severity==="High"?"badge-orange":"badge-yellow"}`} style={{marginRight:8}}>{em.severity}</span>
                  <span style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{em.type}</span>
                </div>
                <span className="badge badge-muted">{em.status}</span>
              </div>
              <div style={{fontSize:12,color:"var(--text-secondary)"}}>Patient: {em.patientName||"Unknown"} · {em.location?.locationName||em.location?.address||"—"}</div>
              {em.assignedAmbulance&&<div style={{fontSize:11,color:"var(--orange)",marginTop:3}}>🚑 {em.assignedAmbulance.ambulanceId}{em.estimatedArrivalTime>0?` · ETA ~${em.estimatedArrivalTime}min`:""}</div>}
              {em.aiRecommendation&&<div style={{fontSize:11,color:"var(--accent)",marginTop:4,lineHeight:1.5}}>🤖 {em.aiRecommendation}</div>}
              <div style={{fontSize:10,color:"var(--text-dim)",marginTop:4}}>{new Date(em.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── APPOINTMENTS ─────────────────────────────────────── */}
      {tab==="appointments"&&<AppointmentsPanel hospitalId={hospitalId}/>}

      {/* ── ALERTS ───────────────────────────────────────────── */}
      {tab==="alerts"&&(
        <div>
          {alerts.length===0&&<div style={{textAlign:"center",padding:60}}><div style={{fontSize:36,marginBottom:10}}>✅</div><div style={{color:"var(--green)"}}>No active alerts</div></div>}
          {alerts.map(a=>(
            <div key={a._id} className="card card-sm" style={{marginBottom:10,borderLeft:`3px solid ${a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}`,display:"flex",gap:12,alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}}>{a.alertType} — {a.resource}</div>
                <div style={{fontSize:12,color:"var(--text-secondary)"}}>{a.message}</div>
                <div style={{fontSize:10,color:"var(--text-dim)",marginTop:3}}>{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>resolveAlert(a._id)}>✓ Resolve</button>
            </div>
          ))}
        </div>
      )}

      {tab==="transfers"&&<TransfersPanel hospitalId={hospitalId}/>}
      {tab==="patients"&&<PatientsTab hospitalId={hospitalId}/>}

      {/* Dispatch modal */}
      {showDispatch&&<DispatchModal hospitalId={hospitalId} onClose={()=>setShowDispatch(false)} onSuccess={()=>{loadHospital();showToast("Ambulance dispatched!");}}/>}
    </div>
  );
}
