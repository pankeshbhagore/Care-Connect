require("dotenv").config();
// ── Startup validation ────────────────────────────────────────
// This catches "undefined controller function" errors with clear messages
const validateRoute = (name, fn) => {
  if (typeof fn !== 'function') {
    process.exit(1);
  }
  return fn;
};

const express    = require("express");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const connectDB  = require("./config/db");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
connectDB();

const app    = express();
const server = http.createServer(app);

const ALLOWED = (process.env.FRONTEND_URL||"").split(",").map(s=>s.trim()).filter(Boolean)
  .concat(["http://localhost:5173","http://localhost:3000"]);

const corsOrigin = (origin, cb) => {
  if(!origin) return cb(null,true);
  if(/\.vercel\.app$/.test(origin)) return cb(null,true);
  if(ALLOWED.includes(origin)) return cb(null,true);
  cb(null, true); // allow all in dev — restrict in prod
};

const io = new Server(server, {
  cors:{ origin:corsOrigin, methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"], credentials:true },
  pingTimeout:60000, pingInterval:25000,
  transports:["websocket","polling"],
  // Auto-reconnection handled client-side
});

app.set("io", io);
app.use(cors({ origin:corsOrigin, credentials:true, methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allowedHeaders:["Content-Type","Authorization"] }));
app.use(express.json({ limit:"5mb" }));
app.use(express.urlencoded({ extended:true }));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/admin",       require("./routes/adminRoutes"));
app.use("/api/hospitals",   require("./routes/hospitalRoutes"));
app.use("/api/transfers",   require("./routes/transferRoutes"));
app.use("/api/ambulances",  require("./routes/ambulanceRoutes"));
app.use("/api/emergencies", require("./routes/emergencyRoutes"));
app.use("/api/predictions", require("./routes/predictionRoutes"));
app.use("/api/hospital-registration", require("./routes/hospitalRegistrationRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/appointments", require("./routes/appointmentRoutes"));

app.get("/", (req,res) => res.json({ status:"ok", version:"v4", message:"Healthcare Resource Coordination Platform 🏥", timestamp:new Date().toISOString() }));
app.use((err,req,res,next) => { console.error("Error:",err.stack); res.status(500).json({ error:"Internal server error", message:err.message }); });

// ── Socket.io ─────────────────────────────────────────────────
io.on("connection", socket => {
  console.log(`[Socket] +${socket.id}`);
  socket.on("join-room",      room => socket.join(room));
  socket.on("join-admin",     ()   => socket.join("admin"));
  socket.on("join-hospital",  id   => socket.join(`hospital:${id}`));
  socket.on("join-ambulance", id   => socket.join(`ambulance:${id}`));
  socket.on("join-ambsim",    id   => socket.join(`ambsim:${id}`));

  // Live GPS from driver
  socket.on("ambulance:location", async data => {
    const { ambulanceId, lat, lng, speed } = data;
    io.emit("ambulanceLocation", { ambulanceId, lat, lng, speed, ts:Date.now() });
    try {
      await require("./models/Ambulance").findOneAndUpdate({ambulanceId},{"location.lat":lat,"location.lng":lng,speed:speed||0,"location.lastUpdated":new Date()});
    } catch(e){}
  });

  // Socket reconnection message (Edge case #15)
  socket.on("reconnect_attempt", () => { console.log(`[Socket] Reconnect attempt: ${socket.id}`); });
  socket.on("disconnect", reason => console.log(`[Socket] -${socket.id} — ${reason}`));
});

// ── Periodic jobs ─────────────────────────────────────────────
const { getCityHealth }     = require("./services/healthPrediction");
const { checkStaleness }    = require("./controllers/hospitalController");
const Ambulance             = require("./models/Ambulance");
const { activeCount }       = require("./services/ambulanceSimulator");
const EmergencyRequest      = require("./models/EmergencyRequest");

// City health broadcast every 30s
setInterval(async () => {
  try { io.emit("cityHealthUpdate", await getCityHealth()); } catch(e){}
}, 30000);

// Resource staleness alerts every 30 min (Edge case #7)
setInterval(async () => {
  try {
    const stale = await checkStaleness();
    stale.forEach(h => {
      io.emit("resourceAlert",{ hospitalId:h._id, hospitalName:h.name, alertType:"StaleData", severity:"Medium",
        message:`⚠ ${h.name}: Resource data outdated (${h.hoursStale}h ago). Please update.` });
    });
  } catch(e){}
}, 30 * 60 * 1000);

// Queue processor — try to dispatch queued emergencies every 30s (Edge case #1)
setInterval(async () => {
  try {
    const queued = await EmergencyRequest.find({status:"Queued"}).sort({queuedAt:1}).limit(5);
    for (const em of queued) {
      const ambs = await Ambulance.find({status:"Available"}).lean();
      if (!ambs.length) break;
      const nearest = ambs.map(a=>({...a,dist:require("./utils/distance")(em.location.lat,em.location.lng,a.location?.lat||0,a.location?.lng||0)})).sort((a,b)=>a.dist-b.dist)[0];
      if (nearest) {
        await EmergencyRequest.findByIdAndUpdate(em._id,{assignedAmbulance:nearest._id,status:"AmbulanceRequested",queuePosition:0});
        await Ambulance.findByIdAndUpdate(nearest._id,{status:"Dispatched"});
        io.emit("queueUpdate",{ requestId:em.requestId, message:"🚑 Ambulance now assigned to your request! Queue cleared.", ambulanceId:nearest.ambulanceId });
        io.emit(`ambulance:${nearest.ambulanceId}:dispatch`,{ emergency:em, instruction:"Queued emergency dispatching now" });
      }
    }
  } catch(e){}
}, 30000);

// Ambulance status heartbeat
setInterval(async () => {
  try {
    const ambs = await Ambulance.find({status:"Available"}).lean();
    io.emit("ambulanceStatusBroadcast",{ available:ambs.length, ambulances:ambs.map(a=>({ambulanceId:a.ambulanceId,lat:a.location?.lat,lng:a.location?.lng})), sims:activeCount() });
  } catch(e){}
}, 10000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { console.log(`✅ Healthcare Platform on port ${PORT}`); });
