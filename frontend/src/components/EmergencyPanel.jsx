import { useState, useEffect, useCallback } from "react";
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

const TILE_URLS = {
  street:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark:"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  smooth:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  topo:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};

const SEV_COLOR = { Critical:"#ff4060", High:"#ff8f00", Medium:"#ffd600", Low:"#00e676" };
const SEV_BADGE = { Critical:"badge-red", High:"badge-orange", Medium:"badge-yellow", Low:"badge-green" };
const ST_COLOR  = { Reported:"#ffd600", AmbulanceRequested:"#00c8ff", AmbulanceAccepted:"#00c8ff", Dispatched:"#ff8f00", EnRoute:"#ff8f00", OnScene:"#b388ff", TransportingToHospital:"#00c8ff", Queued:"#ffd600", Resolved:"#00e676", Cancelled:"#4e7090", PatientNotFound:"#ff4060" };

function NewEmergencyModal({ onClose, onSave }) {
  const [f,setF]=useState({ type:"Other", severity:"Medium", patientName:"", patientAge:"", patientPhone:"", description:"", lat:"", lng:"", address:"" });
  const [saving,setSaving]=useState(false);
  const [locating,setLocating]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const getGPS=()=>{ setLocating(true); navigator.geolocation?.getCurrentPosition(pos=>{s("lat",pos.coords.latitude.toFixed(6));s("lng",pos.coords.longitude.toFixed(6));setLocating(false);},()=>setLocating(false)); };
  const submit=async e=>{ e.preventDefault(); setSaving(true); try{ await onSave({...f,lat:parseFloat(f.lat),lng:parseFloat(f.lng)}); onClose(); } catch(e){ alert(e.message); setSaving(false); } };
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>🚨 New Emergency Request</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{marginBottom:12}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["Cardiac","Stroke","Trauma","Respiratory","Obstetric","Pediatric","Burns","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Severity</label><select className="select" value={f.severity} onChange={e=>s("severity",e.target.value)}>{["Critical","High","Medium","Low"].map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Patient Name</label><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Full name"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Phone</label><input className="input" value={f.patientPhone} onChange={e=>s("patientPhone",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Age</label><input className="input" type="number" value={f.patientAge} onChange={e=>s("patientAge",e.target.value)}/></div>
          </div>
          <div style={{marginBottom:12}}><label className="form-label">Description</label><textarea className="input" rows={2} value={f.description} onChange={e=>s("description",e.target.value)}/></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={getGPS} disabled={locating} style={{marginBottom:8,width:"100%"}}>{locating?"Detecting…":"📍 Auto-Detect Location"}</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><label className="form-label">Latitude *</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)} required/></div>
            <div><label className="form-label">Longitude *</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)} required/></div>
          </div>
          <div style={{marginBottom:14}}><label className="form-label">Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Near, opposite…"/></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create Emergency"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmergencyPanel() {
  const [emergencies,setEmergencies]=useState([]);
  const [hospitals,  setHospitals]  =useState([]);
  const [ambulances, setAmbulances] =useState([]);
  const [loading,    setLoading]    =useState(true);
  const [filter,     setFilter]     =useState("All");
  const [showNew,    setShowNew]    =useState(false);
  const [mapTile,    setMapTile]    =useState("street");
  const [selected,   setSelected]   =useState(null);
  const [showDisp,   setShowDisp]   =useState(null);
  const [dispForm,   setDispForm]   =useState({ hospitalId:"", ambulanceId:"" });

  const load=useCallback(async()=>{
    try{
      const [e,h,a]=await Promise.all([
        api.get("/emergencies"+(filter!=="All"?`?status=${filter}`:"")),
        api.get("/hospitals"),
        api.get("/ambulances"),
      ]);
      setEmergencies(e.data); setHospitals(h.data); setAmbulances(a.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{ load(); const t=setInterval(load,15000); return()=>clearInterval(t); },[load]);
  useEffect(()=>{
    socket.on("newEmergencyRequest",()=>load());
    socket.on("emergencyUpdate",()=>load());
    return()=>{ socket.off("newEmergencyRequest"); socket.off("emergencyUpdate"); };
  },[load]);

  const updateStatus=async(id,status)=>{ try{await api.patch(`/emergencies/${id}/status`,{status}); load();}catch(e){alert(e.message);} };
  const dispatch=async()=>{
    if(!dispForm.hospitalId&&!dispForm.ambulanceId){alert("Select hospital or ambulance");return;}
    try{ await api.post(`/emergencies/${showDisp}/dispatch`,dispForm); load(); setShowDisp(null); }
    catch(e){alert(e.message);}
  };
  const createEmergency=async(data)=>{ await api.post("/emergencies",data); load(); };

  const active=emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status));
  const critical=emergencies.filter(e=>e.severity==="Critical"&&!["Resolved","Cancelled"].includes(e.status));

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

  return(
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",marginBottom:20}}>
        {[["🚨","Total",emergencies.length,"var(--accent)"],["⚡","Active",active.length,active.length>0?"var(--orange)":"var(--green)"],["🔴","Critical",critical.length,critical.length>0?"var(--red)":"var(--green)"],["✅","Resolved",emergencies.filter(e=>e.status==="Resolved").length,"var(--green)"],["⏳","Queued",emergencies.filter(e=>e.status==="Queued").length,"var(--yellow)"],["⏱","Avg Resp",`${Math.round(emergencies.filter(e=>e.responseTimeMinutes>0).reduce((a,e)=>a+e.responseTimeMinutes,0)/Math.max(1,emergencies.filter(e=>e.responseTimeMinutes>0).length))}m`,"var(--purple)"]].map(([i,l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:26}}>{v}</div></div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 390px",gap:16,alignItems:"start"}}>
        {/* Map */}
        <div>
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {Object.entries({street:"🗺 Street",dark:"🌑 Dark",smooth:"🎨 Smooth",topo:"🏔 Topo"}).map(([k,l])=>(
              <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} onClick={()=>setMapTile(k)}>{l}</button>
            ))}
            <span style={{marginLeft:"auto",fontSize:11,color:"var(--text-muted)"}}>{emergencies.filter(e=>e.location?.lat).length} on map</span>
          </div>
          <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:480}}>
            <MapContainer center={[23.18,79.98]} zoom={8} style={{height:"100%",width:"100%"}}>
              <TileLayer url={TILE_URLS[mapTile]} attribution="© OpenStreetMap"/>
              {emergencies.filter(e=>e.location?.lat).map(e=>(
                <CircleMarker key={e._id} center={[e.location.lat,e.location.lng]}
                  radius={e.severity==="Critical"?14:e.severity==="High"?11:8}
                  pathOptions={{color:SEV_COLOR[e.severity]||"#fff",fillColor:SEV_COLOR[e.severity]||"#fff",fillOpacity:0.75,weight:2}}
                  eventHandlers={{click:()=>setSelected(e)}}>
                  <Popup>
                    <div style={{fontFamily:"system-ui",fontSize:13,minWidth:190}}>
                      <div style={{fontWeight:700,marginBottom:4}}>{e.type} — <span style={{color:SEV_COLOR[e.severity]}}>{e.severity}</span></div>
                      <div style={{fontSize:11,color:"#666",marginBottom:4}}>{e.requestId}</div>
                      <div style={{fontSize:11,marginBottom:2}}>Patient: {e.patientName}</div>
                      <div style={{fontSize:11,marginBottom:2}}>Status: <b style={{color:ST_COLOR[e.status]}}>{e.status}</b></div>
                      {e.location?.locationName&&<div style={{fontSize:11,marginBottom:2}}>📍 {e.location.locationName}</div>}
                      {e.assignedHospital&&<div style={{fontSize:11,marginBottom:2}}>🏥 {e.assignedHospital.name}</div>}
                      {e.assignedAmbulance&&<div style={{fontSize:11,marginBottom:2}}>🚑 {e.assignedAmbulance.ambulanceId}</div>}
                      {e.aiRecommendation&&<div style={{fontSize:10,color:"#0066cc",marginTop:6,lineHeight:1.4}}>🤖 {e.aiRecommendation.slice(0,100)}</div>}
                      <div style={{marginTop:8,display:"flex",gap:4}}>
                        <button onClick={()=>setShowDisp(e._id)} style={{background:"var(--accent)",color:"#fff",border:"none",padding:"4px 10px",borderRadius:4,fontSize:10,cursor:"pointer"}}>Dispatch</button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* List */}
        <div>
          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{flex:1}}>
              <option value="All">All ({emergencies.length})</option>
              {["Reported","Queued","AmbulanceRequested","AmbulanceAccepted","EnRoute","OnScene","TransportingToHospital","Resolved","Cancelled"].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ New</button>
          </div>
          <div style={{maxHeight:430,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
            {emergencies.filter(e=>filter==="All"||e.status===filter).map(e=>(
              <div key={e._id} className="card card-sm" style={{borderLeft:`3px solid ${SEV_COLOR[e.severity]||"#ccc"}`,cursor:"pointer"}}
                onClick={()=>setSelected(p=>p?._id===e._id?null:e)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:12,color:"var(--text-primary)"}}>{e.type} — {e.patientName}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)"}}>{e.requestId} · {new Date(e.createdAt).toLocaleTimeString()}</div>
                    {e.location?.locationName&&<div style={{fontSize:10,color:"var(--text-dim)",marginTop:1}}>📍 {e.location.locationName.slice(0,30)}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                    <span className={`badge ${SEV_BADGE[e.severity]||"badge-muted"}`} style={{fontSize:9}}>{e.severity}</span>
                    <span style={{background:`${ST_COLOR[e.status]}22`,color:ST_COLOR[e.status]||"#888",border:`1px solid ${ST_COLOR[e.status]}44`,padding:"1px 5px",borderRadius:4,fontSize:8,fontWeight:700}}>{e.status}</span>
                  </div>
                </div>
                {selected?._id===e._id&&(
                  <div style={{fontSize:11,lineHeight:1.9,color:"var(--text-muted)",paddingTop:8,borderTop:"1px solid var(--border)",marginTop:4}}>
                    {e.description&&<div>📝 {e.description}</div>}
                    {e.location?.address&&<div>📍 {e.location.address}</div>}
                    {e.assignedHospital&&<div>🏥 {e.assignedHospital.name}</div>}
                    {e.assignedAmbulance&&<div>🚑 {e.assignedAmbulance.ambulanceId}</div>}
                    {e.aiRecommendation&&<div style={{color:"var(--accent)",fontSize:10,marginTop:4}}>🤖 {e.aiRecommendation}</div>}
                    {e.rejectedByHospitals?.length>0&&<div style={{color:"var(--red)",fontSize:10}}>🚫 Rejected by {e.rejectedByHospitals.length} hospital(s)</div>}
                    <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                      {!["Resolved","Cancelled","PatientNotFound"].includes(e.status)&&(
                        <button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e2=>{e2.stopPropagation();setShowDisp(e._id);}}>Dispatch</button>
                      )}
                      {e.status==="EnRoute"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e2=>{e2.stopPropagation();updateStatus(e._id,"OnScene");}}>On Scene</button>}
                      {e.status==="OnScene"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e2=>{e2.stopPropagation();updateStatus(e._id,"TransportingToHospital");}}>Transporting</button>}
                      {e.status==="TransportingToHospital"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={e2=>{e2.stopPropagation();updateStatus(e._id,"Resolved");}}>Resolve</button>}
                      {!["Resolved","Cancelled"].includes(e.status)&&<button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--text-muted)"}} onClick={e2=>{e2.stopPropagation();updateStatus(e._id,"Cancelled");}}>Cancel</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {emergencies.filter(e=>filter==="All"||e.status===filter).length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No emergencies found</div>}
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDisp&&(
        <div className="modal-overlay" onClick={()=>setShowDisp(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div className="modal-title" style={{margin:0}}>Dispatch Emergency</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowDisp(null)}>✕</button>
            </div>
            <div style={{marginBottom:12}}><label className="form-label">Assign Hospital</label>
              <select className="select" value={dispForm.hospitalId} onChange={e=>setDispForm(p=>({...p,hospitalId:e.target.value}))}>
                <option value="">Select hospital…</option>
                {hospitals.map(h=><option key={h._id} value={h._id}>{h.name} — {h.location?.city} (ICU: {h.resources?.icuBeds?.available||0})</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}><label className="form-label">Assign Ambulance</label>
              <select className="select" value={dispForm.ambulanceId} onChange={e=>setDispForm(p=>({...p,ambulanceId:e.target.value}))}>
                <option value="">Select ambulance…</option>
                {ambulances.filter(a=>a.status==="Available").map(a=><option key={a._id} value={a._id}>{a.name||a.ambulanceId} ({a.type})</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-ghost" onClick={()=>setShowDisp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={dispatch}>Dispatch Now</button>
            </div>
          </div>
        </div>
      )}

      {showNew&&<NewEmergencyModal onClose={()=>setShowNew(false)} onSave={createEmergency}/>}
    </div>
  );
}
