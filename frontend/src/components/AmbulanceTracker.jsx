// import { useState, useEffect, useCallback, useRef } from "react";
// import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
// import L from "leaflet";
// import "leaflet/dist/leaflet.css";
// import api from "../services/api";
// import socket from "../services/socket";

// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
//   iconUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
//   shadowUrl:"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
// });

// const TILE_URLS = {
//   street:  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
//   dark:    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
//   smooth:  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
//   topo:    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
// };

// const STATUS_COLOR = {
//   Available:"#00e676",Dispatched:"#ff8f00",OnScene:"#00c8ff",
//   Returning:"#ffd600",Offline:"#4e7090",Maintenance:"#ff4060",
// };
// const fmtSec = s => s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;

// function createAmbIcon(a, isLive, heading) {
//   const c = STATUS_COLOR[a.status]||"#4e7090";
//   const rot = heading ? `transform:rotate(${Math.round(heading)}deg);` : "";
//   return L.divIcon({
//     className:"",
//     html:`<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
//       ${isLive?`<div style="position:absolute;width:44px;height:44px;border-radius:50%;border:2px solid ${c};opacity:0.5;animation:ambPulse 1.5s ease-out infinite;"></div>`:""}
//       <div style="background:${c==="4e7090"?"#0d1e35":"#fff"};border:2.5px solid ${c};border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px ${c}88;font-size:18px;">🚑</div>
//     </div>`,
//     iconAnchor:[22,22],
//   });
// }

// function FlyTo({ pos }) {
//   const map = useMap();
//   useEffect(() => { if(pos) map.flyTo([pos.lat,pos.lng], 13, {duration:1.5}); }, [pos?.lat, pos?.lng]);
//   return null;
// }

// function DispatchModal({ ambulance, hospitals, onClose, onDispatch }) {
//   const [target, setTarget] = useState("");
//   const [mode, setMode]     = useState("hospital");
//   const [lat, setLat]       = useState("");
//   const [lng, setLng]       = useState("");
//   const [going, setGoing]   = useState(false);

//   const go = async () => {
//     setGoing(true);
//     let toLat, toLng;
//     if (mode==="hospital") {
//       const h = hospitals.find(h=>h._id===target);
//       if(!h){alert("Select a hospital"); setGoing(false); return;}
//       toLat=h.location.lat; toLng=h.location.lng;
//     } else { toLat=parseFloat(lat); toLng=parseFloat(lng); }
//     if(!toLat||!toLng){alert("Valid location required"); setGoing(false); return;}
//     await onDispatch(ambulance._id, toLat, toLng);
//     onClose();
//   };

