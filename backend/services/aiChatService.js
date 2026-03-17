/**
 * AI Chat Service — Claude by Anthropic (FIXED)
 * Falls back to rich rule-based system if no API key configured
 */
const Hospital = require("../models/Hospital");
const calcDist = require("../utils/distance");

// ── Rule-based knowledge base (always works, no API key needed) ──────────────
const FIRST_AID = {
  cardiac:    "🫀 CARDIAC EMERGENCY:\n• Call ambulance immediately (108/112)\n• Make person lie down, loosen clothing\n• If unconscious + no breathing: start CPR (30 chest compressions + 2 breaths)\n• If AED available, use it\n• Do NOT give water/food\n• Stay with patient until help arrives",
  stroke:     "🧠 STROKE EMERGENCY (FAST Test):\n• Face — ask to smile, one side drooping?\n• Arms — can they raise both?\n• Speech — slurred or strange?\n• Time — call 108 IMMEDIATELY\n• Do NOT give aspirin without doctor advice\n• Note exact time symptoms started",
  bleeding:   "🩸 SEVERE BLEEDING:\n• Apply direct firm pressure with clean cloth\n• Do NOT remove cloth (add more on top if soaked)\n• Elevate injured limb above heart level\n• Call 108 for severe/uncontrolled bleeding",
  burns:      "🔥 BURN TREATMENT:\n• Cool with cool (not cold/ice) running water for 20 min\n• Do NOT use butter, toothpaste, or ice\n• Remove jewelry/tight items near burn\n• Cover loosely with clean non-fluffy material\n• See doctor for burns larger than palm size",
  fracture:   "🦴 FRACTURE/BROKEN BONE:\n• Do NOT try to straighten the limb\n• Immobilize with splint/sling if possible\n• Apply ice pack wrapped in cloth (not directly)\n• Elevate if possible\n• Go to hospital immediately",
  breathing:  "💨 BREATHING DIFFICULTY:\n• Help person sit upright, lean slightly forward\n• Loosen tight clothing around neck/chest\n• If they have an inhaler, help use it\n• Do NOT lay flat\n• Call 108 if severe or worsening",
  choking:    "😮 CHOKING:\n• Encourage strong coughing if conscious\n• If cannot cough/breathe: 5 back blows between shoulder blades\n• Then 5 abdominal thrusts (Heimlich)\n• Alternate back blows + thrusts\n• Call 108 if not resolved in 1 minute",
  poisoning:  "☠️ POISONING:\n• Call Poison Control: 1800-116-117\n• Do NOT induce vomiting unless told to\n• Note what was ingested and when\n• Keep person calm and still\n• If unconscious, place in recovery position",
  heatstroke: "🌡️ HEAT STROKE:\n• Move to cool shaded area immediately\n• Remove excess clothing\n• Apply cool wet cloths to skin\n• Fan the person\n• Give cool water if fully conscious\n• Call 108 — heat stroke is life-threatening",
  snakebite:  "🐍 SNAKE BITE:\n• Keep person CALM and still (slows venom spread)\n• Immobilize bitten limb BELOW heart level\n• Remove tight items near bite (rings, watches)\n• Do NOT suck venom, cut, or apply tourniquet\n• Note snake appearance if safe\n• Rush to hospital with antivenin immediately",
};

const MEDICINES = {
  paracetamol: "💊 Paracetamol (Crocin/Dolo 650):\n• For: Fever, mild-moderate pain\n• Adults: 500-1000mg every 4-6 hours as needed\n• Maximum: 4 grams per day\n• ⚠️ NEVER exceed dose — serious liver damage risk\n• Children: 10-15mg/kg/dose (weight-based)\n• Confirm with your doctor or pharmacist",
  ibuprofen:   "💊 Ibuprofen (Brufen/Combiflam):\n• For: Pain, inflammation, fever\n• Adults: 200-400mg every 4-6 hours WITH food\n• ⚠️ Avoid on empty stomach\n• ⚠️ Avoid if kidney problems, stomach ulcers\n• Avoid in pregnancy (3rd trimester)\n• Confirm with your doctor or pharmacist",
  ors:         "💧 ORS (Oral Rehydration Solution):\n• For: Diarrhea, vomiting, dehydration\n• Mix 1 packet in 1 liter clean/boiled water\n• Sip slowly throughout the day\n• Adults: 200-400ml after each loose stool\n• Homemade: 6 level tsp sugar + ½ tsp salt in 1L water\n• Continue until diarrhea stops",
  antacid:     "🌿 Antacid (Digene/Gelusil):\n• For: Acidity, heartburn, stomach upset\n• Take 30-60 min after meals or at bedtime\n• Do not use for more than 2 weeks without doctor\n• ⚠️ May interact with other medicines — take 2h apart",
};

