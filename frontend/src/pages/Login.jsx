import { useState, useEffect } from "react";
import api from "../services/api";

// ── Sign In ───────────────────────────────────────────────────────────
function SignInForm({ setAuth, setView, onSetup }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      const d   = res.data;
      localStorage.setItem("token",  d.token);
      localStorage.setItem("role",   d.role);
      localStorage.setItem("name",   d.name);
      localStorage.setItem("userId", d.userId || "");
      if(d.hospitalId)  localStorage.setItem("hospitalId",  d.hospitalId);
      if(d.ambulanceId) localStorage.setItem("ambulanceId", d.ambulanceId);
      setAuth({ token:d.token, role:d.role, name:d.name, hospitalId:d.hospitalId, ambulanceId:d.ambulanceId });
    } catch(err) {
      setError(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally { setLoading(false); }
  };

  const inp = "w-full input";
  return (
    <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <label className="form-label">📧 Email</label>
        <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoFocus/>
      </div>
      <div>
        <label className="form-label">🔒 Password</label>
        <div style={{position:"relative"}}>
          <input className="input" type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{paddingRight:44}}/>
          <button type="button" onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"var(--text-muted)"}}>{showPass?"🙈":"👁"}</button>
        </div>
      </div>
      {error&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"10px 14px",borderRadius:"var(--radius-md)",fontSize:13}}>⚠️ {error}</div>}
      <button type="submit" disabled={loading} className="btn btn-primary" style={{padding:"13px",fontSize:14,width:"100%",justifyContent:"center",letterSpacing:1,marginTop:4}}>
        {loading?"⏳ Authenticating…":"Access System →"}
      </button>
      <div style={{marginTop:8,padding:12,background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",fontSize:12,color:"var(--text-muted)"}}>
        <div style={{fontWeight:600,color:"var(--text-secondary)",marginBottom:6}}>Demo credentials:</div>
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,lineHeight:2}}>
          admin@healthcare.local / Admin@123<br/>
          hospital@healthcare.local / Hospital@123
        </div>
      </div>
      {onSetup&&<p style={{textAlign:"center",fontSize:11,color:"var(--text-dim)",marginTop:4}}>First time? <span onClick={onSetup} style={{color:"var(--text-muted)",cursor:"pointer",textDecoration:"underline"}}>Run setup</span></p>}
    </form>
  );
}

