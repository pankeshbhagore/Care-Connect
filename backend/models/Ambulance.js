const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema({
  ambulanceId:   { type: String, required: true, unique: true },
  registrationNo:{ type: String, default: "" },
  name:          { type: String, default: "" },
  type:          { type: String, enum: ["ALS","BLS","Neonatal","Air"], default: "BLS" },
  hospital:      { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
  driver:        { type: String, default: "" },
  driverPhone:   { type: String, default: "" },
  crewCount:     { type: Number, default: 2 },
  equipment:     [{ type: String }],
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    address: { type: String, default: "" },
    lastUpdated: { type: Date, default: Date.now },
  },
  status:        { type: String, enum: ["Available","Dispatched","OnScene","Returning","Offline","Maintenance"], default: "Available" },
  assignedTransfer: { type: mongoose.Schema.Types.ObjectId, ref: "PatientTransfer", default: null },
  speed:         { type: Number, default: 0 },
  fuelLevel:     { type: Number, default: 100 },
  totalTrips:    { type: Number, default: 0 },
  totalKm:       { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Ambulance", ambulanceSchema);
