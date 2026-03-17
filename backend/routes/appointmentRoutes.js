const r = require("express").Router();
const c = require("../controllers/appointmentController");
const auth = require("../middleware/authMiddleware");
r.post("/",                           c.book);           // public - citizen books
r.get("/hospital/:hospitalId",   auth, c.getByHospital);
r.get("/hospital/:hospitalId/stats", auth, c.getStats);
r.patch("/:id/status",           auth, c.updateStatus);
module.exports = r;
