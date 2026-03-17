// GovernancePanel.jsx — Government Integration, Emergency Override, Payment Guarantee
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

const GOV_SCHEMES = ["Ayushman Bharat", "NHM", "PMJAY", "Emergency 112", "AIIMS Network", "State Health Mission"];

export default function GovernancePanel() {
  const [hospitals, setHospitals] = useState([]);
  const [refusalLog, setRefusalLog] = useState([]);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("compliance");

  const load = useCallback(async () => {
    try {
      const [h] = await Promise.all([api.get("/hospitals")]);
      setHospitals(h.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    socket.on("hospitalRefusal", d => {
      setRefusalLog(prev => [{ ...d, time: new Date() }, ...prev.slice(0, 19)]);
    });
    return () => socket.off("hospitalRefusal");
  }, []);

  const activateEmergencyMode = async () => {
    try {
      await api.post("/admin/emergency-mode", { active: !emergencyMode });
      setEmergencyMode(!emergencyMode);
    } catch (e) {
      setEmergencyMode(!emergencyMode); // Demo fallback
    }
  };

  const sendComplianceNotice = async (hospitalId, scheme) => {
    try {
      await api.post(`/admin/compliance-notice`, { hospitalId, scheme });
      alert(`Compliance notice sent for ${scheme}`);
    } catch (e) { alert("Notice sent (demo)"); }
  };

  const tierGroups = {
    "Tier 1 — Government": hospitals.filter(h => h.tier === 1 || h.type === "Government"),
    "Tier 2 — Partner Private": hospitals.filter(h => h.tier === 2 && h.type !== "Government"),
    "Tier 3 — Premium Private": hospitals.filter(h => h.tier === 3 || h.type === "Premium Private"),
  };

  if (loading) return <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading governance data...</div>;

  return (
    <div>
      {/* Emergency Override Banner */}
      {emergencyMode && (
        <div style={{ background: "linear-gradient(90deg,#d32f2f,#b71c1c)", color: "#fff", padding: "12px 20px", borderRadius: "var(--radius-md)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: 2 }}>
          ⚠️ EMERGENCY OVERRIDE ACTIVE — All hospitals must accept patients — Health Authority Notified
          <button onClick={activateEmergencyMode} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", padding: "4px 12px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Deactivate</button>
        </div>
      )}

      {/* Government Integration Header */}
      <div style={{ background: "linear-gradient(135deg,#1a3a6e,#1565C0)", borderRadius: "var(--radius-lg)", padding: 20, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>🏛 GOVERNMENT INTEGRATION HUB</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>National Health Authority · Ministry of Health · Ayushman Bharat · Emergency 112</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GOV_SCHEMES.map(s => (
            <span key={s} style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600 }}>{s}</span>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={activateEmergencyMode} style={{ background: emergencyMode ? "rgba(255,255,255,0.2)" : "#d32f2f", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", padding: "8px 16px", borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {emergencyMode ? "🟢 Deactivate Override" : "🔴 Activate Emergency Override"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[["compliance","📋 Scheme Compliance"],["tiers","🏥 Tiered Routing"],["override","⚖️ Override Log"],["payment","💳 Payment Guarantee"],["incentives","🎁 Incentives"]].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* COMPLIANCE TAB */}
      {tab === "compliance" && (
        <div>
          {hospitals.map(h => {
            const enrolled = h.govSchemes || [];
            const missing = GOV_SCHEMES.filter(s => !enrolled.includes(s));
            return (
              <div key={h._id} className="card card-sm" style={{ marginBottom: 10, borderLeft: `3px solid ${enrolled.length > 0 ? "var(--green)" : "var(--red)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{h.location?.city} · {h.type}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {enrolled.map(s => <span key={s} className="badge badge-green" style={{ fontSize: 9 }}>{s}</span>)}
                      {missing.slice(0, 2).map(s => (
                        <button key={s} onClick={() => sendComplianceNotice(h._id, s)} style={{ padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 20, fontSize: 9, cursor: "pointer", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>+ {s}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className={`badge ${enrolled.length > 1 ? "badge-green" : enrolled.length === 1 ? "badge-yellow" : "badge-red"}`}>{enrolled.length > 1 ? "✓ Compliant" : enrolled.length === 1 ? "Partial" : "⚠ Non-Compliant"}</span>
                    {enrolled.length === 0 && (
                      <button onClick={() => sendComplianceNotice(h._id, "General")} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>📧 Send Notice</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TIERS TAB */}
      {tab === "tiers" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {Object.entries(tierGroups).map(([tierName, tierHospitals]) => (
            <div key={tierName} className="card">
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>{tierName}</div>
              {tierHospitals.map(h => (
                <div key={h._id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{h.name}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 11, color: "var(--text-muted)" }}>
                    <span>ICU: {h.resources?.icuBeds?.available}/{h.resources?.icuBeds?.total}</span>
                    <span className={`badge ${h.alertLevel === "Normal" ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>{h.alertLevel}</span>
                  </div>
                </div>
              ))}
              {tierHospitals.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: 20 }}>No hospitals in this tier</div>}
            </div>
          ))}
        </div>
      )}

      {/* OVERRIDE LOG TAB */}
      {tab === "override" && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 8 }}>Emergency Override Log</div>
            {refusalLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--green)" }}>✅ No refusals logged today. All hospitals complying.</div>
            ) : refusalLog.map((r, i) => (
              <div key={i} style={{ background: "var(--red-dim)", border: "1px solid var(--red)", borderRadius: "var(--radius-md)", padding: 10, marginBottom: 8, fontSize: 11, color: "var(--red)" }}>
                ⚠️ {r.hospitalName} refused emergency patient — {r.time?.toLocaleTimeString()} — Logged to NHA
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 8 }}>Legal Framework</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2 }}>
              Under Emergency Medical Treatment provisions in India:<br/>
              • All government hospitals (Tier 1) must accept critical emergency patients<br/>
              • Refusals are automatically logged and reported to the National Health Authority<br/>
              • Emergency Override Mode forces immediate compliance across all Tier 1 facilities<br/>
              • Hospitals with repeated refusals receive compliance notices and trust score penalties<br/>
              • Critical cases routed to next available tier if primary hospital is truly at capacity
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT TAB */}
      {tab === "payment" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { mode: "Ayushman Bharat", count: 4, amount: "₹45L", active: true, desc: "Direct insurance routing to enrolled hospitals" },
              { mode: "PMJAY Direct", count: 3, amount: "₹28L", active: true, desc: "Pradhan Mantri Jan Arogya Yojana payments" },
              { mode: "Government Escrow", count: 2, amount: "₹15L", active: true, desc: "Digital escrow — instant payment on admission" },
              { mode: "Digital Payment", count: 1, amount: "₹8L", active: true, desc: "Real-time UPI/bank transfer guarantee" },
            ].map(p => (
              <div key={p.mode} style={{ background: "var(--green-dim)", border: "1px solid var(--green)", borderRadius: "var(--radius-lg)", padding: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 4 }}>{p.mode}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--green)", fontFamily: "var(--font-display)", marginBottom: 4 }}>{p.amount}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.count} hospitals · {p.desc}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, marginBottom: 10 }}>💳 Smart Payment Guarantee System</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              Hospitals often refuse patients due to payment uncertainty. The Smart Payment Guarantee system solves this by:<br/><br/>
              1. <b>Pre-authorization</b> — Insurance pre-auth sent BEFORE ambulance arrives<br/>
              2. <b>Digital Escrow</b> — Government funds held in escrow, released on admission<br/>
              3. <b>Real-time Confirmation</b> — Hospital receives payment confirmation in 30 seconds<br/>
              4. <b>Coverage Guarantee</b> — Even uninsured critical patients get emergency fund coverage<br/>
              5. <b>Smart Contract</b> — Automatic payment processing, no paperwork needed at emergency time
            </div>
          </div>
        </div>
      )}

      {/* INCENTIVES TAB */}
      {tab === "incentives" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { icon: "📈", title: "Priority Referrals", desc: "High trust hospitals receive 40% more patient referrals automatically", color: "var(--green)" },
              { icon: "💰", title: "Government Subsidy", desc: "Equipment grants and infrastructure subsidies for compliant hospitals", color: "var(--cyan)" },
              { icon: "🏆", title: "Trust Score Bonus", desc: "High trust score → visible badge → more patients choose the hospital", color: "var(--purple)" },
              { icon: "🛡️", title: "Insurance Priority", desc: "Insurance companies route patients to verified compliant hospitals first", color: "var(--accent)" },
              { icon: "📊", title: "AI Load Prediction", desc: "30-day advance ICU demand forecast helps hospitals plan and prepare", color: "var(--orange)" },
              { icon: "🚑", title: "Ambulance Routing", desc: "System routes ambulances to compliant hospitals — more footfall", color: "var(--yellow)" },
            ].map(m => (
              <div key={m.title} style={{ background: "var(--bg-elevated)", border: `1px solid var(--border)`, borderRadius: "var(--radius-lg)", padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 6, color: m.color }}>{m.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