//   return (
//     <div className="modal-overlay" onClick={onClose}>
//       <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440}}>
//         <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
//           <div className="modal-title" style={{margin:0}}>🚑 Dispatch Simulation — {ambulance.name}</div>
//           <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
//         </div>
//         <div style={{background:"rgba(0,200,255,.08)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:"10px 14px",marginBottom:16,fontSize:12,color:"var(--text-secondary)"}}>
//           From: <b style={{color:"var(--text-primary)"}}>{ambulance.location?.lat?.toFixed(4)}, {ambulance.location?.lng?.toFixed(4)}</b>
//           <br/>Route via OSRM · Realtime simulation every 1.5s
//         </div>
//         <div style={{display:"flex",gap:8,marginBottom:14}}>
//           <button className={`btn btn-sm ${mode==="hospital"?"btn-primary":"btn-ghost"}`} onClick={()=>setMode("hospital")}>🏥 To Hospital</button>
//           <button className={`btn btn-sm ${mode==="custom"?"btn-primary":"btn-ghost"}`} onClick={()=>setMode("custom")}>📍 Custom</button>
//         </div>
//         {mode==="hospital"&&<div style={{marginBottom:14}}><label className="form-label">Target Hospital</label><select className="select" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Select…</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name} — {h.location?.city}</option>)}</select></div>}
//         {mode==="custom"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
//           <div><label className="form-label">Latitude</label><input className="input" type="number" step="0.0001" value={lat} onChange={e=>setLat(e.target.value)}/></div>
//           <div><label className="form-label">Longitude</label><input className="input" type="number" step="0.0001" value={lng} onChange={e=>setLng(e.target.value)}/></div>
//         </div>}
//         <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
//           <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
//           <button className="btn btn-primary" disabled={going} onClick={go}>{going?"🔄 Starting…":"🚑 Start Simulation"}</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function AddAmbModal({ hospitals, onClose, onSave }) {
//   const [f,setF]=useState({name:"",type:"BLS",registrationNo:"",driver:"",driverPhone:"",crewCount:2,hospital:"",lat:"",lng:""});
//   const [saving,setSaving]=useState(false);
//   const s=(k,v)=>setF(p=>({...p,[k]:v}));
//   const submit=async e=>{
//     e.preventDefault(); setSaving(true);
//     try{ await onSave({...f,location:{lat:parseFloat(f.lat)||0,lng:parseFloat(f.lng)||0},crewCount:+f.crewCount,hospital:f.hospital||null}); onClose(); }
//     catch(e){ alert(e.message); setSaving(false); }
//   };
//   return (
//     <div className="modal-overlay" onClick={onClose}>
//       <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
//         <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
//           <div className="modal-title" style={{margin:0}}>🚑 Add Ambulance</div>
//           <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
//         </div>
//         <form onSubmit={submit}>
//           <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
//             <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required placeholder="e.g. Victoria ALS-1"/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["ALS","BLS","Neonatal","Air"].map(t=><option key={t}>{t}</option>)}</select></div>
//             <div style={{marginBottom:12}}><label className="form-label">Registration</label><input className="input" value={f.registrationNo} onChange={e=>s("registrationNo",e.target.value)} placeholder="MP-20-AB-1001"/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Driver</label><input className="input" value={f.driver} onChange={e=>s("driver",e.target.value)}/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Driver Phone</label><input className="input" value={f.driverPhone} onChange={e=>s("driverPhone",e.target.value)}/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Crew</label><input className="input" type="number" min={1} value={f.crewCount} onChange={e=>s("crewCount",e.target.value)}/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Base Hospital</label><select className="select" value={f.hospital} onChange={e=>s("hospital",e.target.value)}><option value="">None</option>{hospitals.map(h=><option key={h._id} value={h._id}>{h.name}</option>)}</select></div>
//             <div style={{marginBottom:12}}><label className="form-label">Lat</label><input className="input" type="number" step="0.0001" value={f.lat} onChange={e=>s("lat",e.target.value)}/></div>
//             <div style={{marginBottom:12}}><label className="form-label">Lng</label><input className="input" type="number" step="0.0001" value={f.lng} onChange={e=>s("lng",e.target.value)}/></div>
//           </div>
//           <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
//             <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
//             <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Adding…":"Add Ambulance"}</button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default function AmbulanceTracker() {
//   const [ambulances, setAmbulances] = useState([]);
//   const [hospitals,  setHospitals]  = useState([]);
//   const [stats,      setStats]      = useState(null);
//   const [loading,    setLoading]    = useState(true);
//   const [filter,     setFilter]     = useState("All");
//   const [mapTile,    setMapTile]    = useState("street");
//   const [showAdd,    setShowAdd]    = useState(false);
//   const [selected,   setSelected]   = useState(null);
//   const [showDispatch,setShowDispatch]=useState(null);
//   const [flyTo,      setFlyTo]      = useState(null);
//   const livePos = useRef({});
//   const [renderKey, setRenderKey]   = useState(0);

//   const load = useCallback(async () => {
//     try {
//       const [a,h,s]=await Promise.all([api.get("/ambulances"),api.get("/hospitals"),api.get("/ambulances/stats")]);
//       setAmbulances(a.data); setHospitals(h.data); setStats(s.data);
//     } catch(e){ console.error(e); }
//     finally{ setLoading(false); }
//   },[]);

