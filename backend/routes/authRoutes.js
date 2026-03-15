const r = require("express").Router();
const c = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
r.post("/register", c.register);
r.post("/login",    c.login);
r.get("/profile",   auth, c.getProfile);
r.put("/profile",   auth, c.updateProfile);
module.exports = r;


