const r    = require("express").Router();
const c    = require("../controllers/hospitalController");
const auth = require("../middleware/authMiddleware");

// Helper: ensure controller function exists before registering route
const safe = (name, fn) => {
  if (typeof fn !== "function") {
    return (req, res) => res.status(501).json({ error: `Function ${name} not implemented. Please update hospitalController.js from the ZIP.` });
  }
  return fn;
};

// Public - no auth needed
r.get("/public",          safe("getPublicList",  c.getPublicList));
r.get("/public/:id",      safe("getPublicOne",   c.getPublicOne));

// Protected
r.get("/summary",              auth, safe("summary",       c.summary));
r.get("/alerts",               auth, safe("getAlerts",     c.getAlerts));
r.get("/recommend",            auth, safe("recommend",     c.recommend));
r.get("/nearby",               auth, safe("nearby",        c.nearby));
r.get("/trust-scores",         auth, safe("getTrustScores",c.getTrustScores));
r.get("/gov-stats",            auth, safe("getGovStats",   c.getGovStats));
r.get("/",                     auth, safe("getAll",        c.getAll));
r.get("/:id",                  auth, safe("getOne",        c.getOne));
r.post("/",                    auth, safe("create",        c.create));
r.put("/:id",                  auth, safe("update",        c.update));
r.put("/:id/resources",        auth, safe("updateResources",c.updateResources));
r.delete("/:id",               auth, safe("remove",        c.remove));
r.patch("/alerts/:id/resolve", auth, safe("resolveAlert",  c.resolveAlert));

module.exports = r;
