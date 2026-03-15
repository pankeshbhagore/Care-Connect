import { useState } from "react";
import api from "../services/api";

export default function Register({ setView }) {
  const [form, setForm] = useState({ name:"", email:"", password:"", phone:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      await api.post("/auth/register", form);
      setDone(true);
    } catch(err) { setError(err.response?.data?.message || "Registration failed"); }
    finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="card" style={{ padding:40, textAlign:"center", maxWidth:400 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <h2 style={{ fontFamily:"var(--font-display)", color:"var(--green)", marginBottom:8 }}>Account Created!</h2>
        <p style={{ color:"var(--text-muted)", marginBottom:20 }}>You can now log in with your credentials.</p>
        <button className="btn btn-primary" onClick={()=>setView("login")}>Go to Login →</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🏥</div>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, letterSpacing:"2px", color:"var(--accent)" }}>Register</h1>
        </div>
        <div className="card" style={{ padding:32 }}>
          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label className="form-label">Full Name</label><input className="input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Your Name" required /></div>
            <div><label className="form-label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="you@example.com" required /></div>
            <div><label className="form-label">Phone</label><input className="input" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+91 XXXXXXXXXX" /></div>
            <div><label className="form-label">Password</label><input className="input" type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Min 6 chars" required /></div>
            {error && <div style={{ background:"var(--red-dim)", border:"1px solid var(--red)", color:"var(--red)", padding:"10px 14px", borderRadius:"var(--radius-md)", fontSize:13 }}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding:"13px", width:"100%", justifyContent:"center" }}>{loading?"Creating…":"Create Account"}</button>
          </form>
          <hr style={{ margin:"20px 0", borderColor:"var(--border)" }} />
          <p style={{ textAlign:"center", fontSize:13, color:"var(--text-muted)" }}>
            Already registered? <span onClick={()=>setView("login")} style={{ color:"var(--accent)", cursor:"pointer", fontWeight:600 }}>Login</span>
          </p>
        </div>
      </div>
    </div>
  );
}
