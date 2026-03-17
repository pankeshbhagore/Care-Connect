/**
 * Hospital Self-Registration Page
 * Hospitals can request to join the platform
 * Admin reviews and sends verification email
 */
import { useState } from "react";
import api from "../services/api";
import { reverseGeocode } from "../services/geocode";

export default function HospitalSelfRegister({ onBack }) {
  const [f,setF]=useState({ name:"", email:"", phone:"", address:"", city:"", district:"", state:"", lat:"", lng:"", type:"Government", message:"" });
  const [submitting,setSubmitting]=useState(false);
  const [done,setDone]=useState(null);
  const [locating,setLocating]=useState(false);
  const [locName,setLocName]=useState("");
  const s=(k,v)=>setF(p=>({...p,[k]:v}));

  const detect=()=>{
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      s("lat",lat.toFixed(6));s("lng",lng.toFixed(6));setLocating(false);
      try{const g=await reverseGeocode(lat,lng);s("address",g.full||g.short||"");s("city",g.city||"");s("district",g.district||"");s("state",g.state||"");setLocName(g.short||"");}catch(e){}
    },()=>setLocating(false),{enableHighAccuracy:true});
  };

  const submit=async e=>{
    e.preventDefault();setSubmitting(true);
    try{
      const r=await api.post("/hospital-registration/self-register",f);
      setDone(r.data);
    }catch(e){alert(e.response?.data?.message||e.message);setSubmitting(false);}
  };

  if(done) return (
    <div style={{maxWidth:480,margin:"40px auto",textAlign:"center",padding:20}}>
      <div style={{fontSize:52,marginBottom:12}}>📬</div>
      <div style={{fontFamily:"var(--font-display)",fontSize:20,color:"var(--green)",marginBottom:8}}>Request Submitted!</div>
      <div style={{color:"var(--text-secondary)",fontSize:13,lineHeight:1.7,marginBottom:16}}>{done.message}</div>
      <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12,fontSize:12,color:"var(--text-muted)",marginBottom:20}}>
        Your Hospital ID: <strong style={{fontFamily:"var(--font-mono)",color:"var(--accent)"}}>{done.hospitalId}</strong>
      </div>
      <button className="btn btn-primary" onClick={onBack}>← Back to Platform</button>
    </div>
  );

  return (
    <div style={{maxWidth:600,margin:"0 auto",padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div>
          <div style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:700,color:"var(--text-primary)"}}>Register Your Hospital</div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>Submit a request to join CareConnect Platform</div>
        </div>
      </div>
      <div style={{background:"var(--accent-dim)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:14,marginBottom:20,fontSize:12,color:"var(--text-secondary)"}}>
        ℹ️ After submission, our admin will review your request and send a verification email to complete registration.
      </div>
      <form onSubmit={submit} className="card" style={{padding:24}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Hospital Name *</label><input className="input" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="Full official name" required/></div>
          <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Contact Email *</label><input className="input" type="email" value={f.email} onChange={e=>s("email",e.target.value)} placeholder="hospital@example.com" required/></div>
          <div style={{marginBottom:14}}><label className="form-label">Phone *</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="+91 90000 00000" required/></div>
          <div style={{marginBottom:14}}><label className="form-label">Type</label><select className="select" value={f.type} onChange={e=>s("type",e.target.value)}>{["Government","Private","Trust","Clinic","Trauma Center"].map(t=><option key={t}>{t}</option>)}</select></div>
        </div>
        <div style={{marginBottom:12}}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={detect} disabled={locating} style={{width:"100%",justifyContent:"center",marginBottom:8}}>{locating?"Detecting…":"📍 Auto-Detect Location"}</button>
          {locName&&<div style={{fontSize:12,color:"var(--green)",background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:"var(--radius-sm)",padding:"6px 10px",marginBottom:8}}>📍 {locName}</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Street, Area"/></div>
          <div style={{marginBottom:14}}><label className="form-label">City *</label><input className="input" value={f.city} onChange={e=>s("city",e.target.value)} required/></div>
          <div style={{marginBottom:14}}><label className="form-label">District *</label><input className="input" value={f.district} onChange={e=>s("district",e.target.value)} required/></div>
          <div style={{marginBottom:14}}><label className="form-label">State *</label><input className="input" value={f.state} onChange={e=>s("state",e.target.value)} required/></div>
          <div style={{marginBottom:14}}><label className="form-label">Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)}/></div>
          <div style={{marginBottom:14}}><label className="form-label">Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)}/></div>
          <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Why do you want to join? (optional)</label><textarea className="input" rows={2} value={f.message} onChange={e=>s("message",e.target.value)} placeholder="Brief description of your hospital…"/></div>
        </div>
        <button type="submit" className="btn btn-primary" style={{width:"100%",justifyContent:"center",padding:12,fontSize:14}} disabled={submitting}>{submitting?"Submitting…":"📬 Submit Registration Request"}</button>
      </form>
    </div>
  );
}