// ── Sign Up (Hospital Registration) ─────────────────────────────────
function SignUpForm({ onSuccess }) {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [city,     setCity]     = useState("Indore");
  const [type,     setType]     = useState("Private");
  const [tier,     setTier]     = useState("Secondary");
  const [icuBeds,  setIcuBeds]  = useState(10);
  const [genBeds,  setGenBeds]  = useState(50);
  const [vents,    setVents]    = useState(5);
  const [erBeds,   setErBeds]   = useState(10);
  const [o2,       setO2]       = useState(95);
  const [doctors,  setDoctors]  = useState(5);
  const [ambs,     setAmbs]     = useState(2);
  const [blood,    setBlood]    = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  useEffect(()=>{
    navigator.geolocation?.getCurrentPosition(
      pos=>setLocation(`${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`),
      ()=>setLocation("Indore, MP")
    );
  },[]);

  const handleSubmit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await api.post("/auth/register", {
        name, email, password, role:"HospitalOperator",
        location, city, type, tier,
        icuBeds, generalBeds:genBeds, ventilators:vents,
        erBeds, oxygenLevel:o2, doctors, ambulances:ambs, bloodAvailable:blood,
      });
      onSuccess?.("Registration submitted! Please wait for admin approval.");
    } catch(err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally { setLoading(false); }
  };

  const inp = {className:"input",style:{fontSize:13}};
  const lbl = {className:"form-label",style:{fontSize:11}};

  return(
    <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12,maxHeight:"60vh",overflowY:"auto",paddingRight:4}}>
      <div>
        <label {...lbl}>Hospital Name *</label>
        <input {...inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. City Care Hospital" required/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <label {...lbl}>Email *</label>
          <input {...inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="hospital@email.com" required/>
        </div>
        <div>
          <label {...lbl}>Password *</label>
          <input {...inp} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Create password" required/>
        </div>
      </div>
      <div>
        <label {...lbl}>Location (auto-detected)</label>
        <input {...inp} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Detecting…"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <div>
          <label {...lbl}>City</label>
          <select className="select" value={city} onChange={e=>setCity(e.target.value)} style={{fontSize:13}}>
            <option>Indore</option><option>Bhopal</option><option>Jabalpur</option><option>Sagar</option><option>Katni</option><option>Rewa</option><option>Gwalior</option>
          </select>
        </div>
        <div>
          <label {...lbl}>Type</label>
          <select className="select" value={type} onChange={e=>setType(e.target.value)} style={{fontSize:13}}>
            <option>Private</option><option>Government</option><option>Trust</option>
          </select>
        </div>
        <div>
          <label {...lbl}>Tier</label>
          <select className="select" value={tier} onChange={e=>setTier(e.target.value)} style={{fontSize:13}}>
            <option>Primary</option><option>Secondary</option><option>Tertiary</option><option>Quaternary</option>
          </select>
        </div>
      </div>
      <div style={{borderTop:"1px solid var(--border)",paddingTop:10}}>
        <div style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:10}}>Resources</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["ICU Beds",icuBeds,setIcuBeds],["General Beds",genBeds,setGenBeds],["Ventilators",vents,setVents],["ER Beds",erBeds,setErBeds],["Oxygen %",o2,setO2],["Doctors",doctors,setDoctors],["Ambulances",ambs,setAmbs]].map(([lbl,val,fn])=>(
            <div key={lbl}>
              <label className="form-label" style={{fontSize:10}}>{lbl}</label>
              <input className="input" type="number" min={0} max={lbl==="Oxygen %"?100:undefined} value={val} onChange={e=>fn(+e.target.value)} style={{fontSize:13}}/>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}>
            <input type="checkbox" checked={blood} onChange={e=>setBlood(e.target.checked)} id="blood_avail" style={{accentColor:"var(--accent)"}}/>
            <label htmlFor="blood_avail" style={{fontSize:13,color:"var(--text-secondary)"}}>Blood Available</label>
          </div>
        </div>
      </div>
      {error&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"10px 14px",borderRadius:"var(--radius-md)",fontSize:13}}>⚠️ {error}</div>}
      <button type="submit" disabled={loading} className="btn btn-primary" style={{padding:"13px",fontSize:14,width:"100%",justifyContent:"center",marginTop:4}}>
        {loading?"⏳ Registering…":"🏥 Register Hospital"}
      </button>
    </form>
  );
}

// ── Main Login Component ──────────────────────────────────────────────
export default function Login({ setAuth, setView, onSetup, subtitle, onBack }) {
  const [tab, setTab] = useState("signin");
  const [successMsg, setSuccessMsg] = useState("");

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:460}}>
        {onBack&&<button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:20,fontSize:12}}>← Back</button>}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10}}>🏥</div>
          <h1 style={{fontFamily:"var(--font-display)",fontSize:20,letterSpacing:"3px",color:"var(--accent)",marginBottom:4}}>CARE-CONNECT</h1>
          <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-muted)",letterSpacing:"1.5px"}}>{subtitle||"EMERGENCY HEALTHCARE PLATFORM"}</div>
        </div>
        <div className="card" style={{padding:28}}>
          {/* Tab switcher */}
          <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",overflow:"hidden",marginBottom:22}}>
            {[["signin","🔑 Sign In"],["signup","🏥 Register Hospital"]].map(([t,l])=>(
              <button key={t} onClick={()=>{setTab(t);setSuccessMsg("");}} style={{flex:1,padding:"10px",fontSize:13,fontWeight:500,background:tab===t?"var(--accent-dim)":"transparent",color:tab===t?"var(--accent)":"var(--text-muted)",border:"none",cursor:"pointer",transition:"all .15s",borderRight:t==="signin"?"1px solid var(--border)":"none"}}>
                {l}
              </button>
            ))}
          </div>

          {successMsg&&<div style={{background:"var(--green-dim)",border:"1px solid var(--green)",color:"var(--green)",padding:"10px 14px",borderRadius:"var(--radius-md)",fontSize:13,marginBottom:16}}>✅ {successMsg}</div>}

          {tab==="signin"&&<SignInForm setAuth={setAuth} setView={setView} onSetup={onSetup}/>}
          {tab==="signup"&&<SignUpForm onSuccess={msg=>{setSuccessMsg(msg);setTab("signin");}}/>}
        </div>
      </div>
    </div>
  );
}
