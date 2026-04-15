const PatientTransfer = require("../models/PatientTransfer");
const Hospital        = require("../models/Hospital");
const calcDistance    = require("../utils/distance");

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.hospital) filter.$or = [{ fromHospital: req.query.hospital }, { toHospital: req.query.hospital }];
    const list = await PatientTransfer.find(filter)
      .populate("fromHospital", "name location.city")
      .populate("toHospital",   "name location.city")
      .sort({ createdAt: -1 }).limit(200).lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const t = await PatientTransfer.findById(req.params.id).populate("fromHospital").populate("toHospital");
    if (!t) return res.status(404).json({ message: "Not found" });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const {
      fromHospitalId, toHospitalId,
      patientName, patientAge, patientGender, bloodGroup,
      // accept BOTH field name variants from frontend
      condition, patientCondition,
      priority,
      notes, transferReason,
    } = req.body;

    if (!fromHospitalId || !toHospitalId)
      return res.status(400).json({ message: "fromHospitalId and toHospitalId required" });

    const [from, to] = await Promise.all([
      Hospital.findById(fromHospitalId),
      Hospital.findById(toHospitalId),
    ]);
    if (!from || !to) return res.status(404).json({ message: "Hospital not found" });

    const distKm  = parseFloat(calcDistance(from.location.lat, from.location.lng, to.location.lat, to.location.lng).toFixed(1));
    const estMins = Math.round((distKm / 60) * 60);
    const count   = await PatientTransfer.countDocuments();
    const transferId = `TRF-${String(count + 1).padStart(5, "0")}`;

    const transfer = await PatientTransfer.create({
      transferId,
      fromHospital: fromHospitalId,
      toHospital:   toHospitalId,
      patientName:  patientName || "Anonymous",
      patientAge:   parseInt(patientAge) || 0,
      patientGender: patientGender || "Other",
      bloodGroup:   bloodGroup || "",
      // accept either field name
      condition:    condition || patientCondition || "",
      priority:     priority || "Normal",
      distanceKm:   distKm,
      estimatedMinutes: estMins,
      requestedBy:  req.user?.id || null,
      // accept either field name for notes/reason
      notes:        notes || transferReason || "",
    });

    await transfer.populate(["fromHospital", "toHospital"]);
    const io = req.app.get("io");
    if (io) {
      const payload = { ...transfer.toObject(), fromName: from.name, toName: to.name };
      // FIX 5: Notify destination hospital room specifically + admin
      io.to(`hospital:${toHospitalId}`).emit("newTransfer", payload);
      io.to("admin").emit("newTransfer", payload);
    }
    res.status(201).json(transfer);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, rejectionReason, vehicleUsed } = req.body;
    const t = await PatientTransfer.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });

    // FIX 2: validate status against model enum
    const VALID = ["Requested","Accepted","InTransit","Completed","Cancelled","Rejected"];
    if (!VALID.includes(status))
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID.join(", ")}` });

    t.status = status;
    if (status === "Accepted")  t.acceptedAt  = new Date();
    if (status === "Completed") t.completedAt = new Date();
    if (status === "Cancelled" || status === "Rejected") {
      t.cancelledAt = new Date();
      t.rejectionReason = rejectionReason || "";
    }
    if (vehicleUsed) t.vehicleUsed = vehicleUsed;
    await t.save();
    await t.populate(["fromHospital", "toHospital"]);

    const io = req.app.get("io");
    if (io) {
      const payload = t.toObject();
      // Notify both hospitals + admin
      io.to(`hospital:${t.fromHospital?._id || t.fromHospital}`).emit("transferUpdate", payload);
      io.to(`hospital:${t.toHospital?._id  || t.toHospital}`).emit("transferUpdate", payload);
      io.to("admin").emit("transferUpdate", payload);
    }
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// FIX 3: return flat shape that frontend expects
exports.suggest = async (req, res) => {
  try {
    const { fromHospitalId, specialty } = req.query;
    if (!fromHospitalId) return res.status(400).json({ message: "fromHospitalId required" });
    const from = await Hospital.findById(fromHospitalId).lean();
    if (!from) return res.status(404).json({ message: "Not found" });

    const hospitals = await Hospital.find({ _id: { $ne: fromHospitalId }, status: { $ne: "Offline" } }).lean();
    const scored = hospitals.map(h => {
      const dist  = calcDistance(from.location.lat, from.location.lng, h.location.lat, h.location.lng);
      const r     = h.resources;
      const icuAvailable = r.icuBeds?.available || 0;
      const icuTotal     = r.icuBeds?.total     || 1;
      const ventAvail    = r.ventilators?.available || 0;
      const icuA  = icuAvailable / Math.max(1, icuTotal);
      const ventA = ventAvail / Math.max(1, r.ventilators?.total || 1);
      const specB = specialty && h.specialties?.includes(specialty) ? 0.2 : 0;
      const score = Math.max(0, 1 - dist / 100) * 0.45 + icuA * 0.30 + ventA * 0.15 + specB;
      return {
        // FIX 3: flat shape matching frontend expectations
        hospitalId:   h._id,
        hospitalName: h.name,
        city:         h.location?.city || "",
        icuAvailable,
        icuTotal,
        ventAvailable: ventAvail,
        oxygenLevel:  r.oxygenLevel || 0,
        distKm:       parseFloat(dist.toFixed(1)),
        estMins:      Math.round((dist / 60) * 60),
        score:        parseFloat(score.toFixed(3)),
        alertLevel:   h.alertLevel,
        reason: `${dist.toFixed(0)}km away | ICU: ${icuAvailable}/${icuTotal} free | Vent: ${ventAvail} | O₂: ${r.oxygenLevel || 0}%`,
      };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    res.json({ suggestions: scored, from: from.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.stats = async (req, res) => {
  try {
    const filter = {};
    if (req.query.hospital) {
      filter.$or = [{ fromHospital: req.query.hospital }, { toHospital: req.query.hospital }];
    }
    const all   = await PatientTransfer.find(filter).lean();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    res.json({
      total:     all.length,
      today:     all.filter(t => new Date(t.createdAt) >= today).length,
      pending:   all.filter(t => t.status === "Requested").length,
      inTransit: all.filter(t => t.status === "InTransit").length,
      completed: all.filter(t => t.status === "Completed").length,
      critical:  all.filter(t => t.priority === "Critical").length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
