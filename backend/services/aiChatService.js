/**
 * AI Chat Service — Smart healthcare assistant
 * Uses rule-based + Claude API if available, else comprehensive rules
 */
const Hospital  = require("../models/Hospital");
const calcDist  = require("../utils/distance");

// ── Knowledge base ─────────────────────────────────────────────
const FIRST_AID = {
  cardiac:    "🫀 CARDIAC EMERGENCY:\n• Call ambulance immediately\n• Make person lie down, loosen clothing\n• If unconscious + no breathing: start CPR (30 chest compressions + 2 breaths)\n• If AED available, use it\n• Do NOT give water/food\n• Stay with patient until ambulance arrives",
  stroke:     "🧠 STROKE EMERGENCY (FAST Test):\n• Face — ask to smile, one side drooping?\n• Arms — can they raise both?\n• Speech — slurred or strange?\n• Time — call ambulance IMMEDIATELY\n• Do NOT give aspirin without doctor advice\n• Note time symptoms started",
  bleeding:   "🩸 SEVERE BLEEDING:\n• Apply direct pressure with clean cloth\n• Do NOT remove cloth (add more on top if soaked)\n• Elevate injured limb above heart level\n• Do NOT use tourniquet unless life-threatening\n• Call ambulance for severe bleeding",
  burns:      "🔥 BURN TREATMENT:\n• Cool burn with cool (not cold) running water for 20 min\n• Do NOT use ice, butter, or toothpaste\n• Remove jewelry/tight clothing near burn\n• Cover with clean non-fluffy material\n• See doctor for burns larger than palm",
  fracture:   "🦴 FRACTURE/BROKEN BONE:\n• Do NOT try to straighten the limb\n• Immobilize the area with a splint/sling\n• Apply ice pack wrapped in cloth\n• Elevate if possible\n• Seek immediate medical attention",
  breathing:  "💨 BREATHING DIFFICULTY:\n• Help person sit upright, leaning slightly forward\n• Loosen tight clothing around neck/chest\n• If person has inhaler, help them use it\n• Do NOT lay them flat\n• Call ambulance if severe or getting worse",
  choking:    "😮 CHOKING:\n• Encourage strong coughing if person can cough\n• If cannot cough/breathe: 5 back blows between shoulder blades\n• Then 5 abdominal thrusts (Heimlich)\n• Alternate back blows + abdominal thrusts\n• Call ambulance if object not dislodged",
  poisoning:  "☠️ POISONING:\n• Call Poison Control: 1800-116-117\n• Do NOT induce vomiting unless told to\n• Note what was taken and when\n• Keep person calm and still\n• If unconscious, place in recovery position",
  heatstroke: "🌡️ HEAT STROKE:\n• Move to cool shaded area immediately\n• Remove excess clothing\n• Apply cool wet cloths to body\n• Fan the person\n• Give cool water if conscious and able to swallow\n• Call ambulance — heat stroke is life-threatening",
  snakebite:  "🐍 SNAKE BITE:\n• Keep person CALM and still\n• Immobilize bitten limb below heart level\n• Remove tight items near bite (rings, watches)\n• Do NOT suck venom, cut, or tie tourniquet\n• Note snake appearance if safe\n• Rush to nearest hospital with antivenin",
};

const MEDICINES = {
  paracetamol: "💊 Paracetamol (Crocin/Dolo 650):\n• For: Fever, mild pain\n• Adults: 500-1000mg every 4-6 hours\n• Max: 4 grams/day\n• ⚠️ Do NOT exceed dose — liver damage risk\n• Children: 10-15mg/kg/dose",
  ibuprofen:   "💊 Ibuprofen (Brufen/Combiflam):\n• For: Pain, inflammation, fever\n• Adults: 200-400mg every 4-6 hours with food\n• ⚠️ Avoid on empty stomach, avoid in kidney problems\n• Avoid in pregnancy (3rd trimester)",
  ors:         "💧 ORS (Oral Rehydration Solution):\n• For: Diarrhea, vomiting, dehydration\n• Dissolve 1 packet in 1 liter clean water\n• Sip slowly throughout the day\n• Adults: 200-400ml after each loose stool\n• Homemade: 6 tsp sugar + ½ tsp salt in 1L water",
  antacid:     "🌿 Antacid (Digene/Gelusil):\n• For: Acidity, heartburn, stomach upset\n• Take 30 min after meals or at bedtime\n• Do not take for more than 2 weeks without doctor\n• ⚠️ May interact with other medicines",
};

