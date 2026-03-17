const r    = require("express").Router();
const c    = require("../controllers/hospitalRegistrationController");
const auth = require("../middleware/authMiddleware");

// Public — no auth needed
r.get("/verify/:token",           c.getVerificationInfo);
r.post("/verify/:token",          c.completeVerification);
r.post("/self-register",          c.selfRegister);
r.get("/geocode",                 c.geocodeAddress);

// Admin protected
r.post("/invite",            auth, c.adminInviteHospital);
r.post("/resend/:id",        auth, c.resendVerification);
r.post("/approve/:id",       auth, c.approveHospital);
r.get("/status",             auth, c.getRegistrationStatus);

module.exports = r;
