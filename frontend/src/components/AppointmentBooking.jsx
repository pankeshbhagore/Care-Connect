import { useState, useEffect } from "react";
import api from "../services/api";

const SPECIALTIES = ["General Medicine","Cardiology","Neurology","Orthopedics","Gynecology","Pediatrics","Ophthalmology","ENT","Dermatology","Psychiatry","Urology","Oncology","Nephrology","Gastroenterology","Emergency"];

export function AppointmentModal({ hospital, onClose }) {
  const [f, setF] = useState({
    patientName:"", patientPhone:"", patientAge:"", patientGender:"Male",
    specialty:"General Medicine", appointmentDate:"", appointmentTime:"", reason:"",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const s = (k,v) => setF(p=>({...p,[k]:v}));

  // Get next 14 days for date picker
  const getMinDate = () => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0]; };
  const getMaxDate = () => { const d=new Date(); d.setDate(d.getDate()+14); return d.toISOString().split("T")[0]; };

  const TIME_SLOTS = ["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM"];

  const submit = async e => {
    e.preventDefault(); setSubmitting(true);
    try {
      const r = await api.post("/appointments", { hospitalId:hospital._id, ...f, patientAge:+f.patientAge||0 });
      setDone(r.data);
    } catch(e){ alert("Booking failed: "+e.message); }
    finally { setSubmitting(false); }
  };

  // Hospital specialties + default list
  const availableSpecialties = hospital.specialties?.length > 0
    ? [...new Set([...hospital.specialties, "General Medicine","Emergency"])]
    : SPECIALTIES;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:540,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div className="modal-title" style={{margin:0}}>📅 Book Appointment</div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>🏥 {hospital.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {done ? (
          <div style={{textAlign:"center",padding:30}}>
            <div style={{fontSize:52,marginBottom:16}}>✅</div>
            <div style={{fontFamily:"var(--font-display)",fontSize:20,color:"var(--green)",marginBottom:8}}>Appointment Booked!</div>
            <div style={{background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:"var(--radius-md)",padding:16,marginBottom:16,textAlign:"left",fontSize:13,lineHeight:1.8}}>
              <div><b>ID:</b> {done.appointmentId}</div>
              <div><b>Hospital:</b> {hospital.name}</div>
              <div><b>Date:</b> {new Date(done.appointmentDate).toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>
              <div><b>Time:</b> {done.appointmentTime}</div>
              <div><b>Specialty:</b> {done.specialty}</div>
              <div><b>Patient:</b> {done.patientName}</div>
              <div><b>Status:</b> <span style={{color:"var(--yellow)",fontWeight:700}}>Pending Confirmation</span></div>
            </div>
            <div style={{fontSize:12,color:"var(--text-muted)",marginBottom:16}}>📞 Hospital will call {done.patientPhone} to confirm. Please arrive 10 minutes early.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={()=>setDone(null)}>Book Another</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <div style={{gridColumn:"1/-1",marginBottom:12}}>
                <label className="form-label">Specialty *</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {availableSpecialties.slice(0,8).map(sp=>(
                    <button key={sp} type="button" onClick={()=>s("specialty",sp)} style={{padding:"5px 12px",border:`1px solid ${f.specialty===sp?"var(--accent)":"var(--border)"}`,background:f.specialty===sp?"var(--accent-dim)":"var(--bg-elevated)",color:f.specialty===sp?"var(--accent)":"var(--text-secondary)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:12,transition:"all .15s"}}>
                      {sp}
                    </button>
                  ))}
                  {availableSpecialties.length>8&&(
                    <select className="select" value={f.specialty} onChange={e=>s("specialty",e.target.value)} style={{fontSize:12}}>
                      {availableSpecialties.map(sp=><option key={sp}>{sp}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div style={{marginBottom:12}}><label className="form-label">Patient Name *</label><input className="input" value={f.patientName} onChange={e=>s("patientName",e.target.value)} placeholder="Full name" required/></div>
              <div style={{marginBottom:12}}><label className="form-label">Phone *</label><input className="input" value={f.patientPhone} onChange={e=>s("patientPhone",e.target.value)} placeholder="Mobile number" required/></div>
              <div style={{marginBottom:12}}><label className="form-label">Age</label><input className="input" type="number" min={0} max={120} value={f.patientAge} onChange={e=>s("patientAge",e.target.value)} placeholder="Age in years"/></div>
              <div style={{marginBottom:12}}><label className="form-label">Gender</label><select className="select" value={f.patientGender} onChange={e=>s("patientGender",e.target.value)}><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div style={{marginBottom:12}}><label className="form-label">Date *</label><input className="input" type="date" value={f.appointmentDate} onChange={e=>s("appointmentDate",e.target.value)} min={getMinDate()} max={getMaxDate()} required/></div>
              <div style={{marginBottom:12}}>
                <label className="form-label">Time Slot *</label>
                <select className="select" value={f.appointmentTime} onChange={e=>s("appointmentTime",e.target.value)} required>
                  <option value="">Select time…</option>
                  {TIME_SLOTS.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1/-1",marginBottom:12}}><label className="form-label">Reason / Symptoms</label><textarea className="input" rows={2} value={f.reason} onChange={e=>s("reason",e.target.value)} placeholder="Briefly describe your symptoms or reason for visit…"/></div>
            </div>
            <div style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:10,fontSize:11,color:"var(--text-muted)",marginBottom:14}}>
              ℹ️ Appointment is subject to hospital confirmation. You will receive a call at your provided number.
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting?"Booking…":"📅 Confirm Booking"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Appointments management panel for hospital operator
export function AppointmentsPanel({ hospitalId }) {
  const [appointments, setApps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const load = async () => {
    try {
      const url = `/appointments/hospital/${hospitalId}${filter!=="all"?`?status=${filter}`:""}${dateFilter?`${filter!=="all"?"&":"?"}date=${dateFilter}`:""}`;
      const [a,s] = await Promise.all([api.get(url),api.get(`/appointments/hospital/${hospitalId}/stats`)]);
      setApps(a.data); setStats(s.data);
    } catch(e){ console.error(e); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); },[filter,dateFilter,hospitalId]);

  const updateStatus=async(id,status)=>{
    try{ await api.patch(`/appointments/${id}/status`,{status}); load(); }
    catch(e){ alert(e.message); }
  };

  const STATUS_C={Pending:"var(--yellow)",Confirmed:"var(--green)",Completed:"var(--accent)",Cancelled:"var(--red)",NoShow:"var(--text-muted)"};

  return (
    <div>
      {stats&&(
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",marginBottom:16}}>
          {[["📋","Total",stats.total,"var(--accent)"],["📅","Today",stats.today,"var(--green)"],["⏳","Pending",stats.pending,"var(--yellow)"],["✅","Confirmed",stats.confirmed,"var(--green)"],["✓","Completed",stats.completed,"var(--accent)"],["❌","Cancelled",stats.cancelled,"var(--red)"]].map(([i,l,v,c])=>(
            <div key={l} className="stat-card"><div className="stat-label">{i} {l}</div><div className="stat-value" style={{color:c,fontSize:22}}>{v||0}</div></div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4}}>
          {["all","Pending","Confirmed","Completed","Cancelled"].map(f=>(
            <button key={f} className={`tab-btn ${filter===f?"active":""}`} style={{padding:"5px 12px",fontSize:11}} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
        <input className="input" type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{width:160,fontSize:12}}/>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺</button>
      </div>
      {loading?<div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>:(
        appointments.length===0?<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>No appointments found</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {appointments.map(a=>(
              <div key={a._id} className="card card-sm" style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:48,height:48,borderRadius:"var(--radius-md)",background:"var(--bg-elevated)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--border)"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{new Date(a.appointmentDate).getDate()}</div>
                  <div style={{fontSize:9,color:"var(--text-muted)"}}>{new Date(a.appointmentDate).toLocaleString("en",{month:"short"})}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{a.patientName}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>{a.specialty} · {a.appointmentTime} · {a.patientGender}, {a.patientAge}y</div>
                  {a.reason&&<div style={{fontSize:11,color:"var(--text-secondary)",marginTop:2}}>{a.reason}</div>}
                  <div style={{fontSize:11,color:"var(--accent)",marginTop:2}}>📞 {a.patientPhone}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  <span style={{background:`${STATUS_C[a.status]||"#4e7090"}22`,color:STATUS_C[a.status]||"var(--text-muted)",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{a.status}</span>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {a.status==="Pending"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(a._id,"Confirmed")}>Confirm</button>}
                    {a.status==="Confirmed"&&<button className="btn btn-primary btn-sm" style={{fontSize:9}} onClick={()=>updateStatus(a._id,"Completed")}>Complete</button>}
                    {["Pending","Confirmed"].includes(a.status)&&<button className="btn btn-ghost btn-sm" style={{fontSize:9,color:"var(--red)"}} onClick={()=>updateStatus(a._id,"Cancelled")}>Cancel</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
