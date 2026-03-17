const Ambulance  = require("../models/Ambulance");
const Hospital   = require("../models/Hospital");
const routeOpt   = require("../services/routeOptimizer");
const ambSim     = require("../services/ambulanceSimulator");

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.hospital) filter.hospital = req.query.hospital;
    const list = await Ambulance.find(filter).populate("hospital","name location.city location.lat location.lng").lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const a = await Ambulance.findById(req.params.id).populate("hospital","name location.city");
    if (!a) return res.status(404).json({ message: "Not found" });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const count = await Ambulance.countDocuments();
    const ambulanceId = `AMB-${String(count+1).padStart(4,"0")}`;
    const amb = await Ambulance.create({ ...req.body, ambulanceId });
    req.app.get("io")?.emit("ambulanceAdded", amb);
    res.status(201).json(amb);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const a = await Ambulance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!a) return res.status(404).json({ message: "Not found" });
    req.app.get("io")?.emit("ambulanceUpdate", a);
    res.json(a);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng, address, speed } = req.body;
    const a = await Ambulance.findById(req.params.id);
    if (!a) return res.status(404).json({ message: "Not found" });
    a.location = { lat, lng, address: address||"", lastUpdated: new Date() };
    if (speed !== undefined) a.speed = speed;
    await a.save();
    req.app.get("io")?.emit("ambulanceLocation", { id: a._id, ambulanceId: a.ambulanceId, lat, lng, status: a.status, speed: a.speed });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── NEW: Dispatch with full route simulation ──────────────────
exports.dispatch = async (req, res) => {
  try {
    const amb = await Ambulance.findById(req.params.id);
    if (!amb) return res.status(404).json({ message: "Not found" });
    const { targetLat, targetLng, emergencyRequestId, priority } = req.body;
    if (!targetLat || !targetLng) return res.status(400).json({ message: "targetLat, targetLng required" });

    // Get route from OSRM
    const routeResult = await routeOpt.getOptimizedRoute(
      amb.location.lat, amb.location.lng,
      parseFloat(targetLat), parseFloat(targetLng)
    );
    const route = routeResult ? {
      coords: routeResult.geometry,
      distanceKm: parseFloat((routeResult.distance/1000).toFixed(1)),
      durationMin: Math.round(routeResult.duration/60),
    } : null;

    amb.status = "Dispatched";
    await amb.save();

    const io = req.app.get("io");
    io?.emit("ambulanceUpdate", amb.toObject());

    // Start simulation in background
    if (route?.coords?.length > 1) {
      ambSim.simulate(io, amb.ambulanceId, emergencyRequestId||"demo", route.coords, priority||"High");
    }

    res.json({ ok: true, ambulance: amb, route: { distanceKm: route?.distanceKm, durationMin: route?.durationMin, points: route?.coords?.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ── Stats summary ─────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const all = await Ambulance.find().lean();
    const byStatus = {};
    for (const a of all) byStatus[a.status] = (byStatus[a.status]||0)+1;
    res.json({ total: all.length, byStatus, activeSimulations: ambSim.activeCount() });
  } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Ambulance.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
