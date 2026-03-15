const r = require("express").Router();
const c = require("../controllers/adminController");
const auth = require("../middleware/authMiddleware");
r.get("/check",         c.check);
r.post("/seed",         c.seed);
r.get("/users",         auth, c.getUsers);
r.post("/users",        auth, c.createUser);
r.put("/users/:id/status", auth, c.updateStatus);
r.delete("/users/:id",  auth, c.deleteUser);
r.get("/stats",         auth, c.getStats);
module.exports = r;

