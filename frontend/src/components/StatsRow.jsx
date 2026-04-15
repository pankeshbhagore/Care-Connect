/**
 * StatsRow — 7 live KPI cards
 * Adapted from reference project for our dark-theme CSS variables
 */
export default function StatsRow({ hospitals = [], emergencies = [] }) {
  const totalHospitals  = hospitals.length;
  const icuAvailable    = hospitals.reduce((s,h)=>s+(h.resources?.icuBeds?.available||0),0);
  const icuTotal        = hospitals.reduce((s,h)=>s+(h.resources?.icuBeds?.total||0),0);
  const ventsAvailable  = hospitals.reduce((s,h)=>s+(h.resources?.ventilators?.available||0),0);
  const ambulances      = hospitals.reduce((s,h)=>s+(h.resources?.ambulancesAvailable||0),0);
  const doctors         = hospitals.reduce((s,h)=>s+(h.resources?.doctorsOnDuty||0),0);
  const oxygenBeds      = hospitals.reduce((s,h)=>s+(h.resources?.oxygenBeds?.available||0),0);
  const activeEmg       = emergencies.filter(e=>!["Resolved","Cancelled"].includes(e.status)).length;
  const redAlert        = hospitals.filter(h=>h.alertLevel==="Red").length;

  const stats = [
    { label:"ACTIVE EMERGENCIES", value:activeEmg, icon:"🚨", color:"var(--red)",    sub: redAlert>0?`${redAlert} Red Alert`:"All clear" },
    { label:"ICU AVAILABLE",       value:icuAvailable, icon:"🛏", color:"var(--accent)", sub:`of ${icuTotal} total` },
    { label:"VENTILATORS",         value:ventsAvailable,icon:"💨",color:"var(--accent)", sub:"available" },
    { label:"AMBULANCES",          value:ambulances,   icon:"🚑", color:"var(--green)",  sub:"available" },
    { label:"ER DOCTORS",          value:doctors,      icon:"⚕",  color:"var(--yellow)", sub:"on duty" },
    { label:"OXYGEN BEDS",         value:oxygenBeds,   icon:"💧", color:"var(--accent)", sub:"available" },
    { label:"HOSPITALS",           value:totalHospitals,icon:"🏥",color:"var(--purple)",  sub:"in network" },
  ];

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
      {stats.map(s=>(
        <div key={s.label} className="stat-card" style={{padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
            <span style={{fontSize:14}}>{s.icon}</span>
            <span style={{fontSize:9,fontFamily:"var(--font-mono)",color:"var(--text-muted)",letterSpacing:"0.05em",textTransform:"uppercase",fontWeight:600}}>{s.label}</span>
          </div>
          <div style={{fontFamily:"var(--font-display)",fontSize:28,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
          {s.sub&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}
