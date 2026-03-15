const r = require("express").Router();
const c = require("../controllers/emergencyController");
const auth = require("../middleware/authMiddleware");
r.get("/",                  auth, c.getAll);
r.post("/",                 auth, c.create);
r.patch("/:id/status",      auth, c.updateStatus);
r.post("/:id/dispatch",     auth, c.dispatch);
module.exports = r;

