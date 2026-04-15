/**
 * AI Chat Service — CareAssist Health Assistant
 * Uses Claude API (claude-sonnet-4-5) when ANTHROPIC_API_KEY is set
 * Falls back to comprehensive rule-based responses automatically
 */
const Hospital = require("../models/Hospital");
const calcDist = require("../utils/distance");

// ── Rule-based knowledge base (fallback + context enrichment) ──
const FIRST_AID = {
  cardiac:   "🫀 CARDIAC EMERGENCY:\n• Call ambulance immediately (108)\n• Make person lie down, loosen clothing\n• If unconscious + no breathing: start CPR (30 compressions + 2 breaths)\n• If AED available, use it\n• Do NOT give water/food\n• Stay with patient until ambulance arrives",
  stroke:    "🧠 STROKE EMERGENCY (FAST Test):\n• Face — ask to smile, one side drooping?\n• Arms — can they raise both?\n• Speech — slurred or strange?\n• Time — call ambulance IMMEDIATELY\n• Do NOT give aspirin without doctor advice\n• Note time symptoms started",
  bleeding:  "🩸 SEVERE BLEEDING:\n• Apply direct pressure with clean cloth\n• Do NOT remove cloth (add more on top)\n• Elevate injured limb above heart level\n• Call ambulance for severe bleeding",
  burns:     "🔥 BURN TREATMENT:\n• Cool with cool (not cold) running water for 20 min\n• Do NOT use ice, butter, or toothpaste\n• Remove jewelry/tight clothing near burn\n• Cover with clean non-fluffy material",
  fracture:  "🦴 FRACTURE:\n• Do NOT try to straighten the limb\n• Immobilize with a splint/sling\n• Apply ice pack wrapped in cloth\n• Seek immediate medical attention",
  breathing: "💨 BREATHING DIFFICULTY:\n• Help person sit upright, leaning slightly forward\n• Loosen tight clothing around neck/chest\n• If person has inhaler, help them use it\n• Call ambulance if severe or getting worse",
  choking:   "😮 CHOKING:\n• Encourage strong coughing if person can cough\n• 5 back blows between shoulder blades\n• Then 5 abdominal thrusts (Heimlich)\n• Call ambulance if object not dislodged",
  poisoning: "☠️ POISONING:\n• Call Poison Control: 1800-116-117\n• Do NOT induce vomiting unless told to\n• Note what was taken and when\n• Keep person calm and still",
  heatstroke:"🌡️ HEAT STROKE:\n• Move to cool shaded area immediately\n• Apply cool wet cloths to body\n• Fan the person, give cool water if conscious\n• Call ambulance — heat stroke is life-threatening",
  snakebite: "🐍 SNAKE BITE:\n• Keep person CALM and still\n• Immobilize bitten limb below heart level\n• Remove rings/watches near bite\n• Do NOT suck venom or tie tourniquet\n• Rush to nearest hospital with antivenin",
};

const MEDICINES = {
  paracetamol:"💊 Paracetamol (Crocin/Dolo 650):\n• For: Fever, mild pain\n• Adults: 500-1000mg every 4-6 hours (max 4g/day)\n• Children: 10-15mg/kg/dose\n• ⚠️ Do NOT exceed dose — liver damage risk",
  ibuprofen:  "💊 Ibuprofen (Brufen/Combiflam):\n• For: Pain, inflammation, fever\n• Adults: 200-400mg every 4-6 hours with food\n• ⚠️ Avoid on empty stomach and in kidney problems",
  ors:        "💧 ORS (Oral Rehydration Solution):\n• For: Diarrhea, vomiting, dehydration\n• Dissolve 1 packet in 1 liter clean water\n• Sip slowly — 200-400ml after each loose stool\n• Homemade: 6 tsp sugar + ½ tsp salt in 1L water",
  antacid:    "🌿 Antacid (Digene/Gelusil):\n• For: Acidity, heartburn, stomach upset\n• Take 30 min after meals or at bedtime\n• Do not take for more than 2 weeks without doctor",
};

const SYMPTOMS = {
  fever:    "🌡️ FEVER:\n• Rest and drink plenty of fluids\n• Take paracetamol for temperature > 38.5°C\n• See doctor if: fever > 39°C, lasts > 3 days, or with rash/severe headache",
  headache: "🤕 HEADACHE:\n• Rest in quiet, dark room\n• Stay hydrated, take paracetamol or ibuprofen\n• ⚠️ URGENT: Sudden severe headache + stiff neck or vision changes — seek emergency care",
  stomach:  "🤢 STOMACH PAIN:\n• Mild: rest, avoid solid foods, drink clear fluids, take ORS\n• ⚠️ URGENT: Severe pain, fever, blood in stool — go to hospital",
  diabetes: "🍬 DIABETES:\n• Low blood sugar: Give sugar, fruit juice, or glucose tablet immediately\n• High blood sugar: excessive thirst, frequent urination — check blood sugar\n• Always carry glucose tablets",
};

