import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "./context/ThemeContext.jsx";
import Login          from "./pages/Login.jsx";
import Register       from "./pages/Register.jsx";
import FirstTimeSetup from "./pages/FirstTimeSetup.jsx";
import HospitalsPanel   from "./components/HospitalsPanel.jsx";
import TransfersPanel   from "./components/TransfersPanel.jsx";
import AmbulanceTracker from "./components/AmbulanceTracker.jsx";
import EmergencyPanel   from "./components/EmergencyPanel.jsx";
import PredictionPanel  from "./components/PredictionPanel.jsx";
import AdminPanel       from "./components/AdminPanel.jsx";
import api    from "./services/api.js";
import socket from "./services/socket.js";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [auth, setAuth] = useState({ token:localStorage.getItem("token"), role:localStorage.getItem("role"), name:localStorage.getItem("name") });
  const [authView, setAuthView]         = useState("login");
  const [setupChecked, setSetupChecked] = useState(false);
  const [needsSetup, setNeedsSetup]     = useState(false);
  const [tab, setTab]                   = useState("hospitals");
  const [notifications, setNotifications] = useState([]);
  const [cityMetrics, setCityMetrics]   = useState(null);
  const [clock, setClock]               = useState(new Date());
  const liveRef  = useRef(0);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(()=>{ const t=setInterval(()=>setClock(new Date()),1000); return()=>clearInterval(t); },[]);

  useEffect(()=>{
    if(auth.token){ setSetupChecked(true); return; }
    (async()=>{
      try { const r=await api.get("/admin/check"); setNeedsSetup(!r.data.adminExists); }
      catch{ setNeedsSetup(false); }
      finally { setSetupChecked(true); }
    })();
  },[auth.token]);

  useEffect(()=>{
    if(!auth.token) return;
    const load=async()=>{ try{ const r=await api.get("/predictions/city-health"); setCityMetrics(r.data); }catch{} };
    load(); const t=setInterval(load,30000); return()=>clearInterval(t);
  },[auth.token]);

  const addNotif=useCallback((msg,type="info")=>{
    const id=Date.now();
    setNotifications(p=>[{id,msg,type},...p.slice(0,5)]);
    setTimeout(()=>setNotifications(p=>p.filter(n=>n.id!==id)),8000);
  },[]);

  useEffect(()=>{
    if(!auth.token) return;
    socket.on("newEmergencyRequest", d=>{ liveRef.current+=1; setLiveCount(liveRef.current); addNotif(`🚨 ${d.request?.type||"Emergency"} — ${d.request?.severity||""}`, d.request?.severity==="Critical"?"error":"warning"); });
    socket.on("newTransfer",      d=>addNotif(`🚑 Transfer: ${d.fromName} → ${d.toName}`,"info"));
    socket.on("resourceAlert",    d=>addNotif(`⚠️ ${d.hospitalName}: ${d.message}`,"error"));
    socket.on("cityHealthUpdate", d=>setCityMetrics(d));
    return()=>{ socket.off("newEmergencyRequest"); socket.off("newTransfer"); socket.off("resourceAlert"); socket.off("cityHealthUpdate"); };
  },[auth.token,addNotif]);

  const logout=()=>{ localStorage.clear(); setAuth({token:null,role:null,name:null}); setAuthView("login"); };

  if(!setupChecked) return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52}}>🏥</div>
      <div style={{fontFamily:"var(--font-display)",fontSize:18,color:"var(--accent)",letterSpacing:"2px"}}>HEALTHCARE PLATFORM</div>
      <div style={{fontSize:13,color:"var(--text-muted)"}}>Starting up…</div>
    </div>
  );

  if(!auth.token){
    if(needsSetup||authView==="setup") return <FirstTimeSetup onSetupComplete={()=>{setNeedsSetup(false);window.location.reload();}}/>;
    if(authView==="register")          return <Register setView={setAuthView}/>;
    return <Login setAuth={setAuth} setView={setAuthView} onSetup={()=>setAuthView("setup")}/>;
  }

  const TABS=[
    {id:"hospitals",  label:"🏥 Hospitals"},
    {id:"emergencies",label:"🚨 Emergencies"},
    {id:"transfers",  label:"🚑 Transfers"},
    {id:"ambulances", label:"🚐 Ambulances"},
    {id:"forecast",   label:"🔮 AI Forecast"},
    ...(auth.role==="Admin"?[{id:"admin",label:"👥 Admin"}]:[]),
  ];

  const sc=s=>s>70?"var(--green)":s>40?"var(--yellow)":"var(--red)";

  return (
    <div className="page-wrapper">
      {/* Toast notifications */}
      <div style={{position:"fixed",top:16,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:380}}>
        {notifications.map(n=>(
          <div key={n.id} style={{background:n.type==="error"?"var(--red-dim)":n.type==="success"?"var(--green-dim)":n.type==="warning"?"var(--orange-dim)":"var(--accent-dim)",border:`1px solid ${n.type==="error"?"var(--red)":n.type==="success"?"var(--green)":n.type==="warning"?"var(--orange)":"var(--accent)"}`,color:n.type==="error"?"var(--red)":n.type==="success"?"var(--green)":n.type==="warning"?"var(--orange)":"var(--accent)",padding:"10px 16px",borderRadius:"var(--radius-md)",fontSize:12,fontWeight:500,boxShadow:"var(--shadow-md)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span>{n.msg}</span>
            <button onClick={()=>setNotifications(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",opacity:.7,fontSize:14}}>✕</button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div style={{fontSize:28,lineHeight:1}}>🏥</div>
          <div>
            <div className="logo" style={{fontSize:16,letterSpacing:"2px"}}>HEALTHCARE RESOURCE PLATFORM</div>
            <div className="tagline" style={{fontSize:9}}>
              {auth.role?.toUpperCase()} · {clock.toLocaleTimeString()}
              {cityMetrics?.healthScore!=null&&<span style={{marginLeft:10,color:sc(cityMetrics.healthScore)}}>· City Score {cityMetrics.healthScore}/100</span>}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {cityMetrics&&(
            <div style={{display:"flex",gap:12,alignItems:"center",fontSize:11,color:"var(--text-muted)"}}>
              <span>ICU <b style={{color:"var(--accent)"}}>{cityMetrics.icuPressure}%</b></span>
              <span>Alerts <b style={{color:cityMetrics.activeAlerts>0?"var(--red)":"var(--green)"}}>{cityMetrics.activeAlerts}</b></span>
              <span>🏥 {cityMetrics.totalHospitals}</span>
            </div>
          )}
          {liveCount>0&&(
            <button onClick={()=>{liveRef.current=0;setLiveCount(0);}} style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"3px 10px",borderRadius:"var(--radius-sm)",fontWeight:700,fontSize:11,cursor:"pointer"}}>
              +{liveCount} NEW
            </button>
          )}
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--green)",fontFamily:"var(--font-display)",fontWeight:600,letterSpacing:1}}>
            <span style={{width:7,height:7,background:"var(--green)",borderRadius:"50%",display:"inline-block",boxShadow:"0 0 6px var(--green)"}}/>
            LIVE
          </div>
          <span style={{color:"var(--text-secondary)",fontSize:13,fontWeight:600}}>{auth.name}</span>
          <span className={`role-pill role-${auth.role?.toLowerCase()}`}>{auth.role?.toUpperCase()}</span>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme"/>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </header>

      {/* Tab bar + Content */}
      <div className="content-area">
        <div className="tab-bar mb-20" style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {tab==="hospitals"   && <HospitalsPanel/>}
        {tab==="emergencies" && <EmergencyPanel/>}
        {tab==="transfers"   && <TransfersPanel/>}
        {tab==="ambulances"  && <AmbulanceTracker/>}
        {tab==="forecast"    && <PredictionPanel/>}
        {tab==="admin"       && auth.role==="Admin" && <AdminPanel/>}
      </div>
    </div>
  );
}
