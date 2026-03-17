const mongoose = require("mongoose");
const appointmentSchema = new mongoose.Schema({
  appointmentId:  { type:String, required:true, unique:true },
  hospital:       { type:mongoose.Schema.Types.ObjectId, ref:"Hospital", required:true },
  patientName:    { type:String, required:true },
  patientPhone:   { type:String, required:true },
  patientAge:     { type:Number, default:0 },
  patientGender:  { type:String, enum:["Male","Female","Other"], default:"Other" },
  specialty:      { type:String, default:"General" },
  doctor:         { type:String, default:"" },
  appointmentDate:{ type:Date, required:true },
  appointmentTime:{ type:String, required:true },
  reason:         { type:String, default:"" },
  status:         { type:String, enum:["Pending","Confirmed","Completed","Cancelled","NoShow"], default:"Pending" },
  notes:          { type:String, default:"" },
  bookedBy:       { type:mongoose.Schema.Types.ObjectId, ref:"User", default:null },
  confirmedAt:    { type:Date, default:null },
  cancelledAt:    { type:Date, default:null },
  reminderSent:   { type:Boolean, default:false },
}, { timestamps:true });
module.exports = mongoose.model("Appointment", appointmentSchema);