const EMERGENCY_NUMBERS = "📞 EMERGENCY NUMBERS:\n• Ambulance: 108\n• National Emergency: 112\n• Police: 100 | Fire: 101\n• Poison Control: 1800-116-117\n• Women Helpline: 1091 | Child Helpline: 1098";

const HEALTH_TIPS = [
  "💧 Drink at least 8 glasses of water daily",
  "🏃 30 minutes of moderate exercise 5 days a week",
  "😴 7-9 hours of sleep for adults is essential",
  "🥗 Eat 5 portions of fruits/vegetables daily",
  "🚭 Avoid smoking — it causes 8 million deaths/year",
  "🧴 Wash hands for 20 seconds to prevent infection",
  "🩺 Annual health checkup recommended after age 40",
];

// ── Intent detection ───────────────────────────────────────────
function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (/emergency|ambulance|help.*urgent|urgent.*help|sos|critical/.test(m)) return "emergency";
  if (/cardiac|heart attack|chest.*pain|palpitation/.test(m))               return "cardiac";
  if (/stroke|paralysis|face.*droop/.test(m))                                return "stroke";
  if (/bleed|bleeding|cut.*deep|wound/.test(m))                              return "bleeding";
  if (/burn|fire.*injury|scald/.test(m))                                     return "burns";
  if (/fracture|broken.*bone|sprain/.test(m))                                return "fracture";
  if (/breath|asthma/.test(m))                                               return "breathing";
  if (/choke|choking|stuck.*throat/.test(m))                                 return "choking";
  if (/poison|swallowed|overdose/.test(m))                                   return "poisoning";
  if (/heat.*stroke|sunstroke/.test(m))                                      return "heatstroke";
  if (/snake.*bite|snakebite/.test(m))                                       return "snakebite";
  if (/fever|temperature/.test(m))                                           return "fever";
  if (/headache|migraine/.test(m))                                           return "headache";
  if (/stomach|diarrhea|vomit|nausea|acidity/.test(m))                       return "stomach";
  if (/diabete|sugar.*level|insulin/.test(m))                                return "diabetes";
  if (/paracetamol|crocin|dolo/.test(m))                                     return "paracetamol";
  if (/ibuprofen|brufen|pain.*killer/.test(m))                               return "ibuprofen";
  if (/\bors\b|dehydration/.test(m))                                         return "ors";
  if (/antacid|digene|gelusil/.test(m))                                      return "antacid";
  if (/hospital.*near|nearest.*hospital|find.*hospital/.test(m))             return "nearby_hospital";
  if (/appointment|book|schedule.*doctor/.test(m))                           return "appointment";
  if (/tip|advice|health.*tip|stay.*healthy/.test(m))                        return "health_tip";
  if (/number|helpline|emergency.*number|call/.test(m))                      return "numbers";
  if (/hello|hi\b|hey\b|help|what.*can.*you/.test(m))                        return "greeting";
  return "general";
}

