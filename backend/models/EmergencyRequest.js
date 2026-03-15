const mongoose = require("mongoose");

const emergencyRequestSchema = new mongoose.Schema({
  requestId:    { type: String, required: true, unique: true },
  type:         { type: String, enum: ["Cardiac","Stroke","Trauma","Respiratory","Obstetric","Pediatric","Burns","Other"], default: "Other" },
  severity:     { type: String, enum: ["Critical","High","Medium","Low"], default: "Medium" },
  patientName:  { type: String, default: "Unknown" },
  patientAge:   { type: Number, default: 0 },
  patientPhone: { type: String, default: "" },
  description:  { type: String, default: "" },
  location: {
    lat:     { type: Number, required: true },
    lng:     { type: Number, required: true },
    address: { type: String, default: "" },
  },
  reportedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  assignedHospital: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
  assignedAmbulance:{ type: mongoose.Schema.Types.ObjectId, ref: "Ambulance", default: null },
  status:       { type: String, enum: ["Reported","Dispatched","EnRoute","OnScene","Transferred","Resolved","Cancelled"], default: "Reported" },
  dispatchedAt: { type: Date, default: null },
  arrivedAt:    { type: Date, default: null },
  resolvedAt:   { type: Date, default: null },
  responseTimeMinutes: { type: Number, default: 0 },
  aiRecommendation: { type: String, default: "" },
  notes:        [{ text: String, by: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

module.exports = mongoose.model("EmergencyRequest", emergencyRequestSchema);