const SYMPTOMS = {
  fever:     "🌡️ FEVER GUIDANCE:\n• Temperature > 37.5°C is fever\n• Rest and drink plenty of fluids\n• Take paracetamol for temperature > 38.5°C\n• See doctor if fever > 39°C, lasts > 3 days, or with rash/severe headache",
  headache:  "🤕 HEADACHE GUIDANCE:\n• Rest in quiet, dark room\n• Stay hydrated\n• Paracetamol or ibuprofen for pain\n• ⚠️ URGENT: Sudden severe headache, headache with stiff neck, vision changes — seek emergency care",
  stomach:   "🤢 STOMACH PAIN GUIDANCE:\n• Mild: rest, avoid solid foods, drink clear fluids\n• Take ORS if vomiting/diarrhea\n• ⚠️ URGENT: Severe pain, pain with fever, blood in stool — go to hospital",
  chest:     "⚠️ CHEST PAIN — POSSIBLE EMERGENCY:\n• Any chest pain should be evaluated immediately\n• Call emergency number if: severe crushing pain, pain spreading to arm/jaw, sweating, breathlessness\n• Do NOT ignore chest pain, especially if over 40",
  diabetes:  "🍬 DIABETES GUIDANCE:\n• Low blood sugar (hypoglycemia): Give sugar, fruit juice, or glucose tablet immediately\n• High blood sugar symptoms: excessive thirst, frequent urination — check blood sugar\n• Always carry glucose tablets\n• Regular monitoring and medication as prescribed",
};

const EMERGENCY_NUMBERS = "📞 EMERGENCY NUMBERS:\n• Ambulance: 108\n• National Emergency: 112\n• Police: 100\n• Fire: 101\n• Poison Control: 1800-116-117\n• Women Helpline: 1091\n• Child Helpline: 1098";

const HEALTH_TIPS = [
  "💧 Drink at least 8 glasses of water daily",
  "🏃 30 minutes of moderate exercise 5 days a week",
  "😴 7-9 hours of sleep for adults",
  "🥗 Eat 5 portions of fruits/vegetables daily",
  "🚭 Avoid smoking — it causes 8 million deaths/year",
  "🧴 Wash hands for 20 seconds to prevent infection",
  "🩺 Annual health checkup after age 40",
  "💊 Never self-medicate — consult a doctor",
];

// ── Intent detection ───────────────────────────────────────────
function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (/emergency|ambulance|help.*urgent|urgent.*help|sos|critical/i.test(m)) return "emergency";
  if (/cardiac|heart attack|chest.*pain|palpitation/i.test(m)) return "cardiac";
  if (/stroke|paralysis|face.*droop/i.test(m)) return "stroke";
  if (/bleed|bleeding|cut.*deep|wound/i.test(m)) return "bleeding";
  if (/burn|fire.*injury|scald/i.test(m)) return "burns";
  if (/fracture|broken.*bone|sprain/i.test(m)) return "fracture";
  if (/breath|choke|asthma|inhale/i.test(m)) return "breathing";
  if (/choke|choking|stuck.*throat/i.test(m)) return "choking";
  if (/poison|swallowed|overdose/i.test(m)) return "poisoning";
  if (/heat.*stroke|sunstroke|hypertherm/i.test(m)) return "heatstroke";
  if (/snake.*bite|snakebite/i.test(m)) return "snakebite";
  if (/fever|temperature/i.test(m)) return "fever";
  if (/headache|migraine/i.test(m)) return "headache";
  if (/stomach|diarrhea|vomit|nausea|acidity/i.test(m)) return "stomach";
  if (/diabete|sugar.*level|insulin/i.test(m)) return "diabetes";
  if (/paracetamol|crocin|dolo|fever.*medicine/i.test(m)) return "paracetamol";
  if (/ibuprofen|brufen|pain.*killer/i.test(m)) return "ibuprofen";
  if (/ors|dehydration|diarr.*solution/i.test(m)) return "ors";
  if (/antacid|acidity.*medicine|digene|gelusil/i.test(m)) return "antacid";
  if (/hospital.*near|nearest.*hospital|find.*hospital|hospital.*close/i.test(m)) return "nearby_hospital";
  if (/appointment|book|schedule.*doctor|see.*doctor/i.test(m)) return "appointment";
  if (/icu|bed.*available|blood.*available|oxygen/i.test(m)) return "resources";
  if (/tip|advice|health.*tip|stay.*healthy/i.test(m)) return "health_tip";
  if (/number|helpline|phone.*emergency|call/i.test(m)) return "numbers";
  if (/hello|hi|hey|help|what.*can.*you|assist/i.test(m)) return "greeting";
  return "general";
}

