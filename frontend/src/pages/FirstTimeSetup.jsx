import { useState } from "react";
import api from "../services/api";

export default function FirstTimeSetup({ onSetupComplete }) {
  const [form, setForm] = useState({ name:"System Admin", email:"admin@healthcare.local", password:"Admin@123", seedKey:"Healthcare@AdminSeed2024" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await api.post("/admin/seed", form);
      const d   = res.data;
      localStorage.setItem("token", d.token);
      localStorage.setItem("role",  "Admin");
      localStorage.setItem("name",  d.name);
      onSetupComplete();
    } catch(err) { setError(err.response?.data?.message || "Setup failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:440 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:52, marginBottom:10 }}>⚙️</div>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, letterSpacing:"2px", color:"var(--accent)" }}>First-Time Setup</h1>
          <p style={{ color:"var(--text-muted)", fontSize:12, marginTop:4 }}>Create the system administrator account</p>
        </div>
        <div className="card" style={{ padding:32 }}>
          <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><label className="form-label">Admin Name</label><input className="input" value={form.name} onChange={e=>set("name",e.target.value)} required /></div>
            <div><label className="form-label">Admin Email</label><input className="input" type="email" value={form.email} onChange={e=>set("email",e.target.value)} required /></div>
            <div><label className="form-label">Password</label><input className="input" type="password" value={form.password} onChange={e=>set("password",e.target.value)} required /></div>
            <div><label className="form-label">Setup Key</label><input className="input" value={form.seedKey} onChange={e=>set("seedKey",e.target.value)} placeholder="From .env ADMIN_SEED_KEY" required /></div>
            {error && <div style={{ background:"var(--red-dim)", border:"1px solid var(--red)", color:"var(--red)", padding:"10px 14px", borderRadius:"var(--radius-md)", fontSize:13 }}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding:"13px", width:"100%", justifyContent:"center" }}>{loading?"Setting up…":"Complete Setup →"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
