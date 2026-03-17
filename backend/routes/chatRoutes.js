const r = require("express").Router();
const c = require("../controllers/chatController");
r.post("/", c.chat);  // public - no auth needed
module.exports = r;
