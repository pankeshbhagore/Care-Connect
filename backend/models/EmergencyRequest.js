const mongoose = require("mongoose");

const emergencyRequestSchema = new mongoose.Schema({
  requestId:    { type: String, required: true, unique: true },
  type:         { type: String, enum: ["Cardiac","Stroke","Trauma","Respiratory","Obstetric","Pediatric","Burns","Other"], default: "Other" },
  severity:     { type: String, enum: ["Critical","High","Medium","Low"], default: "Medium" },
  patientName:  { type: String, default: "Unknown" },
  patientAge:   { type: Number, default: 0 },
  patientPhone: { type: String, default: "" },
  description:  { type: String, default: "" },
  requiredFacilities: [{ type: String }],   // ["ICU","Ventilator","Trauma","BloodBank"]

  location: {
    lat:     { type: Number, required: true },
    lng:     { type: Number, required: true },
    address: { type: String, default: "" },
  },

  // Citizen reporter (optional - no login required)
  reportedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reporterPhone: { type: String, default: "" },
  reporterName:  { type: String, default: "" },

  assignedHospital:  { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
  assignedAmbulance: { type: mongoose.Schema.Types.ObjectId, ref: "Ambulance", default: null },

  // Smart dispatch flow
  status: { type: String, enum: ["Reported","AmbulanceRequested","AmbulanceAccepted","EnRoute","OnScene","TransportingToHospital","HospitalAlerted","Resolved","Cancelled"], default: "Reported" },

  dispatchedAt:     { type: Date, default: null },
  ambulanceAcceptedAt: { type: Date, default: null },
  arrivedAtPatientAt:  { type: Date, default: null },
  arrivedAtHospitalAt: { type: Date, default: null },
  resolvedAt:       { type: Date, default: null },
  responseTimeMinutes: { type: Number, default: 0 },

  // Hospital pre-alert
  hospitalAlertSent:    { type: Boolean, default: false },
  hospitalAlertMessage: { type: String, default: "" },
  estimatedArrivalTime: { type: Number, default: 0 }, // minutes

  // Route/tracking
  routePoints: [{ lat: Number, lng: Number, ts: Date }],

  aiRecommendation: { type: String, default: "" },
  notes: [{ text: String, by: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

module.exports = mongoose.model("EmergencyRequest", emergencyRequestSchema);
