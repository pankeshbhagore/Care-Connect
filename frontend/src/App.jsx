import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "./context/ThemeContext.jsx";
import CitizenPortal             from "./pages/CitizenPortal.jsx";
import HospitalOperatorDashboard from "./pages/HospitalOperatorDashboard.jsx";
import AmbulanceOperatorDashboard from "./pages/AmbulanceOperatorDashboard.jsx";
import Register                  from "./pages/Register.jsx";
import FirstTimeSetup            from "./pages/FirstTimeSetup.jsx";
import HospitalsPanel   from "./components/HospitalsPanel.jsx";
import TransfersPanel   from "./components/TransfersPanel.jsx";
import AmbulanceTracker from "./components/AmbulanceTracker.jsx";
import EmergencyPanel   from "./components/EmergencyPanel.jsx";
import PredictionPanel  from "./components/PredictionPanel.jsx";
import AdminPanel       from "./components/AdminPanel.jsx";
import api    from "./services/api.js";
import socket from "./services/socket.js";

// ── Staff Login Sidebar ───────────────────────────────────────
function StaffLoginPanel({ onClose, onLogin }) {
  const [role,     setRole]     = useState("hospital-operator");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const ROLE_OPTIONS = [
    { id:"hospital-operator",  label:"🏥 Hospital Operator",  color:"var(--green)" },
    { id:"ambulance-operator", label:"🚑 Ambulance Driver",   color:"var(--orange)" },
    { id:"central-authority",  label:"🏛 Central Authority",  color:"var(--purple)" },
    { id:"admin",              label:"🔑 System Admin",       color:"var(--red)" },
  ];

  const ROLE_HINTS = {
    "hospital-operator":  "victoria@healthcare.local / Hospital@123",
    "ambulance-operator": "driver001@healthcare.local / Driver@123",
    "central-authority":  "central@healthcare.local / Central@123",
    "admin":              "admin@healthcare.local / Admin@123",
  };

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const d   = res.data;
      // Validate role match
      const roleMatches = {
        "hospital-operator":  ["HospitalOperator","Admin"],
        "ambulance-operator": ["AmbulanceOperator","Admin"],
        "central-authority":  ["CentralAuthority","Admin","Operator"],
        "admin":              ["Admin"],
      };
      if (!roleMatches[role]?.includes(d.role)) {
        setError(`This login is for ${role.replace("-"," ")}. Your account is: ${d.role}`);
        setLoading(false); return;
      }
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:1000, display:"flex", justifyContent:"flex-end" }} onClick={onClose}>
      <div style={{ background:"var(--bg-card)", width:380, maxWidth:"95vw", height:"100%", overflowY:"auto", boxShadow:"var(--shadow-lg)", borderLeft:"1px solid var(--border)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:24, borderBottom:"1px solid var(--border)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:18, color:"var(--text-primary)" }}>Staff Login</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>Hospital operators, ambulance drivers & admins</div>
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, color:"var(--text-muted)", cursor:"pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:24 }}>
          <div style={{ marginBottom:18 }}>
            <label className="form-label">Select Your Role</label>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {ROLE_OPTIONS.map(r=>(
                <button key={r.id} type="button" onClick={()=>{setRole(r.id);setEmail("");setError("");}} style={{ padding:"10px 14px", border:`1px solid ${role===r.id?r.color:"var(--border)"}`, background:role===r.id?`${r.color}15`:"var(--bg-elevated)", color:role===r.id?r.color:"var(--text-secondary)", borderRadius:"var(--radius-md)", textAlign:"left", fontFamily:"var(--font-display)", fontSize:13, fontWeight:role===r.id?700:400, cursor:"pointer", transition:"all .15s" }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom:14 }}>
              <label className="form-label">Email</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={ROLE_HINTS[role]?.split(" / ")[0] || "your@email.com"} required autoComplete="username" />
            </div>
            <div style={{ marginBottom:14 }}>
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>

            {error && (
              <div style={{ background:"var(--red-dim)", border:"1px solid var(--red)", color:"var(--red)", padding:"10px 14px", borderRadius:"var(--radius-md)", fontSize:12, marginBottom:14 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width:"100%", justifyContent:"center", padding:"12px", fontSize:14 }}>
              {loading ? "⏳ Logging in…" : "Login →"}
            </button>
          </form>

          {/* Quick hint */}
          <div style={{ marginTop:16, background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:12 }}>
            <div style={{ fontSize:10, color:"var(--accent)", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Demo Credentials</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.8, fontFamily:"var(--font-mono)" }}>
              {ROLE_HINTS[role]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [auth, setAuth] = useState({
    token:       localStorage.getItem("token"),
    role:        localStorage.getItem("role"),
    name:        localStorage.getItem("name"),
    hospitalId:  localStorage.getItem("hospitalId")  || null,
    ambulanceId: localStorage.getItem("ambulanceId") || null,
  });

  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [setupChecked,   setSetupChecked]   = useState(false);
  const [needsSetup,     setNeedsSetup]     = useState(false);
  const [showRegister,   setShowRegister]   = useState(false);
  const [tab,            setTab]            = useState("hospitals");
  const [notifications,  setNotifs]         = useState([]);
  const [cityMetrics,    setCityMetrics]     = useState(null);
  const [clock,          setClock]          = useState(new Date());
  const liveRef  = useRef(0);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(()=>{ const t=setInterval(()=>setClock(new Date()),1000); return()=>clearInterval(t); },[]);

  // Check first-time setup
  useEffect(()=>{
    (async()=>{
      try{ const r=await api.get("/admin/check"); setNeedsSetup(!r.data.adminExists); }
      catch{ setNeedsSetup(false); }
      finally{ setSetupChecked(true); }
    })();
  },[]);

  // City metrics (for staff dashboards)
  useEffect(()=>{
    if(!auth.token) return;
    const load=async()=>{ try{ const r=await api.get("/predictions/city-health"); setCityMetrics(r.data); }catch{} };
    load(); const t=setInterval(load,30000); return()=>clearInterval(t);
  },[auth.token]);

  const addNotif = useCallback((msg,type="info")=>{
    const id=Date.now();
    setNotifs(p=>[{id,msg,type},...p.slice(0,5)]);
    setTimeout(()=>setNotifs(p=>p.filter(n=>n.id!==id)),8000);
  },[]);

  useEffect(()=>{
    if(!auth.token) return;
    socket.on("newEmergencyRequest", d=>{ liveRef.current+=1; setLiveCount(liveRef.current); addNotif(`🚨 ${d.request?.type||"Emergency"} — ${d.request?.severity||""}`, d.request?.severity==="Critical"?"error":"warning"); });
    socket.on("newTransfer",      d=>addNotif(`🚑 Transfer: ${d.fromName} → ${d.toName}`,"info"));
    socket.on("resourceAlert",    d=>addNotif(`⚠️ ${d.hospitalName}: ${d.message}`,"error"));
    socket.on("cityHealthUpdate", d=>setCityMetrics(d));
    return()=>{ socket.off("newEmergencyRequest"); socket.off("newTransfer"); socket.off("resourceAlert"); socket.off("cityHealthUpdate"); };
  },[auth.token,addNotif]);

  const handleLogin = (data) => {
    setAuth(data);
    setShowStaffLogin(false);
    setTab("hospitals");
  };

  const logout = () => {
    localStorage.clear();
    setAuth({token:null,role:null,name:null,hospitalId:null,ambulanceId:null});
    liveRef.current=0; setLiveCount(0);
  };

  // ─── Loading ─────────────────────────────────────────────────
  if (!setupChecked) return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:52}}>🏥</div>
      <div style={{fontFamily:"var(--font-display)",fontSize:18,color:"var(--accent)",letterSpacing:"2px"}}>Care - Connect</div>
      <div style={{fontSize:13,color:"var(--text-muted)"}}>Starting up…</div>
    </div>
  );

  // ─── First-time setup ────────────────────────────────────────
  if (needsSetup) return <FirstTimeSetup onSetupComplete={()=>{setNeedsSetup(false);window.location.reload();}}/>;

  // ─── Register ────────────────────────────────────────────────
  if (showRegister) return <Register setView={v=>{ if(v==="login") setShowRegister(false); }}/>;

  // ─── Hospital Operator ───────────────────────────────────────
  if (auth.token && auth.role==="HospitalOperator") {
    const hospitalId = auth.hospitalId || localStorage.getItem("hospitalId");
    return (
      <div className="page-wrapper">
        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:22}}>🏥</div>
            <div>
              <div className="logo" style={{fontSize:14,letterSpacing:"1.5px"}}>HOSPITAL PORTAL</div>
              <div className="tagline" style={{fontSize:9}}>{auth.name} · {clock.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="header-actions">
            <span className="role-pill" style={{background:"rgba(0,230,118,.15)",color:"var(--green)",border:"1px solid rgba(0,230,118,.3)"}}>🏥 HOSPITAL OP</span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="content-area">
          <HospitalOperatorDashboard hospitalId={hospitalId} onBack={logout}/>
        </div>
      </div>
    );
  }

  // ─── Ambulance Operator ──────────────────────────────────────
  if (auth.token && auth.role==="AmbulanceOperator") {
    const ambulanceId = auth.ambulanceId || localStorage.getItem("ambulanceId");
    return (
      <div className="page-wrapper">
        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:22}}>🚑</div>
            <div>
              <div className="logo" style={{fontSize:14,letterSpacing:"1.5px"}}>AMBULANCE DRIVER PORTAL</div>
              <div className="tagline" style={{fontSize:9}}>{auth.name} · {clock.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="header-actions">
            <span className="role-pill" style={{background:"rgba(255,143,0,.15)",color:"var(--orange)",border:"1px solid rgba(255,143,0,.3)"}}>🚑 DRIVER</span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <div className="content-area">
          <AmbulanceOperatorDashboard ambulanceId={ambulanceId} onBack={logout}/>
        </div>
      </div>
    );
  }

  // ─── Central Authority / Admin Dashboard ─────────────────────
  if (auth.token && ["Admin","CentralAuthority","Operator"].includes(auth.role)) {
    const TABS=[
      {id:"hospitals",  label:"🏥 Hospitals"},
      {id:"emergencies",label:"🚨 Emergencies"},
      {id:"transfers",  label:"🚑 Transfers"},
      {id:"ambulances", label:"🚐 Ambulances"},
      {id:"forecast",   label:"🔮 AI Forecast"},
      ...(auth.role==="Admin"?[{id:"admin",label:"👥 Admin"}]:[]),
    ];
    const sc = s=>s>70?"var(--green)":s>40?"var(--yellow)":"var(--red)";

    return (
      <div className="page-wrapper">
        {/* Toast notifications */}
        <div style={{position:"fixed",top:16,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:380}}>
          {notifications.map(n=>(
            <div key={n.id} style={{background:n.type==="error"?"var(--red-dim)":n.type==="success"?"var(--green-dim)":n.type==="warning"?"var(--orange-dim)":"var(--accent-dim)",border:`1px solid ${n.type==="error"?"var(--red)":n.type==="success"?"var(--green)":n.type==="warning"?"var(--orange)":"var(--accent)"}`,color:n.type==="error"?"var(--red)":n.type==="success"?"var(--green)":n.type==="warning"?"var(--orange)":"var(--accent)",padding:"10px 16px",borderRadius:"var(--radius-md)",fontSize:12,fontWeight:500,boxShadow:"var(--shadow-md)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <span>{n.msg}</span>
              <button onClick={()=>setNotifs(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",color:"inherit",cursor:"pointer",opacity:.7}}>✕</button>
            </div>
          ))}
        </div>

        <header className="app-header">
          <div className="header-brand">
            <div style={{fontSize:26,lineHeight:1}}>🏥</div>
            <div>
              <div className="logo" style={{fontSize:14,letterSpacing:"2px"}}>HEALTHCARE RESOURCE PLATFORM</div>
              <div className="tagline" style={{fontSize:9}}>
                {auth.role==="Admin"?"SYSTEM ADMIN":"CENTRAL AUTHORITY"} · {auth.name} · {clock.toLocaleTimeString()}
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
            {liveCount>0&&<button onClick={()=>{liveRef.current=0;setLiveCount(0);}} style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"3px 10px",borderRadius:"var(--radius-sm)",fontWeight:700,fontSize:11,cursor:"pointer"}}>+{liveCount} NEW</button>}
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--green)",fontFamily:"var(--font-display)",fontWeight:600,letterSpacing:1}}>
              <span style={{width:7,height:7,background:"var(--green)",borderRadius:"50%",display:"inline-block",boxShadow:"0 0 6px var(--green)"}}/>LIVE
            </div>
            <span style={{color:"var(--text-secondary)",fontSize:13,fontWeight:600}}>{auth.name}</span>
            <span className={`role-pill role-${auth.role?.toLowerCase()}`}>{auth.role==="CentralAuthority"?"CENTRAL":auth.role?.toUpperCase()}</span>
            <button className="theme-toggle" onClick={toggleTheme}/>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>

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

  // ─── DEFAULT: CITIZEN PORTAL (landing page) ──────────────────
  return (
    <>
      <CitizenPortal
        onStaffLogin={() => setShowStaffLogin(true)}
        showStaffLoginButton={true}
      />
      {showStaffLogin && (
        <StaffLoginPanel
          onClose={() => setShowStaffLogin(false)}
          onLogin={handleLogin}
        />
      )}
    </>
  );
}
