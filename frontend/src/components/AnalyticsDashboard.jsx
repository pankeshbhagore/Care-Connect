import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine
} from "recharts";
import api from "../services/api";
import socket from "../services/socket";

const COLORS = ["#00c8ff","#00e676","#ff8f00","#ff4060","#b388ff","#ffd600","#ff6b6b","#4ecdc4"];

function KpiCard({icon,label,value,sub,color="var(--accent)",trend}) {
  return(
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value" style={{color,fontSize:28}}>{value}</div>
      {sub&&<div className="stat-sub">{sub}</div>}
      {trend!=null&&<div style={{fontSize:10,color:trend>=0?"var(--green)":"var(--red)",marginTop:4,fontWeight:600}}>{trend>=0?"↑":"↓"} {Math.abs(trend)}%</div>}
    </div>
  );
}

function SectionTitle({children}) {
  return <div style={{fontFamily:"var(--font-display)",fontSize:13,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>{children}</div>;
}

const CustomTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 14px",boxShadow:"var(--shadow-md)",fontSize:12}}>
      <div style={{fontWeight:700,color:"var(--text-primary)",marginBottom:6}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color,marginBottom:2}}>{p.name}: <b>{typeof p.value==="number"?p.value.toFixed(1):p.value}</b></div>)}
    </div>
  );
};