const SYMPTOMS = {
  fever:    "🌡️ FEVER GUIDANCE:\n• Normal body temp: 36.1-37.2°C\n• Fever starts at 37.5°C+\n• Rest, drink plenty of fluids\n• Paracetamol for temp above 38.5°C\n• ⚠️ See doctor: fever >39°C, lasts >3 days, or with rash/severe headache/stiff neck",
  headache: "🤕 HEADACHE GUIDANCE:\n• Rest in quiet, dark room\n• Stay hydrated (dehydration is common cause)\n• Paracetamol or ibuprofen for pain relief\n• ⚠️ URGENT: Sudden 'thunderclap' headache, worst ever, with stiff neck or vision changes — seek emergency care immediately",
  stomach:  "🤢 STOMACH PAIN:\n• Mild: rest, avoid solid food for a few hours, drink clear fluids\n• Take ORS if vomiting/diarrhea\n• ⚠️ URGENT: Severe pain, pain with fever >38.5°C, blood in stool/vomit — go to hospital",
  chest:    "⚠️ CHEST PAIN — POSSIBLE EMERGENCY:\n• Any chest pain should be evaluated by a doctor\n• **Call 108 immediately** if: crushing/pressure/squeezing pain, spreads to arm/jaw/back, sweating, breathlessness\n• Do NOT ignore chest pain, especially if over 40\n• Chew aspirin 325mg if heart attack suspected (no allergy)",
  diabetes: "🍬 DIABETES GUIDANCE:\n• **Low blood sugar**: Give glucose tablet, fruit juice, or sugar immediately (15g fast carbs)\n• Wait 15 min, recheck. Repeat if still low.\n• **High blood sugar symptoms**: extreme thirst, frequent urination, blurred vision — check blood glucose\n• Always carry glucose tablets\n• Never skip insulin/medication doses",
};

const EMERGENCY_NUMBERS = "📞 EMERGENCY NUMBERS (India):\n• 🚑 Ambulance: 108 (Free Govt)\n• 🆘 National Emergency: 112\n• 👮 Police: 100\n• 🔥 Fire: 101\n• ☠️ Poison Control: 1800-116-117\n• 👩 Women Helpline: 1091\n• 👶 Child Helpline: 1098\n• 🏥 108 is free from any phone, no balance needed";

const HEALTH_TIPS = [
  "💧 Drink at least 8 glasses (2 liters) of water daily — more in summer",
  "🏃 30 minutes of moderate exercise 5 days a week reduces heart disease risk by 35%",
  "😴 7-9 hours of sleep for adults — poor sleep raises diabetes and heart disease risk",
  "🥗 Eat 5 portions of fruits and vegetables daily — different colors provide different nutrients",
  "🚭 Smoking causes 1 in 5 deaths — quitting at any age significantly improves health",
  "🧴 Wash hands with soap for 20 seconds — prevents 80% of common infections",
  "🩺 Annual health checkup after age 40 — catch problems early when most treatable",
  "💊 Never self-medicate antibiotics — antibiotic resistance is a growing crisis",
  "🧘 15 minutes of meditation daily reduces stress hormones by up to 30%",
  "🦷 Brush twice daily + floss — gum disease is linked to heart disease and diabetes",
];

// ── Intent detection ──────────────────────────────────────────────────────────
function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (/emergency|ambulance|help.*urgent|urgent.*help|sos|critical|dying|died/i.test(m)) return "emergency";
  if (/cardiac|heart attack|chest.*pain|palpitation|angina/i.test(m)) return "cardiac";
  if (/stroke|paralysis|face.*droop|slurred.*speech/i.test(m)) return "stroke";
  if (/bleed|bleeding|cut.*deep|wound.*deep/i.test(m)) return "bleeding";
  if (/burn|scald|fire.*injury/i.test(m)) return "burns";
  if (/fracture|broken.*bone|sprain|dislocat/i.test(m)) return "fracture";
  if (/breath|choke|asthma|wheez|inhale|suffocating/i.test(m)) return "breathing";
  if (/choking|stuck.*throat|heimlich/i.test(m)) return "choking";
  if (/poison|swallowed.*wrong|overdose|toxic/i.test(m)) return "poisoning";
  if (/heat.*stroke|sunstroke|hypertherm/i.test(m)) return "heatstroke";
  if (/snake.*bite|snakebite|venom/i.test(m)) return "snakebite";
  if (/fever|temperature|bukhar/i.test(m)) return "fever";
  if (/headache|migraine|sir.*dard/i.test(m)) return "headache";
  if (/stomach|diarrhea|vomit|nausea|acidity|pet.*dard/i.test(m)) return "stomach";
  if (/chest.*pain|seene.*dard/i.test(m)) return "chest";
  if (/diabet|sugar.*level|insulin|blood sugar/i.test(m)) return "diabetes";
  if (/paracetamol|crocin|dolo|fever.*medicine|tylenol/i.test(m)) return "paracetamol";
  if (/ibuprofen|brufen|combiflam|pain.*killer|advil/i.test(m)) return "ibuprofen";
  if (/ors|dehydration|electrolyte/i.test(m)) return "ors";
  if (/antacid|acidity.*medicine|digene|gelusil|omeprazole/i.test(m)) return "antacid";
  if (/hospital.*near|nearest.*hospital|find.*hospital|hospital.*close|where.*hospital/i.test(m)) return "nearby_hospital";
  if (/appointment|book.*doctor|see.*doctor|schedule.*doctor/i.test(m)) return "appointment";
  if (/icu|bed.*available|blood.*available|oxygen.*hospital|ventilator/i.test(m)) return "resources";
  if (/tip|advice|health.*tip|stay.*healthy|healthy.*living/i.test(m)) return "health_tip";
  if (/number|helpline|phone.*emergency|call.*ambulance|emergency.*number/i.test(m)) return "numbers";
  if (/hello|hi|hey|help|what.*can.*you|assist|namaste|namaskar/i.test(m)) return "greeting";
  return "general";
}

