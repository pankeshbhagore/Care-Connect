const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema({
  hospitalId:   { type:String, required:true, unique:true },
  name:         { type:String, required:true, trim:true },
  type:         { type:String, enum:["Government","Private","Trust","Clinic","Trauma Center"], default:"Government" },
  level:        { type:String, enum:["Primary","Secondary","Tertiary","Quaternary"], default:"Secondary" },
  tier:         { type:String, enum:["Tier1","Tier2","Tier3"], default:"Tier2" },
  registeredBy: { type:mongoose.Schema.Types.ObjectId, ref:"User", default:null },

  // ── Email-based Verification Flow ─────────────────────────────
  isVerified:        { type:Boolean, default:false },
  verificationToken: { type:String, default:null },
  tokenExpiry:       { type:Date,   default:null },
  verifiedAt:        { type:Date,   default:null },
  registrationStatus:{ type:String, enum:["pending","email_sent","verified","approved","rejected"], default:"approved" },
  registrationEmail: { type:String, default:"" },
  selfRegistered:    { type:Boolean, default:false },  // hospital registered itself
  approvedBy:        { type:mongoose.Schema.Types.ObjectId, ref:"User", default:null },
  approvedAt:        { type:Date, default:null },
  rejectionReason:   { type:String, default:"" },
  emailSentAt:       { type:Date, default:null },
  emailResendCount:  { type:Number, default:0 },

  // ── Government Integration ────────────────────────────────────
  govRegistration: {
    ayushmanEmpanelled: { type:Boolean, default:false },
    nhm:                { type:Boolean, default:false },
    moh:                { type:Boolean, default:false },
    emergencyService:   { type:Boolean, default:false },
    registrationCode:   { type:String, default:"" },
  },

  trustScore:      { type:Number, default:75, min:0, max:100 },
  acceptanceRate:  { type:Number, default:100 },
  rejectionCount:  { type:Number, default:0 },
  incentivePoints: { type:Number, default:0 },

  // ── Location (full detail) ─────────────────────────────────────
  location: {
    lat:      { type:Number, required:true },
    lng:      { type:Number, required:true },
    address:  { type:String, default:"" },
    landmark: { type:String, default:"" },
    city:     { type:String, default:"" },
    district: { type:String, default:"" },
    state:    { type:String, default:"" },
    pincode:  { type:String, default:"" },
    region:   { type:String, default:"" },  // for region-wise grouping
  },
  contact: {
    phone:     { type:String, default:"" },
    emergency: { type:String, default:"" },
    email:     { type:String, default:"" },
    website:   { type:String, default:"" },
  },
  resources: {
    icuBeds:          { total:{type:Number,default:0}, available:{type:Number,default:0} },
    generalBeds:      { total:{type:Number,default:0}, available:{type:Number,default:0} },
    emergencyBeds:    { total:{type:Number,default:0}, available:{type:Number,default:0} },
    icuPediatric:     { total:{type:Number,default:0}, available:{type:Number,default:0} },
    maternity:        { total:{type:Number,default:0}, available:{type:Number,default:0} },
    isolation:        { total:{type:Number,default:0}, available:{type:Number,default:0} },
    ventilators:      { total:{type:Number,default:0}, available:{type:Number,default:0} },
    oxygenBeds:       { total:{type:Number,default:0}, available:{type:Number,default:0} },
    dialysisMachines: { total:{type:Number,default:0}, available:{type:Number,default:0} },
    ctScan:    { type:Boolean, default:false },
    mri:       { type:Boolean, default:false },
    xray:      { type:Boolean, default:false },
    bloodBank: { type:Boolean, default:false },
    doctorsOnDuty:        { type:Number, default:0 },
    nursesOnDuty:         { type:Number, default:0 },
    specialistsAvailable: { type:[String], default:[] },
    ambulancesTotal:      { type:Number, default:0 },
    ambulancesAvailable:  { type:Number, default:0 },
    oxygenLevel:          { type:Number, default:100, min:0, max:100 },
    bloodUnitsAvailable:  { type:Number, default:0 },
  },
  status:         { type:String, enum:["Active","Overwhelmed","Offline","Maintenance"], default:"Active" },
  alertLevel:     { type:String, enum:["Normal","Yellow","Orange","Red"], default:"Normal" },
  lastUpdated:    { type:Date, default:Date.now },
  updatedBy:      { type:String, default:"" },
  specialties:    { type:[String], default:[] },
  traumaCenter:   { type:Boolean, default:false },
  covidWard:      { type:Boolean, default:false },
  avgPatientWait: { type:Number, default:0 },
}, { timestamps:true });

hospitalSchema.index({"location.city":1});
hospitalSchema.index({"location.district":1});
hospitalSchema.index({"location.region":1});
hospitalSchema.index({status:1});
hospitalSchema.index({registrationStatus:1});
hospitalSchema.index({verificationToken:1});
module.exports = mongoose.model("Hospital", hospitalSchema);