// ── Nearby hospital lookup ─────────────────────────────────────
async function getNearbyHospitals(lat, lng) {
  try {
    const hospitals = await Hospital.find({ status: { $ne: "Offline" } }).lean();
    return hospitals
      .map(h => ({
        name: h.name,
        city: h.location?.city || "",
        dist: parseFloat(calcDist(lat, lng, h.location.lat, h.location.lng).toFixed(1)),
        icu: h.resources?.icuBeds?.available || 0,
        tier: h.tier || "",
        alertLevel: h.alertLevel || "Normal",
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  } catch(e) {
    return [];
  }
}

// ── Claude API call ─────────────────────────────────────────────
async function callClaudeAPI(message, nearbyHospitals) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const hospitalContext = nearbyHospitals.length > 0
    ? `\n\nNEARBY HOSPITALS (user's location):\n${nearbyHospitals.map((h,i) =>
        `${i+1}. ${h.name} — ${h.dist}km | ICU: ${h.icu} available | Alert: ${h.alertLevel} | ${h.city}`
      ).join("\n")}`
    : "";

  const systemPrompt = `You are CareAssist, a professional AI health assistant for the Care-Connect emergency healthcare platform in India (Madhya Pradesh region).

Your role:
- Provide accurate, actionable first aid and health guidance
- Help users find hospitals and book appointments on the platform
- Provide emergency numbers when needed
- Give clear, concise responses with bullet points
- Always prioritize safety — recommend calling 108 or 112 for life-threatening emergencies
- Use medical knowledge appropriate for Indian healthcare context
- Format responses with **bold** for important points
- Keep responses focused and under 200 words unless detailed first aid is needed

Emergency numbers in India: 108 (Ambulance), 112 (National Emergency), 100 (Police), 101 (Fire), 1800-116-117 (Poison Control)

Platform features you can guide users to:
- Request Ambulance button (dispatches nearest ambulance automatically)
- Hospital Map (live ICU/bed availability)
- Hospital List (search and filter hospitals)
- Book Appointment (at any hospital)
- Track Emergency (real-time ambulance tracking)
${hospitalContext}

Always end responses with 2-3 relevant suggestion chips in this format:
SUGGESTIONS: suggestion1 | suggestion2 | suggestion3`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const fullText = response.content[0]?.text || "";

  // Parse suggestions from the response
  const sugMatch = fullText.match(/SUGGESTIONS:\s*(.+)$/m);
  const suggestions = sugMatch
    ? sugMatch[1].split("|").map(s => s.trim()).filter(Boolean).slice(0, 4)
    : ["Find Hospital", "Book Appointment", "Emergency Numbers"];

  // Remove suggestions line from the response text
  const cleanText = fullText.replace(/SUGGESTIONS:.*$/m, "").trim();

  return { text: cleanText, suggestions };
}

// ── Rule-based response ─────────────────────────────────────────
async function getRuleBasedResponse(intent, userLat, userLng) {
  let response = "";
  let suggestions = [];
  let urgent = false;

  switch(intent) {
    case "emergency":
      urgent = true;
      response = `🚨 **EMERGENCY DETECTED**\n\nImmediate steps:\n1. **Call 108** (Ambulance) or **112** (National Emergency)\n2. Stay calm and give your exact location\n3. Don't move the patient if spine/neck injury suspected\n4. Stay on the line with dispatch\n\n${EMERGENCY_NUMBERS}\n\nUse the **Request Ambulance** button to auto-dispatch the nearest ambulance.`;
      suggestions = ["Request Ambulance Now", "Find Nearest Hospital", "Call 108"];
      break;
    case "cardiac":    urgent=true;  response=FIRST_AID.cardiac;    suggestions=["Request Ambulance","Find Hospital","CPR Steps"]; break;
    case "stroke":     urgent=true;  response=FIRST_AID.stroke;     suggestions=["Request Ambulance","Find Stroke Center"]; break;
    case "bleeding":                 response=FIRST_AID.bleeding;   suggestions=["Find Nearest Hospital","Request Ambulance"]; break;
    case "burns":                    response=FIRST_AID.burns;      suggestions=["Find Hospital","Request Ambulance"]; break;
    case "fracture":                 response=FIRST_AID.fracture;   suggestions=["Find Hospital","Orthopedics Near Me"]; break;
    case "breathing":  urgent=true;  response=FIRST_AID.breathing;  suggestions=["Request Ambulance","Find Hospital"]; break;
    case "choking":    urgent=true;  response=FIRST_AID.choking;    suggestions=["Request Ambulance"]; break;
    case "poisoning":  urgent=true;  response=FIRST_AID.poisoning;  suggestions=["Request Ambulance","Poison Control: 1800-116-117"]; break;
    case "heatstroke": urgent=true;  response=FIRST_AID.heatstroke; suggestions=["Request Ambulance","Find Hospital"]; break;
    case "snakebite":  urgent=true;  response=FIRST_AID.snakebite;  suggestions=["Request Ambulance","Find Hospital"]; break;
    case "fever":                    response=SYMPTOMS.fever;       suggestions=["Find Hospital","Book Appointment","Paracetamol Info"]; break;
    case "headache":                 response=SYMPTOMS.headache;    suggestions=["Find Hospital","Medicine Info"]; break;
    case "stomach":                  response=SYMPTOMS.stomach;     suggestions=["Find Hospital","ORS Info","Book Appointment"]; break;
    case "diabetes":                 response=SYMPTOMS.diabetes;    suggestions=["Find Hospital","Book Appointment"]; break;
    case "paracetamol":              response=MEDICINES.paracetamol; suggestions=["Find Pharmacy","Book Doctor"]; break;
    case "ibuprofen":                response=MEDICINES.ibuprofen;  suggestions=["Find Pharmacy"]; break;
    case "ors":                      response=MEDICINES.ors;        suggestions=["Find Pharmacy"]; break;
    case "antacid":                  response=MEDICINES.antacid;    suggestions=["Find Pharmacy"]; break;
    case "numbers":                  response=EMERGENCY_NUMBERS;    suggestions=["Request Ambulance","Find Hospital"]; break;
    case "health_tip":
      const tip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
      response = `💡 **Health Tip:**\n\n${tip}\n\nWould you like more tips or health information?`;
      suggestions = ["More Tips","Book Health Checkup","Find Hospital"]; break;
    case "appointment":
      response = `📅 **Book an Appointment:**\n\n• Browse the **Hospital List** tab\n• Click any hospital card\n• Click **"Book Appointment"** button\n\nOr tell me which specialty you need and I'll help!`;
      suggestions = ["Show Hospitals","Cardiology","Orthopedics","General Medicine"]; break;
    case "nearby_hospital":
      if (userLat && userLng) {
        const nearby = await getNearbyHospitals(userLat, userLng);
        if (nearby.length > 0) {
          response = `🏥 **Nearest Hospitals to You:**\n\n${nearby.map((h,i) =>
            `${i+1}. **${h.name}** (${h.dist}km)\n   📍 ${h.city} | 🛏 ICU: ${h.icu} | ${h.alertLevel}`
          ).join("\n\n")}`;
          suggestions = ["Request Ambulance","Book Appointment","Get Directions"];
        } else {
          response = "📍 Enable location to find nearby hospitals, or browse the **Hospital Map** tab.";
          suggestions = ["Open Hospital Map","Hospital List"];
        }
      } else {
        response = "📍 **Enable your location** (click 'Detect Location') to find the nearest hospitals.\n\nOr browse the **Hospital Map** or **Hospital List** tab to see all available hospitals.";
        suggestions = ["Open Hospital Map","Hospital List"];
      }
      break;
    case "greeting":
      response = `👋 **Hello! I'm CareAssist — your AI Health Assistant.**\n\nI can help you with:\n\n🚨 **Emergency Help** — First aid, ambulance dispatch\n🏥 **Find Hospitals** — Live ICU/bed availability\n📅 **Book Appointments** — Any specialty\n💊 **Medicine Info** — Dosage, usage, side effects\n🩺 **Symptom Guidance** — What to do\n💡 **Health Tips** — Stay healthy\n\nWhat do you need help with today?`;
      suggestions = ["Emergency Help","Find Hospital","Book Appointment","Medicine Info","Health Tips"]; break;
    default:
      response = `🤔 I can help you with:\n\n• 🚨 **Emergency first aid** (cardiac, stroke, burns, etc.)\n• 🏥 **Finding nearby hospitals**\n• 📅 **Booking appointments**\n• 💊 **Medicine information & dosage**\n• 🩺 **Symptom guidance**\n• 📞 **Emergency numbers**\n• 💡 **Health tips**\n\nPlease describe your health concern!`;
      suggestions = ["Emergency Help","Find Hospital","Book Appointment","Medicine Info","Health Tips"];
  }

  return { response, suggestions, urgent };
}

// ── Main export ────────────────────────────────────────────────
async function generateResponse(message, userLat, userLng, context = {}) {
  const intent   = detectIntent(message);
  const isUrgent = ["emergency","cardiac","stroke","breathing","choking","poisoning","heatstroke","snakebite"].includes(intent);

  // For urgent emergencies, always use rule-based (faster, more reliable)
  if (isUrgent) {
    const { response, suggestions, urgent } = await getRuleBasedResponse(intent, userLat, userLng);
    return { response, suggestions, urgent, intent, source: "rules" };
  }

  // Try Claude API if key is set
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-api03-...") {
    try {
      // Get nearby hospitals for context enrichment
      const nearby = (userLat && userLng) ? await getNearbyHospitals(userLat, userLng) : [];

      const { text, suggestions } = await callClaudeAPI(message, nearby);
      return {
        response:    text,
        suggestions: suggestions,
        urgent:      false,
        intent,
        source:      "claude",
      };
    } catch(e) {
      console.warn("[CareAssist] Claude API failed, using rules:", e.message);
      // Fall through to rule-based
    }
  }

  // Rule-based fallback
  const { response, suggestions, urgent } = await getRuleBasedResponse(intent, userLat, userLng);
  return { response, suggestions, urgent, intent, source: "rules" };
}

module.exports = { generateResponse };
