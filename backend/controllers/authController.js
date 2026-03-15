const User   = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: "Name, email, and password required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 12);
    await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: hashed, role: "Citizen", phone: phone?.trim()||"", accountStatus:"active", isActive:true });
    res.status(201).json({ message: "Account created. You can now log in." });
  } catch (err) { res.status(500).json({ error: "Registration failed" }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: "Invalid email or password" });
    if (!user.isActive || user.accountStatus === "suspended")
      return res.status(403).json({ message: "Account suspended. Contact administrator.", suspended: true });
    user.lastLogin = new Date(); user.loginCount = (user.loginCount||0)+1;
    await user.save();
    res.json({ token: signToken(user), role: user.role, name: user.name, email: user.email, phone: user.phone||"", userId: user._id, hospitalId: user.hospitalId?.toString()||null, ambulanceId: user.ambulanceId?.toString()||null });
  } catch (err) { res.status(500).json({ error: "Login failed" }); }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: "Server error" }); }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ["name","phone","address","bloodGroup","emergencyContact"];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    res.json({ message: "Profile updated", user });
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
};
