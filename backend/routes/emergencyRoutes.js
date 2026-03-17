const r = require("express").Router();
const c = require("../controllers/emergencyController");
const auth = require("../middleware/authMiddleware");

// ── Public (no auth) ──────────────────────────────────────────
r.post("/",                       c.create);
r.get("/nearby-hospitals",        c.getNearbyHospitals);
r.get("/track/:requestId",        c.trackEmergency);
r.get("/geocode",                 c.geocodeLocation);

// ── Protected ─────────────────────────────────────────────────
r.get("/",                   auth, c.getAll);
r.get("/:id",                auth, c.getOne);
r.patch("/:id/status",       auth, c.updateStatus);
r.post("/:id/dispatch",      auth, c.dispatch);
r.post("/:id/ambulance-accept", auth, c.ambulanceAccept);
r.post("/:id/hospital-reject",  auth, c.hospitalReject);
r.post("/:id/patient-not-found",auth, c.patientNotFound);

module.exports = r;
