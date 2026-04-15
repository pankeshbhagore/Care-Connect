import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import socket from "../services/socket";
import { reverseGeocode, forwardGeocode } from "../services/geocode";
import AIChatbot from "../components/AIChatbot";
import LiveTrackingMap from "../components/LiveTrackingMap";
import { AppointmentModal } from "../components/AppointmentBooking";

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
  topo:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};
const ALERT_C = {Red:"#ff4060",Orange:"#ff8f00",Yellow:"#ffd600",Normal:"#00e676"};
const SEV_C   = {Critical:"#ff4060",High:"#ff8f00",Medium:"#ffd600",Low:"#00e676"};
const TIER_C  = {Tier1:"#00e676",Tier2:"#00c8ff",Tier3:"#b388ff"};
const TIER_L  = {Tier1:"Government",Tier2:"Private Partner",Tier3:"Premium Private"};
const CRIT_KW = ["unconscious","not breathing","no pulse","cardiac arrest","seizure","unresponsive","drowning","gunshot"];
const HIGH_KW  = ["chest pain","difficulty breathing","severe pain","head injury","bleeding heavily","vomiting blood"];

const STATUS_STEPS = [
  {s:"Reported",l:"Request Received",i:"📋"},
  {s:"Queued",l:"Queued - Finding Ambulance",i:"⏳"},
  {s:"AmbulanceRequested",l:"Ambulance Being Located",i:"🔍"},
  {s:"AmbulanceAccepted",l:"Ambulance Confirmed",i:"✅"},
  {s:"EnRoute",l:"Ambulance En Route",i:"🚑"},
  {s:"OnScene",l:"Ambulance On Scene",i:"👨‍⚕️"},
  {s:"TransportingToHospital",l:"Going to Hospital",i:"🏥"},
  {s:"Resolved",l:"Resolved",i:"✅"},
];

function createHospIcon(h) {
  const c=ALERT_C[h.alertLevel]||"#4e7090";
  const tc=TIER_C[h.tier]||"#8a8a8a";
  const r=h.resources||{};
  return L.divIcon({
    className:"",
    html:`<div style="background:#fff;border:2px solid ${c};border-radius:10px;padding:6px 10px;min-width:130px;box-shadow:0 3px 14px rgba(0,0,0,.18);cursor:pointer;font-family:system-ui">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:8px;color:${c};font-weight:800;letter-spacing:1px">${h.alertLevel}</span>
        <span style="font-size:7px;color:${tc};font-weight:700">${h.tier||""}</span>
      </div>
      <div style="font-size:11px;font-weight:700;color:#0d1e35;line-height:1.2;margin-bottom:2px">${h.name.length>22?h.name.slice(0,20)+"...":h.name}</div>
      <div style="font-size:9px;color:#666;margin-bottom:2px">${h.location?.city||""}${h.distKm?" · "+h.distKm+"km":""}</div>
      <div style="font-size:10px">ICU <b style="color:${(r.icuBeds?.available||0)===0?"#ff4060":"#00a855"}">${r.icuBeds?.available||0}/${r.icuBeds?.total||0}</b> O2 <b style="color:${(r.oxygenLevel||100)<40?"#ff4060":"#00a855"}">${r.oxygenLevel||100}%</b></div>
    </div>`,
    iconAnchor:[65,0],
  });
}

function FlyTo({pos}) {
  const map=useMap();
  useEffect(()=>{if(pos)map.flyTo([pos.lat,pos.lng],13,{duration:1.5});},[pos?.lat,pos?.lng]);
  return null;
}

