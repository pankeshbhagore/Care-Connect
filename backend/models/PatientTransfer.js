const mongoose = require("mongoose");

const patientTransferSchema = new mongoose.Schema({
  transferId:      { type: String, required: true, unique: true },
  patientName:     { type: String, default: "Anonymous" },
  patientAge:      { type: Number, default: 0 },
  patientGender:   { type: String, enum: ["Male","Female","Other"], default: "Other" },
  bloodGroup:      { type: String, default: "" },
  condition:       { type: String, default: "" },
  priority:        { type: String, enum: ["Critical","High","Medium","Normal"], default: "Normal" },
  fromHospital:    { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  toHospital:      { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  requestedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  requestedAt:     { type: Date, default: Date.now },
  acceptedAt:      { type: Date, default: null },
  completedAt:     { type: Date, default: null },
  cancelledAt:     { type: Date, default: null },
  status:          { type: String, enum: ["Requested","Accepted","InTransit","Completed","Cancelled","Rejected"], default: "Requested" },
  rejectionReason: { type: String, default: "" },
  distanceKm:      { type: Number, default: 0 },
  estimatedMinutes:{ type: Number, default: 0 },
  vehicleUsed:     { type: String, default: "" },
  aiSuggested:     { type: Boolean, default: false },
  notes:           { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("PatientTransfer", patientTransferSchema);
