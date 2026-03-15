const r = require("express").Router();
const c = require("../controllers/emergencyController");
const auth = require("../middleware/authMiddleware");

// Public routes (no auth needed for citizens)
r.post("/",                             c.create);          // citizen reports emergency
r.get("/nearby-hospitals",              c.getNearbyHospitals); // citizen sees nearby hospitals
r.get("/track/:requestId",              c.trackEmergency);  // citizen tracks their request

// Protected routes
r.get("/",                         auth, c.getAll);
r.get("/:id",                      auth, c.getOne);
r.patch("/:id/status",             auth, c.updateStatus);
r.post("/:id/dispatch",            auth, c.dispatch);
r.post("/:id/ambulance-accept",    auth, c.ambulanceAccept);

module.exports = r;
