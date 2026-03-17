const { generateResponse } = require("../services/aiChatService");

exports.chat = async (req, res) => {
  try {
    const { message, userLat, userLng } = req.body;
    if (!message?.trim()) return res.status(400).json({ message:"Message required" });
    const result = await generateResponse(message.trim(), userLat, userLng);
    res.json(result);
  } catch(e) { res.status(500).json({ error:e.message, response:"Sorry, I'm having trouble right now. For emergencies, call 108 or 112.", suggestions:["Call 108","Call 112"] }); }
};
