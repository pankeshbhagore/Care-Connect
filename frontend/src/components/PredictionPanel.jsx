import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import api from "../services/api";
import socket from "../services/socket";

const RISK_BADGE={Critical:"badge-red",High:"badge-orange",Medium:"badge-yellow",Low:"badge-green"};
const RISK_COLOR={Critical:"var(--red)",High:"var(--orange)",Medium:"var(--yellow)",Low:"var(--green)"};

function ScoreGauge({ score, size=110 }) {
  const color = score>70?"var(--green)":score>40?"var(--orange)":"var(--red)";
  const r=size*0.4, circ=Math.PI*r, dash=(score/100)*circ;
  return(
    <div style={{textAlign:"center",display:"inline-flex",flexDirection:"column",alignItems:"center"}}>
      <svg width={size} height={size*0.6} viewBox={`0 0 ${size} ${size*0.6}`}>
        <path d={`M ${size*.1} ${size*.55} A ${r} ${r} 0 0 1 ${size*.9} ${size*.55}`} fill="none" stroke="var(--border)" strokeWidth={8} strokeLinecap="round"/>
        <path d={`M ${size*.1} ${size*.55} A ${r} ${r} 0 0 1 ${size*.9} ${size*.55}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{transition:"stroke-dasharray .8s"}}/>
      </svg>
      <div style={{fontFamily:"var(--font-display)",fontWeight:900,fontSize:size*0.28,color,marginTop:-(size*0.12)}}>{score}</div>
    </div>
  );
}

export default function PredictionPanel() {
  const [predictions,setPredictions]=useState([]);
  const [cityHealth,setCityHealth]=useState(null);
  const [alerts,setAlerts]=useState([]);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    try{
      const [p,c,a]=await Promise.all([api.get("/predictions/icu-demand"),api.get("/predictions/city-health"),api.get("/hospitals/alerts")]);
      setPredictions(p.data);setCityHealth(c.data);setAlerts(a.data);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{ load(); const t=setInterval(load,60000); return()=>clearInterval(t); },[load]);
  useEffect(()=>{
    socket.on("cityHealthUpdate",d=>setCityHealth(d));
    socket.on("resourceAlert",()=>load());
    return()=>{ socket.off("cityHealthUpdate"); socket.off("resourceAlert"); };
  },[load]);

  const resolveAlert=async id=>{
    try{ await api.patch(`/hospitals/alerts/${id}/resolve`); load(); }
    catch(e){ alert(e.message); }
  };

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading forecasts…</div>;

  const hc=cityHealth;
  const scoreColor=s=>s>70?"var(--green)":s>40?"var(--orange)":"var(--red)";
  const chartData=predictions.slice(0,10).map(p=>({
    name:p.hospitalName.replace(/Hospital|Medical|District|Government/gi,"").trim().slice(0,15),
    util:p.icuUtilization,
    fill:p.icuUtilization>=90?"#ff4060":p.icuUtilization>=75?"#ff8f00":p.icuUtilization>=50?"#ffd600":"#00e676"
  }));

  return(
    <div>
      {/* City Health Overview */}
      {hc&&(
        <div className="card" style={{marginBottom:20,background:"linear-gradient(135deg,var(--bg-card),var(--bg-elevated))"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:20}}>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,color:"var(--text-muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>City Health Score</div>
              <ScoreGauge score={hc.healthScore||0}/>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8,textAlign:"center"}}>
                {(hc.healthScore||0)>70?"✅ System Healthy":(hc.healthScore||0)>40?"⚠️ Moderate Pressure":"🔴 Critical Load"}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["ICU Pressure",`${hc.icuPressure||0}%`,hc.icuPressure>=75?"var(--red)":"var(--accent)"],
                ["Bed Pressure",`${hc.bedPressure||0}%`,hc.bedPressure>=75?"var(--red)":"var(--purple)"],
                ["Active Alerts",hc.activeAlerts||0,(hc.activeAlerts||0)>0?"var(--red)":"var(--green)"],
                ["Transfers Today",hc.transfersToday||0,"var(--orange)"],
                ["Emergencies",hc.emergenciesToday||0,"var(--yellow)"],
                ["Critical Hospitals",hc.criticalHospitals||0,(hc.criticalHospitals||0)>0?"var(--red)":"var(--green)"],
              ].map(([l,v,c])=>(
                <div key={l} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px 14px",minWidth:100}}>
                  <div style={{fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{l}</div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignSelf:"flex-start"}}>
              <span className="badge badge-muted">🏥 {hc.totalHospitals||0} Hospitals</span>
              {(hc.overwhelmed||0)>0&&<span className="badge badge-red">🔴 {hc.overwhelmed} Overwhelmed</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {/* ICU chart */}
        <div className="card">
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>📊 ICU Utilization by Hospital</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis type="number" domain={[0,100]} tick={{fontSize:10,fill:"var(--text-muted)"}} tickFormatter={v=>`${v}%`}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:"var(--text-muted)"}} width={100}/>
              <Tooltip formatter={v=>`${v}%`} contentStyle={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
              <Bar dataKey="util" radius={[0,4,4,0]}>
                {chartData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Alerts */}
        <div className="card">
          <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>🔔 Active Alerts ({alerts.length})</div>
          {alerts.length===0?(
            <div style={{textAlign:"center",padding:50}}>
              <div style={{fontSize:36,marginBottom:10}}>✅</div>
              <div style={{color:"var(--green)",fontFamily:"var(--font-display)"}}>No Active Alerts</div>
            </div>
          ):(
            <div style={{maxHeight:230,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
              {alerts.map(a=>(
                <div key={a._id} className="card card-sm" style={{borderLeft:`3px solid ${a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}`,display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:12,color:a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)",marginBottom:2}}>{a.alertType} — {a.resource}</div>
                    <div style={{fontSize:12,color:"var(--text-secondary)"}}>{a.message}</div>
                    <div style={{fontSize:10,color:"var(--text-dim)",marginTop:3}}>
                      <span className={`badge ${RISK_BADGE[a.severity]||"badge-muted"}`} style={{marginRight:8}}>{a.severity}</span>
                      {a.hospital?.name} · {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{fontSize:10,whiteSpace:"nowrap"}} onClick={()=>resolveAlert(a._id)}>✓ Resolve</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ICU Demand Forecast list */}
      <div className="card">
        <div style={{fontFamily:"var(--font-display)",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>🔮 Per-Hospital ICU Demand Forecast &amp; AI Recommendation</div>
        {predictions.map(p=>(
          <div key={p.hospitalId} className="card card-sm" style={{marginBottom:10,borderLeft:`2px solid ${RISK_COLOR[p.riskLevel]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:2}}>{p.hospitalName}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:5}}>{p.city}</div>
                <div style={{height:5,background:"var(--bg-primary)",borderRadius:3,overflow:"hidden",marginBottom:5}}>
                  <div style={{width:`${p.icuUtilization}%`,height:"100%",background:p.icuUtilization>=90?"var(--red)":p.icuUtilization>=75?"var(--orange)":"var(--green)",borderRadius:3,transition:"width .5s"}}/>
                </div>
                <div style={{fontSize:11,color:"var(--text-secondary)",lineHeight:1.5}}>🤖 {p.recommendation}</div>
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <span className={`badge ${RISK_BADGE[p.oxygenRisk]||"badge-muted"}`} style={{fontSize:9}}>O₂ {p.oxygenRisk}</span>
                  <span className={`badge ${RISK_BADGE[p.ventRisk]||"badge-muted"}`} style={{fontSize:9}}>Vent {p.ventRisk}</span>
                  <span className="badge badge-muted" style={{fontSize:9}}>{p.alertLevel}</span>
                </div>
              </div>
              <div style={{textAlign:"right",minWidth:100}}>
                <span className={`badge ${RISK_BADGE[p.riskLevel]||"badge-muted"}`}>{p.riskLevel}</span>
                <div style={{fontFamily:"var(--font-mono)",fontSize:18,marginTop:5,color:RISK_COLOR[p.riskLevel]}}>{p.icuUtilization}%</div>
                {p.hoursToCapacity&&<div style={{fontSize:10,color:"var(--orange)",marginTop:2}}>~{p.hoursToCapacity}h to full</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
