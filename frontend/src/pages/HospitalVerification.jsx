/**
 * Hospital Verification Page — accessed via email link
 * Route: /verify-hospital/:token
 * Hospital completes registration here
 */
import { useState, useEffect } from "react";
import api from "../services/api";
import { reverseGeocode } from "../services/geocode";

const SPECIALTIES_LIST = [
  "Cardiology","Neurology","Orthopedics","Gynecology","Pediatrics",
  "Oncology","Nephrology","Gastroenterology","Pulmonology","Urology",
  "Dermatology","Ophthalmology","ENT","Psychiatry","Emergency Medicine",
  "Radiology","Anesthesiology","General Surgery","Plastic Surgery",
];

export default function HospitalVerification() {
  const token = window.location.pathname.split("/verify-hospital/")[1];
  const [phase,      setPhase]     = useState("loading"); // loading|form|success|error|expired|done
  const [hospital,   setHospital]  = useState(null);
  const [error,      setError]     = useState("");
  const [submitting, setSubmitting]= useState(false);
  const [locating,   setLocating]  = useState(false);
  const [preview,    setPreview]   = useState(null); // ethereal preview URL

  // Form state
  const [step, setStep] = useState(1); // 3 steps
  const [f, setF] = useState({
    // Step 1 — Contact & Location
    phone:"", emergency:"", website:"",
    address:"", landmark:"", city:"", district:"", state:"", pincode:"",
    lat:"", lng:"", locationName:"",
    // Step 2 — Resources
    icuTotal:"0", icuAvail:"0", bedsTotal:"0", bedsAvail:"0",
    emergencyBeds:"0", ventTotal:"0", ventAvail:"0",
    oxygenLevel:"100", dialysis:"0", bloodUnits:"0",
    doctorsOnDuty:"0", nursesOnDuty:"0", ambulancesTotal:"0", ambulancesAvailable:"0",
    ctScan:false, mri:false, xray:false, bloodBank:false,
    traumaCenter:false, covidWard:false,
    specialties:[],
    // Step 3 — Operator Account
    operatorName:"", operatorEmail:"", operatorPassword:"", confirmPassword:"",
  });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const toggle = k => setF(p=>({...p,[k]:!p[k]}));

  useEffect(()=>{
    if (!token) { setPhase("error"); setError("No verification token in URL"); return; }
    api.get(`/hospital-registration/verify/${token}`)
      .then(r=>{
        if (r.data.alreadyVerified) { setPhase("done"); setHospital(r.data.hospital); return; }
        setHospital(r.data.hospital);
        // Pre-fill from existing data
        setF(p=>({...p,
          phone: r.data.hospital.phone||"",
          city:  r.data.hospital.city||"",
          address: r.data.hospital.address||"",
        }));
        setPhase("form");
      })
      .catch(e=>{
        const msg = e.response?.data?.message || "Token verification failed";
        if (e.response?.data?.expired || msg.includes("expired") || msg.includes("Invalid")) {
          setPhase("expired"); setError(msg);
        } else {
          setPhase("error"); setError(msg);
        }
      });
  },[token]);

  const detectLocation = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lng} = pos.coords;
      s("lat",lat.toFixed(6)); s("lng",lng.toFixed(6)); setLocating(false);
      try {
        const g = await reverseGeocode(lat,lng);
        s("address",g.full||g.short||"");
        s("city",    g.city||"");
        s("district",g.district||"");
        s("state",   g.state||"");
        s("pincode", g.postcode||"");
        s("locationName", g.short||"");
      } catch(e){}
    },()=>setLocating(false),{enableHighAccuracy:true});
  };

  const toggleSpecialty = sp => setF(p=>({ ...p, specialties: p.specialties.includes(sp) ? p.specialties.filter(x=>x!==sp) : [...p.specialties,sp] }));

  const submit = async () => {
    if (f.operatorPassword !== f.confirmPassword) { alert("Passwords don't match"); return; }
    if (!f.operatorName||!f.operatorEmail||!f.operatorPassword) { alert("Operator account details required"); return; }
    setSubmitting(true);
    try {
      const r = await api.post(`/hospital-registration/verify/${token}`, { ...f });
      setPhase("success");
      setPreview(r.data.loginToken);
      setHospital(h=>({...h, ...r.data.hospital}));
    } catch(e) {
      alert(e.response?.data?.message || "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const STEP_LABELS = ["📍 Contact & Location","🏥 Resources","🔑 Create Account"];

  // ── LOADING ──────────────────────────────────────────────────
  if (phase==="loading") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:16}}>🏥</div>
        <div style={{fontFamily:"var(--font-display)",fontSize:16,color:"var(--accent)"}}>Verifying your registration link…</div>
      </div>
    </div>
  );

  // ── EXPIRED ──────────────────────────────────────────────────
  if (phase==="expired") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      <div className="card" style={{maxWidth:460,width:"90%",textAlign:"center",padding:40}}>
        <div style={{fontSize:52,marginBottom:16}}>⏰</div>
        <h2 style={{fontFamily:"var(--font-display)",color:"var(--orange)",marginBottom:8}}>Link Expired</h2>
        <p style={{color:"var(--text-secondary)",marginBottom:20}}>This registration link has expired. Please contact your administrator to send a new verification email.</p>
        <div style={{background:"var(--orange-dim)",border:"1px solid var(--orange)",borderRadius:"var(--radius-md)",padding:12,fontSize:12,color:"var(--orange)",marginBottom:16}}>
          {error}
        </div>
        <div style={{fontSize:12,color:"var(--text-muted)"}}>Contact: admin@healthcare.local</div>
      </div>
    </div>
  );

  // ── ALREADY DONE ─────────────────────────────────────────────
  if (phase==="done") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      <div className="card" style={{maxWidth:460,width:"90%",textAlign:"center",padding:40}}>
        <div style={{fontSize:52,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:"var(--font-display)",color:"var(--green)",marginBottom:8}}>Already Registered</h2>
        <p style={{color:"var(--text-secondary)",marginBottom:20}}><strong>{hospital?.name}</strong> has already completed registration.</p>
        <a href="/" className="btn btn-primary" style={{textDecoration:"none",display:"inline-block"}}>Go to Platform →</a>
      </div>
    </div>
  );

  // ── ERROR ─────────────────────────────────────────────────────
  if (phase==="error") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      <div className="card" style={{maxWidth:460,width:"90%",textAlign:"center",padding:40}}>
        <div style={{fontSize:52,marginBottom:16}}>❌</div>
        <h2 style={{fontFamily:"var(--font-display)",color:"var(--red)",marginBottom:8}}>Invalid Link</h2>
        <p style={{color:"var(--text-secondary)",marginBottom:16}}>{error}</p>
        <a href="/" className="btn btn-ghost" style={{textDecoration:"none",display:"inline-block"}}>Go to Homepage</a>
      </div>
    </div>
  );

  // ── SUCCESS ──────────────────────────────────────────────────
  if (phase==="success") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-primary)",fontFamily:"var(--font-body)",padding:20}}>
      <div className="card" style={{maxWidth:520,width:"100%",textAlign:"center",padding:40}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <h2 style={{fontFamily:"var(--font-display)",color:"var(--green)",fontSize:24,marginBottom:8}}>Registration Complete!</h2>
        <p style={{color:"var(--text-secondary)",marginBottom:24,lineHeight:1.7}}>
          <strong>{hospital?.name}</strong> is now registered and active on CareConnect platform. Your hospital operator account has been created.
        </p>
        <div style={{background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:"var(--radius-md)",padding:16,marginBottom:20,textAlign:"left"}}>
          <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--green)",marginBottom:8}}>✅ What's Next</div>
          <div style={{fontSize:12,color:"var(--text-secondary)",lineHeight:1.8}}>
            <div>1. Go to the platform homepage</div>
            <div>2. Click <strong>"Staff Login"</strong> (top right)</div>
            <div>3. Select <strong>"Hospital Operator"</strong></div>
            <div>4. Login with your email: <strong>{f.operatorEmail}</strong></div>
            <div>5. Start managing your hospital's resources in real-time</div>
          </div>
        </div>
        <a href="/" style={{background:"var(--green)",color:"#fff",textDecoration:"none",padding:"13px 28px",borderRadius:"var(--radius-md)",fontFamily:"var(--font-display)",fontWeight:700,fontSize:14,display:"inline-block"}}>
          Go to CareConnect →
        </a>
      </div>
    </div>
  );

  // ── MAIN FORM ────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-primary)",fontFamily:"var(--font-body)"}}>
      {/* Header */}
      <div style={{background:"var(--bg-card)",borderBottom:"1px solid var(--border)",padding:"16px 24px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{fontSize:28}}>🏥</div>
        <div>
          <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:16,color:"var(--text-primary)",letterSpacing:"1px"}}>CARE-CONNECT</div>
          <div style={{fontSize:11,color:"var(--text-muted)"}}>Hospital Registration Portal</div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"30px 20px"}}>
        {/* Hospital info banner */}
        <div style={{background:"linear-gradient(135deg,var(--accent-dim),rgba(0,200,255,.04))",border:"1px solid rgba(0,200,255,.25)",borderRadius:"var(--radius-lg)",padding:20,marginBottom:28}}>
          <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:18,color:"var(--text-primary)",marginBottom:4}}>
            {hospital?.name}
          </div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>
            {hospital?.email} · Complete your hospital registration below
          </div>
        </div>

        {/* Step progress */}
        <div style={{display:"flex",gap:0,marginBottom:28}}>
          {STEP_LABELS.map((lbl,i)=>{
            const active=step===i+1,done=step>i+1;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
                {i>0&&<div style={{position:"absolute",top:16,right:"50%",width:"100%",height:2,background:done?"var(--green)":"var(--border)"}}/>}
                <div style={{width:34,height:34,borderRadius:"50%",background:done?"var(--green)":active?"var(--accent)":"var(--bg-elevated)",border:`2px solid ${done?"var(--green)":active?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,zIndex:1,color:done||active?"#fff":"var(--text-muted)",fontWeight:700,position:"relative"}}>
                  {done?"✓":i+1}
                </div>
                <div style={{fontSize:11,color:active?"var(--accent)":done?"var(--green)":"var(--text-muted)",marginTop:6,textAlign:"center",lineHeight:1.3}}>{lbl}</div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{padding:28}}>

          {/* ── STEP 1: Contact & Location ─────────────────────── */}
          {step===1&&(
            <>
              <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)",marginBottom:20}}>📍 Contact & Location Details</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <div style={{marginBottom:14}}><label className="form-label">Emergency Phone *</label><input className="input" value={f.phone} onChange={e=>s("phone",e.target.value)} placeholder="e.g. +91 90000 00000" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">24/7 Emergency Line</label><input className="input" value={f.emergency} onChange={e=>s("emergency",e.target.value)} placeholder="Emergency number"/></div>
                <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Website</label><input className="input" value={f.website} onChange={e=>s("website",e.target.value)} placeholder="https://yourhospital.com"/></div>
              </div>
              <hr style={{border:"none",borderTop:"1px solid var(--border)",margin:"16px 0"}}/>
              <div style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:13,color:"var(--text-secondary)",marginBottom:12}}>📍 Hospital Location</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={detectLocation} disabled={locating} style={{marginBottom:10,width:"100%",justifyContent:"center"}}>
                {locating?"🔄 Detecting...":"📍 Auto-Detect Location via GPS"}
              </button>
              {f.locationName&&<div style={{background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:"var(--radius-md)",padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--green)"}}>📍 {f.locationName}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Full Address</label><input className="input" value={f.address} onChange={e=>s("address",e.target.value)} placeholder="Building, Street, Area…"/></div>
                <div style={{marginBottom:14}}><label className="form-label">Landmark</label><input className="input" value={f.landmark} onChange={e=>s("landmark",e.target.value)} placeholder="Near XYZ"/></div>
                <div style={{marginBottom:14}}><label className="form-label">City *</label><input className="input" value={f.city} onChange={e=>s("city",e.target.value)} placeholder="e.g. Indore" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">District *</label><input className="input" value={f.district} onChange={e=>s("district",e.target.value)} placeholder="e.g. Indore" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">State *</label><input className="input" value={f.state} onChange={e=>s("state",e.target.value)} placeholder="e.g. Madhya Pradesh" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">Pincode</label><input className="input" value={f.pincode} onChange={e=>s("pincode",e.target.value)} placeholder="452001"/></div>
                <div style={{marginBottom:14}}><label className="form-label">Latitude</label><input className="input" type="number" step="0.000001" value={f.lat} onChange={e=>s("lat",e.target.value)}/></div>
                <div style={{marginBottom:14}}><label className="form-label">Longitude</label><input className="input" type="number" step="0.000001" value={f.lng} onChange={e=>s("lng",e.target.value)}/></div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
                <button className="btn btn-primary" onClick={()=>{ if(!f.phone||!f.city||!f.district||!f.state){alert("Fill required fields");return;} setStep(2); }}>Next: Resources →</button>
              </div>
            </>
          )}

          {/* ── STEP 2: Resources ─────────────────────────────── */}
          {step===2&&(
            <>
              <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)",marginBottom:20}}>🏥 Hospital Resources</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
                {[["ICU Beds Total","icuTotal"],["ICU Available","icuAvail"],["General Beds Total","bedsTotal"],["General Available","bedsAvail"],["Emergency Beds","emergencyBeds"],["Ventilators Total","ventTotal"],["Vents Available","ventAvail"],["Oxygen Level %","oxygenLevel"],["Dialysis Machines","dialysis"],["Blood Units","bloodUnits"],["Doctors on Duty","doctorsOnDuty"],["Nurses on Duty","nursesOnDuty"],["Ambulances Total","ambulancesTotal"],["Ambulances Available","ambulancesAvailable"]].map(([lbl,key])=>(
                  <div key={key} style={{marginBottom:12}}>
                    <label className="form-label">{lbl}</label>
                    <input className="input" type="number" min={0} max={key==="oxygenLevel"?100:undefined} value={f[key]} onChange={e=>s(key,e.target.value)}/>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:14}}>
                <label className="form-label">Equipment Available</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[["ctScan","CT Scan"],["mri","MRI"],["xray","X-Ray"],["bloodBank","Blood Bank"],["traumaCenter","Trauma Center"],["covidWard","COVID Ward"]].map(([key,lbl])=>(
                    <button key={key} type="button" onClick={()=>toggle(key)} style={{padding:"6px 14px",border:`1px solid ${f[key]?"var(--accent)":"var(--border)"}`,background:f[key]?"var(--accent-dim)":"var(--bg-elevated)",color:f[key]?"var(--accent)":"var(--text-secondary)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:12,fontWeight:f[key]?700:400}}>
                      {f[key]?"✓ ":""}{lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label className="form-label">Specialties (select all that apply)</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",maxHeight:140,overflowY:"auto",padding:4}}>
                  {SPECIALTIES_LIST.map(sp=>(
                    <button key={sp} type="button" onClick={()=>toggleSpecialty(sp)} style={{padding:"4px 12px",border:`1px solid ${f.specialties.includes(sp)?"var(--accent)":"var(--border)"}`,background:f.specialties.includes(sp)?"var(--accent-dim)":"var(--bg-elevated)",color:f.specialties.includes(sp)?"var(--accent)":"var(--text-secondary)",borderRadius:20,cursor:"pointer",fontSize:11}}>
                      {sp}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
                <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={()=>setStep(3)}>Next: Create Account →</button>
              </div>
            </>
          )}

          {/* ── STEP 3: Operator Account ──────────────────────── */}
          {step===3&&(
            <>
              <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)",marginBottom:8}}>🔑 Create Operator Account</div>
              <div style={{background:"var(--accent-dim)",border:"1px solid rgba(0,200,255,.2)",borderRadius:"var(--radius-md)",padding:12,marginBottom:20,fontSize:12,color:"var(--text-secondary)"}}>
                This account will be used to log in to the hospital dashboard and manage resources.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Your Full Name *</label><input className="input" value={f.operatorName} onChange={e=>s("operatorName",e.target.value)} placeholder="Dr. / Manager name" required/></div>
                <div style={{gridColumn:"1/-1",marginBottom:14}}><label className="form-label">Login Email *</label><input className="input" type="email" value={f.operatorEmail} onChange={e=>s("operatorEmail",e.target.value)} placeholder="your@hospital.com" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">Password *</label><input className="input" type="password" value={f.operatorPassword} onChange={e=>s("operatorPassword",e.target.value)} placeholder="Min 8 characters" required/></div>
                <div style={{marginBottom:14}}><label className="form-label">Confirm Password *</label><input className="input" type="password" value={f.confirmPassword} onChange={e=>s("confirmPassword",e.target.value)} placeholder="Repeat password" required/></div>
              </div>
              {f.operatorPassword && f.confirmPassword && f.operatorPassword!==f.confirmPassword&&(
                <div style={{color:"var(--red)",fontSize:12,marginBottom:8}}>⚠ Passwords do not match</div>
              )}
              <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:12,marginBottom:16,fontSize:11,color:"var(--text-muted)"}}>
                📋 <strong>Summary:</strong> {hospital?.name} · {f.city}, {f.district}, {f.state} · ICU {f.icuAvail}/{f.icuTotal} · Beds {f.bedsAvail}/{f.bedsTotal} · {f.specialties.length} specialties
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
                <button className="btn btn-ghost" onClick={()=>setStep(2)}>← Back</button>
                <button className="btn btn-primary" style={{background:"var(--green)",borderColor:"var(--green)",padding:"12px 28px",fontSize:14}} disabled={submitting || f.operatorPassword!==f.confirmPassword} onClick={submit}>
                  {submitting?"🔄 Registering…":"✅ Complete Registration"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
