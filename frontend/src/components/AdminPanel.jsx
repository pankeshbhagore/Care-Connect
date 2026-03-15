import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

function CreateUserModal({ onClose, onSave }) {
  const [f,setF]=useState({ name:"", email:"", password:"", role:"Operator", phone:"", department:"", badgeNumber:"" });
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=async e=>{
    e.preventDefault(); setErr(""); setSaving(true);
    try { await onSave(f); onClose(); }
    catch(e){ setErr(e.response?.data?.message||e.message); setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>➕ Create User</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Full Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Email *</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} required/></div>
            <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Password *</label><input className="input" type="password" value={f.password} onChange={e=>s("password",e.target.value)} placeholder="Min 6 chars" required/></div>
            <div style={{marginBottom:12}}><label className="form-label">Role</label><select className="select" value={f.role} onChange={e=>s("role",e.target.value)}>{["Operator","Admin","Citizen"].map(r=><option key={r}>{r}</option>)}</select></div>
            <div style={{marginBottom:12}}><label className="form-label">Phone</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)}/></div>
            <div style={{marginBottom:12}}><label className="form-label">Department</label><input className="input" value={f.department} onChange={e=>s("department",e.target.value)} placeholder="e.g. Emergency"/></div>
            <div style={{marginBottom:12}}><label className="form-label">Badge Number</label><input className="input" value={f.badgeNumber} onChange={e=>s("badgeNumber",e.target.value)}/></div>
          </div>
          {err&&<div style={{background:"var(--red-dim)",border:"1px solid var(--red)",color:"var(--red)",padding:"10px 14px",borderRadius:"var(--radius-md)",fontSize:13,marginBottom:14}}>⚠️ {err}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,borderTop:"1px solid var(--border)"}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?"Creating…":"Create User"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [users,setUsers]=useState([]);
  const [stats,setStats]=useState(null);
  const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);
  const [search,setSearch]=useState("");

  const load=useCallback(async()=>{
    try {
      const [u,s]=await Promise.all([api.get("/admin/users"),api.get("/admin/stats")]);
      setUsers(u.data); setStats(s.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const toggleStatus=async(id,current)=>{
    try { await api.put(`/admin/users/${id}/status`,{status:current==="active"?"suspended":"active"}); load(); }
    catch(e){ alert(e.message); }
  };
  const deleteUser=async(id)=>{
    if(!confirm("Delete this user?")) return;
    try { await api.delete(`/admin/users/${id}`); load(); }
    catch(e){ alert(e.message); }
  };
  const createUser=async(data)=>{ await api.post("/admin/users",data); load(); };

  const ROLE_COLORS = { Admin:"var(--red)", Operator:"var(--orange)", Citizen:"var(--accent)" };
  const filtered=users.filter(u=>!search||u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase()));

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading…</div>;

  return (
    <div>
      {stats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(5,1fr)",marginBottom:20}}>
          {[["👥","Total Users",stats.users?.total,"var(--accent)"],["🔑","Admins",stats.users?.admins,"var(--red)"],["👮","Operators",stats.users?.operators,"var(--orange)"],["👤","Citizens",stats.users?.citizens,"var(--green)"],["🏥","Hospitals",stats.hospitals?.total,"var(--purple)"]].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:28}}>{v??0}</div></div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}>
        <input className="input" style={{flex:1}} placeholder="🔍 Search users…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}>+ Create User</button>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"var(--font-body)",fontSize:13}}>
          <thead>
            <tr style={{background:"var(--bg-elevated)",borderBottom:"1px solid var(--border)"}}>
              {["Name","Email","Role","Status","Department","Last Login","Actions"].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:11,fontWeight:600,color:"var(--text-muted)",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u._id} style={{borderBottom:"1px solid var(--border)",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"10px 14px",color:"var(--text-primary)",fontWeight:600}}>{u.name}</td>
                <td style={{padding:"10px 14px",color:"var(--text-secondary)",fontSize:12}}>{u.email}</td>
                <td style={{padding:"10px 14px"}}>
                  <span style={{background:`${ROLE_COLORS[u.role]||"#4e7090"}22`,color:ROLE_COLORS[u.role]||"var(--text-muted)",border:`1px solid ${ROLE_COLORS[u.role]||"#4e7090"}44`,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>{u.role}</span>
                </td>
                <td style={{padding:"10px 14px"}}>
                  <span className={`badge ${u.accountStatus==="active"?"badge-green":"badge-red"}`}>{u.accountStatus}</span>
                </td>
                <td style={{padding:"10px 14px",color:"var(--text-muted)",fontSize:12}}>{u.department||"—"}</td>
                <td style={{padding:"10px 14px",color:"var(--text-muted)",fontSize:11}}>{u.lastLogin?new Date(u.lastLogin).toLocaleDateString():"Never"}</td>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",gap:5}}>
                    <button className={`btn btn-ghost btn-sm ${u.accountStatus==="active"?"":"btn-primary"}`} style={{fontSize:10}} onClick={()=>toggleStatus(u._id,u.accountStatus)}>
                      {u.accountStatus==="active"?"Suspend":"Activate"}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10,color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>deleteUser(u._id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>No users found</div>}
      </div>

      {showCreate&&<CreateUserModal onClose={()=>setShowCreate(false)} onSave={createUser}/>}
    </div>
  );
}
