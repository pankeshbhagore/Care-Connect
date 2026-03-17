import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";

const QUICK_ACTIONS = [
  {label:"🚨 Emergency Help",  msg:"I need emergency help"},
  {label:"🏥 Find Hospital",   msg:"Find nearest hospital"},
  {label:"📅 Book Appointment",msg:"I want to book an appointment"},
  {label:"💊 Medicine Info",   msg:"Tell me about medicines"},
  {label:"🩺 Symptom Check",   msg:"I have symptoms to check"},
  {label:"💡 Health Tips",     msg:"Give me health tips"},
  {label:"📞 Emergency Numbers",msg:"Emergency numbers"},
  {label:"🫀 Heart Attack",    msg:"Heart attack first aid"},
  {label:"🧠 Stroke",          msg:"Stroke symptoms and first aid"},
  {label:"🔥 Burns",           msg:"Burn treatment first aid"},
];

function formatMessage(text) {
  // Convert **bold** and \n to JSX
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((p, j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}
        {i < text.split('\n').length-1 && <br/>}
      </span>
    );
  });
}

export default function AIChatbot({ userLocation, onRequestAmbulance, onShowHospitals, hospitals }) {
  const [open,    setOpen]    = useState(false);
  const [messages,setMessages]= useState([{
    role:"assistant",
    text:"👋 **Hello! I'm CareAssist — your AI Health Assistant.**\n\nI can help with emergencies, find hospitals, book appointments, medicine info, and health guidance.\n\nWhat do you need help with?",
    suggestions:["Emergency Help","Find Hospital","Book Appointment","Medicine Info","Health Tips"],
    urgent:false,
    time: new Date(),
  }]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [unread,  setUnread]  = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{
    if(open) { setUnread(0); setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),100); }
  },[open, messages]);

  const sendMessage = useCallback(async (text) => {
    if(!text?.trim()) return;
    const userMsg = { role:"user", text:text.trim(), time:new Date() };
    setMessages(p=>[...p,userMsg]);
    setInput("");
    setLoading(true);
    try {
      const r = await api.post("/chat", { message:text.trim(), userLat:userLocation?.lat, userLng:userLocation?.lng });
      const d = r.data;
      const aiMsg = { role:"assistant", text:d.response, suggestions:d.suggestions||[], urgent:d.urgent||false, time:new Date() };
      setMessages(p=>[...p,aiMsg]);
      if (!open) setUnread(u=>u+1);
    } catch(e) {
      setMessages(p=>[...p,{role:"assistant",text:"Sorry, I'm having trouble connecting. For emergencies call **108** or **112**.",suggestions:["Call 108"],urgent:false,time:new Date()}]);
    } finally { setLoading(false); }
  },[userLocation, open]);

  const handleSuggestion = (sug) => {
    if (sug==="Request Ambulance Now"||sug==="Request Ambulance") { onRequestAmbulance?.(); return; }
    if (sug==="Find Hospital"||sug==="Show Hospitals"||sug==="Open Hospital Map"||sug==="Hospital List") { onShowHospitals?.(); return; }
    sendMessage(sug);
  };

  const handleSubmit = e => { e.preventDefault(); sendMessage(input); };

  return (
    <>
      {/* Floating button */}
      <div style={{position:"fixed",bottom:24,right:24,zIndex:1000}}>
        <button onClick={()=>setOpen(o=>!o)} style={{
          width:60,height:60,borderRadius:"50%",
          background:open?"var(--bg-card)":"linear-gradient(135deg,#00c8ff,#0088cc)",
          border:open?"2px solid var(--border)":"none",
          boxShadow:"0 4px 20px rgba(0,200,255,.4)",
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:26,position:"relative",transition:"all .2s",
        }}>
          {open ? "✕" : "💬"}
          {unread>0&&!open&&(
            <div style={{position:"absolute",top:-4,right:-4,background:"var(--red)",color:"#fff",width:20,height:20,borderRadius:"50%",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {unread>9?"9+":unread}
            </div>
          )}
        </button>
      </div>

      {/* Chat window */}
      {open&&(
        <div style={{
          position:"fixed",bottom:96,right:24,zIndex:999,
          width:380,maxWidth:"calc(100vw - 48px)",
          height:560,maxHeight:"calc(100vh - 120px)",
          background:"var(--bg-card)",border:"1px solid var(--border)",
          borderRadius:20,boxShadow:"0 8px 40px rgba(0,0,0,.25)",
          display:"flex",flexDirection:"column",overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{background:"linear-gradient(135deg,#00c8ff,#0055aa)",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
            <div>
              <div style={{fontFamily:"var(--font-display)",fontWeight:700,color:"#fff",fontSize:14}}>CareAssist AI</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.75)",display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:6,height:6,background:"#00e676",borderRadius:"50%",display:"inline-block"}}/>
                Online — 24/7 Health Assistant
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{marginLeft:"auto",background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14}}>✕</button>
          </div>

          {/* Quick actions */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",overflowX:"auto",whiteSpace:"nowrap",display:"flex",gap:6}}>
            {QUICK_ACTIONS.map(qa=>(
              <button key={qa.label} onClick={()=>sendMessage(qa.msg)} style={{
                padding:"5px 10px",border:"1px solid var(--border)",background:"var(--bg-elevated)",
                color:"var(--text-secondary)",borderRadius:20,fontSize:11,cursor:"pointer",
                whiteSpace:"nowrap",transition:"all .15s",flexShrink:0,
              }} onMouseEnter={e=>{e.currentTarget.style.background="var(--accent-dim)";e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="var(--bg-elevated)";e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>
                {qa.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:"flex",flexDirection:msg.role==="user"?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                {msg.role==="assistant"&&(
                  <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#00c8ff,#0055aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>🤖</div>
                )}
                <div style={{maxWidth:"82%"}}>
                  <div style={{
                    padding:"10px 13px",borderRadius:msg.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",
                    background:msg.role==="user"?"linear-gradient(135deg,#00c8ff,#0055aa)":msg.urgent?"var(--red-dim)":"var(--bg-elevated)",
                    border:msg.urgent?"1px solid var(--red)":"1px solid var(--border)",
                    color:msg.role==="user"?"#fff":"var(--text-primary)",
                    fontSize:13,lineHeight:1.6,
                    boxShadow:"0 1px 6px rgba(0,0,0,.08)",
                  }}>
                    {msg.urgent&&<div style={{fontSize:11,fontWeight:700,color:"var(--red)",marginBottom:6}}>🚨 URGENT — SEEK IMMEDIATE HELP</div>}
                    {formatMessage(msg.text)}
                  </div>
                  {/* Suggestion chips */}
                  {msg.suggestions?.length>0&&(
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                      {msg.suggestions.map(sug=>(
                        <button key={sug} onClick={()=>handleSuggestion(sug)} style={{
                          padding:"4px 10px",border:"1px solid var(--accent)",background:"var(--accent-dim)",
                          color:"var(--accent)",borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:500,
                        }}>{sug}</button>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:9,color:"var(--text-dim)",marginTop:4,textAlign:msg.role==="user"?"right":"left"}}>
                    {msg.time?.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#00c8ff,#0055aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
                <div style={{padding:"10px 14px",borderRadius:"4px 16px 16px 16px",background:"var(--bg-elevated)",border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {[0,1,2].map(i=><span key={i} style={{width:7,height:7,background:"var(--accent)",borderRadius:"50%",display:"inline-block",animation:`bounce 1.2s ${i*0.2}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",background:"var(--bg-card)"}}>
            <form onSubmit={handleSubmit} style={{display:"flex",gap:8}}>
              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                placeholder="Ask about health, hospitals, appointments…"
                style={{flex:1,padding:"9px 14px",border:"1px solid var(--border)",borderRadius:20,background:"var(--bg-elevated)",color:"var(--text-primary)",fontSize:13,outline:"none",fontFamily:"var(--font-body)"}}
                disabled={loading}
              />
              <button type="submit" disabled={loading||!input.trim()} style={{width:38,height:38,borderRadius:"50%",background:input.trim()?"linear-gradient(135deg,#00c8ff,#0055aa)":"var(--bg-elevated)",border:input.trim()?"none":"1px solid var(--border)",color:input.trim()?"#fff":"var(--text-muted)",cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,transition:"all .2s"}}>
                ➤
              </button>
            </form>
            <div style={{textAlign:"center",fontSize:9,color:"var(--text-dim)",marginTop:5}}>
              For life-threatening emergencies call 108 • AI guidance is not a substitute for professional medical advice
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)}
        }
      `}</style>
    </>
  );
}