// ── Generate response ──────────────────────────────────────────
async function generateResponse(message, userLat, userLng, context = {}) {
  const intent = detectIntent(message);
  let response = "";
  let suggestions = [];
  let urgent = false;

  switch(intent) {
    case "emergency":
      urgent = true;
      response = `🚨 **EMERGENCY DETECTED**\n\nImmediate steps:\n1. **Call 108** (Ambulance) or **112** (National Emergency) RIGHT NOW\n2. Stay calm and give your exact location\n3. Don't move the person if spine/neck injury suspected\n4. Stay on the line with dispatch\n\n${EMERGENCY_NUMBERS}\n\nUse the **"Request Ambulance"** button to dispatch the nearest ambulance automatically.`;
      suggestions = ["Request Ambulance Now", "Find Nearest Hospital", "Call 108"];
      break;
    case "cardiac": urgent=true; response = FIRST_AID.cardiac; suggestions=["Request Ambulance","Find Heart Hospital","CPR Steps"]; break;
    case "stroke":  urgent=true; response = FIRST_AID.stroke;   suggestions=["Request Ambulance","Find Stroke Center"]; break;
    case "bleeding":response = FIRST_AID.bleeding; suggestions=["Find Nearest Hospital","Request Ambulance"]; break;
    case "burns":   response = FIRST_AID.burns;    suggestions=["Find Hospital","Request Ambulance"]; break;
    case "fracture":response = FIRST_AID.fracture; suggestions=["Find Hospital","Orthopedics Near Me"]; break;
    case "breathing":urgent=true; response=FIRST_AID.breathing; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "choking": urgent=true; response=FIRST_AID.choking;   suggestions=["Request Ambulance"]; break;
    case "poisoning":urgent=true;response=FIRST_AID.poisoning; suggestions=["Request Ambulance","Poison Control: 1800-116-117"]; break;
    case "heatstroke":urgent=true;response=FIRST_AID.heatstroke;suggestions=["Request Ambulance","Find Hospital"]; break;
    case "snakebite":urgent=true;response=FIRST_AID.snakebite; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "fever":   response=SYMPTOMS.fever;    suggestions=["Find Hospital","Book Appointment","Paracetamol Info"]; break;
    case "headache":response=SYMPTOMS.headache; suggestions=["Find Hospital","Medicine Info"]; break;
    case "stomach": response=SYMPTOMS.stomach;  suggestions=["Find Hospital","ORS Info","Book Appointment"]; break;
    case "diabetes":response=SYMPTOMS.diabetes; suggestions=["Find Hospital","Book Appointment"]; break;
    case "paracetamol":response=MEDICINES.paracetamol; suggestions=["Find Pharmacy","Book Doctor"]; break;
    case "ibuprofen":  response=MEDICINES.ibuprofen;   suggestions=["Find Pharmacy"]; break;
    case "ors":        response=MEDICINES.ors;          suggestions=["Find Pharmacy"]; break;
    case "antacid":    response=MEDICINES.antacid;      suggestions=["Find Pharmacy"]; break;
    case "numbers":    response=EMERGENCY_NUMBERS;      suggestions=["Request Ambulance","Find Hospital"]; break;
    case "health_tip":
      const tip = HEALTH_TIPS[Math.floor(Math.random()*HEALTH_TIPS.length)];
      response = `💡 **Health Tip of the Day:**\n\n${tip}\n\nWould you like more health tips or information about a specific health topic?`;
      suggestions=["More Tips","Book Health Checkup","Find Hospital"]; break;
    case "appointment":
      response = `📅 **Book an Appointment:**\n\nI can help you book an appointment at any hospital.\n\n• Browse hospitals in the Hospital List tab\n• Click on any hospital for details\n• Click **"Book Appointment"** button\n\nOr tell me which hospital or specialty you need and I'll guide you!`;
      suggestions=["Show Hospitals","General Medicine","Cardiology","Orthopedics"]; break;
    case "nearby_hospital":
      if (userLat && userLng) {
        try {
          const hospitals = await Hospital.find({status:{$ne:"Offline"}}).lean();
          const nearby = hospitals.map(h=>({name:h.name,city:h.location?.city,dist:parseFloat(calcDist(userLat,userLng,h.location.lat,h.location.lng).toFixed(1)),icu:h.resources?.icuBeds?.available||0,tier:h.tier})).sort((a,b)=>a.dist-b.dist).slice(0,5);
          response = `🏥 **Nearest Hospitals to You:**\n\n${nearby.map((h,i)=>`${i+1}. **${h.name}** (${h.dist}km)\n   📍 ${h.city} | 🛏 ICU: ${h.icu} | ${h.tier||"Hospital"}`).join("\n\n")}`;
          suggestions=["Get Directions","Request Ambulance","Book Appointment"];
        } catch(e) { response="Please enable location to find nearest hospitals."; }
      } else {
        response = "📍 **Enable your location** (click 'Detect Location' button) to find the nearest hospitals to you.\n\nOr browse the **Hospital Map** or **Hospital List** tab to see all available hospitals.";
        suggestions=["Open Hospital Map","Hospital List"];
      }
      break;
    case "resources":
      response = `🏥 **Hospital Resources:**\n\nYou can check real-time resource availability:\n• **ICU beds** — shown on hospital cards\n• **Oxygen levels** — displayed as O₂ %\n• **Ventilators** — shown in hospital details\n• **Blood bank** — look for 🩸 badge\n\nGo to **Hospital Map** or **Hospital List** to see live data for all hospitals.`;
      suggestions=["View Hospital Map","Hospital List"]; break;
    case "greeting":
      response = `👋 **Hello! I'm CareAssist — your AI Health Assistant.**\n\nI can help you with:\n\n🚨 **Emergency Help** — First aid, ambulance\n🏥 **Find Hospitals** — Nearest with available beds\n📅 **Book Appointments** — Any specialty\n💊 **Medicine Info** — Dosage, usage\n🩺 **Symptoms Guide** — What to do\n💡 **Health Tips** — Stay healthy\n\nWhat do you need help with today?`;
      suggestions=["Emergency Help","Find Hospital","Book Appointment","Health Tips","Medicine Info"]; break;
    default:
      response = `🤔 I can help you with:\n\n• 🚨 **Emergency first aid** (cardiac, stroke, burns, etc.)\n• 🏥 **Finding nearby hospitals**\n• 📅 **Booking appointments**\n• 💊 **Medicine information**\n• 🩺 **Symptom guidance**\n• 📞 **Emergency numbers**\n• 💡 **Health tips**\n\nPlease describe your health concern or ask about any of the above topics.`;
      suggestions=["Emergency Help","Find Hospital","Book Appointment","Medicine Info","Health Tips"];
  }

  return { response, suggestions, urgent, intent };
}

module.exports = { generateResponse };
