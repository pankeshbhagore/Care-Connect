require("dotenv").config();

// ── Validate ENV ─────────────────────────────
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

// ── Imports ─────────────────────────────────
const express    = require("express");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const connectDB  = require("./config/db");

const Ambulance        = require("./models/Ambulance");
const EmergencyRequest = require("./models/EmergencyRequest");

const { getCityHealth }  = require("./services/healthPrediction");
const { checkStaleness } = require("./controllers/hospitalController");
const { activeCount }    = require("./services/ambulanceSimulator");

const distance = require("./utils/distance");

// ── Init ────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

connectDB();

const app    = express();
const server = http.createServer(app);

// ── CORS Setup ─────────────────────────────
const ALLOWED = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean)
  .concat(["http://localhost:5173", "http://localhost:3000"]);

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (/\.vercel\.app$/.test(origin)) return cb(null, true);
  if (ALLOWED.includes(origin)) return cb(null, true);

  console.warn("Blocked CORS:", origin);
  cb(new Error("Not allowed by CORS"));
};

// ── Socket.io ──────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

// ── Middleware ─────────────────────────────
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/hospitals", require("./routes/hospitalRoutes"));
app.use("/api/transfers", require("./routes/transferRoutes"));
app.use("/api/ambulances", require("./routes/ambulanceRoutes"));
app.use("/api/emergencies", require("./routes/emergencyRoutes"));
app.use("/api/predictions", require("./routes/predictionRoutes"));
app.use("/api/hospital-registration", require("./routes/hospitalRegistrationRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/appointments", require("./routes/appointmentRoutes"));

app.get("/", (req, res) =>
  res.json({
    status: "ok",
    version: "v4",
    message: "Healthcare Platform 🏥",
  })
);

// ── Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ── Socket Events ──────────────────────────
io.on("connection", socket => {
  console.log("Socket connected:", socket.id);

  socket.on("ambulance:location", async data => {
    const { ambulanceId, lat, lng } = data;

    io.emit("ambulanceLocation", data);

    try {
      await Ambulance.findOneAndUpdate(
        { ambulanceId },
        {
          "location.lat": lat,
          "location.lng": lng,
          "location.lastUpdated": new Date(),
        }
      );
    } catch (err) {
      console.error(err);
    }
  });
});

// ── Jobs ───────────────────────────────────

// City health
setInterval(async () => {
  try {
    const data = await getCityHealth();
    io.emit("cityHealthUpdate", data);
  } catch (e) {
    console.error(e);
  }
}, 30000);

// Stale data
setInterval(async () => {
  try {
    const stale = await checkStaleness();

    stale.forEach(h => {
      io.emit("resourceAlert", {
        hospitalId: h._id,
        message: "Data outdated",
      });
    });
  } catch (e) {
    console.error(e);
  }
}, 30 * 60 * 1000);

// Queue processor
setInterval(async () => {
  try {
    const queued = await EmergencyRequest.find({ status: "Queued" });

    for (const em of queued) {
      const ambs = await Ambulance.find({ status: "Available" });

      if (!ambs.length) break;

      const nearest = ambs
        .filter(a => a.location)
        .map(a => ({
          ...a._doc,
          dist: distance(
            em.location.lat,
            em.location.lng,
            a.location.lat,
            a.location.lng
          ),
        }))
        .sort((a, b) => a.dist - b.dist)[0];

      if (nearest) {
        await EmergencyRequest.findByIdAndUpdate(em._id, {
          assignedAmbulance: nearest._id,
          status: "Assigned",
        });

        await Ambulance.findByIdAndUpdate(nearest._id, {
          status: "Dispatched",
        });

        io.emit("ambulanceAssigned", {
          emergencyId: em._id,
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
}, 30000);

// ── Start Server ───────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});