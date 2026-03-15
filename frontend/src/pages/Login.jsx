import { useState } from "react";
import api from "../services/api";

export default function Login({ setAuth, setView, onSetup, subtitle, onBack }) {
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

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom:20, fontSize:12 }}>← Back to Role Selection</button>}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🏥</div>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, letterSpacing:"3px", color:"var(--accent)", marginBottom:4 }}>HEALTHCARE PLATFORM</h1>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--text-muted)", letterSpacing:"1.5px" }}>{subtitle || "RESOURCE COORDINATION SYSTEM"}</div>
        </div>
        <div className="card" style={{ padding:32 }}>
          <h2 style={{ fontFamily:"var(--font-display)", marginBottom:4, fontSize:20 }}>System Login</h2>
          <p style={{ color:"var(--text-muted)", fontSize:12, marginBottom:24 }}>Admin · Operator · Hospital Staff · Ambulance Driver</p>
          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label className="form-label">📧 Email</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
            </div>
            <div>
              <label className="form-label">🔒 Password</label>
              <div style={{ position:"relative" }}>
                <input className="input" type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight:44 }} />
                <button type="button" onClick={()=>setShowPass(p=>!p)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"var(--text-muted)" }}>{showPass?"🙈":"👁"}</button>
              </div>
            </div>
            {error && <div style={{ background:"var(--red-dim)", border:"1px solid var(--red)", color:"var(--red)", padding:"10px 14px", borderRadius:"var(--radius-md)", fontSize:13 }}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding:"13px", fontSize:14, width:"100%", justifyContent:"center", letterSpacing:1, marginTop:4 }}>
              {loading ? "⏳ Authenticating…" : "Access System →"}
            </button>
          </form>
          <hr style={{ margin:"20px 0", borderColor:"var(--border)" }} />
          <p style={{ textAlign:"center", fontSize:13, color:"var(--text-muted)" }}>
            No account? <span onClick={()=>setView?.("register")} style={{ color:"var(--accent)", cursor:"pointer", fontWeight:600 }}>Register as Citizen</span>
          </p>
          {onSetup && <p style={{ textAlign:"center", fontSize:11, color:"var(--text-dim)", marginTop:6 }}>First time? <span onClick={onSetup} style={{ color:"var(--text-muted)", cursor:"pointer", textDecoration:"underline" }}>Run setup</span></p>}
        </div>
      </div>
    </div>
  );
}
