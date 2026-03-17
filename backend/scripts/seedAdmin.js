// require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
// const mongoose = require("mongoose");
// const bcrypt   = require("bcryptjs");
// const User     = require("../models/User");

// async function seedAdmin() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("✅ Connected");
//     const exists = await User.findOne({ role: "Admin" });
//     if (exists) { console.log("ℹ️  Admin already exists:", exists.email); process.exit(0); }
//     const hashed = await bcrypt.hash("Admin@123", 12);
//     const admin  = await User.create({
//       name: "System Admin", email: "admin@healthcare.local",
//       password: hashed, role: "Admin", accountStatus: "active", isActive: true,
//     });
//     console.log("✅ Admin created:");
//     console.log("   Email:    admin@healthcare.local");
//     console.log("   Password: Admin@123");
//     console.log("   (Change password after first login)");
//     process.exit(0);
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//     process.exit(1);
//   }
// }
// seedAdmin();