//   useEffect(()=>{ load(); const t=setInterval(load,20000); return()=>clearInterval(t); },[load]);

//   useEffect(()=>{
//     socket.on("ambulanceLocation", d=>{
//       livePos.current[d.ambulanceId]={ lat:d.lat, lng:d.lng, speed:d.speed||0, heading:d.heading||0, progressPct:d.progressPct||0, remainingSec:d.remainingSec||0, arrived:d.arrived||false, ts:Date.now() };
//       setRenderKey(k=>k+1);
//     });
//     socket.on("ambulanceArrived", d=>{
//       setTimeout(()=>{ delete livePos.current[d.ambulanceId]; setRenderKey(k=>k+1); load(); }, 4000);
//     });
//     socket.on("ambulanceAdded",()=>load());
//     socket.on("ambulanceUpdate",()=>load());
//     return()=>{["ambulanceLocation","ambulanceArrived","ambulanceAdded","ambulanceUpdate"].forEach(e=>socket.off(e));};
//   },[load]);

//   const addAmbulance = async d => { await api.post("/ambulances",d); load(); };
//   const updateStatus = async(id,status)=>{ await api.put(`/ambulances/${id}`,{status}); load(); };
//   const removeAmb    = async id=>{ if(!confirm("Delete?")) return; await api.delete(`/ambulances/${id}`); load(); };

//   const dispatchAmb = async(id,toLat,toLng)=>{
//     try {
//       const res = await api.post(`/ambulances/${id}/dispatch`,{targetLat:toLat,targetLng:toLng,priority:"High"});
//       load();
//     } catch(e){ alert("Dispatch failed: "+e.message); }
//   };

//   const liveSims = Object.entries(livePos.current).filter(([,p])=>!p.arrived);
//   const filtered = filter==="All" ? ambulances : ambulances.filter(a=>a.status===filter);

//   if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

//   return (
//     <div>
//       <style>{`@keyframes ambPulse{0%{transform:scale(1);opacity:0.6}70%{transform:scale(1.5);opacity:0}100%{transform:scale(1);opacity:0}}`}</style>

//       {/* Stats row */}
//       {stats&&(
//         <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",marginBottom:20}}>
//           {[["🚑","Total",stats.total,"var(--accent)"],["✅","Available",stats.byStatus?.Available||0,"var(--green)"],["🔴","Dispatched",stats.byStatus?.Dispatched||0,"var(--orange)"],["🏥","On Scene",stats.byStatus?.OnScene||0,"var(--accent)"],["↩","Returning",stats.byStatus?.Returning||0,"var(--yellow)"],["🎮","Live Sims",liveSims.length,"var(--purple)"]].map(([i,l,v,c])=>(
//             <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:26}}>{v}</div></div>
//           ))}
//         </div>
//       )}

//       {/* Live sim banner */}
//       {liveSims.length>0&&(
//         <div style={{background:"var(--orange-dim)",border:"1px solid var(--orange)",borderRadius:"var(--radius-md)",padding:"10px 16px",marginBottom:14}}>
//           <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--orange)",marginBottom:6}}>🚑 LIVE SIMULATION ACTIVE — {liveSims.length} ambulance(s)</div>
//           <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
//             {liveSims.map(([id,p])=>(
//               <div key={id} style={{fontSize:11,color:"var(--text-secondary)"}}>
//                 <b style={{color:"var(--orange)"}}>{id}</b>: {p.speed}km/h · {p.progressPct}% · ETA {fmtSec(p.remainingSec)}
//                 <div style={{height:3,width:120,background:"var(--bg-elevated)",borderRadius:2,marginTop:3}}>
//                   <div style={{width:`${p.progressPct}%`,height:"100%",background:"var(--orange)",borderRadius:2,transition:"width .5s"}}/>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:16,alignItems:"start"}}>
//         {/* MAP */}
//         <div>
//           {/* Tile controls */}
//           <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
//             {Object.entries({street:"🗺 Street",dark:"🌑 Dark",smooth:"🎨 Smooth",topo:"🏔 Topo"}).map(([k,l])=>(
//               <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} onClick={()=>setMapTile(k)}>{l}</button>
//             ))}
//             <span style={{marginLeft:"auto",fontSize:11,color:"var(--text-muted)"}}>{hospitals.length} hospitals · {ambulances.length} ambulances</span>
//           </div>

