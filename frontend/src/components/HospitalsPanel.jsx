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

const ALERT_COLOR = { Red:"#ff4060", Orange:"#ff8f00", Yellow:"#ffd600", Normal:"#00e676" };
const TILE_URLS = {
  street:  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark:    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  smooth:  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  topo:    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};

const pct = (a,t) => t>0 ? Math.round((a/t)*100) : 0;
const barClr = p => p>50?"var(--green)":p>25?"var(--yellow)":"var(--red)";
const fmtAgo = dt => { if(!dt) return "—"; const m=Math.floor((Date.now()-new Date(dt))/60000); return m<1?"just now":m<60?`${m}m ago`:`${Math.floor(m/60)}h ago`; };

function createHospitalIcon(h) {
  const color = ALERT_COLOR[h.alertLevel]||"#4e7090";
  const r = h.resources||{};
  const ip = pct(r.icuBeds?.available||0, r.icuBeds?.total||1);
  return L.divIcon({
    className:"",
    html:`<div style="background:#0d1e35;border:2px solid ${color};border-radius:8px;padding:5px 9px;min-width:120px;box-shadow:0 2px 12px rgba(0,0,0,.6);font-family:system-ui,sans-serif;cursor:pointer;">
      <div style="font-size:8px;color:${color};font-weight:700;letter-spacing:1px;margin-bottom:2px">${h.alertLevel?.toUpperCase()}</div>
      <div style="font-size:11px;font-weight:700;color:#e8f1fa;line-height:1.2;margin-bottom:3px">${h.name.length>22?h.name.slice(0,20)+"…":h.name}</div>
      <div style="font-size:9px;color:#4e7090;margin-bottom:3px">${h.location?.city||""}</div>
      <div style="font-size:10px;color:#8aaccc">ICU <span style="color:${ip>50?"#00e676":ip>25?"#ffd600":"#ff4060"};font-weight:700">${r.icuBeds?.available||0}/${r.icuBeds?.total||0}</span> · O₂ ${r.oxygenLevel||0}%</div>
      <div style="margin-top:3px;height:3px;background:#1a3055;border-radius:2px;overflow:hidden"><div style="width:${ip}%;height:100%;background:${ip>50?"#00e676":ip>25?"#ffd600":"#ff4060"}"></div></div>
    </div>`,
    iconAnchor:[60,0],
  });
}

