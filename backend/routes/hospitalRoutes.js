const r = require("express").Router();
const c = require("../controllers/hospitalController");
const auth = require("../middleware/authMiddleware");

// Public - citizens can see hospital resources
r.get("/public",         c.getPublicList);   // returns hospitals with basic resource info
r.get("/public/:id",     c.getPublicOne);    // single hospital public view

// Protected
r.get("/summary",              auth, c.summary);
r.get("/alerts",               auth, c.getAlerts);
r.get("/recommend",            auth, c.recommend);
r.get("/nearby",               auth, c.nearby);
r.get("/",                     auth, c.getAll);
r.get("/:id",                  auth, c.getOne);
r.post("/",                    auth, c.create);
r.put("/:id",                  auth, c.update);
r.put("/:id/resources",        auth, c.updateResources);
r.delete("/:id",               auth, c.remove);
r.patch("/alerts/:id/resolve", auth, c.resolveAlert);

module.exports = r;
