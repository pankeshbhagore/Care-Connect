import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import socket from "../services/socket";

const SEV_COLOR = { Critical:"#ff4060", High:"#ff8f00", Medium:"#ffd600", Low:"#00e676" };
const SEV_BADGE = { Critical:"badge-red", High:"badge-orange", Medium:"badge-yellow", Low:"badge-green" };
const ST_COLOR  = { Reported:"#ffd600", Dispatched:"#ff8f00", EnRoute:"#00c8ff", OnScene:"#b388ff", Transferred:"#00e676", Resolved:"#00e676", Cancelled:"#4e7090" };

function NewEmergencyModal({ onClose, onSave }) {
  const [f,setF]=useState({ type:"Other", severity:"Medium", patientName:"", patientAge:"", patientPhone:"", description:"", lat:"", lng:"", address:"" });
  const [saving,setSaving]=useState(false);
  const [locating,setLocating]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  const getLocation=()=>{
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(pos=>{ s("lat",pos.coords.latitude.toFixed(6)); s("lng",pos.coords.longitude.toFixed(6)); setLocating(false); },()=>setLocating(false));
  };

  const submit=async e=>{
    e.preventDefault(); setSaving(true);
    try { await onSave({...f,lat:parseFloat(f.lat),lng:parseFloat(f.lng)}); onClose(); }
    catch(e){ alert(e.message); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:540}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>🚨 New Emergency Request</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{marginBottom:12}}><label className="form-label">Emergency Type *</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["Cardiac","Stroke","Trauma","Respiratory","Obstetric","Pediatric","Burns","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Severity</label><select className="select" value={f.severity} onChange={e=>s("severity",e.target.value)}>{["Critical","High","Medium","Low"].map(sv=><option key={sv}>{sv}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Patient Name</label><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Unknown"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Age</label><input className="input" type="number" value={f.patientAge} onChange={e=>s("patientAge",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Patient Phone</label><input className="input" value={f.patientPhone} onChange={e=>s("patientPhone",e.target.value)}/></div>
            <div style={{marginBottom:12,gridColumn:"1/-1"}}><label className="form-label">Description</label><textarea className="input" rows={2} value={f.description} onChange={e=>s("description",e.target.value)} placeholder="Symptoms, situation…"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Latitude *</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)} required/></div>
            <div style={{marginBottom:12}}><label className="form-label">Longitude *</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)} required/></div>
            <div style={{marginBottom:12,gridColumn:"1/-1"}}><label className="form-label">Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Street, Area, Landmark"/></div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={getLocation} disabled={locating} style={{marginBottom:14}}>{locating?"📍 Detecting…":"📍 Use My Location"}</button>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Submitting…":"🚨 Submit Emergency"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmergencyPanel() {
  const [emergencies,setEmergencies]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("All");
  const [showNew,setShowNew]=useState(false);
  const [selected,setSelected]=useState(null);

  const load=useCallback(async()=>{
    try {
      const r=await api.get("/emergencies"+(filter!=="All"?`?status=${filter}`:""));
      setEmergencies(r.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[filter]);

  useEffect(()=>{ load(); const t=setInterval(load,15000); return()=>clearInterval(t); },[load]);
  useEffect(()=>{
    socket.on("newEmergencyRequest",()=>load());
    socket.on("emergencyUpdate",()=>load());
    socket.on("emergencyDispatched",()=>load());
    return()=>{ socket.off("newEmergencyRequest"); socket.off("emergencyUpdate"); socket.off("emergencyDispatched"); };
  },[load]);

  const updateStatus=async(id,status,notes)=>{
    try { await api.patch(`/emergencies/${id}/status`,{status,notes}); load(); }
    catch(e){ alert(e.message); }
  };

  const createEmergency=async(data)=>{ await api.post("/emergencies",data); load(); };

  const active=emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status));
  const critical=emergencies.filter(e=>e.severity==="Critical"&&!["Resolved","Cancelled"].includes(e.status));

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

  return (
    <div>
      {/* Stats */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(5,1fr)",marginBottom:20}}>
        {[["🚨","Total",emergencies.length,"var(--accent)"],["⚡","Active",active.length,active.length>0?"var(--orange)":"var(--green)"],["🔴","Critical",critical.length,critical.length>0?"var(--red)":"var(--green)"],["✅","Resolved",emergencies.filter(e=>e.status==="Resolved").length,"var(--green)"],["⏱","Avg Response",`${Math.round(emergencies.filter(e=>e.responseTimeMinutes>0).reduce((a,e)=>a+e.responseTimeMinutes,0)/Math.max(1,emergencies.filter(e=>e.responseTimeMinutes>0).length))} min`,"var(--purple)"]].map(([i,l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:28}}>{v}</div></div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 400px",gap:16,alignItems:"start"}}>
        {/* Map */}
        <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:480}}>
          <MapContainer center={[23.18,79.98]} zoom={8} style={{height:"100%",width:"100%",background:"#0a1628"}}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB"/>
            {emergencies.filter(e=>e.location?.lat).map(e=>(
              <CircleMarker key={e._id} center={[e.location.lat,e.location.lng]} radius={e.severity==="Critical"?14:e.severity==="High"?11:8} pathOptions={{ color:SEV_COLOR[e.severity]||"#fff", fillColor:SEV_COLOR[e.severity]||"#fff", fillOpacity:0.7, weight:2 }}>
                <Popup>
                  <div style={{fontFamily:"system-ui",background:"#0d1e35",color:"#e8f1fa",minWidth:190,padding:4}}>
                    <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{e.type} — {e.severity}</div>
                    <div style={{fontSize:11,color:"#8aaccc",marginBottom:4}}>{e.requestId}</div>
                    <div style={{fontSize:11,marginBottom:2}}>Patient: {e.patientName}</div>
                    <div style={{fontSize:11,marginBottom:2}}>Status: <span style={{color:ST_COLOR[e.status],fontWeight:700}}>{e.status}</span></div>
                    {e.assignedHospital&&<div style={{fontSize:11,marginBottom:4}}>Hospital: {e.assignedHospital.name}</div>}
                    {e.aiRecommendation&&<div style={{fontSize:10,color:"#00c8ff",marginTop:6,lineHeight:1.4}}>🤖 {e.aiRecommendation}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* List */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{flex:1,marginRight:8}}>
              <option value="All">All Requests</option>
              {["Reported","Dispatched","EnRoute","OnScene","Resolved","Cancelled"].map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ New</button>
          </div>
          <div style={{maxHeight:430,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {emergencies.filter(e=>filter==="All"||e.status===filter).map(e=>(
              <div key={e._id} className="card card-sm" style={{borderLeft:`3px solid ${SEV_COLOR[e.severity]||"#fff"}`,cursor:"pointer"}} onClick={()=>setSelected(selected?._id===e._id?null:e)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{e.type} — {e.patientName}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)"}}>{e.requestId} · {new Date(e.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                    <span className={`badge ${SEV_BADGE[e.severity]||"badge-muted"}`}>{e.severity}</span>
                    <span style={{background:`${ST_COLOR[e.status]}22`,color:ST_COLOR[e.status],border:`1px solid ${ST_COLOR[e.status]}44`,padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:700}}>{e.status}</span>
                  </div>
                </div>
                {selected?._id===e._id&&(
                  <div style={{fontSize:11,lineHeight:1.9,color:"var(--text-muted)",paddingTop:8,borderTop:"1px solid var(--border)",marginTop:4}}>
                    {e.description&&<div>📝 {e.description}</div>}
                    {e.location?.address&&<div>📍 {e.location.address}</div>}
                    {e.assignedHospital&&<div>🏥 {e.assignedHospital.name}</div>}
                    {e.assignedAmbulance&&<div>🚑 {e.assignedAmbulance.ambulanceId}</div>}
                    {e.aiRecommendation&&<div style={{color:"var(--accent)",fontSize:10,marginTop:4}}>🤖 {e.aiRecommendation}</div>}
                    <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                      {e.status==="Reported"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(e._id,"Dispatched")}>Dispatch</button>}
                      {e.status==="Dispatched"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(e._id,"EnRoute")}>En Route</button>}
                      {e.status==="EnRoute"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(e._id,"OnScene")}>On Scene</button>}
                      {e.status==="OnScene"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(e._id,"Resolved")}>✓ Resolve</button>}
                      {!["Resolved","Cancelled"].includes(e.status)&&<button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--text-muted)"}} onClick={()=>updateStatus(e._id,"Cancelled")}>Cancel</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {emergencies.filter(e=>filter==="All"||e.status===filter).length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No emergencies found</div>}
          </div>
        </div>
      </div>

      {showNew&&<NewEmergencyModal onClose={()=>setShowNew(false)} onSave={createEmergency}/>}
    </div>
  );
}
