require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const connectDB  = require("./config/db");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

connectDB();

const app    = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────
const ALLOWED = (process.env.FRONTEND_URL || "")
  .split(",").map(s => s.trim()).filter(Boolean)
  .concat(["http://localhost:5173", "http://localhost:3000"]);

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (/\.vercel\.app$/.test(origin)) return cb(null, true);
  if (ALLOWED.includes(origin)) return cb(null, true);
  cb(new Error("CORS: " + origin + " not allowed"));
};

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"], credentials: true },
  pingTimeout: 60000, pingInterval: 25000,
  transports: ["websocket","polling"],
});

app.set("io", io);
app.use(cors({ origin: corsOrigin, credentials: true, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/admin",       require("./routes/adminRoutes"));
app.use("/api/hospitals",   require("./routes/hospitalRoutes"));
app.use("/api/transfers",   require("./routes/transferRoutes"));
app.use("/api/ambulances",  require("./routes/ambulanceRoutes"));
app.use("/api/emergencies", require("./routes/emergencyRoutes"));
app.use("/api/predictions", require("./routes/predictionRoutes"));

app.get("/", (req, res) => res.json({
  status: "ok", version: "v1",
  message: "Healthcare Resource Coordination Platform 🏥",
  timestamp: new Date().toISOString(),
}));

app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on("connection", socket => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("join-room",       room => socket.join(room));
  socket.on("join-admin",      ()   => socket.join("admin"));
  socket.on("join-operator",   ()   => socket.join("operators"));
  socket.on("join-hospital",   id   => socket.join(`hospital:${id}`));
  socket.on("join-ambulance",  id   => socket.join(`ambulance:${id}`));

  // Live ambulance GPS from driver app
  socket.on("ambulance:location", async data => {
    const { ambulanceId, lat, lng, speed } = data;
    io.emit("ambulanceLocation", { ambulanceId, lat, lng, speed, ts: Date.now() });
    try {
      const Ambulance = require("./models/Ambulance");
      await Ambulance.findOneAndUpdate({ ambulanceId }, { "location.lat":lat, "location.lng":lng, speed:speed||0, "location.lastUpdated":new Date() });
    } catch(e) {}
  });

  socket.on("disconnect", reason => console.log(`[Socket] Disconnected: ${socket.id} — ${reason}`));
});

// ── Periodic city health broadcast ───────────────────────────
const { getCityHealth } = require("./services/healthPrediction");
setInterval(async () => {
  try {
    const metrics = await getCityHealth();
    io.emit("cityHealthUpdate", metrics);
  } catch(e) {}
}, 30000);

// ── Ambulance simulator (demo mode only) ─────────────────────
const Ambulance = require("./models/Ambulance");
setInterval(async () => {
  try {
    const ambs = await Ambulance.find({ status: { $in: ["Dispatched","Returning"] } }).lean();
    for (const a of ambs) {
      if (!a.location?.lat) continue;
      const jitter = () => (Math.random() - 0.5) * 0.002;
      const newLat = a.location.lat + jitter();
      const newLng = a.location.lng + jitter();
      await Ambulance.findByIdAndUpdate(a._id, { "location.lat": newLat, "location.lng": newLng, "location.lastUpdated": new Date(), speed: Math.round(40 + Math.random()*30) });
      io.emit("ambulanceLocation", { ambulanceId: a.ambulanceId, lat: newLat, lng: newLng, speed: Math.round(40+Math.random()*30), ts: Date.now() });
    }
  } catch(e) {}
}, 5000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Healthcare Platform running on port ${PORT}`);
  console.log(`   Frontend: ${FRONTEND_URL}`);
});
