import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import socket from "../services/socket";

const STATUS_COLOR = { Available:"#00e676", Dispatched:"#ff8f00", OnScene:"#00c8ff", Returning:"#ffd600", Offline:"#4e7090", Maintenance:"#ff4060" };

function createAmbIcon(a) {
  const c = STATUS_COLOR[a.status]||"#4e7090";
  return L.divIcon({
    className:"",
    html:`<div style="background:#0d1e35;border:2px solid ${c};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px ${c}55;font-size:18px;cursor:pointer;">🚑</div>`,
    iconAnchor:[18,18],
  });
}

function AddAmbModal({ hospitals, onClose, onSave }) {
  const [f,setF]=useState({ name:"", type:"BLS", registrationNo:"", driver:"", driverPhone:"", crewCount:2, hospital:"", lat:"", lng:"" });
  const [saving,setSaving]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=async e=>{
    e.preventDefault(); setSaving(true);
    try {
      await onSave({ ...f, location:{ lat:parseFloat(f.lat)||0, lng:parseFloat(f.lng)||0 }, crewCount:+f.crewCount, hospital:f.hospital||null });
      onClose();
    } catch(e){ alert(e.message); }
    setSaving(false);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>🚑 Add Ambulance</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Victoria ALS-1" required/></div>
            <div style={{marginBottom:12}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["ALS","BLS","Neonatal","Air"].map(t=><option key={t}>{t}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Registration No</label><input className="input" value={f.registrationNo} onChange={e=>s("registrationNo",e.target.value)} placeholder="MP-20-AB-1001"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Driver Name</label><input className="input" value={f.driver} onChange={e=>s("driver",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Driver Phone</label><input className="input" value={f.driverPhone} onChange={e=>s("driverPhone",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Crew Count</label><input className="input" type="number" min={1} value={f.crewCount} onChange={e=>s("crewCount",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Base Hospital</label><select className="select" value={f.hospital} onChange={e=>s("hospital",e.target.value)}><option value="">None</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Start Lat</label><input className="input" type="number" step="0.0001" value={f.lat} onChange={e=>s("lat",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Start Lng</label><input className="input" type="number" step="0.0001" value={f.lng} onChange={e=>s("lng",e.target.value)}/></div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Adding…":"Add Ambulance"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AmbulanceTracker() {
  const [ambulances,setAmbulances]=useState([]);
  const [hospitals,setHospitals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("All");
  const [showAdd,setShowAdd]=useState(false);
  const [selected,setSelected]=useState(null);
  const livePositions=useRef({});

  const load=useCallback(async()=>{
    try {
      const [a,h]=await Promise.all([api.get("/ambulances"),api.get("/hospitals")]);
      setAmbulances(a.data); setHospitals(h.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); const t=setInterval(load,15000); return()=>clearInterval(t); },[load]);

  useEffect(()=>{
    socket.on("ambulanceLocation", data=>{
      livePositions.current[data.ambulanceId]={ lat:data.lat, lng:data.lng, speed:data.speed, ts:data.ts };
      setAmbulances(prev=>prev.map(a=>a.ambulanceId===data.ambulanceId?{...a,location:{...a.location,lat:data.lat,lng:data.lng,lastUpdated:new Date()},speed:data.speed}:a));
    });
    socket.on("ambulanceAdded",()=>load());
    socket.on("ambulanceUpdate",()=>load());
    return()=>{ socket.off("ambulanceLocation"); socket.off("ambulanceAdded"); socket.off("ambulanceUpdate"); };
  },[load]);

  const updateStatus=async(id,status)=>{
    try { await api.put(`/ambulances/${id}`,{status}); load(); }
    catch(e){ alert(e.message); }
  };

  const addAmbulance=async(data)=>{ await api.post("/ambulances",data); load(); };
  const removeAmbulance=async(id)=>{ if(!confirm("Delete?")) return; await api.delete(`/ambulances/${id}`); load(); };

  const filtered=filter==="All"?ambulances:ambulances.filter(a=>a.status===filter);
  const counts=Object.fromEntries(Object.keys(STATUS_COLOR).map(s=>[s,ambulances.filter(a=>a.status===s).length]));

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

  return (
    <div>
      {/* Summary */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(6,1fr)",marginBottom:20}}>
        {[["🚑","Total",ambulances.length,"var(--accent)"],["✅","Available",counts.Available||0,"var(--green)"],["🔴","Dispatched",counts.Dispatched||0,"var(--orange)"],["🏥","On Scene",counts.OnScene||0,"var(--accent)"],["↩","Returning",counts.Returning||0,"var(--yellow)"],["⚙","Maintenance",counts.Maintenance||0,"var(--text-muted)"]].map(([i,l,v,c])=>(
          <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:28}}>{v}</div></div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 420px",gap:16,alignItems:"start"}}>
        {/* Map */}
        <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:520}}>
          <MapContainer center={[23.18,79.98]} zoom={8} style={{height:"100%",width:"100%",background:"#0a1628"}}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB"/>
            {hospitals.map(h=>h.location?.lat&&(
              <Marker key={h._id} position={[h.location.lat,h.location.lng]}>
                <Popup><div style={{fontFamily:"system-ui",color:"#e8f1fa",background:"#0d1e35",padding:4}}><b>{h.name}</b><br/><span style={{fontSize:11,color:"#8aaccc"}}>{h.location.city}</span></div></Popup>
              </Marker>
            ))}
            {ambulances.map(a=>a.location?.lat&&(
              <Marker key={a._id} position={[a.location.lat,a.location.lng]} icon={createAmbIcon(a)}>
                <Popup>
                  <div style={{fontFamily:"system-ui",background:"#0d1e35",color:"#e8f1fa",minWidth:180,padding:4}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>🚑 {a.name}</div>
                    <div style={{fontSize:11,color:"#8aaccc",marginBottom:6}}>{a.type} · {a.registrationNo}</div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Status</span><span style={{color:STATUS_COLOR[a.status],fontWeight:700}}>{a.status}</span></div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Driver</span><span>{a.driver||"—"}</span></div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between",marginBottom:2}}><span>Speed</span><span>{a.speed||0} km/h</span></div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between",marginBottom:6}}><span>Fuel</span><span style={{color:(a.fuelLevel||0)<25?"#ff4060":"#00e676"}}>{a.fuelLevel||0}%</span></div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {a.status!=="Available"&&<button className="btn btn-ghost btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(a._id,"Available")}>→ Available</button>}
                      {a.status==="Available"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(a._id,"Dispatched")}>→ Dispatch</button>}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* List */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{flex:1,marginRight:8}}>
              <option value="All">All Ambulances</option>
              {Object.keys(STATUS_COLOR).map(s=><option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add</button>
          </div>
          <div style={{maxHeight:480,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {filtered.map(a=>(
              <div key={a._id} className="card card-sm" style={{borderLeft:`3px solid ${STATUS_COLOR[a.status]||"#4e7090"}`,cursor:"pointer"}} onClick={()=>setSelected(selected?._id===a._id?null:a)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>🚑 {a.name}</div>
                    <div style={{fontSize:10,color:"var(--text-muted)"}}>{a.type} · {a.registrationNo}</div>
                  </div>
                  <span style={{background:`${STATUS_COLOR[a.status]}22`,color:STATUS_COLOR[a.status],border:`1px solid ${STATUS_COLOR[a.status]}44`,padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700}}>{a.status}</span>
                </div>
                {selected?._id===a._id&&(
                  <div style={{fontSize:11,lineHeight:1.9,color:"var(--text-muted)",marginTop:6,paddingTop:6,borderTop:"1px solid var(--border)"}}>
                    <div>👤 Driver: {a.driver||"—"} {a.driverPhone?`(${a.driverPhone})`:""}</div>
                    <div>👥 Crew: {a.crewCount}</div>
                    <div>⛽ Fuel: <span style={{color:(a.fuelLevel||0)<25?"var(--red)":"var(--green)"}}>{a.fuelLevel||0}%</span></div>
                    {a.location?.lat&&<div>📍 {a.location.lat?.toFixed(4)}, {a.location.lng?.toFixed(4)}</div>}
                    {a.speed>0&&<div>⚡ Speed: {a.speed} km/h</div>}
                    {a.hospital&&<div>🏥 Base: {hospitals.find(h=>h._id===a.hospital)?.name||"—"}</div>}
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {["Available","Dispatched","OnScene","Returning","Maintenance"].filter(s=>s!==a.status).map(s=>(
                        <button key={s} className="btn btn-ghost btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(a._id,s)}>→ {s}</button>
                      ))}
                      <button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>removeAmbulance(a._id)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No ambulances found</div>}
          </div>
        </div>
      </div>

      {showAdd&&<AddAmbModal hospitals={hospitals} onClose={()=>setShowAdd(false)} onSave={addAmbulance}/>}
    </div>
  );
}
