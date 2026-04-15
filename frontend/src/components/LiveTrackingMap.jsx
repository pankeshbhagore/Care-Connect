
import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
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

const TILE_URLS = {
  street:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark:"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  smooth:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};

function createAmbulanceIcon(heading=0, isMoving=false) {
  return L.divIcon({
    className:"",
    html:`<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
      ${isMoving?`<div style="position:absolute;width:48px;height:48px;border-radius:50%;border:2px solid #ff8f00;opacity:.5;animation:trackPulse 1.5s ease-out infinite;"></div>`:""}
      <div style="width:40px;height:40px;background:#ff8f00;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(255,143,0,.6);font-size:22px;border:2px solid #fff;">🚑</div>
    </div>`,
    iconAnchor:[24,24],
  });
}

function createPatientIcon() {
  return L.divIcon({
    className:"",
    html:`<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(255,64,96,.2);border:2px solid #ff4060;animation:trackPulse 2s ease-out infinite;"></div>
      <div style="width:36px;height:36px;background:#ff4060;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid #fff;box-shadow:0 0 12px rgba(255,64,96,.5);">📍</div>
    </div>`,
    iconAnchor:[22,22],
  });
}

function createHospitalIcon() {
  return L.divIcon({
    className:"",
    html:`<div style="width:40px;height:40px;background:#00e676;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid #fff;box-shadow:0 0 12px rgba(0,230,118,.4);">🏥</div>`,
    iconAnchor:[20,20],
  });
}

function MapController({ center, ambulancePos }) {
  const map = useMap();
  const prevPos = useRef(null);
  useEffect(()=>{
    if(ambulancePos && (!prevPos.current || Math.abs(prevPos.current.lat-ambulancePos.lat)>0.001 || Math.abs(prevPos.current.lng-ambulancePos.lng)>0.001)) {
      map.panTo([ambulancePos.lat, ambulancePos.lng], {animate:true, duration:1});
      prevPos.current = ambulancePos;
    }
  },[ambulancePos]);
  return null;
}

const STATUS_INFO = {
  Reported:            {color:"#ffd600",icon:"📋",label:"Request Received"},
  Queued:              {color:"#ffd600",icon:"⏳",label:"In Queue"},
  AmbulanceRequested:  {color:"#00c8ff",icon:"🔍",label:"Finding Ambulance"},
  AmbulanceAccepted:   {color:"#00c8ff",icon:"✅",label:"Ambulance Confirmed"},
  EnRoute:             {color:"#ff8f00",icon:"🚑",label:"Ambulance En Route"},
  OnScene:             {color:"#b388ff",icon:"👨‍⚕️",label:"Ambulance On Scene"},
  TransportingToHospital:{color:"#00c8ff",icon:"🏥",label:"Transporting to Hospital"},
  Resolved:            {color:"#00e676",icon:"✅",label:"Resolved"},
  Cancelled:           {color:"#4e7090",icon:"❌",label:"Cancelled"},
  PatientNotFound:     {color:"#ff4060",icon:"❓",label:"Patient Not Found"},
};

const ALL_STATUSES = ["Reported","AmbulanceRequested","AmbulanceAccepted","EnRoute","OnScene","TransportingToHospital","Resolved"];

export default function LiveTrackingMap({ requestId, onClose, compact=false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapTile, setMapTile] = useState("smooth");
  const [ambPos, setAmbPos] = useState(null);
  const [ambTrail, setAmbTrail] = useState([]);  // breadcrumb trail
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [progress, setProgress] = useState(0);
  const [ambSpeed, setAmbSpeed] = useState(0);
  const etaTimer = useRef(null);

  const load = useCallback(async()=>{
    try{
      const r = await api.get(`/emergencies/track/${requestId}`);
      setData(r.data);
      if(r.data.assignedAmbulance?.location?.lat) {
        const pos = {lat:r.data.assignedAmbulance.location.lat, lng:r.data.assignedAmbulance.location.lng};
        setAmbPos(pos);
      }
      if(r.data.estimatedArrivalTime) setEtaSeconds(r.data.estimatedArrivalTime*60);
    } catch(e){ setError(e.response?.data?.message||"Not found"); }
    finally{ setLoading(false); }
  },[requestId]);

  useEffect(()=>{ load(); const t=setInterval(load,10000); return()=>clearInterval(t); },[load]);

  // ETA countdown
  useEffect(()=>{
    if(etaSeconds>0) {
      etaTimer.current = setInterval(()=>setEtaSeconds(s=>s>0?s-1:0),1000);
      return()=>clearInterval(etaTimer.current);
    }
  },[etaSeconds]);

  // Live ambulance location updates
  useEffect(()=>{
    socket.on("ambulanceLocation", d=>{
      const amb = data?.assignedAmbulance;
      if(!amb) return;
      if(d.ambulanceId===amb.ambulanceId||d.ambulanceId===amb._id?.toString()||d.id===amb._id?.toString()) {
        const newPos = {lat:d.lat, lng:d.lng};
        setAmbPos(newPos);
        setAmbSpeed(d.speed||0);
        if(d.progressPct) setProgress(d.progressPct);
        if(d.remainingSec) setEtaSeconds(d.remainingSec);
        setAmbTrail(t=>[...t.slice(-30), [d.lat,d.lng]]);
      }
    });
    socket.on("emergencyUpdate", d=>{ if(d.requestId===requestId) setData(d); });
    socket.on("queueUpdate",     d=>{ if(d.requestId===requestId) load(); });
    socket.on("citizenAlert",    d=>{ if(d.requestId===requestId) { /* show toast */ } });
    return()=>{["ambulanceLocation","emergencyUpdate","queueUpdate","citizenAlert"].forEach(e=>socket.off(e));};
  },[data,requestId,load]);

  const fmtEta = s => { if(!s||s<=0) return "Arrived"; const m=Math.floor(s/60),sec=s%60; return m>0?`${m}m ${sec}s`:`${sec}s`; };
  const shareUrl = `${window.location.origin}?track=${requestId}`;

  if(loading) return <div style={{padding:compact?20:40,textAlign:"center",color:"var(--text-muted)"}}>Loading tracking…</div>;
  if(error)   return <div style={{padding:compact?12:24}}><div style={{color:"var(--red)",marginBottom:12}}>❌ {error}</div><button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></div>;
  if(!data)   return null;

  const statusInfo = STATUS_INFO[data.status] || STATUS_INFO.Reported;
  const statusIdx  = ALL_STATUSES.indexOf(data.status);
  const hasAmb     = !!data.assignedAmbulance;
  const patLat     = data.location?.lat;
  const patLng     = data.location?.lng;
  const hospLat    = data.assignedHospital?.location?.lat;
  const hospLng    = data.assignedHospital?.location?.lng;
  const isActive   = ["EnRoute","AmbulanceAccepted","OnScene","TransportingToHospital"].includes(data.status);

  const mapCenter = ambPos || (patLat ? {lat:patLat,lng:patLng} : {lat:23.18,lng:79.98});

  return (
    <div style={{fontFamily:"var(--font-body)"}}>
      <style>{`@keyframes trackPulse{0%{transform:scale(1);opacity:.6}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1);opacity:0}}`}</style>

      {/* Status header — delivery-app style */}
      <div style={{background:isActive?"linear-gradient(135deg,#0a2a0a,#122212)":"var(--bg-elevated)",border:`1px solid ${statusInfo.color}44`,borderRadius:"var(--radius-lg)",padding:compact?"14px":"16px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:compact?40:48,height:compact?40:48,borderRadius:"50%",background:`${statusInfo.color}22`,border:`2px solid ${statusInfo.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:compact?20:24,flexShrink:0}}>{statusInfo.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:statusInfo.color,fontSize:compact?14:16}}>{statusInfo.label}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
              {data.requestId} · {data.type} · <span style={{color:statusInfo.color,fontWeight:600}}>{data.severity}</span>
              {data.aiTriageSeverity&&data.aiTriageSeverity!==data.severity&&<span style={{background:"var(--orange-dim)",color:"var(--orange)",padding:"0 6px",borderRadius:4,fontSize:9,marginLeft:6,fontWeight:700}}>AI→{data.aiTriageSeverity}</span>}
            </div>
            {data.location?.locationName&&<div style={{fontSize:11,color:"var(--text-dim)",marginTop:2}}>📍 {data.location.locationName}</div>}
          </div>
          {etaSeconds>0&&isActive&&(
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontFamily:"var(--font-display)",fontWeight:900,fontSize:compact?20:26,color:statusInfo.color}}>{fmtEta(etaSeconds)}</div>
              <div style={{fontSize:9,color:"var(--text-muted)"}}>ETA</div>
              {ambSpeed>0&&<div style={{fontSize:10,color:"var(--orange)",marginTop:2}}>{ambSpeed} km/h</div>}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isActive&&(
          <div style={{marginTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text-muted)",marginBottom:4}}>
              <span>🚑 Ambulance</span><span>{progress}% complete</span><span>📍 Patient</span>
            </div>
            <div style={{height:6,background:"var(--bg-primary)",borderRadius:3,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",left:`${progress}%`,top:"-3px",width:12,height:12,borderRadius:"50%",background:statusInfo.color,transform:"translateX(-50%)",transition:"left 1s linear",zIndex:1,boxShadow:`0 0 8px ${statusInfo.color}`}}/>
              <div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${statusInfo.color}88,${statusInfo.color})`,borderRadius:3,transition:"width 1s linear"}}/>
            </div>
          </div>
        )}
      </div>

      {/* Status timeline */}
      <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:0}}>
          {ALL_STATUSES.slice(0,6).map((s,i)=>{
            const si=STATUS_INFO[s];const done=statusIdx>i;const active=statusIdx===i;
            return(
              <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,position:"relative"}}>
                {i>0&&<div style={{position:"absolute",top:15,right:"50%",width:"100%",height:2,background:done?"var(--green)":"var(--border)",transition:"background .5s"}}/>}
                <div style={{width:32,height:32,borderRadius:"50%",background:done?"var(--green)":active?si.color:"var(--bg-elevated)",border:`2px solid ${done?"var(--green)":active?si.color:"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,zIndex:1,transition:"all .3s",boxShadow:active?`0 0 10px ${si.color}66`:""}}>{done?"✓":si.icon}</div>
                <div style={{fontSize:8,color:done?"var(--green)":active?"var(--text-primary)":"var(--text-dim)",textAlign:"center",marginTop:4,lineHeight:1.2,maxWidth:50}}>{si.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue info */}
      {data.status==="Queued"&&(
        <div style={{background:"var(--yellow-dim)",border:"1px solid var(--yellow)",borderRadius:"var(--radius-md)",padding:"12px 14px",marginBottom:14}}>
          <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--yellow)",marginBottom:4}}>⏳ You are in Queue — Position #{data.queuePosition}</div>
          <div style={{fontSize:12,color:"var(--text-secondary)"}}>No ambulance is available right now. You will be automatically assigned when one becomes free.</div>
        </div>
      )}

      {/* LIVE MAP */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",gap:5,marginBottom:6}}>
          {Object.entries({smooth:"🎨 Smooth",street:"🗺 Street",dark:"🌑 Dark"}).map(([k,l])=>(
            <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} style={{fontSize:10}} onClick={()=>setMapTile(k)}>{l}</button>
          ))}
          <span style={{marginLeft:"auto",fontSize:10,color:"var(--text-muted)"}}>
            {ambPos&&isActive&&<span style={{color:"var(--orange)",fontWeight:600}}>🔴 LIVE TRACKING</span>}
          </span>
        </div>
        <div style={{height:compact?260:380,borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)"}}>
          <MapContainer center={[mapCenter.lat,mapCenter.lng]} zoom={12} style={{height:"100%",width:"100%"}}>
            <TileLayer url={TILE_URLS[mapTile]} attribution="© OpenStreetMap"/>
            <MapController ambulancePos={ambPos}/>

            {/* Patient location */}
            {patLat&&<Marker position={[patLat,patLng]} icon={createPatientIcon()}>
              <Popup><div style={{fontFamily:"system-ui",fontSize:13}}><b>📍 Patient Location</b><br/>{data.location?.locationName||data.location?.address||`${patLat?.toFixed(4)},${patLng?.toFixed(4)}`}</div></Popup>
            </Marker>}

            {/* Hospital */}
            {hospLat&&<Marker position={[hospLat,hospLng]} icon={createHospitalIcon()}>
              <Popup><div style={{fontFamily:"system-ui",fontSize:13}}><b>🏥 {data.assignedHospital?.name}</b></div></Popup>
            </Marker>}

            {/* Ambulance - moving */}
            {ambPos&&<Marker position={[ambPos.lat,ambPos.lng]} icon={createAmbulanceIcon(0,isActive)}>
              <Popup>
                <div style={{fontFamily:"system-ui",fontSize:13,minWidth:160}}>
                  <b>🚑 {data.assignedAmbulance?.name||data.assignedAmbulance?.ambulanceId}</b><br/>
                  <span style={{fontSize:11,color:"#666"}}>Driver: {data.assignedAmbulance?.driver||"—"}</span><br/>
                  {ambSpeed>0&&<span style={{color:"#ff8f00",fontWeight:700}}>● {ambSpeed} km/h</span>}
                  {etaSeconds>0&&<><br/><span>ETA: {fmtEta(etaSeconds)}</span></>}
                </div>
              </Popup>
            </Marker>}

            {/* Breadcrumb trail */}
            {ambTrail.length>1&&<Polyline positions={ambTrail} pathOptions={{color:"#ff8f00",weight:3,opacity:.7,dashArray:"6,4"}}/>}

            {/* Route line ambulance→patient */}
            {ambPos&&patLat&&data.status==="EnRoute"&&(
              <Polyline positions={[[ambPos.lat,ambPos.lng],[patLat,patLng]]} pathOptions={{color:"#ff8f00",weight:2,opacity:.4,dashArray:"8,6"}}/>
            )}
            {/* Route line ambulance→hospital */}
            {ambPos&&hospLat&&data.status==="TransportingToHospital"&&(
              <Polyline positions={[[ambPos.lat,ambPos.lng],[hospLat,hospLng]]} pathOptions={{color:"#00c8ff",weight:2,opacity:.4,dashArray:"8,6"}}/>
            )}

            {/* Patient proximity circle */}
            {patLat&&<Circle center={[patLat,patLng]} radius={300} pathOptions={{color:"#ff4060",fillColor:"#ff4060",fillOpacity:.06,weight:1,dashArray:"4,4"}}/>}
          </MapContainer>
        </div>

        {/* Map legend */}
        <div style={{display:"flex",gap:12,marginTop:6,fontSize:10,color:"var(--text-muted)"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:12,borderRadius:"50%",background:"#ff8f00",display:"inline-block"}}/>Ambulance</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:12,borderRadius:"50%",background:"#ff4060",display:"inline-block"}}/>Patient</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:12,borderRadius:"50%",background:"#00e676",display:"inline-block"}}/>Hospital</span>
          {ambTrail.length>1&&<span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:16,height:2,background:"#ff8f00",display:"inline-block"}}/>Route trail</span>}
        </div>
      </div>

      {/* Ambulance + Hospital info cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {hasAmb&&(
          <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12}}>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--orange)",fontSize:11,marginBottom:6}}>🚑 AMBULANCE</div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",marginBottom:3}}>{data.assignedAmbulance.name||data.assignedAmbulance.ambulanceId}</div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>{data.assignedAmbulance.driver||"—"}</div>
            {data.assignedAmbulance.driverPhone&&<div style={{fontSize:11,color:"var(--accent)",marginTop:3}}>📞 {data.assignedAmbulance.driverPhone}</div>}
            {ambSpeed>0&&<div style={{fontSize:11,color:"var(--orange)",marginTop:3}}>{ambSpeed} km/h</div>}
          </div>
        )}
        {data.assignedHospital&&(
          <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12}}>
            <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--green)",fontSize:11,marginBottom:6}}>🏥 HOSPITAL</div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text-primary)",marginBottom:3}}>{data.assignedHospital.name}</div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>📍 {data.assignedHospital.location?.city}</div>
            {data.assignedHospital.contact?.emergency&&<div style={{fontSize:11,color:"var(--accent)",marginTop:3}}>📞 {data.assignedHospital.contact.emergency}</div>}
            {data.estimatedArrivalTime>0&&<div style={{fontSize:11,color:"var(--green)",marginTop:3}}>ETA ~{data.estimatedArrivalTime} min</div>}
          </div>
        )}
      </div>

      {/* AI Recommendation */}
      {data.aiRecommendation&&(
        <div style={{background:"rgba(0,200,255,.05)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:12,marginBottom:12,fontSize:11,color:"var(--text-secondary)",lineHeight:1.6}}>
          🤖 <strong style={{color:"var(--accent)"}}>AI:</strong> {data.aiRecommendation}
        </div>
      )}

      {/* Share + actions */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={()=>{ navigator.clipboard?.writeText(shareUrl); }}>📤 Copy Link</button>
        <button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={load}>↺ Refresh</button>
        {onClose&&<button className="btn btn-ghost btn-sm" style={{fontSize:10}} onClick={onClose}>Close</button>}
        <div style={{marginLeft:"auto",fontSize:10,color:"var(--text-dim)"}}>ID: {requestId}</div>
      </div>
    </div>
  );
}
