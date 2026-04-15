import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "./context/ThemeContext.jsx";
import CitizenPortal              from "./pages/CitizenPortal.jsx";
import HospitalOperatorDashboard  from "./pages/HospitalOperatorDashboard.jsx";
import HospitalVerification       from "./pages/HospitalVerification.jsx";
import HospitalSelfRegister       from "./pages/HospitalSelfRegister.jsx";
import FirstTimeSetup             from "./pages/FirstTimeSetup.jsx";
import HospitalsPanel     from "./components/HospitalsPanel.jsx";
import TransfersPanel     from "./components/TransfersPanel.jsx";
import EmergencyPanel     from "./components/EmergencyPanel.jsx";
import AdminPanel         from "./components/AdminPanel.jsx";
import AnalyticsDashboard from "./components/AnalyticsDashboard.jsx";
import AmbulanceOperatorDashboard from "./pages/AmbulanceOperatorDashboard.jsx";
import api    from "./services/api.js";
import socket from "./services/socket.js";

// ── Staff Login Panel ─────────────────────────────────────────
function StaffLoginPanel({ onClose, onLogin, onHospitalRegister }) {
  const [email,    setEmail]   = useState("");
  const [password, setPassword]= useState("");
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const d   = res.data;
      localStorage.setItem("token",  d.token);
      localStorage.setItem("role",   d.role);
      localStorage.setItem("name",   d.name);
      if (d.hospitalId)  localStorage.setItem("hospitalId",  d.hospitalId);
      if (d.ambulanceId) localStorage.setItem("ambulanceId", d.ambulanceId);
      onLogin({ token:d.token, role:d.role, name:d.name, hospitalId:d.hospitalId||null, ambulanceId:d.ambulanceId||null });
    } catch(err) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"var(--bg-card)",width:"100%",maxWidth:400,borderRadius:"var(--radius-lg)",boxShadow:"var(--shadow-lg)",border:"1px solid var(--border)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#0055aa,#0088cc)",padding:"24px 24px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:18,color:"#fff",letterSpacing:"1px"}}>🏥 Staff Login</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.75)",marginTop:3}}>Hospital Operators & Administrators</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>

        {/* Form */}
        <div style={{padding:24}}>
          <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label className="form-label">Email Address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" placeholder="your@hospital.com"/>
            </div>
            <div>
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••"/>
            </div>
            {error&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"9px 13px",borderRadius:"var(--radius-md)",fontSize:12}}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:"13px",fontSize:14,background:"#0088cc",borderColor:"#0088cc"}}>
              {loading?"⏳ Logging in…":"Login →"}
            </button>
          </form>

          {/* Demo hints */}
          <div style={{marginTop:16,background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12}}>
            <div style={{fontSize:10,color:"var(--accent)",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Demo Credentials</div>
            <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"var(--font-mono)",lineHeight:1.9}}>
              <div>🏥 victoria@healthcare.local / Hospital@123</div>
              <div>🔑 admin@healthcare.local / Admin@123</div>
            </div>
          </div>

          {/* Hospital registration link */}
          <div style={{marginTop:14,textAlign:"center",borderTop:"1px solid var(--border)",paddingTop:14}}>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:8}}>Not registered yet?</div>
            <button className="btn btn-ghost btn-sm" style={{width:"100%",justifyContent:"center",fontSize:12}} onClick={()=>{onClose();onHospitalRegister();}}>
              🏥 Register Your Hospital →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [auth, setAuth] = useState({
    token:       localStorage.getItem("token"),
    role:        localStorage.getItem("role"),
    name:        localStorage.getItem("name"),
    hospitalId:  localStorage.getItem("hospitalId")  || null,
    ambulanceId: localStorage.getItem("ambulanceId") || null,
  });
  const [showLogin,   setShowLogin]   = useState(false);
  const [setupDone,   setSetupDone]   = useState(false);
  const [needsSetup,  setNeedsSetup]  = useState(false);
  const [showHospReg, setShowHospReg] = useState(false);
  const [tab,         setTab]         = useState("hospitals");
  const [notifs,      setNotifs]      = useState([]);
  const [clock,       setClock]       = useState(new Date());
  const liveRef   = useRef(0);
  const [liveCnt, setLiveCnt] = useState(0);

  useEffect(()=>{ const t=setInterval(()=>setClock(new Date()),1000); return()=>clearInterval(t); },[]);

  useEffect(()=>{
    // Check for hospital verification token in URL
    if (window.location.pathname.startsWith("/verify-hospital/")) return;
    (async()=>{
      try{ const r=await api.get("/admin/check"); setNeedsSetup(!r.data.adminExists); }
      catch{ setNeedsSetup(false); }
      finally{ setSetupDone(true); }
    })();
  },[]);

  const addNotif = useCallback((msg,type="info")=>{
    const id=Date.now();
    setNotifs(p=>[{id,msg,type},...p.slice(0,5)]);
    setTimeout(()=>setNotifs(p=>p.filter(n=>n.id!==id)),8000);
  },[]);

  useEffect(()=>{
    if(!auth.token) return;
    socket.on("newEmergencyRequest",d=>{ liveRef.current+=1; setLiveCnt(liveRef.current); addNotif(`🚨 ${d.request?.type} — ${d.request?.severity}`,d.request?.severity==="Critical"?"error":"warning"); });
    socket.on("newTransfer",      d=>addNotif(`🚑 Transfer: ${d.fromName} → ${d.toName}`,"info"));
    socket.on("resourceAlert",    d=>addNotif(`⚠️ ${d.hospitalName}: ${d.message}`,"error"));
    socket.on("newHospitalRegistrationRequest", d=>addNotif(`🏥 New hospital registration: ${d.hospital?.name}`,"info"));
    return()=>{ ["newEmergencyRequest","newTransfer","resourceAlert","newHospitalRegistrationRequest"].forEach(e=>socket.off(e)); };
  },[auth.token,addNotif]);

  const login  = data => { setAuth(data); setShowLogin(false); setTab("hospitals"); };
  const logout = () => { localStorage.clear(); setAuth({token:null,role:null,name:null,hospitalId:null,ambulanceId:null}); liveRef.current=0; setLiveCnt(0); };

  // ── Hospital Verification via email link ─────────────────────
  if (window.location.pathname.startsWith("/verify-hospital/")) {
    return <HospitalVerification/>;
  }

  // ── First time setup ─────────────────────────────────────────
  if(!setupDone) return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52}}>🏥</div>
      <div style={{fontFamily:"var(--font-display)",fontSize:18,color:"var(--accent)",letterSpacing:"2px"}}>CARE-CONNECT</div>
      <div style={{fontSize:13,color:"var(--text-muted)"}}>Starting…</div>
    </div>
  );

  if(needsSetup) return <FirstTimeSetup onSetupComplete={()=>{setNeedsSetup(false);window.location.reload();}}/>;

  // ── Hospital Self Registration page ──────────────────────────
  if (showHospReg) return <HospitalSelfRegister onBack={()=>setShowHospReg(false)}/>;

  // ── Hospital Operator ─────────────────────────────────────────
  if(auth.token && auth.role==="HospitalOperator") {
    return (
      <div className="page-wrapper">
        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:22}}>🏥</div>
            <div><div className="logo" style={{fontSize:14}}>HOSPITAL PORTAL</div><div className="tagline" style={{fontSize:9}}>{auth.name} · {clock.toLocaleTimeString()}</div></div>
          </div>
          <div className="header-actions">
            <span className="role-pill" style={{background:"rgba(0,230,118,.12)",color:"var(--green)",border:"1px solid rgba(0,230,118,.25)"}}>🏥 HOSPITAL </span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="content-area"><HospitalOperatorDashboard hospitalId={auth.hospitalId} onBack={logout}/></div>
      </div>
    );
  }

  // ── Ambulance Driver Dashboard ───────────────────────────────────
  if(auth.token && auth.role==="AmbulanceOperator") {
    return (
      <div className="page-wrapper">
        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:22}}>🚑</div>
            <div><div className="logo" style={{fontSize:14}}>AMBULANCE PORTAL</div><div className="tagline" style={{fontSize:9}}>{auth.name} · {clock.toLocaleTimeString()}</div></div>
          </div>
          <div className="header-actions">
            <span className="role-pill" style={{background:"rgba(255,143,0,.12)",color:"var(--orange)",border:"1px solid rgba(255,143,0,.25)"}}>🚑 DRIVER</span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="content-area"><AmbulanceOperatorDashboard ambulanceId={auth.ambulanceId} onBack={logout}/></div>
      </div>
    );
  }

  // ── Admin Dashboard ───────────────────────────────────────────
  if(auth.token && auth.role==="Admin") {
    const TABS=[
      {id:"hospitals",  label:"🏥 Hospitals"},
      {id:"emergencies",label:"🚨 Emergencies"},
      {id:"transfers",  label:"🚑 Transfers"},
      {id:"analytics",  label:"📊 Analytics"},
      {id:"admin",      label:"👥 Management"},
    ];
    return (
      <div className="page-wrapper">
        {/* Toast notifications */}
        <div style={{position:"fixed",top:16,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:380}}>
          {notifs.map(n=>(
            <div key={n.id} style={{background:n.type==="error"?"var(--red-dim)":n.type==="warning"?"var(--orange-dim)":"var(--accent-dim)",border:`1px solid ${n.type==="error"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--accent)"}`,color:n.type==="error"?"var(--red)":n.type==="warning"?"var(--orange)":"var(--accent)",padding:"10px 16px",borderRadius:"var(--radius-md)",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:10,boxShadow:"var(--shadow-md)"}}>
              <span>{n.msg}</span>
              <button onClick={()=>setNotifs(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",opacity:.7,marginLeft:"auto"}}>✕</button>
            </div>
          ))}
        </div>
        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:26}}>🏥</div>
            <div>
              <div className="logo" style={{fontSize:14,letterSpacing:"2px"}}>CARE-CONNECT ADMIN</div>
              <div className="tagline" style={{fontSize:9}}>CENTRAL AUTHORITY · {auth.name} · {clock.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="header-actions">
            {liveCnt>0&&<button onClick={()=>{liveRef.current=0;setLiveCnt(0);}} style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"3px 10px",borderRadius:"var(--radius-sm)",fontWeight:700,fontSize:11,cursor:"pointer"}}>+{liveCnt} NEW</button>}
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--green)",fontWeight:600}}>
              <span style={{width:7,height:7,background:"var(--green)",borderRadius:"50%",display:"inline-block",boxShadow:"0 0 6px var(--green)"}}/>LIVE
            </div>
            <span style={{color:"var(--text-secondary)",fontSize:12,fontWeight:600}}>{auth.name}</span>
            <span className="role-pill role-admin">ADMIN</span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="content-area">
          <div className="tab-bar mb-20" style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
            {TABS.map(t=>(<button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>))}
          </div>
          {tab==="hospitals"   && <HospitalsPanel/>}
          {tab==="emergencies" && <EmergencyPanel/>}
          {tab==="transfers"   && <TransfersPanel/>}
          {tab==="analytics"   && <AnalyticsDashboard/>}
          {tab==="admin"       && <AdminPanel/>}
        </div>
      </div>
    );
  }

  // ── Default: Citizen Portal ───────────────────────────────────
  return (
    <>
      <CitizenPortal onStaffLogin={()=>setShowLogin(true)} showStaffLoginButton={true}/>
      {showLogin&&<StaffLoginPanel onClose={()=>setShowLogin(false)} onLogin={login} onHospitalRegister={()=>setShowHospReg(true)}/>}
    </>
  );
}
