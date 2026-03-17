const mongoose = require("mongoose");

const emergencyRequestSchema = new mongoose.Schema({
  requestId:    { type:String, required:true, unique:true },
  type:         { type:String, enum:["Cardiac","Stroke","Trauma","Respiratory","Obstetric","Pediatric","Burns","Other"], default:"Other" },
  severity:     { type:String, enum:["Critical","High","Medium","Low"], default:"Medium" },
  aiTriageSeverity: { type:String, enum:["Critical","High","Medium","Low"], default:null }, // AI-upgraded
  patientName:  { type:String, default:"Unknown" },
  patientAge:   { type:Number, default:0 },
  patientPhone: { type:String, default:"" },
  description:  { type:String, default:"" },
  requiredFacilities: [{ type:String }],
  location: {
    lat:     { type:Number, required:true },
    lng:     { type:Number, required:true },
    address: { type:String, default:"" },
    locationName: { type:String, default:"" },
  },
  reportedBy:    { type:mongoose.Schema.Types.ObjectId, ref:"User", default:null },
  reporterPhone: { type:String, default:"" },
  reporterName:  { type:String, default:"" },
  assignedHospital:  { type:mongoose.Schema.Types.ObjectId, ref:"Hospital", default:null },
  assignedAmbulance: { type:mongoose.Schema.Types.ObjectId, ref:"Ambulance", default:null },
  status: { type:String, enum:["Reported","Queued","AmbulanceRequested","AmbulanceAccepted","EnRoute","OnScene","TransportingToHospital","Resolved","Cancelled","PatientNotFound"], default:"Reported" },
  // Queue (edge case: no ambulance available)
  queuePosition:  { type:Number, default:0 },
  queuedAt:       { type:Date, default:null },
  // Duplicate detection
  isDuplicate:    { type:Boolean, default:false },
  duplicateOf:    { type:mongoose.Schema.Types.ObjectId, ref:"EmergencyRequest", default:null },
  // Timestamps
  dispatchedAt:        { type:Date, default:null },
  ambulanceAcceptedAt: { type:Date, default:null },
  arrivedAtPatientAt:  { type:Date, default:null },
  resolvedAt:          { type:Date, default:null },
  responseTimeMinutes: { type:Number, default:0 },
  // Hospital pre-alert
  hospitalAlertSent:    { type:Boolean, default:false },
  estimatedArrivalTime: { type:Number, default:0 },
  // Hospital rejection tracking
  rejectedByHospitals:  [{ hospitalId:String, hospitalName:String, reason:String, at:Date }],
  // AI
  aiRecommendation: { type:String, default:"" },
  notes: [{ text:String, by:String, at:{ type:Date, default:Date.now } }],
}, { timestamps:true });

module.exports = mongoose.model("EmergencyRequest", emergencyRequestSchema);