function LocationSearch({onSelect}) {
  const [q,setQ]=useState("");const [results,setResults]=useState([]);const [open,setOpen]=useState(false);
  const search=async()=>{if(q.length<3)return;const r=await forwardGeocode(q);setResults(r);setOpen(r.length>0);};
  return(
    <div style={{position:"relative"}}>
      <div style={{display:"flex",gap:6}}>
        <input className="input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Search address or landmark..." style={{flex:1}}/>
        <button className="btn btn-ghost btn-sm" onClick={search}>Search</button>
      </div>
      {open&&results.length>0&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",zIndex:2000,boxShadow:"var(--shadow-md)",maxHeight:180,overflowY:"auto"}}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>{onSelect(r.lat,r.lng,r.short);setOpen(false);setQ(r.short);}} style={{padding:"9px 14px",cursor:"pointer",fontSize:12,color:"var(--text-secondary)",borderBottom:"1px solid var(--border)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
              📍 {r.short}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── FIXED EmergencyForm: single step, auto GPS, name+phone optional ──
function EmergencyForm({onClose, onSubmit, userLocation}) {
  const [f, setF] = useState({
    type:"Other", severity:"High", description:"",
    address:"", locationName:"", lat:"", lng:"",
    reporterName:"", reporterPhone:"",
  });
  const [locating, setLocating]     = useState(false);
  const [locName,  setLocName]      = useState("");
  const [aiWarn,   setAiWarn]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locError, setLocError]     = useState("");
  const s = (k,v) => setF(p=>({...p,[k]:v}));

  // Auto-detect location immediately when form opens
  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng) {
      s("lat", userLocation.lat.toFixed(6));
      s("lng", userLocation.lng.toFixed(6));
      reverseGeocode(userLocation.lat, userLocation.lng).then(g => {
        const name = g?.short || (userLocation.lat.toFixed(4)+", "+userLocation.lng.toFixed(4));
        s("locationName", name); s("address", g?.full || name); setLocName(name);
      }).catch(()=>{});
    } else {
      detectGPS();
    }
  }, []);

  const detectGPS = () => {
    setLocating(true); setLocError("");
    if (!navigator.geolocation) {
      setLocError("GPS not available. Search your address below."); setLocating(false); return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude:lat, longitude:lng} = pos.coords;
        s("lat", lat.toFixed(6)); s("lng", lng.toFixed(6)); setLocating(false);
        try {
          const g = await reverseGeocode(lat, lng);
          const name = g?.short || (lat.toFixed(4)+", "+lng.toFixed(4));
          s("locationName", name); s("address", g?.full || name); setLocName(name);
        } catch(e) { setLocName(lat.toFixed(4)+", "+lng.toFixed(4)); }
      },
      () => { setLocating(false); setLocError("GPS denied. Search your address below."); },
      { enableHighAccuracy:true, timeout:10000 }
    );
  };

  const checkAI = desc => {
    const d=(desc||"").toLowerCase();
    if(CRIT_KW.some(k=>d.includes(k))) setAiWarn("AI Triage: CRITICAL detected — severity auto-upgraded.");
    else if(HIGH_KW.some(k=>d.includes(k))&&f.severity==="Low") setAiWarn("AI Triage: Suggests HIGH severity.");
    else setAiWarn("");
  };

  const submit = async () => {
    if (!f.lat || !f.lng) { alert("Location required. Detect GPS or search address."); return; }
    setSubmitting(true);
    try { await onSubmit(f); } catch(e) { alert("Error: "+e.message); setSubmitting(false); }
  };

  const TYPES=[["Cardiac","\u{1FAC0}"],["Stroke","\u{1F9E0}"],["Trauma","\u{1F915}"],["Respiratory","\u{1F4A8}"],["Obstetric","\u{1F931}"],["Pediatric","\u{1F476}"],["Burns","\u{1F525}"],["Other","\u{2695}\uFE0F"]];

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,maxHeight:"92vh",overflowY:"auto"}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:"var(--radius-md)",padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:22}}>🚨</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:15}}>Emergency Ambulance Request</div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>AI dispatches nearest ambulance · No login required</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Location */}
        <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,marginBottom:16}}>
          <div style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:11,color:"var(--text-secondary)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>📍 Your Location *</div>
          {locating&&(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",color:"var(--accent)",fontSize:13}}>
              <span style={{display:"inline-block",width:14,height:14,border:"2px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              Detecting your location...
            </div>
          )}
          {locName&&!locating&&(
            <div style={{background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:10,fontSize:13,color:"var(--green)",display:"flex",alignItems:"center",gap:8}}>
              <span>📍</span>
              <span style={{flex:1,fontWeight:500}}>{locName}</span>
              <button onClick={detectGPS} style={{background:"none",border:"none",cursor:"pointer",color:"var(--green)",fontSize:11,textDecoration:"underline"}}>Refresh</button>
            </div>
          )}
          {locError&&!locating&&(
            <div style={{background:"var(--orange-dim)",border:"1px solid var(--orange)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:10,fontSize:12,color:"var(--orange)"}}>
              ⚠️ {locError}
            </div>
          )}
          {!locName&&!locating&&(
            <button className="btn btn-primary btn-sm" onClick={detectGPS} style={{width:"100%",justifyContent:"center",marginBottom:10,padding:"10px"}}>
              📍 Detect My Location (GPS)
            </button>
          )}
          <div style={{marginBottom:10}}>
            <label className="form-label" style={{fontSize:11}}>Or search address / landmark</label>
            <LocationSearch onSelect={(lat,lng,name)=>{s("lat",lat.toFixed(6));s("lng",lng.toFixed(6));s("locationName",name);s("address",name);setLocName(name);setLocError("");}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label className="form-label" style={{fontSize:11}}>Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)} placeholder="auto-detected"/></div>
            <div><label className="form-label" style={{fontSize:11}}>Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)} placeholder="auto-detected"/></div>
          </div>
        </div>

        {/* Description */}
        <div style={{marginBottom:14}}>
          <label className="form-label">Description <span style={{color:"var(--text-dim)",fontWeight:400,fontSize:11}}>(optional — helps AI triage)</span></label>
          <textarea className="input" rows={2} value={f.description} onChange={e=>{s("description",e.target.value);checkAI(e.target.value);}} placeholder="e.g. unconscious, chest pain, not breathing..."/>
          {aiWarn&&<div style={{fontSize:11,color:"var(--orange)",marginTop:5,background:"var(--orange-dim)",padding:"6px 10px",borderRadius:"var(--radius-sm)"}}>🤖 {aiWarn}</div>}
        </div>

        {/* Contact — both optional */}
        <div style={{marginBottom:16}}>
          <label className="form-label">Your Contact <span style={{color:"var(--text-dim)",fontWeight:400,fontSize:11}}>(optional)</span></label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <input className="input" value={f.reporterName} onChange={e=>s("reporterName",e.target.value)} placeholder="Name (optional)"/>
            <input className="input" type="tel" value={f.reporterPhone} onChange={e=>s("reporterPhone",e.target.value)} placeholder="Mobile (optional)"/>
          </div>
        </div>

        {/* Submit */}
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"14px",fontSize:15,fontWeight:800,background:"var(--red)",borderColor:"var(--red)",letterSpacing:"0.5px",opacity:(!f.lat||!f.lng)?0.5:1}} onClick={submit} disabled={submitting||locating||!f.lat||!f.lng}>
          {submitting?"Sending request...":locating?"Waiting for location...":"🚑  Request Ambulance NOW"}
        </button>
        {(!f.lat||!f.lng)&&!locating&&(
          <div style={{textAlign:"center",fontSize:11,color:"var(--orange)",marginTop:8}}>Location required — detect GPS or search address above</div>
        )}
      </div>
    </div>
  );
}