//           <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:520}}>
//             <MapContainer center={[23.18,79.98]} zoom={7} style={{height:"100%",width:"100%"}}>
//               <TileLayer url={TILE_URLS[mapTile]} attribution="© OpenStreetMap"/>
//               {flyTo&&<FlyTo pos={flyTo}/>}

//               {/* Hospitals */}
//               {hospitals.map(h=>h.location?.lat&&(
//                 <Marker key={h._id} position={[h.location.lat,h.location.lng]}>
//                   <Popup><div style={{fontFamily:"system-ui",fontSize:13}}><b>🏥 {h.name}</b><br/><span style={{fontSize:11,color:"#666"}}>{h.location.city} · ICU {h.resources?.icuBeds?.available||0}/{h.resources?.icuBeds?.total||0}</span></div></Popup>
//                 </Marker>
//               ))}

//               {/* Ambulances */}
//               {ambulances.map(a=>{
//                 const live=livePos.current[a.ambulanceId];
//                 const lat=live?.lat??a.location?.lat;
//                 const lng=live?.lng??a.location?.lng;
//                 if(!lat) return null;
//                 const isLive=!!live&&!live.arrived;
//                 return (
//                   <Marker key={a._id} position={[lat,lng]} icon={createAmbIcon(a,isLive,live?.heading)}>
//                     <Popup>
//                       <div style={{fontFamily:"system-ui",fontSize:13,minWidth:190}}>
//                         <div style={{fontWeight:700,marginBottom:4}}>🚑 {a.name}</div>
//                         <div style={{fontSize:11,color:"#666",marginBottom:4}}>{a.type} · {a.registrationNo}</div>
//                         <div>Status: <b style={{color:STATUS_COLOR[a.status]}}>{a.status}</b></div>
//                         {isLive&&<>
//                           <div style={{color:"#ff8f00",fontWeight:700,marginTop:4}}>● {live.speed}km/h — {live.progressPct}%</div>
//                           <div>ETA: {fmtSec(live.remainingSec)}</div>
//                         </>}
//                         <div style={{marginTop:5,fontSize:11}}>Driver: {a.driver||"—"} · {a.driverPhone||""}</div>
//                         {a.status==="Available"&&<button onClick={()=>setShowDispatch(a)} style={{marginTop:7,background:"#ff8f00",border:"none",color:"#fff",padding:"4px 12px",borderRadius:4,fontSize:11,cursor:"pointer",width:"100%"}}>🚑 Dispatch + Simulate</button>}
//                       </div>
//                     </Popup>
//                   </Marker>
//                 );
//               })}

//               {/* Route polylines for live simulations */}
//               {liveSims.map(([ambId,pos])=>{
//                 const a=ambulances.find(x=>x.ambulanceId===ambId);
//                 if(!a?.location?.lat) return null;
//                 return (
//                   <Polyline key={`rt-${ambId}`}
//                     positions={[[a.location.lat,a.location.lng],[pos.lat,pos.lng]]}
//                     pathOptions={{color:"#ff8f00",weight:3,opacity:0.8,dashArray:"10,5"}}
//                   />
//                 );
//               })}
//             </MapContainer>
//           </div>

//           {/* Legend */}
//           <div style={{display:"flex",gap:10,marginTop:8,fontSize:11,color:"var(--text-muted)",flexWrap:"wrap"}}>
//             {Object.entries(STATUS_COLOR).map(([s,c])=>(
//               <span key={s} style={{display:"flex",alignItems:"center",gap:4}}>
//                 <span style={{width:9,height:9,borderRadius:"50%",background:c,display:"inline-block"}}/>
//                 {s}
//               </span>
//             ))}
//           </div>
//         </div>