// ── Main response generator ────────────────────────────────────────────────────
async function generateResponse(message, userLat, userLng, context = {}) {
  const intent = detectIntent(message);
  let response = "";
  let suggestions = [];
  let urgent = false;

  // Try Claude API first if configured
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-api03-your-key-here") {
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const result = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `You are CareAssist, an AI health assistant for Care-Connect emergency platform in India. 
Provide helpful, concise health guidance. For emergencies, always say "Call 108 immediately". 
Use **bold** for key actions. Keep responses under 200 words. Be empathetic and clear.
Emergency numbers: 108 (Ambulance), 112 (National), 1800-116-117 (Poison Control).`,
        messages: [{ role: "user", content: message }],
      });
      const aiResponse = result.content[0]?.text || "";
      if (aiResponse) {
        const isEmergency = /cardiac|stroke|unconscious|not breathing|call 108|emergency/i.test(aiResponse);
        return {
          response: aiResponse,
          suggestions: isEmergency
            ? ["Request Ambulance Now", "Call 108", "Find Nearest Hospital"]
            : ["Find Hospital", "Book Appointment", "More Health Tips"],
          urgent: isEmergency,
          intent: "ai_response",
        };
      }
    } catch (err) {
      console.warn("[AI Chat] Claude API failed, using rule-based:", err.message);
    }
  }

  // Rule-based fallback
  switch (intent) {
    case "emergency":
      urgent = true;
      response = `🚨 **EMERGENCY DETECTED**\n\n1. **Call 108** (Free Ambulance) or **112** RIGHT NOW\n2. Stay calm and give exact location\n3. Don't move person if spine/neck injury suspected\n4. Stay on call with dispatch until help arrives\n\n${EMERGENCY_NUMBERS}\n\nUse **"Request Ambulance"** button to dispatch nearest ambulance automatically.`;
      suggestions = ["Request Ambulance Now", "Find Nearest Hospital", "Call 108", "Call 112"];
      break;
    case "cardiac": urgent=true; response=FIRST_AID.cardiac; suggestions=["Request Ambulance","Find Cardiac Hospital","CPR Guide"]; break;
    case "stroke":  urgent=true; response=FIRST_AID.stroke;  suggestions=["Request Ambulance","Stroke Center Near Me"]; break;
    case "bleeding": response=FIRST_AID.bleeding; suggestions=["Request Ambulance","Find Nearest Hospital"]; break;
    case "burns":    response=FIRST_AID.burns;    suggestions=["Find Hospital","Request Ambulance"]; break;
    case "fracture": response=FIRST_AID.fracture; suggestions=["Find Hospital","Orthopedics Near Me"]; break;
    case "breathing": urgent=true; response=FIRST_AID.breathing; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "choking":  urgent=true; response=FIRST_AID.choking;  suggestions=["Request Ambulance"]; break;
    case "poisoning":urgent=true; response=FIRST_AID.poisoning;suggestions=["Request Ambulance","Poison Control: 1800-116-117"]; break;
    case "heatstroke":urgent=true; response=FIRST_AID.heatstroke;suggestions=["Request Ambulance","Find Hospital"]; break;
    case "snakebite":urgent=true; response=FIRST_AID.snakebite; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "fever":    response=SYMPTOMS.fever;    suggestions=["Find Hospital","Book Appointment","Paracetamol Info"]; break;
    case "headache": response=SYMPTOMS.headache; suggestions=["Find Hospital","Medicine Info"]; break;
    case "stomach":  response=SYMPTOMS.stomach;  suggestions=["Find Hospital","ORS Guide","Book Appointment"]; break;
    case "chest":    urgent=true; response=SYMPTOMS.chest; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "diabetes": response=SYMPTOMS.diabetes; suggestions=["Find Hospital","Book Appointment"]; break;
    case "paracetamol": response=MEDICINES.paracetamol; suggestions=["Find Pharmacy","Book Doctor"]; break;
    case "ibuprofen":   response=MEDICINES.ibuprofen;   suggestions=["Find Pharmacy"]; break;
    case "ors":         response=MEDICINES.ors;          suggestions=["Find Pharmacy"]; break;
    case "antacid":     response=MEDICINES.antacid;      suggestions=["Find Pharmacy"]; break;
    case "numbers":     response=EMERGENCY_NUMBERS;      suggestions=["Request Ambulance","Find Hospital"]; break;
    case "health_tip":
      const tip = HEALTH_TIPS[Math.floor(Math.random()*HEALTH_TIPS.length)];
      response = `💡 **Health Tip of the Day:**\n\n${tip}\n\nWould you like more health tips or information about a specific health topic?`;
      suggestions=["More Tips","Book Health Checkup","Find Hospital"]; break;
    case "appointment":
      response = `📅 **Book an Appointment:**\n\nI can help you book an appointment at any hospital.\n\n• Browse hospitals in the **Hospital List** tab\n• Click on any hospital card\n• Click **"Book Appointment"** button\n\nTell me which specialty you need and I'll help find a suitable hospital!`;
      suggestions=["Show Hospitals","General Medicine","Cardiology","Orthopedics"]; break;
    case "nearby_hospital":
      if (userLat && userLng) {
        try {
          const hospitals = await Hospital.find({ status: { $ne: "Offline" } }).lean();
          const nearby = hospitals
            .map(h => ({
              name: h.name, city: h.location?.city,
              dist: parseFloat(calcDist(userLat, userLng, h.location.lat, h.location.lng).toFixed(1)),
              icu: h.resources?.icuBeds?.available || 0, tier: h.tier
            }))
            .sort((a, b) => a.dist - b.dist).slice(0, 5);
          response = `🏥 **Nearest Hospitals to You:**\n\n${nearby.map((h, i) => `${i+1}. **${h.name}** (${h.dist}km)\n   📍 ${h.city} | 🛏 ICU: ${h.icu} | ${h.tier || "Hospital"}`).join("\n\n")}`;
          suggestions = ["Get Directions", "Request Ambulance", "Book Appointment"];
        } catch (e) { response = "Please enable location to find nearest hospitals."; }
      } else {
        response = `📍 **Enable your location** (click 'Detect Location') to find nearest hospitals.\n\nOr use the **Hospital Map** or **Hospital List** tab to see all hospitals.`;
        suggestions = ["Open Hospital Map", "Hospital List"];
      }
      break;
    case "resources":
      response = `🏥 **Hospital Resources (Live):**\n\nCheck real-time availability:\n• **ICU beds** — shown on hospital cards\n• **Oxygen levels** — displayed as O₂ %\n• **Ventilators** — shown in hospital details\n• **Blood bank** — look for 🩸 badge\n• **Ambulances** — available count shown\n\nGo to **Hospital Map** or **Hospital List** for live data.`;
      suggestions = ["View Hospital Map", "Hospital List"]; break;
    case "greeting":
      response = `👋 **Hello! I'm CareAssist — your 24/7 AI Health Assistant.**\n\nI can help you with:\n\n🚨 **Emergency Help** — First aid, ambulance dispatch\n🏥 **Find Hospitals** — Nearest with available beds\n📅 **Book Appointments** — Any specialty\n💊 **Medicine Info** — Dosage, usage, side effects\n🩺 **Symptoms Guide** — What to do\n💡 **Health Tips** — Stay healthy\n📞 **Emergency Numbers** — Quick access\n\nWhat do you need help with today?`;
      suggestions = ["Emergency Help", "Find Hospital", "Book Appointment", "Health Tips", "Medicine Info"]; break;
    default:
      response = `🤔 I can help you with:\n\n• 🚨 **Emergency first aid** (cardiac, stroke, burns, choking, etc.)\n• 🏥 **Finding nearby hospitals** with available beds\n• 📅 **Booking appointments**\n• 💊 **Medicine information** and dosage\n• 🩺 **Symptom guidance** and when to see a doctor\n• 📞 **Emergency numbers** (108, 112, etc.)\n• 💡 **Daily health tips**\n\nDescribe your health concern or ask about any of the above.`;
      suggestions = ["Emergency Help", "Find Hospital", "Book Appointment", "Medicine Info", "Health Tips"];
  }

  return { response, suggestions, urgent, intent };
}

module.exports = { generateResponse };
