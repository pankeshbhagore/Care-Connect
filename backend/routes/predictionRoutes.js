const r = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { predictICUDemand, getCityHealth } = require("../services/healthPrediction");
r.get("/icu-demand",  auth, async (req,res) => { try { res.json(await predictICUDemand()); } catch(e){ res.status(500).json({error:e.message}); }});
r.get("/city-health", auth, async (req,res) => { try { res.json(await getCityHealth()); }    catch(e){ res.status(500).json({error:e.message}); }});
module.exports = r;