export default function CitizenPortal({onStaffLogin,showStaffLoginButton}) {
  const [hospitals,setHospitals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("map");
  const [mapTile,setMapTile]=useState("street");
  const [showForm,setShowForm]=useState(false);
  const [trackId,setTrackId]=useState(null);
  const [userPos,setUserPos]=useState(null);
  const [locating,setLocating]=useState(false);
  const [flyTo,setFlyTo]=useState(null);
  const [toast,setToast]=useState(null);
  const [queueAlert,setQueueAlert]=useState(null);
  const [trackInput,setTrackInput]=useState("");
  const [bookingHospital,setBookingHospital]=useState(null);
  const [hospitalSearch,setHospitalSearch]=useState("");
  const [hospitalSearchCity,setHospitalSearchCity]=useState("All");
  const [directRequestHosp,setDirectRequestHosp]=useState(null);

  const showToast=(msg,type="info")=>{setToast({msg,type});setTimeout(()=>setToast(null),6000);};

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const t=p.get("track");
    if(t){setTrackId(t);setView("track");}
  },[]);

  const loadHospitals=useCallback(async(lat,lng)=>{
    try{
      const url=lat&&lng?`/emergencies/nearby-hospitals?lat=${lat}&lng=${lng}`:"/hospitals/public";
      const r=await api.get(url);setHospitals(r.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  const detectLocation=()=>{
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      setUserPos({lat,lng});setFlyTo({lat,lng});
      loadHospitals(lat,lng);setLocating(false);
    },()=>{loadHospitals();setLocating(false);showToast("GPS unavailable - showing all hospitals","error");},{enableHighAccuracy:true});
  };

  useEffect(()=>{loadHospitals();},[loadHospitals]);

  useEffect(()=>{
    socket.on("hospitalResourceUpdate",()=>loadHospitals(userPos?.lat,userPos?.lng));
    return()=>socket.off("hospitalResourceUpdate");
  },[loadHospitals,userPos]);

  const submitEmergency=async form=>{
    const r=await api.post("/emergencies",form);
    const data=r.data;
    if(data.isDuplicate){showToast(`Duplicate detected. Tracking existing: ${data.requestId}`,"error");setTrackId(data.requestId);setView("track");return data;}
    setTrackId(data.requestId);setShowForm(false);
    if(data.status==="Queued"){setQueueAlert({message:`No ambulance available. Queue position: #${data.queuePosition}. Auto-assigned when available.`,requestId:data.requestId});}
    else{showToast(`Ambulance dispatched! ID: ${data.requestId}`,"success");}
    setView("track");
    if(data.wasTriageUpgraded)showToast(`AI upgraded severity to ${data.severity}`,"error");
    return data;
  };

  const totalH=hospitals.length,t1=hospitals.filter(h=>h.tier==="Tier1").length;
  const availICU=hospitals.reduce((s,h)=>s+(h.resources?.icuBeds?.available||0),0);
  const TILE_LABELS={street:"Street",dark:"Dark",smooth:"Smooth",topo:"Topo"};

  return(
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="error"?"var(--red-dim)":toast.type==="success"?"var(--green-dim)":"var(--accent-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":toast.type==="success"?"var(--green)":"var(--accent)"}`,color:toast.type==="error"?"var(--red)":toast.type==="success"?"var(--green)":"var(--accent)",padding:"10px 22px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13,boxShadow:"var(--shadow-md)",maxWidth:480,textAlign:"center"}}>{toast.msg}</div>}

      {queueAlert&&(
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:9998,background:"var(--yellow-dim)",border:"1px solid var(--yellow)",borderRadius:"var(--radius-lg)",padding:"14px 20px",maxWidth:500,boxShadow:"var(--shadow-lg)",textAlign:"center"}}>
          <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--yellow)",marginBottom:4}}>Queued — No Ambulance Available Right Now</div>
          <div style={{fontSize:12,color:"var(--text-secondary)",marginBottom:8}}>{queueAlert.message}</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setQueueAlert(null)}>Dismiss</button>
        </div>
      )}

      <header style={{background:"var(--bg-card)",borderBottom:"1px solid var(--border)",padding:"12px 20px",position:"sticky",top:0,zIndex:500,boxShadow:"var(--shadow-sm)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:1400,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:26}}>🏥</div>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:16,color:"var(--text-primary)",letterSpacing:"1.5px"}}>CARE-CONNECT</div>
              <div style={{fontSize:9,color:"var(--text-muted)",letterSpacing:".8px"}}>AI EMERGENCY RESPONSE & HOSPITAL COORDINATION</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:10,fontSize:11,color:"var(--text-muted)"}}>
              <span>🏥 {totalH} Hospitals</span><span>🏛 {t1} Govt</span><span>🛏 {availICU} ICU Free</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--green)",fontWeight:700}}>
              <span style={{width:7,height:7,background:"var(--green)",borderRadius:"50%",display:"inline-block",boxShadow:"0 0 6px var(--green)"}}/>LIVE
            </div>
            {showStaffLoginButton&&<button onClick={onStaffLogin} className="btn btn-ghost btn-sm" style={{fontSize:11}}>Staff Login</button>}
          </div>
        </div>
      </header>

      {view!=="track"&&(
        <div style={{background:"linear-gradient(135deg,#1a0000,#2d0505,#1a0000)",borderBottom:"2px solid var(--red)",padding:"18px 20px"}}>
          <div style={{maxWidth:1400,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:800,color:"var(--red)",letterSpacing:"1px",marginBottom:2}}>Medical Emergency?</div>
              <div style={{fontSize:12,color:"rgba(255,100,100,.75)"}}>AI dispatches nearest ambulance · No login · Tracks automatically · Queue if busy</div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={detectLocation} disabled={locating} className="btn btn-ghost btn-sm" style={{color:"var(--text-secondary)",fontSize:12}}>{locating?"Detecting...":"📍 Detect Location"}</button>
              <button onClick={()=>setShowForm(true)} style={{background:"var(--red)",border:"2px solid #ff6060",color:"#fff",padding:"11px 26px",borderRadius:"var(--radius-md)",fontFamily:"var(--font-display)",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:"1px",boxShadow:"0 0 20px rgba(255,64,96,.4)"}}>
                REQUEST AMBULANCE
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:"var(--bg-card)",borderBottom:"1px solid var(--border)",overflowX:"auto"}}>
        <div style={{display:"flex",gap:0,padding:"0 20px",maxWidth:1400,margin:"0 auto",alignItems:"center"}}>
          {[["map","Hospital Map"],["list","Hospital List"],...(trackId?[["track","Track Emergency"]]:[])].map(([v,l])=>(
            <button key={v} className={`tab-btn ${view===v?"active":""}`} onClick={()=>setView(v)} style={{whiteSpace:"nowrap"}}>{l}</button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"8px 0"}}>
            <input className="input" style={{width:150,fontSize:11,padding:"5px 10px",height:28}} placeholder="EMG-00001 to track" value={trackInput} onChange={e=>setTrackInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&trackInput&&(setTrackId(trackInput),setView("track"))}/>
            <button className="btn btn-ghost btn-sm" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>trackInput&&(setTrackId(trackInput),setView("track"))}>Track</button>
          </div>
        </div>
      </div>

      <div style={{padding:16,maxWidth:1400,margin:"0 auto"}}>
        {view==="map"&&(
          <div>
            <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
              {Object.entries(TILE_LABELS).map(([k,l])=>(
                <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} onClick={()=>setMapTile(k)}>{l}</button>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={detectLocation} disabled={locating}>{locating?"Detecting...":"📍 My Location"}</button>
              {userPos&&<span style={{fontSize:11,color:"var(--green)"}}>Location detected</span>}
              <div style={{marginLeft:"auto",display:"flex",gap:8,fontSize:10,color:"var(--text-muted)"}}>
                {Object.entries({Tier1:"#00e676",Tier2:"#00c8ff",Tier3:"#b388ff"}).map(([t,c])=>(<span key={t} style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block"}}/>{TIER_L[t]}</span>))}
              </div>
            </div>
            <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:520}}>
              <MapContainer center={userPos?[userPos.lat,userPos.lng]:[23.18,79.98]} zoom={userPos?12:7} style={{height:"100%",width:"100%"}}>
                <TileLayer url={TILE_URLS[mapTile]} attribution="OpenStreetMap"/>
                {flyTo&&<FlyTo pos={flyTo}/>}
                {userPos&&<CircleMarker center={[userPos.lat,userPos.lng]} radius={13} pathOptions={{color:"#ff4060",fillColor:"#ff4060",fillOpacity:.7,weight:3}}><Popup><b>📍 Your Location</b></Popup></CircleMarker>}
                {hospitals.map(h=>h.location?.lat&&(
                  <Marker key={h._id} position={[h.location.lat,h.location.lng]} icon={createHospIcon(h)}>
                    <Popup>
                      <div style={{fontFamily:"system-ui",fontSize:13,minWidth:220}}>
                        <div style={{fontWeight:800,marginBottom:4}}>{h.name}</div>
                        <div style={{fontSize:11,color:"#666",marginBottom:6}}>{TIER_L[h.tier]} · {h.type}{h.distKm?` · ${h.distKm}km`:""}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6,fontSize:11}}>
                          <div style={{background:"#f5f5f5",padding:"3px 7px",borderRadius:5}}>ICU <b style={{color:(h.resources?.icuBeds?.available||0)===0?"#ff4060":"#00a855"}}>{h.resources?.icuBeds?.available||0}/{h.resources?.icuBeds?.total||0}</b></div>
                          <div style={{background:"#f5f5f5",padding:"3px 7px",borderRadius:5}}>O₂ <b style={{color:(h.resources?.oxygenLevel||100)<40?"#ff4060":"#00a855"}}>{h.resources?.oxygenLevel||100}%</b></div>
                          <div style={{background:"#f5f5f5",padding:"3px 7px",borderRadius:5}}>Vents <b>{h.resources?.ventilators?.available||0}</b></div>
                          <div style={{background:"#f5f5f5",padding:"3px 7px",borderRadius:5}}>Docs <b>{h.resources?.doctorsOnDuty||0}</b></div>
                        </div>
                        {h.govRegistration?.ayushmanEmpanelled&&<div style={{fontSize:10,color:"#00a855",marginBottom:2}}>✓ Ayushman Bharat Empanelled</div>}
                        {h.govRegistration?.emergencyService&&<div style={{fontSize:10,color:"#0066cc",marginBottom:4}}>✓ Govt Emergency Service</div>}
                        {h.contact?.emergency&&<div style={{fontSize:11,marginBottom:6}}>📞 {h.contact.emergency}</div>}
                        <div style={{marginBottom:6,fontSize:10}}>Trust Score: <b style={{color:(h.trustScore||75)>80?"#00a855":(h.trustScore||75)>60?"#ff8f00":"#ff4060"}}>{h.trustScore||75}/100</b></div>
                        <button onClick={()=>setShowForm(true)} style={{background:"#ff4060",border:"none",color:"#fff",padding:"6px 14px",borderRadius:6,fontSize:11,cursor:"pointer",width:"100%",marginBottom:5}}>Request Ambulance</button>
                        <button onClick={()=>setBookingHospital(h)} style={{background:"#00a855",border:"none",color:"#fff",padding:"6px 14px",borderRadius:6,fontSize:11,cursor:"pointer",width:"100%"}}>📅 Book Appointment</button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {view==="list"&&(
          <div>
            {/* Hospital search bar */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <input className="input" style={{flex:1,minWidth:180}} placeholder="🔍 Search hospitals by name, city, district..." value={hospitalSearch} onChange={e=>setHospitalSearch(e.target.value)}/>
            <select className="select" value={hospitalSearchCity} onChange={e=>setHospitalSearchCity(e.target.value)} style={{minWidth:140}}>
              <option value="All">All Cities</option>
              {[...new Set(hospitals.map(h=>h.location?.city).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          {loading?<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>Loading hospitals...</div>:(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                {hospitals.filter(h=>{
                  if(hospitalSearch) {
                    const q=hospitalSearch.toLowerCase();
                    if(!h.name?.toLowerCase().includes(q)&&!h.location?.city?.toLowerCase().includes(q)&&!h.location?.district?.toLowerCase().includes(q)) return false;
                  }
                  if(hospitalSearchCity!=="All"&&h.location?.city!==hospitalSearchCity) return false;
                  return true;
                }).map(h=>{
                  const r=h.resources||{};const ac=ALERT_C[h.alertLevel]||"#4e7090";const tc=TIER_C[h.tier]||"#4e7090";
                  return(
                    <div key={h._id} className="card" style={{borderTop:`3px solid ${ac}`,cursor:"pointer"}} onClick={()=>{setFlyTo({lat:h.location.lat,lng:h.location.lng});setView("map");}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{flex:1,marginRight:8}}>
                          <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,color:"var(--text-primary)"}}>{h.name}</div>
                          <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>📍 {h.location?.address||h.location?.city}{h.distKm?` · ${h.distKm}km`:""}</div>
                          <div style={{display:"flex",gap:5,marginTop:5}}>
                            <span style={{background:`${tc}22`,color:tc,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:600}}>{TIER_L[h.tier]}</span>
                            <span style={{background:`${ac}22`,color:ac,padding:"1px 7px",borderRadius:4,fontSize:10,fontWeight:700}}>{h.alertLevel}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:10}}>
                        {[["ICU",r.icuBeds,"var(--accent)"],["Beds",r.generalBeds,"var(--purple)"],["Vents",r.ventilators,"var(--green)"]].map(([lbl,b,c])=>b&&(
                          <div key={lbl} style={{background:"var(--bg-elevated)",borderRadius:"var(--radius-sm)",padding:"6px",textAlign:"center"}}>
                            <div style={{fontSize:9,color:"var(--text-muted)",marginBottom:1}}>{lbl}</div>
                            <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:15,color:b.available===0?"var(--red)":c}}>{b.available}<span style={{fontSize:10,color:"var(--text-muted)"}}>/{b.total}</span></div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
                        <span className={`badge ${(r.oxygenLevel||0)>50?"badge-green":"badge-red"}`}>O₂ {r.oxygenLevel||0}%</span>
                        {r.bloodBank&&<span className="badge badge-accent">Blood Bank</span>}
                        {h.traumaCenter&&<span className="badge badge-red">Trauma</span>}
                        {h.govRegistration?.ayushmanEmpanelled&&<span className="badge badge-green">Ayushman</span>}
                        {h.govRegistration?.emergencyService&&<span className="badge badge-accent">Govt Emergency</span>}
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                        <div style={{flex:1,height:3,background:"var(--bg-primary)",borderRadius:2}}>
                          <div style={{width:`${h.trustScore||75}%`,height:"100%",background:(h.trustScore||75)>80?"var(--green)":(h.trustScore||75)>60?"var(--orange)":"var(--red)",borderRadius:2}}/>
                        </div>
                        <span style={{fontSize:10,color:"var(--text-muted)"}}>Trust {h.trustScore||75}</span>
                      </div>
                      {h.contact?.emergency&&<div style={{fontSize:11,color:"var(--accent)"}}>📞 {h.contact.emergency}</div>}
                    <div style={{marginTop:8,display:"flex",gap:6}}>
                      <button onClick={e=>{e.stopPropagation();setDirectRequestHosp(h);setShowForm(true);}} style={{flex:1,padding:"7px",background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:"var(--radius-md)",fontSize:11,cursor:"pointer",fontWeight:600}}>🚑 Request Emergency</button>
                      <button onClick={e=>{e.stopPropagation();setBookingHospital(h);}} style={{flex:1,padding:"7px",background:"var(--green-dim)",border:"1px solid var(--green)",color:"var(--green)",borderRadius:"var(--radius-md)",fontSize:11,cursor:"pointer",fontWeight:600}}>📅 Book Appointment</button>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view==="track"&&trackId&&(
          <div style={{maxWidth:600,margin:"0 auto"}}>
            <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
              <h2 style={{fontFamily:"var(--font-display)",fontSize:18,color:"var(--text-primary)",margin:0}}>Live Tracking</h2>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setTrackId(null);setView("map");}}>Back to Map</button>
            </div>
            <LiveTrackingMap requestId={trackId} onClose={()=>{setTrackId(null);setView("map");}}/>
          </div>
        )}
        {view==="track"&&!trackId&&(
          <div style={{maxWidth:400,margin:"40px auto",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>📡</div>
            <div style={{fontFamily:"var(--font-display)",fontSize:16,color:"var(--text-primary)",marginBottom:8}}>Track Your Emergency</div>
            <div style={{display:"flex",gap:8}}>
              <input className="input" style={{flex:1}} placeholder="EMG-00001" value={trackInput} onChange={e=>setTrackInput(e.target.value)}/>
              <button className="btn btn-primary" onClick={()=>trackInput&&setTrackId(trackInput)}>Track</button>
            </div>
          </div>
        )}
      </div>

      {showForm&&<EmergencyForm onClose={()=>{setShowForm(false);setDirectRequestHosp(null);}} onSubmit={submitEmergency} userLocation={userPos} preferredHospital={directRequestHosp}/>}
      {bookingHospital&&<AppointmentModal hospital={bookingHospital} onClose={()=>setBookingHospital(null)}/>}
      <AIChatbot 
        userLocation={userPos}
        onRequestAmbulance={()=>setShowForm(true)}
        onShowHospitals={()=>setView("list")}
        hospitals={hospitals}
      />
    </div>
  );
}
