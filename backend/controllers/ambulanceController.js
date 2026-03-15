const Ambulance = require("../models/Ambulance");
const Hospital  = require("../models/Hospital");

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.hospital) filter.hospital = req.query.hospital;
    const list = await Ambulance.find(filter).populate("hospital","name location.city").lean();
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

// Live GPS location update
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

exports.remove = async (req, res) => {
  try {
    await Ambulance.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

