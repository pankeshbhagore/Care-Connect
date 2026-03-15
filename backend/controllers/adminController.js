const User     = require("../models/User");
const Hospital = require("../models/Hospital");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

exports.check = async (req, res) => {
  try { const a = await User.findOne({ role:"Admin" }); res.json({ adminExists:!!a }); }
  catch(e){ res.status(500).json({ error:e.message }); }
};

exports.seed = async (req, res) => {
  try {
    const { name, email, password, seedKey } = req.body;
    if (seedKey !== process.env.ADMIN_SEED_KEY) return res.status(403).json({ message:"Invalid seed key" });
    if (await User.findOne({ role:"Admin" })) return res.status(400).json({ message:"Admin already exists" });
    const hashed = await bcrypt.hash(password, 12);
    const admin  = await User.create({ name, email:email.toLowerCase(), password:hashed, role:"Admin", accountStatus:"active", isActive:true });
    const token  = jwt.sign({ id:admin._id, role:"Admin", name:admin.name }, process.env.JWT_SECRET, { expiresIn:"7d" });
    res.status(201).json({ message:"Admin created", token, role:"Admin", name:admin.name, userId:admin._id });
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getUsers = async (req, res) => {
  try { res.json(await User.find().select("-password").sort({ createdAt:-1 }).lean()); }
  catch(e){ res.status(500).json({ error:e.message }); }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, department, badgeNumber } = req.body;
    if (!name||!email||!password) return res.status(400).json({ message:"name, email, password required" });
    if (await User.findOne({ email:email.toLowerCase() })) return res.status(400).json({ message:"Email exists" });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email:email.toLowerCase(), password:hashed, role:role||"Operator", phone:phone||"", department:department||"", badgeNumber:badgeNumber||"", accountStatus:"active", isActive:true, createdBy:req.user.id });
    res.status(201).json({ message:"Created", user:{ ...user.toObject(), password:undefined } });
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { accountStatus:req.body.status, isActive:req.body.status==="active" }, { new:true }).select("-password");
    if (!user) return res.status(404).json({ message:"Not found" });
    res.json(user);
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id===req.user.id) return res.status(400).json({ message:"Cannot delete yourself" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message:"Deleted" });
  } catch(e){ res.status(500).json({ error:e.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const [users, hospitals] = await Promise.all([User.find().lean(), Hospital.find().lean()]);
    res.json({
      users:{ total:users.length, admins:users.filter(u=>u.role==="Admin").length, operators:users.filter(u=>u.role==="Operator").length, citizens:users.filter(u=>u.role==="Citizen").length },
      hospitals:{ total:hospitals.length, active:hospitals.filter(h=>h.status==="Active").length, overwhelmed:hospitals.filter(h=>h.status==="Overwhelmed").length },
    });
  } catch(e){ res.status(500).json({ error:e.message }); }
};
