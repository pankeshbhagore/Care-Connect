import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from "react-leaflet";
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

const STATUS_STEPS = [
  { s:"Available",             l:"Available",         i:"✅", color:"var(--green)" },
  { s:"AmbulanceAccepted",     l:"Accepted Dispatch", i:"📲", color:"var(--accent)" },
  { s:"EnRoute",               l:"En Route to Patient",i:"🚑", color:"var(--orange)" },
  { s:"OnScene",               l:"On Scene",          i:"👨‍⚕️", color:"var(--yellow)" },
  { s:"TransportingToHospital",l:"To Hospital",       i:"🏥", color:"var(--purple)" },
];

export default function AmbulanceOperatorDashboard({ ambulanceId, onBack }) {
  const [ambulance, setAmbulance] = useState(null);
  const [activeEmergency, setActiveEmergency] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("map");
  const [toast, setToast] = useState(null);
  const locInterval = useRef(null);
  const mapRef = useRef(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const loadAmbulance = useCallback(async () => {
    if (!ambulanceId) return;
    try {
      const r = await api.get(`/ambulances/${ambulanceId}`);
      setAmbulance(r.data);
      if (r.data.location?.lat) setMyLocation({ lat: r.data.location.lat, lng: r.data.location.lng });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [ambulanceId]);

  const loadActiveEmergency = useCallback(async () => {
    try {
      const r = await api.get(`/emergencies?status=AmbulanceAccepted,EnRoute,OnScene,TransportingToHospital`);
      const mine = r.data.find(e => e.assignedAmbulance?._id === ambulanceId || e.assignedAmbulance?.toString() === ambulanceId);
      setActiveEmergency(mine || null);
    } catch(e) {}
  }, [ambulanceId]);

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get("/emergencies?status=AmbulanceRequested");
      setPendingRequests(r.data);
    } catch(e) {}
  }, []);

  useEffect(() => {
    loadAmbulance();
    loadActiveEmergency();
    loadPending();
    const t = setInterval(() => { loadAmbulance(); loadActiveEmergency(); loadPending(); }, 15000);
    return () => clearInterval(t);
  }, [loadAmbulance, loadActiveEmergency, loadPending]);

  // Start live GPS sharing
  const startGPSSharing = () => {
    if (locInterval.current) return;
    locInterval.current = setInterval(() => {
      navigator.geolocation?.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setMyLocation({ lat, lng });
        socket.emit("ambulance:location", { ambulanceId: ambulance?.ambulanceId, lat, lng, speed: 40 });
        api.patch(`/ambulances/${ambulanceId}/location`, { lat, lng, speed: 40 }).catch(()=>{});
      }, null, { enableHighAccuracy: true });
    }, 5000);
    showToast("GPS sharing started 📡");
  };

  const stopGPSSharing = () => {
    if (locInterval.current) { clearInterval(locInterval.current); locInterval.current = null; }
    showToast("GPS sharing stopped");
  };

  // Accept dispatch
  const acceptDispatch = async (emergencyId) => {
    try {
      await api.post(`/emergencies/${emergencyId}/ambulance-accept`, { ambulanceObjectId: ambulanceId });
      showToast("Dispatch accepted ✓");
      loadActiveEmergency(); loadPending(); loadAmbulance();
      startGPSSharing();
    } catch(e) { showToast(e.message, "error"); }
  };

  // Update status
  const updateStatus = async (emergencyId, status) => {
    try {
      await api.patch(`/emergencies/${emergencyId}/status`, { status });
      showToast(`Status: ${status} ✓`);
      loadActiveEmergency(); loadAmbulance();
      if (status === "Resolved" || status === "Cancelled") stopGPSSharing();
    } catch(e) { showToast(e.message, "error"); }
  };

  // Listen for dispatch notifications
  useEffect(() => {
    if (!ambulance) return;
    socket.on(`ambulance:${ambulance.ambulanceId}:dispatch`, d => {
      showToast("🚨 New emergency dispatch!", "error");
      loadPending();
      setTab("requests");
    });
    socket.on("newEmergencyRequest", () => loadPending());
    return () => { socket.off(`ambulance:${ambulance?.ambulanceId}:dispatch`); socket.off("newEmergencyRequest"); };
  }, [ambulance, loadPending]);

  useEffect(() => () => stopGPSSharing(), []);

  if (loading) return <div style={{ textAlign:"center",padding:80,color:"var(--text-muted)" }}>Loading ambulance dashboard…</div>;
  if (!ambulance) return <div style={{ textAlign:"center",padding:80,color:"var(--red)" }}>Ambulance not found or not assigned</div>;

  const SEV_C = { Critical:"var(--red)", High:"var(--orange)", Medium:"var(--yellow)", Low:"var(--green)" };

  return (
    <div>
      {toast && <div style={{ position:"fixed",top:20,right:24,zIndex:9999,background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 18px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13,boxShadow:"var(--shadow-md)" }}>{toast.msg}</div>}

      {/* Ambulance status header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div>
          <h2 style={{ fontFamily:"var(--font-display)",fontSize:22,color:"var(--text-primary)",marginBottom:4 }}>🚑 {ambulance.name}</h2>
          <div style={{ fontSize:12,color:"var(--text-muted)" }}>{ambulance.type} · {ambulance.registrationNo} · Driver: {ambulance.driver||"—"}</div>
          <div style={{ display:"flex",gap:8,marginTop:8 }}>
            <span style={{ background:ambulance.status==="Available"?"var(--green-dim)":"var(--orange-dim)",color:ambulance.status==="Available"?"var(--green)":"var(--orange)",border:`1px solid ${ambulance.status==="Available"?"rgba(0,230,118,.3)":"rgba(255,143,0,.3)"}`,padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700 }}>{ambulance.status}</span>
            {locInterval.current && <span className="badge badge-green" style={{ animation:"pulse-text 2s infinite" }}>📡 GPS Live</span>}
          </div>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          {!locInterval.current
            ? <button className="btn btn-primary btn-sm" onClick={startGPSSharing}>📡 Start GPS</button>
            : <button className="btn btn-ghost btn-sm" style={{ color:"var(--red)" }} onClick={stopGPSSharing}>⏹ Stop GPS</button>
          }
        </div>
      </div>

      {/* Active emergency alert */}
      {activeEmergency && (
        <div style={{ background:"var(--red-dim)",border:"2px solid var(--red)",borderRadius:"var(--radius-lg)",padding:16,marginBottom:16 }}>
          <div style={{ fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:16,marginBottom:8 }}>🚨 ACTIVE EMERGENCY</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
            <div><div style={{ fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8 }}>Type</div><div style={{ fontSize:14,fontWeight:700,color:"var(--text-primary)" }}>{activeEmergency.type} — {activeEmergency.severity}</div></div>
            <div><div style={{ fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8 }}>Patient</div><div style={{ fontSize:14,fontWeight:700,color:"var(--text-primary)" }}>{activeEmergency.patientName}</div></div>
            <div><div style={{ fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8 }}>Location</div><div style={{ fontSize:12,color:"var(--text-secondary)" }}>{activeEmergency.location?.address||`${activeEmergency.location?.lat?.toFixed(4)},${activeEmergency.location?.lng?.toFixed(4)}`}</div></div>
            <div><div style={{ fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8 }}>Hospital</div><div style={{ fontSize:12,color:"var(--text-secondary)" }}>{activeEmergency.assignedHospital?.name||"—"}</div></div>
          </div>
          {activeEmergency.aiRecommendation && <div style={{ fontSize:11,color:"var(--accent)",background:"rgba(0,200,255,.06)",border:"1px solid rgba(0,200,255,.15)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:12,lineHeight:1.5 }}>🤖 {activeEmergency.aiRecommendation}</div>}
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {activeEmergency.status==="AmbulanceAccepted"&&<button className="btn btn-primary" onClick={()=>updateStatus(activeEmergency._id,"EnRoute")}>🚑 Start — En Route</button>}
            {activeEmergency.status==="EnRoute"&&<button className="btn btn-primary" onClick={()=>updateStatus(activeEmergency._id,"OnScene")}>👨‍⚕️ Arrived — On Scene</button>}
            {activeEmergency.status==="OnScene"&&<button className="btn btn-primary" onClick={()=>updateStatus(activeEmergency._id,"TransportingToHospital")}>🏥 Transporting to Hospital</button>}
            {activeEmergency.status==="TransportingToHospital"&&<button className="btn btn-primary" onClick={()=>updateStatus(activeEmergency._id,"Resolved")}>✅ Resolved at Hospital</button>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar mb-20" style={{ display:"flex",gap:4 }}>
        {[["map","🗺 Live Map"],["requests",`📲 Requests (${pendingRequests.length})`],["status","⚙ My Status"]].map(([id,lbl])=>(
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* Map */}
      {tab==="map"&&(
        <div style={{ borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:480 }}>
          <MapContainer center={myLocation?[myLocation.lat,myLocation.lng]:[23.18,79.98]} zoom={myLocation?13:8} style={{ height:"100%",width:"100%",background:"#0a1628" }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB"/>
            {myLocation&&(
              <CircleMarker center={[myLocation.lat,myLocation.lng]} radius={14} pathOptions={{ color:"#ff8f00",fillColor:"#ff8f00",fillOpacity:.8,weight:3 }}>
                <Popup><div style={{ color:"#e8f1fa",background:"#0d1e35",padding:8 }}><b>🚑 My Location</b><br/>{ambulance.name}</div></Popup>
              </CircleMarker>
            )}
            {activeEmergency?.location?.lat&&(
              <CircleMarker center={[activeEmergency.location.lat,activeEmergency.location.lng]} radius={16} pathOptions={{ color:"#ff4060",fillColor:"#ff4060",fillOpacity:.8,weight:3 }}>
                <Popup><div style={{ color:"#e8f1fa",background:"#0d1e35",padding:8 }}><b>🚨 Patient Location</b><br/>{activeEmergency.patientName}<br/>{activeEmergency.location.address}</div></Popup>
              </CircleMarker>
            )}
            {activeEmergency?.assignedHospital?.location?.lat&&(
              <Marker position={[activeEmergency.assignedHospital.location.lat,activeEmergency.assignedHospital.location.lng]}>
                <Popup><div style={{ color:"#e8f1fa",background:"#0d1e35",padding:8 }}><b>🏥 {activeEmergency.assignedHospital.name}</b></div></Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}

      {/* Pending requests */}
      {tab==="requests"&&(
        <div>
          {pendingRequests.length===0&&<div style={{ textAlign:"center",padding:60,color:"var(--text-muted)" }}>No pending dispatch requests</div>}
          {pendingRequests.map(em=>(
            <div key={em._id} className="card" style={{ marginBottom:14,borderLeft:`3px solid ${SEV_C[em.severity]||"var(--text-muted)"}` }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)" }}>{em.type}</div>
                  <span className={`badge ${em.severity==="Critical"?"badge-red":em.severity==="High"?"badge-orange":"badge-yellow"}`}>{em.severity}</span>
                  <span className="badge badge-muted" style={{ marginLeft:6 }}>{em.requestId}</span>
                </div>
                <div style={{ fontSize:11,color:"var(--text-dim)" }}>{new Date(em.createdAt).toLocaleTimeString()}</div>
              </div>
              <div style={{ fontSize:12,color:"var(--text-secondary)",marginBottom:6 }}>
                <div>👤 {em.patientName}{em.patientAge>0?` (${em.patientAge}y)`:""}</div>
                <div>📍 {em.location?.address||`${em.location?.lat?.toFixed(4)},${em.location?.lng?.toFixed(4)}`}</div>
                {em.assignedHospital&&<div>🏥 → {em.assignedHospital.name}</div>}
              </div>
              {em.aiRecommendation&&<div style={{ fontSize:11,color:"var(--accent)",marginBottom:10,lineHeight:1.5 }}>🤖 {em.aiRecommendation}</div>}
              <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:"10px",fontSize:14 }} onClick={()=>acceptDispatch(em._id)}>
                ✅ Accept Dispatch
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      {tab==="status"&&(
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14,marginBottom:20 }}>
            {[["⛽","Fuel",`${ambulance.fuelLevel||0}%`,ambulance.fuelLevel>25?"var(--green)":"var(--red)"],["🧑‍🤝‍🧑","Crew",ambulance.crewCount||0,"var(--accent)"],["🚗","Total Trips",ambulance.totalTrips||0,"var(--purple)"],["📍","Speed",`${ambulance.speed||0} km/h`,"var(--orange)"]].map(([ic,lbl,val,c])=>(
              <div key={lbl} className="stat-card"><div className="stat-label">{ic} {lbl}</div><div className="stat-value" style={{ color:c,fontSize:28 }}>{val}</div></div>
            ))}
          </div>
          <div className="card card-sm" style={{ marginBottom:14 }}>
            <div style={{ fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--accent)",marginBottom:8 }}>⚙ Change My Status</div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {["Available","Maintenance","Offline"].map(s=>(
                <button key={s} className={`btn ${ambulance.status===s?"btn-primary":"btn-ghost"} btn-sm`} onClick={()=>api.put(`/ambulances/${ambulanceId}`,{status:s}).then(()=>{loadAmbulance();showToast(`Status: ${s}`);})}>{s}</button>
              ))}
            </div>
          </div>
          {ambulance.equipment?.length>0&&(
            <div className="card card-sm">
              <div style={{ fontFamily:"var(--font-display)",fontSize:12,fontWeight:600,color:"var(--accent)",marginBottom:8 }}>🏥 Equipment on Board</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {ambulance.equipment.map(eq=><span key={eq} className="badge badge-muted">{eq}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
