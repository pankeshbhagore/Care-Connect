import { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket";

const RISK_BADGE = { Critical:"badge-red", High:"badge-orange", Medium:"badge-yellow", Low:"badge-green" };
const RISK_COLOR = { Critical:"var(--red)", High:"var(--orange)", Medium:"var(--yellow)", Low:"var(--green)" };

function ScoreGauge({ score }) {
  const color = score>70?"var(--green)":score>40?"var(--yellow)":"var(--red)";
  const pct   = score;
  return (
    <div style={{ position:"relative", display:"inline-flex", flexDirection:"column", alignItems:"center" }}>
      <svg width={120} height={70} viewBox="0 0 120 70">
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="var(--border)" strokeWidth={10} strokeLinecap="round"/>
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${(pct/100)*157} 157`} style={{transition:"stroke-dasharray .8s"}}/>
      </svg>
      <div style={{ position:"absolute", bottom:0, fontFamily:"var(--font-display)", fontSize:26, fontWeight:900, color }}>{score}</div>
    </div>
  );
}

export default function PredictionPanel() {
  const [predictions,setPredictions]=useState([]);
  const [cityHealth,setCityHealth]=useState(null);
  const [alerts,setAlerts]=useState([]);
  const [loading,setLoading]=useState(true);

  const load=async()=>{
    try {
      const [p,c,a]=await Promise.all([
        api.get("/predictions/icu-demand"),
        api.get("/predictions/city-health"),
        api.get("/hospitals/alerts"),
      ]);
      setPredictions(p.data); setCityHealth(c.data); setAlerts(a.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); const t=setInterval(load,60000); return()=>clearInterval(t); },[]);
  useEffect(()=>{
    socket.on("cityHealthUpdate", d=>setCityHealth(d));
    socket.on("resourceAlert",()=>load());
    return()=>{ socket.off("cityHealthUpdate"); socket.off("resourceAlert"); };
  },[]);

  const resolveAlert=async(id)=>{
    try { await api.patch(`/hospitals/alerts/${id}/resolve`); load(); }
    catch(e){ alert(e.message); }
  };

  if(loading) return <div style={{textAlign:"center",padding:80,color:"var(--text-muted)"}}>Loading forecasts…</div>;

  return (
    <div>
      {/* City Health Card */}
      {cityHealth&&(
        <div className="card" style={{marginBottom:20,background:"linear-gradient(135deg,var(--bg-card),var(--bg-elevated))"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:20}}>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontSize:11,color:"var(--text-muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>City Health Score</div>
              <ScoreGauge score={cityHealth.healthScore}/>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>
                {cityHealth.healthScore>70?"✅ System healthy":cityHealth.healthScore>40?"⚠️ Moderate pressure":"🔴 Critical load"}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                ["ICU Pressure",`${cityHealth.icuPressure}%`,"var(--accent)"],
                ["Bed Pressure",`${cityHealth.bedPressure}%`,"var(--purple)"],
                ["Active Alerts",cityHealth.activeAlerts,"var(--red)"],
                ["Transfers Today",cityHealth.transfersToday,"var(--orange)"],
                ["Emergencies Today",cityHealth.emergenciesToday,"var(--yellow)"],
                ["Critical Hospitals",cityHealth.criticalHospitals,"var(--red)"],
              ].map(([l,v,c])=>(
                <div key={l} style={{background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"10px 14px",minWidth:110}}>
                  <div style={{fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{l}</div>
                  <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignSelf:"flex-start"}}>
              <span className="badge badge-muted">🏥 {cityHealth.totalHospitals} Hospitals</span>
              {cityHealth.overwhelmed>0&&<span className="badge badge-red">🔴 {cityHealth.overwhelmed} Overwhelmed</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        {/* ICU Demand Forecast */}
        <div>
          <div style={{fontFamily:"var(--font-display)",fontSize:13,fontWeight:700,color:"var(--text-secondary)",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>🔮 ICU Demand Forecast</div>
          {predictions.map(p=>(
            <div key={p.hospitalId} className="card card-sm" style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"var(--font-display)",fontWeight:700,fontSize:13,color:"var(--text-primary)",marginBottom:2}}>{p.hospitalName}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:5}}>{p.city}</div>
                  <div style={{height:5,background:"var(--bg-primary)",borderRadius:3,marginBottom:5,overflow:"hidden"}}>
                    <div style={{width:`${p.icuUtilization}%`,height:"100%",background:p.icuUtilization>=90?"var(--red)":p.icuUtilization>=75?"var(--orange)":"var(--green)",borderRadius:3,transition:"width .5s"}}/>
                  </div>
                  <div style={{fontSize:11,color:"var(--text-secondary)",lineHeight:1.4}}>{p.recommendation}</div>
                </div>
                <div style={{textAlign:"right",minWidth:100}}>
                  <span className={`badge ${RISK_BADGE[p.riskLevel]||"badge-muted"}`}>{p.riskLevel}</span>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:13,marginTop:5,color:"var(--text-secondary)"}}>{p.icuUtilization}%</div>
                  {p.hoursToCapacity&&<div style={{fontSize:10,color:"var(--orange)",marginTop:2}}>~{p.hoursToCapacity}h to full</div>}
                  <div style={{display:"flex",gap:4,justifyContent:"flex-end",marginTop:5,flexWrap:"wrap"}}>
                    <span className={`badge ${RISK_BADGE[p.oxygenRisk]||"badge-muted"}`} style={{fontSize:9}}>O₂ {p.oxygenRisk}</span>
                    <span className={`badge ${RISK_BADGE[p.ventRisk]||"badge-muted"}`} style={{fontSize:9}}>Vent {p.ventRisk}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active Alerts */}
        <div>
          <div style={{fontFamily:"var(--font-display)",fontSize:13,fontWeight:700,color:"var(--text-secondary)",letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>🔔 Active Resource Alerts ({alerts.length})</div>
          {alerts.length===0&&(
            <div style={{textAlign:"center",padding:50}}>
              <div style={{fontSize:36,marginBottom:10}}>✅</div>
              <div style={{color:"var(--green)",fontFamily:"var(--font-display)",fontSize:14}}>No Active Alerts</div>
            </div>
          )}
          {alerts.map(a=>(
            <div key={a._id} className="card card-sm" style={{borderLeft:`3px solid ${a.severity==="Critical"?"var(--red)":a.severity==="High"?"var(--orange)":"var(--yellow)"}`,marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
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
      </div>
    </div>
  );
}