function ResBar({ label, a, t }) {
  const p = pct(a,t);
  return (
    <div style={{marginBottom:5}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
        <span style={{color:"var(--text-muted)"}}>{label}</span>
        <span style={{fontFamily:"var(--font-mono)",color:"var(--text-primary)",fontWeight:600}}>{a}/{t}</span>
      </div>
      <div style={{height:4,background:"var(--bg-primary)",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${p}%`,height:"100%",background:barClr(p),borderRadius:2,transition:"width .4s"}}/>
      </div>
    </div>
  );
}

function UpdateModal({ h, onClose, onSave }) {
  const r = h?.resources||{};
  const [f, setF] = useState({
    icuA:r.icuBeds?.available||0, icuT:r.icuBeds?.total||0,
    genA:r.generalBeds?.available||0, genT:r.generalBeds?.total||0,
    ventA:r.ventilators?.available||0, ventT:r.ventilators?.total||0,
    o2:r.oxygenLevel||100, docs:r.doctorsOnDuty||0, nurses:r.nursesOnDuty||0,
    ambA:r.ambulancesAvailable||0, ambT:r.ambulancesTotal||0, blood:r.bloodUnitsAvailable||0,
    status:h?.status||"Active",
  });
  const [saving,setSaving]=useState(false);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const N=(lbl,k)=>(
    <div style={{marginBottom:12}}>
      <label className="form-label">{lbl}</label>
      <input className="input" type="number" min={0} value={f[k]} onChange={e=>s(k,+e.target.value)}/>
    </div>
  );
  const submit = async e => {
    e.preventDefault(); setSaving(true);
    await onSave(h._id,{
      resources:{
        icuBeds:{available:f.icuA,total:f.icuT}, generalBeds:{available:f.genA,total:f.genT},
        ventilators:{available:f.ventA,total:f.ventT}, oxygenLevel:f.o2,
        doctorsOnDuty:f.docs, nursesOnDuty:f.nurses,
        ambulancesAvailable:f.ambA, ambulancesTotal:f.ambT, bloodUnitsAvailable:f.blood,
      },
      status:f.status, updatedBy:localStorage.getItem("name")||"Operator",
    });
    setSaving(false); onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>📊 Update — {h?.name}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🛏 Beds</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
                {N("ICU Avail","icuA")}{N("ICU Total","icuT")}
                {N("Gen Avail","genA")}{N("Gen Total","genT")}
              </div>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",margin:"10px 0 8px"}}>💨 Equipment</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
                {N("Vent Avail","ventA")}{N("Vent Total","ventT")}
              </div>
            </div>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>👥 Staff & Supply</div>
              {N("Doctors on Duty","docs")}{N("Nurses on Duty","nurses")}
              {N("Oxygen Level %","o2")}{N("Blood Units","blood")}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
                {N("Amb Avail","ambA")}{N("Amb Total","ambT")}
              </div>
              <div style={{marginBottom:12}}>
                <label className="form-label">Status</label>
                <select className="select" value={f.status} onChange={e=>s("status",e.target.value)}>
                  {["Active","Overwhelmed","Offline","Maintenance"].map(st=><option key={st}>{st}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Saving…":"Save Resources"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddModal({ onClose, onSave }) {
  const SPECS=["Cardiology","Neurology","Orthopedics","Oncology","Nephrology","Gastroenterology","Pediatrics","Gynecology","General Surgery","ENT","Dermatology","Psychiatry","Transplant"];
  const [step,setStep]=useState(1);
  const [saving,setSaving]=useState(false);
  const [f,setF]=useState({ name:"",type:"Government",level:"Secondary",status:"Active",phone:"",emergency:"",email:"",lat:"",lng:"",address:"",city:"",district:"",state:"Madhya Pradesh",pincode:"",icuT:0,icuA:0,genT:0,genA:0,ventT:0,ventA:0,o2:100,docs:0,nurses:0,ambT:0,ambA:0,blood:0,ctScan:false,mri:false,xray:false,bloodBank:false,traumaCenter:false,specs:[] });
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleSpec=sp=>setF(p=>({...p,specs:p.specs.includes(sp)?p.specs.filter(x=>x!==sp):[...p.specs,sp]}));
  const NF=(lbl,k,type="number")=>(
    <div style={{marginBottom:12}}>
      <label className="form-label">{lbl}</label>
      <input className="input" type={type} value={f[k]} onChange={e=>s(k,type==="number"?+e.target.value:e.target.value)}/>
    </div>
  );
  const Tog=(lbl,k)=>(
    <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"7px 12px",background:f[k]?"var(--accent-dim)":"var(--bg-elevated)",border:`1px solid ${f[k]?"var(--accent)":"var(--border)"}`,borderRadius:"var(--radius-md)",fontSize:12,color:f[k]?"var(--accent)":"var(--text-secondary)",userSelect:"none"}}>
      <input type="checkbox" checked={f[k]} onChange={e=>s(k,e.target.checked)} style={{display:"none"}}/>
      {f[k]?"✓":"○"} {lbl}
    </label>
  );
  const submit=async()=>{
    setSaving(true);
    try {
      await onSave({name:f.name,type:f.type,level:f.level,status:f.status,location:{lat:parseFloat(f.lat),lng:parseFloat(f.lng),address:f.address,city:f.city,district:f.district,state:f.state,pincode:f.pincode},contact:{phone:f.phone,emergency:f.emergency,email:f.email},resources:{icuBeds:{total:f.icuT,available:f.icuA},generalBeds:{total:f.genT,available:f.genA},ventilators:{total:f.ventT,available:f.ventA},oxygenLevel:f.o2,doctorsOnDuty:f.docs,nursesOnDuty:f.nurses,ambulancesTotal:f.ambT,ambulancesAvailable:f.ambA,bloodUnitsAvailable:f.blood,ctScan:f.ctScan,mri:f.mri,xray:f.xray,bloodBank:f.bloodBank},specialties:f.specs,traumaCenter:f.traumaCenter});
      onClose();
    } catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const STEPS=["Basic","Location","Resources","Specialties"];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:640,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div className="modal-title" style={{margin:0}}>🏥 Register New Hospital</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:20}}>
          {STEPS.map((st,i)=>(
            <button key={i} onClick={()=>i<step&&setStep(i+1)} style={{flex:1,padding:"9px 4px",background:"none",border:"none",borderBottom:`2px solid ${step===i+1?"var(--accent)":"transparent"}`,color:step===i+1?"var(--accent)":step>i+1?"var(--green)":"var(--text-muted)",fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,cursor:i<step?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <span style={{width:16,height:16,borderRadius:"50%",background:step>i+1?"var(--green)":step===i+1?"var(--accent)":"var(--bg-elevated)",color:step>=i+1?"#000":"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{step>i+1?"✓":i+1}</span>
              {st}
            </button>
          ))}
        </div>
        {step===1&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Hospital Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Victoria Government Hospital" required/></div>
          <div style={{marginBottom:12}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["Government","Private","Trust","Clinic","Trauma Center"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{marginBottom:12}}><label className="form-label">Level</label><select className="select" value={f.level} onChange={e=>s("level",e.target.value)}>{["Primary","Secondary","Tertiary","Quaternary"].map(l=><option key={l}>{l}</option>)}</select></div>
          {NF("Phone","phone","text")}{NF("Emergency Line","emergency","text")}{NF("Email","email","text")}
        </div>}
        {step===2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Street Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Road, Area, Landmark"/></div>
          {NF("City *","city","text")}{NF("District","district","text")}{NF("State","state","text")}{NF("Pincode","pincode","text")}
          {NF("Latitude *","lat","number")}{NF("Longitude *","lng","number")}
          <div style={{gridColumn:"1/-1",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:10,fontSize:11,color:"var(--text-muted)"}}>💡 Right-click on <a href="https://maps.google.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)"}}>Google Maps</a> → copy lat/lng</div>
        </div>}
        {step===3&&<>
          <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🛏 Beds</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0 12px"}}>
            {NF("ICU Total","icuT")}{NF("ICU Avail","icuA")}<div/>
            {NF("General Total","genT")}{NF("General Avail","genA")}<div/>
          </div>
          <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",margin:"12px 0 8px"}}>⚙️ Equipment & Staff</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0 12px"}}>
            {NF("Vent Total","ventT")}{NF("Vent Avail","ventA")}{NF("Oxygen %","o2")}
            {NF("Doctors","docs")}{NF("Nurses","nurses")}{NF("Blood Units","blood")}
            {NF("Amb Total","ambT")}{NF("Amb Avail","ambA")}
          </div>
          <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",margin:"12px 0 8px"}}>🖥 Diagnostics</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{Tog("CT Scan","ctScan")}{Tog("MRI","mri")}{Tog("X-Ray","xray")}{Tog("Blood Bank","bloodBank")}{Tog("Trauma Center","traumaCenter")}</div>
        </>}
        {step===4&&<>
          <div style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--accent)",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>🩺 Specialties</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {SPECS.map(sp=>(
              <button key={sp} type="button" onClick={()=>toggleSpec(sp)} style={{padding:"5px 12px",border:`1px solid ${f.specs.includes(sp)?"var(--accent)":"var(--border)"}`,background:f.specs.includes(sp)?"var(--accent-dim)":"var(--bg-elevated)",color:f.specs.includes(sp)?"var(--accent)":"var(--text-secondary)",borderRadius:"var(--radius-md)",fontFamily:"var(--font-body)",fontSize:12,cursor:"pointer",transition:"all .15s"}}>{f.specs.includes(sp)?"✓ ":""}{sp}</button>
            ))}
          </div>
          <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:14,fontSize:12,lineHeight:1.8,color:"var(--text-muted)"}}>
            <div style={{fontFamily:"var(--font-display)",color:"var(--accent)",fontSize:11,fontWeight:600,marginBottom:6,letterSpacing:1,textTransform:"uppercase"}}>Summary</div>
            <div><b style={{color:"var(--text-primary)"}}>{f.name||"—"}</b> · {f.type} · {f.level}</div>
            <div>📍 {f.city}{f.state?`, ${f.state}`:""} · {f.lat},{f.lng}</div>
            <div>🛏 ICU:{f.icuT} · Gen:{f.genT} · Vent:{f.ventT} · O₂:{f.o2}%</div>
            {f.specs.length>0&&<div>🩺 {f.specs.slice(0,4).join(", ")}{f.specs.length>4?` +${f.specs.length-4}`:""}</div>}
          </div>
        </>}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:18,paddingTop:14,borderTop:"1px solid var(--border)"}}>
          <button className="btn btn-ghost" onClick={step===1?onClose:()=>setStep(s=>s-1)}>{step===1?"Cancel":"← Back"}</button>
          {step<4?<button className="btn btn-primary" onClick={()=>setStep(s=>s+1)} disabled={step===1&&!f.name}>Next →</button>
                 :<button className="btn btn-primary" onClick={submit} disabled={saving||!f.name||!f.lat||!f.lng}>{saving?"Registering…":"✓ Register Hospital"}</button>}
        </div>
      </div>
    </div>
  );
}

export default function HospitalsPanel() {
  const [hospitals,setHospitals]=useState([]);
  const [summary,setSummary]=useState(null);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState("grid"); // grid | map
  const [search,setSearch]=useState("");
  const [cityFilter,setCityFilter]=useState("All");
  const [alertFilter,setAlertFilter]=useState("All");
  const [updateH,setUpdateH]=useState(null);
  const [detailH,setDetailH]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [mapTile,setMapTile]=useState("street");
  const [toast,setToast]=useState(null);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const loadAll=useCallback(async()=>{
    try {
      const [h,s]=await Promise.all([api.get("/hospitals"),api.get("/hospitals/summary")]);
      setHospitals(h.data); setSummary(s.data);
    } catch(e){ showToast("Load failed: "+e.message,"error"); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ loadAll(); const t=setInterval(loadAll,30000); return()=>clearInterval(t); },[loadAll]);
  useEffect(()=>{
    socket.on("hospitalResourceUpdate",()=>loadAll());
    socket.on("hospitalAdded",()=>loadAll());
    socket.on("resourceAlert",()=>loadAll());
    return()=>{ socket.off("hospitalResourceUpdate"); socket.off("hospitalAdded"); socket.off("resourceAlert"); };
  },[loadAll]);

  const saveResources=async(id,data)=>{
    try { await api.put(`/hospitals/${id}/resources`,data); showToast("Updated ✓"); loadAll(); }
    catch(e){ showToast(e.message,"error"); }
  };
  const addHospital=async(data)=>{
    try { await api.post("/hospitals",data); showToast("Hospital registered ✓"); loadAll(); }
    catch(e){ throw e; }
  };
  const removeHospital=async(id)=>{
    if(!confirm("Delete this hospital?")) return;
    try { await api.delete(`/hospitals/${id}`); showToast("Deleted"); loadAll(); }
    catch(e){ showToast(e.message,"error"); }
  };

  const cities=["All",...Array.from(new Set(hospitals.map(h=>h.location?.city).filter(Boolean))).sort()];
  const filtered=hospitals.filter(h=>{
    if(search&&!h.name.toLowerCase().includes(search.toLowerCase())&&!h.location?.city?.toLowerCase().includes(search.toLowerCase())) return false;
    if(cityFilter!=="All"&&h.location?.city!==cityFilter) return false;
    if(alertFilter!=="All"&&h.alertLevel!==alertFilter) return false;
    return true;
  });

  return (
    <div>
      {toast&&<div style={{position:"fixed",top:20,right:24,zIndex:9999,background:toast.type==="error"?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${toast.type==="error"?"var(--red)":"var(--green)"}`,color:toast.type==="error"?"var(--red)":"var(--green)",padding:"10px 18px",borderRadius:"var(--radius-md)",fontWeight:600,fontSize:13,boxShadow:"var(--shadow-md)"}}>{toast.msg}</div>}

      {/* Summary KPIs */}
      {summary&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(6,1fr)",marginBottom:20}}>
          {[["🛏","ICU Available",summary.icuBeds?.available,`${summary.icuBeds?.utilization}% utilized`,"var(--accent)"],
            ["🏨","General Beds",summary.generalBeds?.available,`${summary.generalBeds?.utilization}% utilized`,"var(--purple)"],
            ["💨","Ventilators",summary.ventilators?.available,`of ${summary.ventilators?.total}`,"var(--green)"],
            ["🚑","Ambulances",summary.ambulances?.available,`of ${summary.ambulances?.total}`,"var(--orange)"],
            ["⚠️","Active Alerts",summary.activeAlerts,`${summary.overwhelmed||0} overwhelmed`,summary.activeAlerts>0?"var(--red)":"var(--green)"],
            ["🔄","Pending Transfer",summary.pendingTransfers,"requests","var(--yellow)"],
          ].map(([ico,lbl,val,sub,clr])=>(
            <div key={lbl} className="stat-card">
              <div className="stat-label">{ico} {lbl}</div>
              <div className="stat-value" style={{color:clr,fontSize:30}}>{val??0}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alert strip */}
      {summary?.alertBreakdown&&(
        <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
          {[["Red","🔴"],["Orange","🟠"],["Yellow","🟡"],["Normal","🟢"]].map(([l,i])=>(
            <span key={l} style={{background:"var(--bg-card)",border:`1px solid ${ALERT_COLOR[l]}44`,borderRadius:"var(--radius-md)",padding:"4px 12px",fontSize:12,color:ALERT_COLOR[l],fontWeight:700,cursor:"pointer"}} onClick={()=>setAlertFilter(l===alertFilter?"All":l)}>
              {i} {summary.alertBreakdown[l]||0} {l}
            </span>
          ))}
          <span className="badge badge-muted" style={{marginLeft:"auto"}}>🏥 {summary.total||0} Hospitals</span>
        </div>
      )}

      {/* Controls */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input className="input" style={{flex:1,minWidth:180}} placeholder="🔍 Search hospitals…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="select" value={cityFilter} onChange={e=>setCityFilter(e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select>
        <select className="select" value={alertFilter} onChange={e=>setAlertFilter(e.target.value)}>
          <option value="All">All Alert Levels</option>
          {["Red","Orange","Yellow","Normal"].map(l=><option key={l}>{l}</option>)}
        </select>
        <div style={{display:"flex",gap:4}}>
          <button className={`btn btn-ghost btn-sm ${view==="grid"?"btn-primary":""}`} onClick={()=>setView("grid")}>⊞ Grid</button>
          <button className={`btn btn-ghost btn-sm ${view==="map"?"btn-primary":""}`} onClick={()=>setView("map")}>🗺 Map</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>+ Add Hospital</button>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>↺</button>
      </div>

      {/* Grid View */}
      {view==="grid"&&(loading?<div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
          {filtered.map(h=>{
            const r=h.resources||{};
            const ac=ALERT_COLOR[h.alertLevel]||"#4e7090";
            return (
              <div key={h._id} className="card" style={{borderTop:`3px solid ${ac}`,cursor:"pointer"}} onClick={()=>setDetailH(detailH?._id===h._id?null:h)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,marginRight:8}}>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:15,color:"var(--text-primary)",lineHeight:1.2}}>{h.name}</div>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>📍 {h.location?.city} · {h.type} · {h.level}</div>
                  </div>
                  <span style={{background:`${ac}22`,color:ac,border:`1px solid ${ac}44`,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h.alertLevel}</span>
                </div>
                <ResBar label="ICU Beds"     a={r.icuBeds?.available||0}    t={r.icuBeds?.total||0}/>
                <ResBar label="General Beds" a={r.generalBeds?.available||0} t={r.generalBeds?.total||0}/>
                <ResBar label="Ventilators"  a={r.ventilators?.available||0} t={r.ventilators?.total||0}/>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
                  <span className={`badge ${(r.oxygenLevel||0)>50?"badge-green":"badge-red"}`}>O₂ {r.oxygenLevel||0}%</span>
                  <span className="badge badge-muted">🚑 {r.ambulancesAvailable||0}/{r.ambulancesTotal||0}</span>
                  <span className="badge badge-muted">👨‍⚕️ {r.doctorsOnDuty||0}</span>
                  {r.bloodBank&&<span className="badge badge-accent">🩸 Blood</span>}
                  {r.ctScan&&<span className="badge badge-muted">CT</span>}
                  {r.mri&&<span className="badge badge-muted">MRI</span>}
                </div>
                {detailH?._id===h._id&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)",fontSize:12,color:"var(--text-muted)",lineHeight:1.9}}>
                    <div>📞 {h.contact?.emergency||h.contact?.phone||"—"}</div>
                    <div>🏥 Status: <span style={{color:h.status==="Active"?"var(--green)":"var(--red)",fontWeight:600}}>{h.status}</span></div>
                    <div>⏱ Avg wait: {h.avgPatientWait||0} min</div>
                    {h.specialties?.length>0&&<div>🩺 {h.specialties.slice(0,4).join(", ")}{h.specialties.length>4?` +${h.specialties.length-4}`:""}</div>}
                    <div style={{fontSize:10,color:"var(--text-dim)",marginTop:4}}>Updated {fmtAgo(h.lastUpdated)}{h.updatedBy?` by ${h.updatedBy}`:""}</div>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                  <span style={{fontSize:10,color:"var(--text-dim)"}}>{fmtAgo(h.lastUpdated)}</span>
                  <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();setUpdateH(h)}}>Update</button>
                    <button className="btn btn-ghost btn-sm" style={{color:"var(--red)",borderColor:"var(--red)"}} onClick={e=>{e.stopPropagation();removeHospital(h._id)}}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"var(--text-muted)"}}>No hospitals match filters</div>}
        </div>
      ))}

      {/* Map View */}
      {view==="map"&&(
        <div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {Object.entries({street:"🗺 Street",dark:"🌑 Dark",smooth:"🎨 Smooth",topo:"🏔 Topo"}).map(([k,l])=>(
              <button key={k} className={`btn btn-sm ${mapTile===k?"btn-primary":"btn-ghost"}`} onClick={()=>setMapTile(k)}>{l}</button>
            ))}
          </div>
        <div style={{borderRadius:"var(--radius-lg)",overflow:"hidden",border:"1px solid var(--border)",height:560,position:"relative"}}>
          <MapContainer center={[23.5,79.5]} zoom={7} style={{height:"100%",width:"100%",background:"#0a1628"}}>
            <TileLayer url={TILE_URLS[mapTile]} attribution="© OpenStreetMap"/>
            {hospitals.map(h=>h.location?.lat&&(
              <Marker key={h._id} position={[h.location.lat,h.location.lng]} icon={createHospitalIcon(h)}>
                <Popup>
                  <div style={{fontFamily:"system-ui",background:"#0d1e35",color:"#e8f1fa",minWidth:200,padding:4}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{h.name}</div>
                    <div style={{fontSize:11,color:"#8aaccc",marginBottom:8}}>{h.type} · {h.location.city}</div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between"}}><span>ICU</span><span style={{color:"#00c8ff",fontWeight:700}}>{h.resources?.icuBeds?.available||0}/{h.resources?.icuBeds?.total||0}</span></div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between"}}><span>Ventilators</span><span style={{color:"#00c8ff"}}>{h.resources?.ventilators?.available||0}/{h.resources?.ventilators?.total||0}</span></div>
                    <div style={{fontSize:11,display:"flex",justifyContent:"space-between"}}><span>O₂</span><span style={{color:(h.resources?.oxygenLevel||0)>50?"#00e676":"#ff4060",fontWeight:700}}>{h.resources?.oxygenLevel||0}%</span></div>
                    <button className="btn btn-primary btn-sm" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={()=>setUpdateH(h)}>Update Resources</button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <div style={{position:"absolute",top:12,right:12,background:"rgba(13,30,53,.92)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px 14px",zIndex:1000,backdropFilter:"blur(4px)"}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:10,color:"var(--accent)",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Alert Level</div>
            {Object.entries(ALERT_COLOR).map(([l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,fontSize:11,color:"var(--text-muted)"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:c}}/><span>{l}</span>
                <span style={{marginLeft:"auto",fontWeight:700,color:"var(--text-primary)"}}>{hospitals.filter(h=>h.alertLevel===l).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {updateH&&<UpdateModal h={updateH} onClose={()=>setUpdateH(null)} onSave={saveResources}/>}
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onSave={addHospital}/>}
    </div>
  );
}
