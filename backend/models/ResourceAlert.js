const mongoose = require("mongoose");

const resourceAlertSchema = new mongoose.Schema({
  hospital:     { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  alertType:    { type: String, enum: ["BedShortage","OxygenLow","VentilatorShortage","StaffShortage","BloodLow","Overload"], default: "BedShortage" },
  severity:     { type: String, enum: ["Critical","High","Medium","Low"], default: "Medium" },
  resource:     { type: String, default: "" },
  currentValue: { type: Number, default: 0 },
  message:      { type: String, default: "" },
  resolved:     { type: Boolean, default: false },
  resolvedAt:   { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("ResourceAlert", resourceAlertSchema);