function RegionWiseHospitals({ hospitals }) {
  const ALERT_C = {Red:"#ff4060",Orange:"#ff8f00",Yellow:"#ffd600",Normal:"#00e676"};
  const TIER_C  = {Tier1:"var(--green)",Tier2:"var(--accent)",Tier3:"var(--purple)"};
  
  // Group by region/district
  const groups = {};
  hospitals.forEach(h=>{
    const key = h.location?.district || h.location?.city || "Unknown";
    if(!groups[key]) groups[key]=[];
    groups[key].push(h);
  });
  const sorted = Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
  
  // City-wise stats for bar chart
  const cityStats = sorted.slice(0,12).map(([city,hs])=>({
    name: city.slice(0,14),
    hospitals: hs.length,
    icu: hs.reduce((s,h)=>s+(h.resources?.icuBeds?.available||0),0),
    beds: hs.reduce((s,h)=>s+(h.resources?.generalBeds?.available||0),0),
    critical: hs.filter(h=>h.alertLevel==="Red"||h.alertLevel==="Orange").length,
  }));

  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>📊 Available Resources by Region</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cityStats} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="name" tick={{fontSize:10,fill:"var(--text-muted)"}}/>
            <YAxis tick={{fontSize:10,fill:"var(--text-muted)"}} width={28}/>
            <Tooltip contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Bar dataKey="hospitals" name="Hospitals" fill="#00c8ff" radius={[3,3,0,0]}/>
            <Bar dataKey="icu"       name="ICU Beds"   fill="#00e676" radius={[3,3,0,0]}/>
            <Bar dataKey="critical"  name="Critical"   fill="#ff4060" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {sorted.map(([region, hs])=>{
        const totalICU   = hs.reduce((s,h)=>s+(h.resources?.icuBeds?.total||0),0);
        const availICU   = hs.reduce((s,h)=>s+(h.resources?.icuBeds?.available||0),0);
        const totalBeds  = hs.reduce((s,h)=>s+(h.resources?.generalBeds?.total||0),0);
        const availBeds  = hs.reduce((s,h)=>s+(h.resources?.generalBeds?.available||0),0);
        const avgTrust   = Math.round(hs.reduce((s,h)=>s+(h.trustScore||75),0)/hs.length);
        const redCount   = hs.filter(h=>h.alertLevel==="Red").length;
        const orangeCount= hs.filter(h=>h.alertLevel==="Orange").length;
        return(
          <div key={region} className="card" style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:16,color:"var(--text-primary)"}}>{region}</div>
                <div style={{fontSize:12,color:"var(--text-muted)"}}>{hs[0]?.location?.state||""} · {hs.length} hospital{hs.length!==1?"s":""}</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span className="badge badge-accent">ICU {availICU}/{totalICU}</span>
                <span className="badge badge-purple">Beds {availBeds}/{totalBeds}</span>
                {redCount>0&&<span className="badge badge-red">🔴 {redCount} Critical</span>}
                {orangeCount>0&&<span className="badge badge-orange">🟠 {orangeCount} High</span>}
                <span className="badge badge-muted">Trust {avgTrust}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:8}}>
              {hs.map(h=>{
                const r=h.resources||{};const ac=ALERT_C[h.alertLevel]||"#4e7090";const tc=TIER_C[h.tier]||"#8a8a8a";
                return(
                  <div key={h._id} style={{background:"var(--bg-elevated)",border:`1px solid ${ac}44`,borderRadius:"var(--radius-md)",padding:"10px 12px",borderLeft:`3px solid ${ac}`}}>
                    <div style={{fontFamily:"var(--font-display)",fontWeight:600,fontSize:12,color:"var(--text-primary)",marginBottom:3}}>{h.name?.slice(0,30)}</div>
                    <div style={{display:"flex",gap:5,marginBottom:5}}>
                      <span style={{background:`${ac}22`,color:ac,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700}}>{h.alertLevel}</span>
                      <span style={{background:`${tc}22`,color:tc,padding:"1px 6px",borderRadius:3,fontSize:9}}>{h.tier}</span>
                      <span className={`badge ${h.status==="Active"?"badge-green":h.status==="Overwhelmed"?"badge-red":"badge-muted"}`} style={{fontSize:9}}>{h.status}</span>
                    </div>
                    <div style={{display:"flex",gap:8,fontSize:11,color:"var(--text-muted)"}}>
                      <span>ICU <b style={{color:(r.icuBeds?.available||0)===0?"var(--red)":"var(--text-primary)"}}>{r.icuBeds?.available||0}/{r.icuBeds?.total||0}</b></span>
                      <span>O₂ <b style={{color:(r.oxygenLevel||100)<30?"var(--red)":"var(--green)"}}>{r.oxygenLevel||100}%</b></span>
                      <span>Docs <b>{r.doctorsOnDuty||0}</b></span>
                    </div>
                    {h.location?.address&&<div style={{fontSize:9,color:"var(--text-dim)",marginTop:3}}>📍 {h.location.address.slice(0,40)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [summary,    setSummary]    = useState(null);
  const [cityHealth, setCityHealth] = useState(null);
  const [predictions,setPredictions]= useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [transfers,  setTransfers]  = useState([]);
  const [emergencies,setEmergencies]= useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("overview");
  const [aiRecs,     setAiRecs]     = useState([]);

  const load = useCallback(async()=>{
    try{
      const [s,c,p,a,t,e,h]=await Promise.all([
        api.get("/hospitals/summary"),api.get("/predictions/city-health"),api.get("/predictions/icu-demand"),
        api.get("/hospitals/alerts"),api.get("/transfers/stats"),api.get("/emergencies"),api.get("/hospitals"),
      ]);
      setSummary(s.data);setCityHealth(c.data);setPredictions(p.data);
      setAlerts(a.data);setTransfers(t.data);setEmergencies(e.data);setHospitals(h.data);
      buildAIRecs(s.data,c.data,p.data,a.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  const buildAIRecs=(sum,city,preds,alerts)=>{
    const r=[];
    if(!sum||!city) return;
    if((city.icuPressure||0)>=90){r.push({sev:"Critical",title:"Critical ICU Pressure",msg:`System-wide ICU at ${city.icuPressure}%. ${city.criticalHospitals} hospitals critical. Immediate redistribution required.`,action:"Activate emergency transfer protocol"});}
    else if((city.icuPressure||0)>=75){r.push({sev:"High",title:"High ICU Pressure",msg:`ICU at ${city.icuPressure}%. Pre-emptive transfers recommended.`,action:"Start proactive patient redistribution"});}
    if((alerts?.length||0)>=5){r.push({sev:"High",title:`${alerts.length} Active Resource Alerts`,msg:`Multiple hospitals reporting shortages.`,action:"Dispatch resource coordination team"});}
    if((sum.oxyLow||0)>0){r.push({sev:"Critical",title:`${sum.oxyLow} Hospital(s) Low Oxygen`,msg:"Oxygen supply critically low. Ventilator failure risk.",action:"Emergency oxygen resupply order"});}
    const ambAvail=sum.ambulances?.available||0,ambTotal=sum.ambulances?.total||1;
    if(ambAvail/ambTotal<0.3){r.push({sev:"High",title:"Low Ambulance Availability",msg:`Only ${ambAvail}/${ambTotal} ambulances available.`,action:"Call in off-duty crews"});}
    if((sum.overwhelmed||0)>0){r.push({sev:"Critical",title:`${sum.overwhelmed} Hospital(s) Overwhelmed`,msg:"Cannot accept new patients.",action:"Activate hospital diversion"});}
    if((city.healthScore||100)<40){r.push({sev:"Critical",title:"City Health Index Critical",msg:`Score: ${city.healthScore}/100. Immediate government intervention needed.`,action:"Activate Emergency Operations Center"});}
    if(r.length===0){r.push({sev:"Low",title:"System Status Normal",msg:`All parameters normal. City health: ${city.healthScore}/100.`,action:"Continue routine monitoring"});}
    setAiRecs(r);
  };

  useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t);},[load]);
  useEffect(()=>{ socket.on("cityHealthUpdate",d=>{setCityHealth(d);load();}); return()=>socket.off("cityHealthUpdate"); },[load]);

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading analytics…</div>;

  // ── Chart data ─────────────────────────────────────────────
  const ALERT_C={Red:"#ff4060",Orange:"#ff8f00",Yellow:"#ffd600",Normal:"#00e676"};
  const hospAlertChart=[
    {name:"Red",count:summary?.alertBreakdown?.Red||0,fill:"#ff4060"},
    {name:"Orange",count:summary?.alertBreakdown?.Orange||0,fill:"#ff8f00"},
    {name:"Yellow",count:summary?.alertBreakdown?.Yellow||0,fill:"#ffd600"},
    {name:"Normal",count:summary?.alertBreakdown?.Normal||0,fill:"#00e676"},
  ];
  const icuByHosp = predictions.slice(0,12).map(p=>({
    name:p.hospitalName.replace(/Hospital|Medical|District|Government/gi,"").trim().slice(0,14),
    icu:p.icuUtilization,
    fill:p.icuUtilization>=90?"#ff4060":p.icuUtilization>=75?"#ff8f00":p.icuUtilization>=50?"#ffd600":"#00e676",
  }));
  const transferChart=[
    {name:"Requested",value:transfers.pending||0,fill:"#ffd600"},
    {name:"In Transit",value:transfers.inTransit||0,fill:"#ff8f00"},
    {name:"Completed",value:transfers.completed||0,fill:"#00e676"},
    {name:"Critical",value:transfers.critical||0,fill:"#ff4060"},
  ].filter(d=>d.value>0);
  const radarData=[
    {metric:"ICU Capacity",value:Math.max(0,100-(cityHealth?.icuPressure||0))},
    {metric:"Bed Avail",value:Math.max(0,100-(cityHealth?.bedPressure||0))},
    {metric:"Ambulances",value:Math.round((summary?.ambulances?.available||0)/Math.max(1,summary?.ambulances?.total||1)*100)},
    {metric:"Oxygen",value:100-(summary?.oxyLow||0)*10},
    {metric:"Alert Ctrl",value:Math.max(0,100-(cityHealth?.activeAlerts||0)*5)},
    {metric:"Transfer Flow",value:Math.max(0,100-(cityHealth?.transfersToday||0)*2)},
  ];
  // Resource comparison scatter data
  const scatterData = hospitals.map(h=>({
    name:h.name?.slice(0,12),
    icu:Math.round(((h.resources?.icuBeds?.total||0)-(h.resources?.icuBeds?.available||0))/(h.resources?.icuBeds?.total||1)*100),
    beds:Math.round(((h.resources?.generalBeds?.total||0)-(h.resources?.generalBeds?.available||0))/(h.resources?.generalBeds?.total||1)*100),
    size:h.resources?.icuBeds?.total||10,
  }));
  const emgByType = emergencies.reduce((acc,e)=>{ acc[e.type]=(acc[e.type]||0)+1; return acc; },{});
  const emgTypeChart = Object.entries(emgByType).map(([k,v])=>({name:k,value:v}));
  const emgBySev = {Critical:0,High:0,Medium:0,Low:0};
  emergencies.forEach(e=>{ if(emgBySev[e.severity]!==undefined) emgBySev[e.severity]++; });
  const sevChart=[
    {name:"Critical",value:emgBySev.Critical,fill:"#ff4060"},
    {name:"High",value:emgBySev.High,fill:"#ff8f00"},
    {name:"Medium",value:emgBySev.Medium,fill:"#ffd600"},
    {name:"Low",value:emgBySev.Low,fill:"#00e676"},
  ].filter(d=>d.value>0);
  const sc=s=>s>70?"var(--green)":s>40?"var(--orange)":"var(--red)";
  const critCount=aiRecs.filter(r=>r.sev==="Critical").length;

  return(
    <div>
      {critCount>0&&(
        <div style={{background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:"var(--radius-md)",padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🚨</span>
          <div><div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"var(--red)",fontSize:14}}>{critCount} CRITICAL ISSUES</div><div style={{fontSize:11,color:"var(--text-secondary)"}}>AI detected critical situations requiring immediate attention</div></div>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto",color:"var(--red)",borderColor:"var(--red)"}} onClick={()=>setTab("ai")}>View AI Analysis →</button>
        </div>
      )}

      <div className="tab-bar mb-20" style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {[["overview","📊 Overview"],["region","📍 Region-wise"],["hospitals","🏥 Hospitals"],["operations","⚡ Operations"],["emergency","🚨 Emergency"]].map(([id,lbl])=>(
          <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────── */}
      {tab==="overview"&&(
        <>
          <div className="stat-grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",marginBottom:24}}>
            <KpiCard icon="🏥" label="Total Hospitals" value={summary?.total||0} sub={`${summary?.active||0} active`} color="var(--accent)"/>
            <KpiCard icon="🛏" label="ICU Available" value={summary?.icuBeds?.available||0} sub={`${summary?.icuBeds?.utilization||0}% utilized`} color={(summary?.icuBeds?.utilization||0)>80?"var(--red)":"var(--accent)"}/>
            <KpiCard icon="🏨" label="General Beds" value={summary?.generalBeds?.available||0} sub={`${summary?.generalBeds?.utilization||0}% utilized`} color="var(--purple)"/>
            <KpiCard icon="💨" label="Ventilators" value={summary?.ventilators?.available||0} sub={`of ${summary?.ventilators?.total||0}`} color="var(--green)"/>
            <KpiCard icon="🚑" label="Ambulances" value={summary?.ambulances?.available||0} sub={`of ${summary?.ambulances?.total||0} fleet`} color="var(--orange)"/>
            <KpiCard icon="⚠️" label="Active Alerts" value={cityHealth?.activeAlerts||0} color={(cityHealth?.activeAlerts||0)>0?"var(--red)":"var(--green)"}/>
            <KpiCard icon="🔄" label="Transfers Today" value={cityHealth?.transfersToday||0} color="var(--yellow)"/>
            <KpiCard icon="🚨" label="Emergencies" value={cityHealth?.emergenciesToday||0} color="var(--red)"/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
  


            {/* Alert distribution */}
            <div className="card">
              <SectionTitle>🏥 Hospital Alert Levels</SectionTitle>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={hospAlertChart} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text-muted)"}}/>
                  <YAxis tick={{fontSize:10,fill:"var(--text-muted)"}} width={24}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>{hospAlertChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ICU utilization by hospital - horizontal bar */}
          <div className="card" style={{marginBottom:20}}>
            <SectionTitle>🛏 ICU Utilization by Hospital</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(240,icuByHosp.length*22)}>
              <BarChart data={icuByHosp} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis type="number" domain={[0,100]} tick={{fontSize:10,fill:"var(--text-muted)"}} tickFormatter={v=>`${v}%`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:"var(--text-muted)"}} width={110}/>
                <Tooltip content={<CustomTooltip/>} formatter={v=>`${v}%`}/>
                <ReferenceLine x={75} stroke="var(--yellow)" strokeDasharray="4 2" label={{value:"75%",fill:"var(--yellow)",fontSize:10}}/>
                <ReferenceLine x={90} stroke="var(--red)" strokeDasharray="4 2" label={{value:"90%",fill:"var(--red)",fontSize:10}}/>
                <Bar dataKey="icu" radius={[0,4,4,0]}>{icuByHosp.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── REGION-WISE ──────────────────────────────────── */}
      {tab==="region"&&(
        <RegionWiseHospitals hospitals={hospitals}/>
      )}

      {/* ── HOSPITALS ──────────────────────────────────── */}
      {tab==="hospitals"&&(
        <>
          {/* Resource scatter plot - ICU vs Bed utilization */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div className="card">
              <SectionTitle>📈 ICU vs Bed Utilization (All Hospitals)</SectionTitle>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis type="number" dataKey="icu" name="ICU Util%" domain={[0,100]} tick={{fontSize:10,fill:"var(--text-muted)"}} label={{value:"ICU %",fill:"var(--text-muted)",fontSize:10,dy:14}}/>
                  <YAxis type="number" dataKey="beds" name="Bed Util%" domain={[0,100]} tick={{fontSize:10,fill:"var(--text-muted)"}} label={{value:"Bed %",fill:"var(--text-muted)",fontSize:10,angle:-90,dx:-14}}/>
                  <Tooltip cursor={{strokeDasharray:"3 3"}} contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                  <ReferenceLine x={75} stroke="var(--yellow)" strokeDasharray="4 2"/>
                  <ReferenceLine y={75} stroke="var(--yellow)" strokeDasharray="4 2"/>
                  <Scatter data={scatterData} fill="var(--accent)" fillOpacity={0.7} name="Hospital"/>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <SectionTitle>⚠️ Active Resource Alerts</SectionTitle>
              <div style={{maxHeight:260,overflowY:"auto"}}>
                {alerts.length===0?<div style={{textAlign:"center",padding:60,color:"var(--green)"}}>✅ No active alerts</div>:
                  alerts.slice(0,10).map(a=>(
                    <div key={a._id} className="card card-sm" style={{marginBottom:8,borderLeft:`2px solid ${a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}`}}>
                      <div style={{fontWeight:700,fontSize:12}}>{a.alertType}</div>
                      <div style={{fontSize:11,color:"var(--text-secondary)"}}>{a.message}</div>
                      <div style={{fontSize:10,color:"var(--text-dim)",marginTop:2}}>{a.hospital?.name} · {new Date(a.createdAt).toLocaleTimeString()}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Hospital comparison table */}
          <div className="card">
            <SectionTitle>📋 Hospital Resource Comparison Table</SectionTitle>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"var(--bg-elevated)"}}>
                  {["Hospital","City","Alert","ICU","Beds","Vents","O₂%","Docs","Trust","Status"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {hospitals.map(h=>{
                    const r=h.resources||{};const ac=ALERT_C[h.alertLevel]||"#4e7090";
                    return(
                      <tr key={h._id} style={{borderBottom:"1px solid var(--border)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"8px 10px",fontWeight:600,color:"var(--text-primary)",maxWidth:160}}>{h.name?.slice(0,24)}</td>
                        <td style={{padding:"8px 10px",color:"var(--text-muted)",fontSize:11}}>{h.location?.city}</td>
                        <td style={{padding:"8px 10px"}}><span style={{background:`${ac}22`,color:ac,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>{h.alertLevel}</span></td>
                        <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)",color:(r.icuBeds?.available||0)===0?"var(--red)":"var(--text-primary)",fontWeight:600}}>{r.icuBeds?.available||0}/{r.icuBeds?.total||0}</td>
                        <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)"}}>{r.generalBeds?.available||0}/{r.generalBeds?.total||0}</td>
                        <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)"}}>{r.ventilators?.available||0}/{r.ventilators?.total||0}</td>
                        <td style={{padding:"8px 10px",fontFamily:"var(--font-mono)",color:(r.oxygenLevel||0)<30?"var(--red)":(r.oxygenLevel||0)<50?"var(--orange)":"var(--green)",fontWeight:600}}>{r.oxygenLevel||0}%</td>
                        <td style={{padding:"8px 10px"}}>{r.doctorsOnDuty||0}</td>
                        <td style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <div style={{width:36,height:4,background:"var(--bg-primary)",borderRadius:2}}>
                              <div style={{width:`${h.trustScore||75}%`,height:"100%",background:(h.trustScore||75)>80?"var(--green)":(h.trustScore||75)>60?"var(--orange)":"var(--red)",borderRadius:2}}/>
                            </div>
                            <span style={{fontSize:10,fontFamily:"var(--font-mono)"}}>{h.trustScore||75}</span>
                          </div>
                        </td>
                        <td style={{padding:"8px 10px"}}><span className={`badge ${h.status==="Active"?"badge-green":h.status==="Overwhelmed"?"badge-red":"badge-muted"}`}>{h.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── OPERATIONS ──────────────────────────────────── */}
      {tab==="operations"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            {/* Transfers */}
            <div className="card">
              <SectionTitle>🚑 Transfer Status Distribution</SectionTitle>
              {transferChart.length>0?(
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={transferChart} cx="50%" cy="50%" outerRadius={85} innerRadius={45} dataKey="value" label={({name,value})=>`${name}:${value}`} labelLine={false}>
                      {transferChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              ):<div style={{textAlign:"center",padding:60,color:"var(--text-muted)"}}>No transfers today</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}}>
                {[["Total",transfers.total,"var(--accent)"],["Today",transfers.today,"var(--green)"],["Critical",transfers.critical,"var(--red)"]].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:"center",background:"var(--bg-elevated)",borderRadius:"var(--radius-sm)",padding:"8px"}}>
                    <div style={{fontSize:10,color:"var(--text-muted)"}}>{l}</div>
                    <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700,color:c}}>{v||0}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ICU forecast */}
            <div className="card">
              <SectionTitle>🔮 ICU Demand Forecast</SectionTitle>
              <div style={{maxHeight:300,overflowY:"auto"}}>
                {predictions.slice(0,8).map(p=>(
                  <div key={p.hospitalId} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                      <span style={{color:"var(--text-primary)",fontWeight:600}}>{p.hospitalName?.slice(0,22)}</span>
                      <span className={`badge ${p.riskLevel==="Critical"?"badge-red":p.riskLevel==="High"?"badge-orange":p.riskLevel==="Medium"?"badge-yellow":"badge-green"}`} style={{fontSize:9}}>{p.riskLevel}</span>
                    </div>
                    <div style={{height:5,background:"var(--bg-primary)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${p.icuUtilization}%`,height:"100%",background:p.icuUtilization>=90?"var(--red)":p.icuUtilization>=75?"var(--orange)":"var(--green)",borderRadius:3,transition:"width .5s"}}/>
                    </div>
                    <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{p.icuUtilization}%{p.hoursToCapacity?` · ~${p.hoursToCapacity}h to full`:""}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EMERGENCY ───────────────────────────────────── */}
      {tab==="emergency"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
            <div className="stat-card"><div className="stat-label">🚨 Total</div><div className="stat-value" style={{color:"var(--accent)",fontSize:28}}>{emergencies.length}</div></div>
            <div className="stat-card"><div className="stat-label">🔴 Critical</div><div className="stat-value" style={{color:"var(--red)",fontSize:28}}>{emergencies.filter(e=>e.severity==="Critical").length}</div></div>
            <div className="stat-card"><div className="stat-label">✅ Resolved</div><div className="stat-value" style={{color:"var(--green)",fontSize:28}}>{emergencies.filter(e=>e.status==="Resolved").length}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            {/* Emergency by type */}
            {emgTypeChart.length>0&&(
              <div className="card">
                <SectionTitle>🚨 Emergency Types</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={emgTypeChart} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:"var(--text-muted)"}}/>
                    <YAxis tick={{fontSize:10,fill:"var(--text-muted)"}} width={24}/>
                    <Tooltip contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                    <Bar dataKey="value" fill="var(--accent)" radius={[4,4,0,0]}>
                      {emgTypeChart.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Emergency by severity */}
            {sevChart.length>0&&(
              <div className="card">
                <SectionTitle>🔴 Severity Distribution</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={sevChart} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value">
                      {sevChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
                    <Legend iconType="circle" wrapperStyle={{fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Recent emergencies table */}
          <div className="card">
            <SectionTitle>📋 Recent Emergency Requests</SectionTitle>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"var(--bg-elevated)"}}>
                  {["ID","Type","Severity","Patient","Location","Hospital","Status","Time","Response"].map(h=>(
                    <th key={h} style={{padding:"7px 10px",textAlign:"left",fontFamily:"var(--font-display)",fontSize:10,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {emergencies.slice(0,20).map(e=>{
                    const sc={Critical:"#ff4060",High:"#ff8f00",Medium:"#ffd600",Low:"#00e676"};
                    return(
                      <tr key={e._id} style={{borderBottom:"1px solid var(--border)"}} onMouseEnter={ev=>ev.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={ev=>ev.currentTarget.style.background=""}>
                        <td style={{padding:"7px 10px",fontFamily:"var(--font-mono)",fontSize:10,color:"var(--text-muted)"}}>{e.requestId}</td>
                        <td style={{padding:"7px 10px"}}>{e.type}</td>
                        <td style={{padding:"7px 10px"}}><span style={{background:`${sc[e.severity]||"#4e7090"}22`,color:sc[e.severity]||"#4e7090",padding:"1px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>{e.severity}</span></td>
                        <td style={{padding:"7px 10px",color:"var(--text-secondary)"}}>{e.patientName}</td>
                        <td style={{padding:"7px 10px",fontSize:11,color:"var(--text-muted)",maxWidth:120}}>{(e.location?.locationName||e.location?.address||"—").slice(0,20)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,color:"var(--text-muted)"}}>{e.assignedHospital?.name?.slice(0,18)||"—"}</td>
                        <td style={{padding:"7px 10px"}}><span className={`badge ${e.status==="Resolved"?"badge-green":e.status==="Cancelled"?"badge-muted":"badge-orange"}`}>{e.status}</span></td>
                        <td style={{padding:"7px 10px",fontSize:10,color:"var(--text-dim)"}}>{new Date(e.createdAt).toLocaleTimeString()}</td>
                        <td style={{padding:"7px 10px",fontFamily:"var(--font-mono)",fontSize:10,color:e.responseTimeMinutes>0?"var(--green)":"var(--text-dim)"}}>{e.responseTimeMinutes>0?`${e.responseTimeMinutes}m`:"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}