import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import socket from "../services/socket";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ALERT_COLOR={Red:"#ff4060",Orange:"#ff8f00",Yellow:"#ffd600",Normal:"#00e676"};
const STATUS_STEPS=[
  {s:"Reported",        l:"Request Received",    i:"📋"},
  {s:"AmbulanceRequested",l:"Finding Ambulance", i:"🔍"},
  {s:"AmbulanceAccepted",l:"Ambulance Confirmed",i:"✅"},
  {s:"EnRoute",          l:"Ambulance En Route", i:"🚑"},
  {s:"OnScene",          l:"Ambulance On Scene", i:"👨‍⚕️"},
  {s:"TransportingToHospital",l:"Going to Hospital",i:"🏥"},
  {s:"Resolved",         l:"Resolved",           i:"✅"},
];

function createHospitalIcon(h) {
  const c = ALERT_COLOR[h.alertLevel]||"#4e7090";
  const r=h.resources||{};
  return L.divIcon({
    className:"",
    html:`<div style="background:#0d1e35;border:2px solid ${c};border-radius:8px;padding:5px 9px;min-width:120px;box-shadow:0 2px 12px rgba(0,0,0,.5);cursor:pointer">
      <div style="font-size:8px;color:${c};font-weight:700;letter-spacing:1px">${h.alertLevel}</div>
      <div style="font-size:11px;font-weight:700;color:#e8f1fa;margin:2px 0">${h.name.length>22?h.name.slice(0,20)+"…":h.name}</div>
      <div style="font-size:9px;color:#4e7090;margin-bottom:3px">${h.location?.city||""} · ${Math.round(h.distKm||0)}km</div>
      <div style="font-size:10px;color:#8aaccc">🛏 ICU ${r.icuBeds?.available||0}/${r.icuBeds?.total||0}</div>
    </div>`,
    iconAnchor:[60,0],
  });
}

