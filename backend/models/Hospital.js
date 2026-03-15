const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema({
  hospitalId:  { type: String, required: true, unique: true },
  name:        { type: String, required: true, trim: true },
  type:        { type: String, enum: ["Government","Private","Trust","Clinic","Trauma Center"], default: "Government" },
  level:       { type: String, enum: ["Primary","Secondary","Tertiary","Quaternary"], default: "Secondary" },
  registeredBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  location: {
    lat:     { type: Number, required: true },
    lng:     { type: Number, required: true },
    address: { type: String, default: "" },
    city:    { type: String, default: "" },
    district:{ type: String, default: "" },
    state:   { type: String, default: "" },
    pincode: { type: String, default: "" },
  },

  contact: {
    phone:     { type: String, default: "" },
    emergency: { type: String, default: "" },
    email:     { type: String, default: "" },
  },

  resources: {
    icuBeds:          { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    generalBeds:      { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    emergencyBeds:    { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    icuPediatric:     { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    maternity:        { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    isolation:        { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    ventilators:      { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    oxygenBeds:       { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    dialysisMachines: { total: { type: Number, default: 0 }, available: { type: Number, default: 0 } },
    ctScan:           { type: Boolean, default: false },
    mri:              { type: Boolean, default: false },
    xray:             { type: Boolean, default: false },
    bloodBank:        { type: Boolean, default: false },
    doctorsOnDuty:    { type: Number, default: 0 },
    nursesOnDuty:     { type: Number, default: 0 },
    specialistsAvailable: [{ type: String }],
    ambulancesTotal:      { type: Number, default: 0 },
    ambulancesAvailable:  { type: Number, default: 0 },
    oxygenLevel:          { type: Number, default: 100, min: 0, max: 100 },
    bloodUnitsAvailable:  { type: Number, default: 0 },
  },

  status:      { type: String, enum: ["Active","Overwhelmed","Offline","Maintenance"], default: "Active" },
  alertLevel:  { type: String, enum: ["Normal","Yellow","Orange","Red"], default: "Normal" },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy:   { type: String, default: "" },
  specialties: [{ type: String }],
  traumaCenter:{ type: Boolean, default: false },
  covidWard:   { type: Boolean, default: false },
  avgPatientWait: { type: Number, default: 0 },
}, { timestamps: true });

hospitalSchema.index({ "location.city": 1 });
hospitalSchema.index({ status: 1 });
module.exports = mongoose.model("Hospital", hospitalSchema);
