import { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";

const QUICK_ACTIONS = [
  {emoji:"🚨",label:"Emergency",msg:"I need emergency help right now"},
  {emoji:"🏥",label:"Find Hospital",msg:"Find nearest hospital to me"},
  {emoji:"📅",label:"Appointment",msg:"I want to book a doctor appointment"},
  {emoji:"🫀",label:"Heart Attack",msg:"Heart attack first aid steps"},
  {emoji:"🧠",label:"Stroke",msg:"Stroke signs and first aid"},
  {emoji:"💊",label:"Medicine",msg:"Tell me about paracetamol dosage"},
  {emoji:"🌡️",label:"Fever",msg:"I have a high fever"},
  {emoji:"📞",label:"Emergency Nos.",msg:"What are the emergency numbers in India"},
];

const EMERGENCY_KEYWORDS = ["emergency","urgent","critical","accident","bleeding","heart attack","stroke","unconscious","not breathing","severe pain","chest pain","no pulse","seizure"];

function formatMsg(text) {
  return text.split("\n").map((line,i,arr)=>{
    const parts=line.split(/\*\*(.*?)\*\*/g);
    return (<span key={i}>{parts.map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}{i<arr.length-1&&<br/>}</span>);
  });
}

function TypingDots() {
  return (
    <div style={{display:"flex",gap:4,padding:"12px 14px",background:"var(--bg-elevated)",border:"1px solid var(--border)",borderRadius:"4px 16px 16px 16px",width:"fit-content"}}>
      {[0,1,2].map(i=>(<span key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--accent)",display:"inline-block",animation:`chatBounce 1.2s ${i*0.18}s ease-in-out infinite`}}/>))}
    </div>
  );
}

export default function AIChatbot({ userLocation, onRequestAmbulance, onShowHospitals }) {
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState([{id:0,role:"assistant",urgent:false,
    text:"👋 **Hello! I\'m CareAssist — your 24/7 AI Health Assistant.**\n\nI can help you with:\n• 🚨 Emergency first aid & ambulance\n• 🏥 Finding nearby hospitals\n• 📅 Booking appointments\n• 💊 Medicine information & dosage\n• 🩺 Symptoms guidance\n• 📞 Emergency numbers\n• 💡 Health tips\n\nWhat do you need help with?",
    suggestions:["Emergency Help","Find Hospital","Book Appointment","Medicine Info","Health Tips"],time:new Date()}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [unread,setUnread]=useState(0);
  const [isListening,setIsListening]=useState(false);
  const recognitionRef=useRef(null);
  const msgEndRef=useRef(null);
  const inputRef=useRef(null);
  const msgIdRef=useRef(1);

  useEffect(()=>{if(open){setUnread(0);setTimeout(()=>msgEndRef.current?.scrollIntoView({behavior:"smooth"}),80);}},[open,messages.length]);

  const sendMessage=useCallback(async(text)=>{
    if(!text?.trim()||loading)return;
    const isEmergency=EMERGENCY_KEYWORDS.some(k=>text.toLowerCase().includes(k));
    setMessages(p=>[...p,{id:msgIdRef.current++,role:"user",text:text.trim(),time:new Date()}]);
    setInput("");setLoading(true);
    try{
      const res=await api.post("/chat",{message:text.trim(),userLat:userLocation?.lat,userLng:userLocation?.lng});
      const d=res.data;
      setMessages(p=>[...p,{id:msgIdRef.current++,role:"assistant",text:d.response||"I couldn\'t process that.",suggestions:d.suggestions||[],urgent:d.urgent||isEmergency||false,time:new Date()}]);
      if(!open)setUnread(u=>u+1);
    }catch(e){
      setMessages(p=>[...p,{id:msgIdRef.current++,role:"assistant",urgent:false,time:new Date(),text:"Sorry, I\'m having trouble right now.\n\n**For emergencies: Call 108 or 112 immediately.**",suggestions:["Call 108 - Ambulance","Call 112 - Emergency"]}]);
    }
    setLoading(false);
  },[userLocation,open,loading]);

  const handleSuggestion=useCallback((sug)=>{
    const sl=sug.toLowerCase();
    if(sl.includes("ambulance now")||sl.includes("request ambulance")){onRequestAmbulance?.();return;}
    if(sl.includes("find hospital")||sl.includes("show hospital")||sl.includes("hospital list")){onShowHospitals?.();return;}
    if(sl.includes("call 108")){window.open("tel:108");return;}
    if(sl.includes("call 112")){window.open("tel:112");return;}
    sendMessage(sug);
  },[onRequestAmbulance,onShowHospitals,sendMessage]);

  const handleSubmit=e=>{e.preventDefault();sendMessage(input);};
  const toggleOpen=()=>setOpen(o=>{if(!o)setUnread(0);return !o;});

  const toggleVoice=useCallback(()=>{
    if(isListening){recognitionRef.current?.stop();setIsListening(false);return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Voice input not supported. Try Chrome or Edge.");return;}
    const rec=new SR();
    rec.lang="en-IN";rec.interimResults=false;rec.maxAlternatives=1;
    rec.onresult=(e)=>{sendMessage(e.results[0][0].transcript);setIsListening(false);};
    rec.onerror=()=>setIsListening(false);rec.onend=()=>setIsListening(false);
    recognitionRef.current=rec;rec.start();setIsListening(true);
  },[isListening,sendMessage]);

  return(
    <>
      <style>{`
        @keyframes chatBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        @keyframes chatFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,64,96,.5)}50%{box-shadow:0 0 0 8px rgba(255,64,96,0)}}
        .chat-msg{animation:chatFadeIn .2s ease-out}
        .chat-sug:hover{background:var(--accent)!important;color:#fff!important;border-color:var(--accent)!important}
      `}</style>

      <button onClick={toggleOpen} style={{position:"fixed",bottom:24,right:24,zIndex:1000,width:58,height:58,borderRadius:"50%",cursor:"pointer",background:open?"var(--bg-elevated)":"linear-gradient(135deg,#0088cc,#0055aa)",border:open?"2px solid var(--border)":"none",boxShadow:open?"none":"0 4px 20px rgba(0,136,204,.45)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,transition:"all .2s",color:open?"var(--text-muted)":"#fff"}}>
        {open?"✕":"💬"}
        {unread>0&&!open&&<div style={{position:"absolute",top:-4,right:-4,background:"#ff4060",color:"#fff",width:20,height:20,borderRadius:"50%",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid var(--bg-primary)"}}>{unread>9?"9+":unread}</div>}
      </button>

      {open&&(
        <div style={{position:"fixed",bottom:96,right:24,zIndex:999,width:390,maxWidth:"calc(100vw - 32px)",height:580,maxHeight:"calc(100vh - 112px)",background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:20,boxShadow:"0 10px 48px rgba(0,0,0,.25)",display:"flex",flexDirection:"column",overflow:"hidden",animation:"chatFadeIn .2s ease-out"}}>

          <div style={{background:"linear-gradient(135deg,#0055aa,#0088cc)",padding:"14px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:"#fff",fontSize:14,fontFamily:"var(--font-display)"}}>CareAssist AI</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.7)",display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:6,height:6,background:"#00e676",borderRadius:"50%",display:"inline-block"}}/>
                Online · 24/7 · Voice enabled
              </div>
            </div>
            <button onClick={toggleOpen} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>

          <div style={{borderBottom:"1px solid var(--border)",padding:"8px 10px",overflowX:"auto",display:"flex",gap:5,flexShrink:0}}>
            {QUICK_ACTIONS.map(qa=>(
              <button key={qa.label} onClick={()=>sendMessage(qa.msg)} style={{padding:"5px 10px",border:"1px solid var(--border)",background:"var(--bg-elevated)",color:"var(--text-secondary)",borderRadius:20,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all .15s",display:"flex",alignItems:"center",gap:4}}
                onMouseEnter={e=>{e.currentTarget.style.background="var(--accent-dim)";e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="var(--bg-elevated)";e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-secondary)";}}>
                {qa.emoji} {qa.label}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map(msg=>(
              <div key={msg.id} className="chat-msg" style={{display:"flex",flexDirection:msg.role==="user"?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                {msg.role==="assistant"&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0088cc,#0055aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>🤖</div>}
                <div style={{maxWidth:"80%"}}>
                  <div style={{padding:"10px 13px",borderRadius:msg.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",background:msg.role==="user"?"linear-gradient(135deg,#0088cc,#0055aa)":msg.urgent?"rgba(255,64,96,.08)":"var(--bg-elevated)",border:msg.urgent?"1px solid rgba(255,64,96,.35)":msg.role==="user"?"none":"1px solid var(--border)",color:msg.role==="user"?"#fff":"var(--text-primary)",fontSize:13,lineHeight:1.65}}>
                    {msg.urgent&&<div style={{fontSize:11,fontWeight:700,color:"#ff4060",marginBottom:5,display:"flex",alignItems:"center",gap:4}}>🚨 URGENT — ACT IMMEDIATELY</div>}
                    {formatMsg(msg.text)}
                  </div>
                  {msg.suggestions?.length>0&&(
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                      {msg.suggestions.map(sug=>(<button key={sug} className="chat-sug" onClick={()=>handleSuggestion(sug)} style={{padding:"4px 10px",border:"1px solid var(--accent)",background:"var(--accent-dim)",color:"var(--accent)",borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:500,transition:"all .15s"}}>{sug}</button>))}
                    </div>
                  )}
                  <div style={{fontSize:9,color:"var(--text-dim)",marginTop:4,textAlign:msg.role==="user"?"right":"left"}}>{msg.time?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                </div>
              </div>
            ))}
            {loading&&<div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#0088cc,#0055aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div><TypingDots/></div>}
            {isListening&&<div style={{textAlign:"center",padding:"6px",color:"var(--red)",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:"var(--red)",display:"inline-block",animation:"micPulse 1s infinite"}}/>Listening… speak now</div>}
            <div ref={msgEndRef}/>
          </div>

          <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",background:"var(--bg-card)",flexShrink:0}}>
            <form onSubmit={handleSubmit} style={{display:"flex",gap:8,alignItems:"center"}}>
              <button type="button" onClick={toggleVoice} title={isListening?"Stop":"Speak"} style={{width:36,height:36,borderRadius:"50%",flexShrink:0,cursor:"pointer",border:"1px solid var(--border)",background:isListening?"var(--red-dim)":"var(--bg-elevated)",color:isListening?"var(--red)":"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,transition:"all .2s",animation:isListening?"micPulse 1s infinite":"none"}}>
                {isListening?"🛑":"🎤"}
              </button>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={isListening?"Listening…":"Ask about health, hospitals, medicines…"} disabled={loading||isListening}
                style={{flex:1,padding:"9px 14px",border:"1px solid var(--border)",borderRadius:20,background:"var(--bg-elevated)",color:"var(--text-primary)",fontSize:13,outline:"none",fontFamily:"var(--font-body)"}}
                onFocus={e=>e.target.style.borderColor="var(--accent)"} onBlur={e=>e.target.style.borderColor="var(--border)"}/>
              <button type="submit" disabled={loading||!input.trim()||isListening} style={{width:36,height:36,borderRadius:"50%",flexShrink:0,cursor:input.trim()?"pointer":"default",background:input.trim()?"linear-gradient(135deg,#0088cc,#0055aa)":"var(--bg-elevated)",border:input.trim()?"none":"1px solid var(--border)",color:input.trim()?"#fff":"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,transition:"all .2s"}}>➤</button>
            </form>
            <div style={{textAlign:"center",fontSize:9,color:"var(--text-dim)",marginTop:5}}>🎤 Voice enabled · Call 108 for emergencies · AI is not a substitute for medical advice</div>
          </div>
        </div>
      )}
    </>
  );
}