// Emergency Request Form
function EmergencyForm({ onSubmit, onClose, userLocation }) {
  const [step,setStep]=useState(1);
  const [f,setF]=useState({
    type:"Other", severity:"High",
    patientName:"", patientAge:"", patientPhone:"",
    description:"", address:"",
    lat: userLocation?.lat||"", lng: userLocation?.lng||"",
    requiredFacilities:[],
    reporterName:"", reporterPhone:"",
  });
  const [submitting,setSubmitting]=useState(false);
  const [locating,setLocating]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleFac=fc=>setF(p=>({...p,requiredFacilities:p.requiredFacilities.includes(fc)?p.requiredFacilities.filter(x=>x!==fc):[...p.requiredFacilities,fc]}));

  const getGPS=()=>{
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(pos=>{ s("lat",pos.coords.latitude.toFixed(6)); s("lng",pos.coords.longitude.toFixed(6)); setLocating(false); },()=>setLocating(false),{enableHighAccuracy:true});
  };

  const submit=async()=>{
    setSubmitting(true);
    try { const result=await onSubmit(f); return result; }
    catch(e){ alert("Error: "+e.message); setSubmitting(false); }
  };

  const TYPES=[["Cardiac","🫀"],["Stroke","🧠"],["Trauma","🤕"],["Respiratory","💨"],["Obstetric","🤱"],["Pediatric","👶"],["Burns","🔥"],["Other","⚕️"]];
  const FACS=[["ICU","🛏"],["Ventilator","💨"],["BloodBank","🩸"],["Trauma","🚑"]];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:"var(--radius-md)",padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:24}}>🚨</span>
          <div>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:15}}>Emergency Ambulance Request</div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>Nearest available ambulance will be dispatched immediately</div>
          </div>
        </div>

        {step===1&&<>
          <div style={{marginBottom:14}}>
            <label className="form-label">Emergency Type *</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {TYPES.map(([t,i])=>(
                <button key={t} type="button" onClick={()=>s("type",t)} style={{padding:"10px 8px",border:`1px solid ${f.type===t?"var(--red)":"var(--border)"}`,background:f.type===t?"var(--red-dim)":"var(--bg-elevated)",color:f.type===t?"var(--red)":"var(--text-secondary)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:11,textAlign:"center",transition:"all .15s"}}>
                  <div style={{fontSize:20,marginBottom:3}}>{i}</div>{t}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label className="form-label">Severity</label>
            <div style={{display:"flex",gap:8}}>
              {[["Critical","var(--red)"],["High","var(--orange)"],["Medium","var(--yellow)"],["Low","var(--green)"]].map(([sv,c])=>(
                <button key={sv} type="button" onClick={()=>s("severity",sv)} style={{flex:1,padding:"8px",border:`1px solid ${f.severity===sv?c:"var(--border)"}`,background:f.severity===sv?`${c}22`:"var(--bg-elevated)",color:f.severity===sv?c:"var(--text-secondary)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:12,fontWeight:f.severity===sv?700:400}}>
                  {sv}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label className="form-label">Required Facilities</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {FACS.map(([fc,i])=>(
                <button key={fc} type="button" onClick={()=>toggleFac(fc)} style={{padding:"6px 12px",border:`1px solid ${f.requiredFacilities.includes(fc)?"var(--accent)":"var(--border)"}`,background:f.requiredFacilities.includes(fc)?"var(--accent-dim)":"var(--bg-elevated)",color:f.requiredFacilities.includes(fc)?"var(--accent)":"var(--text-secondary)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:12}}>
                  {i} {fc}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>setStep(2)}>Next: Your Location →</button>
          </div>
        </>}

        {step===2&&<>
          <div style={{marginBottom:14}}>
            <label className="form-label">Your Location *</label>
            <button className="btn btn-primary btn-sm" onClick={getGPS} disabled={locating} style={{marginBottom:10,width:"100%",justifyContent:"center",padding:"10px"}}>
              {locating?"🔄 Detecting GPS…":"📍 Auto-Detect My Location"}
            </button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label className="form-label">Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)} placeholder="23.1815" required/></div>
              <div><label className="form-label">Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)} placeholder="79.9864" required/></div>
            </div>
            <div style={{marginTop:10}}><label className="form-label">Address / Landmark</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Near XYZ, Street name, Landmark…"/></div>
          </div>
          <div style={{marginBottom:14}}>
            <label className="form-label">Patient Details</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Patient Name"/></div>
              <div><input className="input" type="number" value={f.patientAge} onChange={e=>s("patientAge",e.target.value)} placeholder="Age"/></div>
            </div>
            <input className="input" style={{marginTop:8}} value={f.description} onChange={e=>s("description",e.target.value)} placeholder="Brief description of emergency…"/>
          </div>
          <div style={{marginBottom:14}}>
            <label className="form-label">Your Contact (optional)</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <input className="input" value={f.reporterName} onChange={e=>s("reporterName",e.target.value)} placeholder="Your Name"/>
              <input className="input" value={f.reporterPhone} onChange={e=>s("reporterPhone",e.target.value)} placeholder="Your Phone"/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:16}}>
            <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{background:"var(--red)",borderColor:"var(--red)",padding:"10px 24px",fontSize:14}} onClick={submit} disabled={submitting||!f.lat||!f.lng}>
              {submitting?"🔄 Sending…":"🚨 Request Ambulance NOW"}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

// Live tracking component
function LiveTracker({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/emergencies/track/${requestId}`);
      setData(r.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    socket.on("emergencyUpdate", d => { if(d.requestId === requestId) setData(d); });
    return () => socket.off("emergencyUpdate");
  }, [requestId]);

  const statusIdx = data ? STATUS_STEPS.findIndex(s=>s.s===data.status) : -1;

  if (loading) return <div style={{padding:40,textAlign:"center",color:"var(--text-muted)"}}>Loading tracking…</div>;
  if (!data)   return <div style={{padding:40,textAlign:"center",color:"var(--red)"}}>Emergency not found</div>;

  return (
    <div>
      <div style={{background:"var(--accent-dim)",border:"1px solid var(--accent)",borderRadius:"var(--radius-md)",padding:14,marginBottom:16}}>
        <div style={{fontFamily:"var(--font-display)",fontSize:13,fontWeight:700,color:"var(--accent)",marginBottom:4}}>
          🚨 Emergency #{data.requestId} — {data.type} — {data.severity}
        </div>
        <div style={{fontSize:11,color:"var(--text-muted)"}}>Patient: {data.patientName} · {data.location?.address}</div>
      </div>

      {/* Status timeline */}
      <div style={{marginBottom:20}}>
        {STATUS_STEPS.slice(0,6).map((st,i)=>{
          const done   = statusIdx > i;
          const active = statusIdx === i;
          return (
            <div key={st.s} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:done?"var(--green)":active?"var(--accent)":"var(--bg-elevated)",border:`2px solid ${done?"var(--green)":active?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                {done?"✓":st.i}
              </div>
              <div style={{paddingTop:4}}>
                <div style={{fontSize:13,fontWeight:active?700:400,color:done?"var(--green)":active?"var(--text-primary)":"var(--text-muted)"}}>{st.l}</div>
                {active&&<div style={{fontSize:11,color:"var(--accent)",animation:"pulse-text 1.5s infinite"}}>● In progress…</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assigned ambulance */}
      {data.assignedAmbulance&&(
        <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,marginBottom:14}}>
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--orange)",marginBottom:8}}>🚑 ASSIGNED AMBULANCE</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{data.assignedAmbulance.name||data.assignedAmbulance.ambulanceId}</div>
          <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>
            Driver: {data.assignedAmbulance.driver||"—"}
            {data.assignedAmbulance.driverPhone&&<> · 📞 {data.assignedAmbulance.driverPhone}</>}
          </div>
          {data.estimatedArrivalTime>0&&<div style={{fontSize:12,color:"var(--accent)",marginTop:4}}>ETA: ~{data.estimatedArrivalTime} minutes</div>}
        </div>
      )}

      {/* Assigned hospital */}
      {data.assignedHospital&&(
        <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,marginBottom:14}}>
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--green)",marginBottom:8}}>🏥 ASSIGNED HOSPITAL</div>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{data.assignedHospital.name}</div>
          <div style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>📍 {data.assignedHospital.location?.city}</div>
          {data.assignedHospital.contact?.emergency&&<div style={{fontSize:12,color:"var(--accent)",marginTop:4}}>📞 Emergency: {data.assignedHospital.contact.emergency}</div>}
        </div>
      )}

      {/* AI Recommendation */}
      {data.aiRecommendation&&(
        <div style={{background:"rgba(0,200,255,.05)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:12,fontSize:11,color:"var(--text-secondary)",lineHeight:1.6}}>
          🤖 <strong style={{color:"var(--accent)"}}>AI Guide:</strong> {data.aiRecommendation}
        </div>
      )}

      <div style={{marginTop:16,display:"flex",gap:10}}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close Tracker</button>
        <button className="btn btn-primary btn-sm" onClick={load}>↺ Refresh</button>
      </div>
    </div>
  );
}

export default function CitizenPortal({ onBack, onStaffLogin, showStaffLoginButton }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState("map");  // map | list | emergency | track
  const [showForm, setShowForm]   = useState(false);
  const [trackId, setTrackId]     = useState(null);
  const [userPos, setUserPos]     = useState(null);
  const [locating, setLocating]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const loadHospitals = useCallback(async (lat, lng) => {
    try {
      const url = lat && lng ? `/emergencies/nearby-hospitals?lat=${lat}&lng=${lng}` : "/hospitals/public";
      const r = await api.get(url);
      setHospitals(r.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const detectLocation = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserPos({ lat, lng });
      loadHospitals(lat, lng);
      setLocating(false);
    }, () => { loadHospitals(); setLocating(false); }, { enableHighAccuracy: true });
  };

  useEffect(() => { loadHospitals(); }, [loadHospitals]);

  const submitEmergency = async (form) => {
    const r = await api.post("/emergencies", form);
    setSubmitted(r.data);
    setShowForm(false);
    setTrackId(r.data.requestId);
    setView("track");
    return r.data;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏥</span>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Healthcare Platform</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Citizen Emergency Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {showStaffLoginButton && (
            <button onClick={onStaffLogin} className="btn btn-ghost btn-sm" style={{ fontSize: 11, border:"1px solid var(--border)" }}>
              🔑 Staff Login
            </button>
          )}
          {onBack && !showStaffLoginButton && (
            <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ fontSize: 11 }}>← Back</button>
          )}
        </div>
      </div>

      {/* Emergency CTA */}
      {view !== "track" && (
        <div style={{ background: "linear-gradient(135deg, #1a0000, #2d0a0a)", borderBottom: "1px solid var(--red)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--red)" }}>🚨 Medical Emergency?</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Request an ambulance immediately — we'll find the nearest one</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={detectLocation} disabled={locating} className="btn btn-ghost btn-sm">
              {locating ? "🔄 Locating…" : "📍 Detect My Location"}
            </button>
            <button onClick={() => setShowForm(true)} style={{ background: "var(--red)", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "var(--radius-md)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 0.5 }}>
              🚑 Request Ambulance
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "0 20px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[["map","🗺 Hospital Map"],["list","📋 Hospital List"],...((trackId||submitted)?[["track","📡 Track Emergency"]]:[])].map(([v,l])=>(
          <button key={v} className={`tab-btn ${view===v?"active":""}`} onClick={()=>setView(v)}>{l}</button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {/* MAP VIEW */}
        {view === "map" && (
          <div>
            {userPos && (
              <div className="badge badge-green" style={{ marginBottom: 12 }}>
                📍 Your location detected — showing nearest hospitals
              </div>
            )}
            <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border)", height: 520, position: "relative" }}>
              <MapContainer center={userPos ? [userPos.lat, userPos.lng] : [23.18, 79.98]} zoom={userPos ? 11 : 7} style={{ height: "100%", width: "100%", background: "#0a1628" }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
                {userPos && (
                  <CircleMarker center={[userPos.lat, userPos.lng]} radius={14} pathOptions={{ color:"#ff4060", fillColor:"#ff4060", fillOpacity:0.8, weight:3 }}>
                    <Popup><div style={{ color: "#e8f1fa", background: "#0d1e35", padding: 8 }}><b>📍 Your Location</b></div></Popup>
                  </CircleMarker>
                )}
                {hospitals.map(h => h.location?.lat && (
                  <Marker key={h._id} position={[h.location.lat, h.location.lng]} icon={createHospitalIcon(h)}>
                    <Popup>
                      <div style={{ fontFamily: "system-ui", background: "#0d1e35", color: "#e8f1fa", minWidth: 220, padding: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{h.name}</div>
                        <div style={{ fontSize: 11, color: "#8aaccc", marginBottom: 6 }}>{h.type} · {h.location.city}{h.distKm ? ` · ${h.distKm}km` : ""}</div>
                        {[["ICU Beds",h.resources?.icuBeds],["General Beds",h.resources?.generalBeds],["Ventilators",h.resources?.ventilators]].map(([lbl,b])=>b&&(
                          <div key={lbl} style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3 }}><span style={{ color:"#4e7090" }}>{lbl}</span><span style={{ color:"#00c8ff",fontWeight:700 }}>{b.available}/{b.total}</span></div>
                        ))}
                        <div style={{ fontSize:11,marginTop:4 }}>O₂: <span style={{ color:(h.resources?.oxygenLevel||0)>50?"#00e676":"#ff4060",fontWeight:700 }}>{h.resources?.oxygenLevel||0}%</span></div>
                        <div style={{ fontSize:11,marginTop:4 }}>📞 {h.contact?.emergency||h.contact?.phone||"—"}</div>
                        {h.resources?.doctorsOnDuty>0 && <div style={{ fontSize:11 }}>👨‍⚕️ {h.resources.doctorsOnDuty} doctors on duty</div>}
                        <button onClick={()=>setSelected(h)} style={{ marginTop:8,background:"var(--accent)",border:"none",color:"#000",padding:"5px 12px",borderRadius:4,fontSize:11,cursor:"pointer",width:"100%" }}>View Details</button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              <div style={{ position:"absolute",top:12,right:12,background:"rgba(13,30,53,.92)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px 14px",zIndex:1000 }}>
                <div style={{ fontSize:10,color:"var(--accent)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>Alert Level</div>
                {Object.entries(ALERT_COLOR).map(([l,c])=>(
                  <div key={l} style={{ display:"flex",alignItems:"center",gap:7,marginBottom:5,fontSize:11,color:"var(--text-muted)" }}>
                    <div style={{ width:10,height:10,borderRadius:"50%",background:c }}/><span>{l}</span>
                    <span style={{ marginLeft:"auto",fontWeight:700,color:"var(--text-primary)" }}>{hospitals.filter(h=>h.alertLevel===l).length}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === "list" && (
          <div>
            {loading ? <div style={{ textAlign:"center",padding:60,color:"var(--text-muted)" }}>Loading hospitals…</div> : (
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14 }}>
                {hospitals.map(h => {
                  const r=h.resources||{};
                  const ac=ALERT_COLOR[h.alertLevel]||"#4e7090";
                  return (
                    <div key={h._id} className="card" style={{ borderTop:`3px solid ${ac}` }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                        <div>
                          <div style={{ fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)" }}>{h.name}</div>
                          <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:2 }}>📍 {h.location?.city} · {h.type}{h.distKm?` · ${h.distKm}km away`:""}</div>
                        </div>
                        <span style={{ background:`${ac}22`,color:ac,border:`1px solid ${ac}44`,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700 }}>{h.alertLevel}</span>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                        {[["🛏 ICU Beds",r.icuBeds?.available,r.icuBeds?.total,"var(--accent)"],["🏨 General",r.generalBeds?.available,r.generalBeds?.total,"var(--purple)"],["💨 Vents",r.ventilators?.available,r.ventilators?.total,"var(--green)"],["🚑 Ambulance",r.ambulancesAvailable,r.ambulancesTotal,"var(--orange)"]].map(([lbl,a,t,c])=>(
                          <div key={lbl} style={{ background:"var(--bg-elevated)",borderRadius:"var(--radius-md)",padding:"8px 10px",textAlign:"center" }}>
                            <div style={{ fontSize:10,color:"var(--text-muted)",marginBottom:3 }}>{lbl}</div>
                            <div style={{ fontFamily:"var(--font-display)",fontSize:16,fontWeight:700,color:c }}>{a||0}/{t||0}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        <span className={`badge ${(r.oxygenLevel||0)>50?"badge-green":"badge-red"}`}>O₂ {r.oxygenLevel||0}%</span>
                        {r.bloodBank&&<span className="badge badge-accent">🩸 Blood Bank</span>}
                        {r.ctScan&&<span className="badge badge-muted">CT Scan</span>}
                        {h.traumaCenter&&<span className="badge badge-red">🚑 Trauma</span>}
                      </div>
                      {h.contact?.emergency&&<div style={{ fontSize:11,color:"var(--accent)",marginTop:8 }}>📞 Emergency: {h.contact.emergency}</div>}
                      {r.doctorsOnDuty>0&&<div style={{ fontSize:11,color:"var(--text-muted)",marginTop:4 }}>👨‍⚕️ {r.doctorsOnDuty} doctors · 👩‍⚕️ {r.nursesOnDuty||0} nurses on duty</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TRACK VIEW */}
        {view === "track" && trackId && <LiveTracker requestId={trackId} onClose={() => { setView("map"); setTrackId(null); }} />}
      </div>

      {/* Selected hospital detail */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div className="modal-title" style={{ margin:0 }}>🏥 {selected.name}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>✕</button>
            </div>
            <div style={{ fontSize:12,lineHeight:1.9,color:"var(--text-muted)" }}>
              <div><b style={{ color:"var(--text-primary)" }}>Type:</b> {selected.type} · {selected.level}</div>
              <div><b style={{ color:"var(--text-primary)" }}>Location:</b> {selected.location?.address}, {selected.location?.city}</div>
              <div><b style={{ color:"var(--text-primary)" }}>Emergency:</b> <span style={{ color:"var(--accent)" }}>{selected.contact?.emergency||"—"}</span></div>
              <div><b style={{ color:"var(--text-primary)" }}>ICU:</b> {selected.resources?.icuBeds?.available}/{selected.resources?.icuBeds?.total} available</div>
              <div><b style={{ color:"var(--text-primary)" }}>Oxygen:</b> {selected.resources?.oxygenLevel||0}%</div>
              {selected.specialties?.length>0&&<div><b style={{ color:"var(--text-primary)" }}>Specialties:</b> {selected.specialties.join(", ")}</div>}
              <div><b style={{ color:"var(--text-primary)" }}>Avg Wait:</b> {selected.avgPatientWait||0} min</div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <EmergencyForm onSubmit={submitEmergency} onClose={() => setShowForm(false)} userLocation={userPos} />
      )}
    </div>
  );
}