//         {/* Ambulance list sidebar */}
//         <div>
//           <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
//             <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{flex:1,marginRight:8}}>
//               <option value="All">All ({ambulances.length})</option>
//               {Object.keys(STATUS_COLOR).map(s=><option key={s}>{s}</option>)}
//             </select>
//             <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
//             <button className="btn btn-primary btn-sm" style={{marginLeft:6}} onClick={()=>setShowAdd(true)}>+ Add</button>
//           </div>

//           <div style={{maxHeight:480,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
//             {filtered.map(a=>{
//               const live=livePos.current[a.ambulanceId];
//               const isLive=!!live&&!live.arrived;
//               const sc=STATUS_COLOR[a.status]||"#4e7090";
//               return (
//                 <div key={a._id} className="card card-sm" style={{borderLeft:`3px solid ${sc}`,cursor:"pointer"}}
//                   onClick={()=>{setSelected(p=>p?._id===a._id?null:a); if(a.location?.lat) setFlyTo({lat:a.location.lat,lng:a.location.lng});}}>
//                   <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
//                     <div>
//                       <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>
//                         {isLive&&<span style={{color:"var(--orange)",fontSize:8,marginRight:4}}>●</span>}
//                         🚑 {a.name}
//                       </div>
//                       <div style={{fontSize:10,color:"var(--text-muted)"}}>{a.type} · {a.registrationNo}</div>
//                     </div>
//                     <span style={{background:`${sc}22`,color:sc,border:`1px solid ${sc}44`,padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700}}>{a.status}</span>
//                   </div>
//                   {isLive&&(
//                     <div style={{marginTop:6}}>
//                       <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--orange)",marginBottom:2}}>
//                         <span>● {live.speed}km/h</span><span>{live.progressPct}% · {fmtSec(live.remainingSec)}</span>
//                       </div>
//                       <div style={{height:3,background:"var(--bg-elevated)",borderRadius:2,overflow:"hidden"}}>
//                         <div style={{width:`${live.progressPct}%`,height:"100%",background:"var(--orange)",transition:"width .4s"}}/>
//                       </div>
//                     </div>
//                   )}
//                   {selected?._id===a._id&&(
//                     <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",fontSize:11,lineHeight:1.8,color:"var(--text-muted)"}}>
//                       <div>👤 {a.driver||"—"} {a.driverPhone?`· 📞 ${a.driverPhone}`:""}</div>
//                       <div>👥 Crew: {a.crewCount} · ⛽ Fuel: {a.fuelLevel||100}%</div>
//                       {a.location?.lat&&<div>📍 {a.location.lat?.toFixed(4)}, {a.location.lng?.toFixed(4)}</div>}
//                       {a.equipment?.length>0&&<div>🏥 {a.equipment.slice(0,3).join(", ")}</div>}
//                       <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
//                         {a.status==="Available"&&<button className="btn btn-primary btn-sm" style={{fontSize:10}} onClick={e=>{e.stopPropagation();setShowDispatch(a);}}>🚑 Dispatch+Sim</button>}
//                         {["Available","OnScene","Returning","Maintenance"].filter(s=>s!==a.status).map(s=>(
//                           <button key={s} className="btn btn-ghost btn-sm" style={{fontSize:9}} onClick={e=>{e.stopPropagation();updateStatus(a._id,s);}}>→{s}</button>
//                         ))}
//                         <button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--red)"}} onClick={e=>{e.stopPropagation();removeAmb(a._id);}}>Del</button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//             {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No ambulances found</div>}
//           </div>
//         </div>
//       </div>

//       {showAdd&&<AddAmbModal hospitals={hospitals} onClose={()=>setShowAdd(false)} onSave={addAmbulance}/>}
//       {showDispatch&&<DispatchModal ambulance={showDispatch} hospitals={hospitals} onClose={()=>setShowDispatch(null)} onDispatch={dispatchAmb}/>}
//     </div>
//   );
// }
