/**
 * MASTER SEED SCRIPT — Seeds everything in correct order
 * Run: node scripts/seedAll.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const User     = require("../models/User");
const Hospital = require("../models/Hospital");
const Ambulance= require("../models/Ambulance");

// ── HOSPITALS DATA ────────────────────────────────────────────
const HOSPITALS = [
  { hospitalId:"HOSP-0001", name:"Victoria Government Hospital", type:"Government", level:"Tertiary",
    location:{ lat:23.1815, lng:79.9864, address:"Napier Town, Jabalpur", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482001" },
    contact:{ phone:"0761-4012345", emergency:"0761-4012300", email:"victoria@mphealth.gov.in" },
    resources:{ icuBeds:{total:40,available:8}, generalBeds:{total:300,available:45}, emergencyBeds:{total:20,available:5}, icuPediatric:{total:10,available:2}, maternity:{total:20,available:4}, isolation:{total:8,available:2}, ventilators:{total:15,available:3}, oxygenBeds:{total:30,available:6}, dialysisMachines:{total:8,available:2}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:12, nursesOnDuty:35, specialistsAvailable:["Cardiology","Neurology","Orthopedics"], ambulancesTotal:6, ambulancesAvailable:3, oxygenLevel:72, bloodUnitsAvailable:45 },
    status:"Active", alertLevel:"Orange", specialties:["Cardiology","Neurology","Orthopedics","General Surgery","Pediatrics"], traumaCenter:true, avgPatientWait:25 },

  { hospitalId:"HOSP-0002", name:"NSCB Medical College Hospital", type:"Government", level:"Quaternary",
    location:{ lat:23.1736, lng:79.9571, address:"Medical College Road, Jabalpur", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482003" },
    contact:{ phone:"0761-2368000", emergency:"0761-2368001", email:"nscb@mphealth.gov.in" },
    resources:{ icuBeds:{total:80,available:12}, generalBeds:{total:600,available:88}, emergencyBeds:{total:40,available:8}, icuPediatric:{total:20,available:3}, maternity:{total:40,available:8}, isolation:{total:20,available:4}, ventilators:{total:30,available:5}, oxygenBeds:{total:60,available:10}, dialysisMachines:{total:15,available:4}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:25, nursesOnDuty:80, specialistsAvailable:["Cardiology","Neurology","Oncology","Nephrology","Gastroenterology"], ambulancesTotal:10, ambulancesAvailable:5, oxygenLevel:65, bloodUnitsAvailable:120 },
    status:"Active", alertLevel:"Orange", specialties:["Cardiology","Neurology","Oncology","Nephrology","Orthopedics","ENT","Dermatology"], traumaCenter:true, covidWard:true, avgPatientWait:40 },

  { hospitalId:"HOSP-0003", name:"Gokuldas Hospital", type:"Private", level:"Secondary",
    location:{ lat:23.1823, lng:79.9901, address:"Wright Town, Jabalpur", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482002" },
    contact:{ phone:"0761-4089000", emergency:"0761-4089001" },
    resources:{ icuBeds:{total:20,available:5}, generalBeds:{total:100,available:22}, emergencyBeds:{total:10,available:3}, icuPediatric:{total:5,available:1}, maternity:{total:10,available:3}, isolation:{total:4,available:1}, ventilators:{total:8,available:2}, oxygenBeds:{total:15,available:4}, dialysisMachines:{total:4,available:1}, ctScan:true, mri:false, xray:true, bloodBank:true, doctorsOnDuty:8, nursesOnDuty:20, specialistsAvailable:["Cardiology","Orthopedics"], ambulancesTotal:3, ambulancesAvailable:2, oxygenLevel:85, bloodUnitsAvailable:30 },
    status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Orthopedics","General Surgery","Gynecology"], traumaCenter:false, avgPatientWait:15 },

  { hospitalId:"HOSP-0004", name:"City Hospital Katni", type:"Government", level:"Secondary",
    location:{ lat:23.8299, lng:80.4042, address:"Main Road, Katni", city:"Katni", district:"Katni", state:"Madhya Pradesh", pincode:"483501" },
    contact:{ phone:"07622-234567", emergency:"07622-234500" },
    resources:{ icuBeds:{total:15,available:0}, generalBeds:{total:120,available:10}, emergencyBeds:{total:8,available:1}, icuPediatric:{total:4,available:0}, maternity:{total:8,available:1}, isolation:{total:3,available:0}, ventilators:{total:5,available:0}, oxygenBeds:{total:10,available:2}, dialysisMachines:{total:2,available:0}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:5, nursesOnDuty:12, specialistsAvailable:[], ambulancesTotal:2, ambulancesAvailable:1, oxygenLevel:40, bloodUnitsAvailable:5 },
    status:"Overwhelmed", alertLevel:"Red", specialties:["General Medicine","General Surgery"], traumaCenter:false, avgPatientWait:90 },

  { hospitalId:"HOSP-0005", name:"Sanjivani Hospital", type:"Private", level:"Secondary",
    location:{ lat:23.1667, lng:79.9333, address:"Adhartal, Jabalpur", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482004" },
    contact:{ phone:"0761-4112233", emergency:"0761-4112200" },
    resources:{ icuBeds:{total:12,available:4}, generalBeds:{total:60,available:15}, emergencyBeds:{total:6,available:2}, icuPediatric:{total:3,available:1}, maternity:{total:6,available:2}, isolation:{total:3,available:1}, ventilators:{total:5,available:2}, oxygenBeds:{total:10,available:3}, dialysisMachines:{total:3,available:1}, ctScan:true, mri:false, xray:true, bloodBank:true, doctorsOnDuty:6, nursesOnDuty:15, specialistsAvailable:["Cardiology"], ambulancesTotal:2, ambulancesAvailable:2, oxygenLevel:90, bloodUnitsAvailable:20 },
    status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","General Surgery"], traumaCenter:false, avgPatientWait:10 },

  { hospitalId:"HOSP-0006", name:"District Hospital Narsinghpur", type:"Government", level:"Primary",
    location:{ lat:22.9466, lng:79.1940, address:"Civil Lines, Narsinghpur", city:"Narsinghpur", district:"Narsinghpur", state:"Madhya Pradesh", pincode:"487001" },
    contact:{ phone:"07792-232345" },
    resources:{ icuBeds:{total:8,available:3}, generalBeds:{total:80,available:20}, emergencyBeds:{total:5,available:2}, icuPediatric:{total:2,available:1}, maternity:{total:6,available:2}, isolation:{total:2,available:1}, ventilators:{total:3,available:1}, oxygenBeds:{total:8,available:3}, dialysisMachines:{total:1,available:1}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:4, nursesOnDuty:10, specialistsAvailable:[], ambulancesTotal:2, ambulancesAvailable:1, oxygenLevel:78, bloodUnitsAvailable:10 },
    status:"Active", alertLevel:"Normal", specialties:["General Medicine","Pediatrics"], traumaCenter:false, avgPatientWait:20 },

  { hospitalId:"HOSP-0007", name:"Apollo Clinic Sagar", type:"Private", level:"Secondary",
    location:{ lat:23.8388, lng:78.7378, address:"Makroniya, Sagar", city:"Sagar", district:"Sagar", state:"Madhya Pradesh", pincode:"470001" },
    contact:{ phone:"07582-245678", emergency:"07582-245600" },
    resources:{ icuBeds:{total:18,available:6}, generalBeds:{total:80,available:18}, emergencyBeds:{total:8,available:3}, icuPediatric:{total:4,available:2}, maternity:{total:8,available:3}, isolation:{total:4,available:2}, ventilators:{total:7,available:3}, oxygenBeds:{total:12,available:4}, dialysisMachines:{total:5,available:2}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:10, nursesOnDuty:25, specialistsAvailable:["Cardiology","Orthopedics","Neurology"], ambulancesTotal:4, ambulancesAvailable:3, oxygenLevel:95, bloodUnitsAvailable:55 },
    status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","Orthopedics","Oncology"], traumaCenter:true, avgPatientWait:12 },

  { hospitalId:"HOSP-0008", name:"Bundelkhand Medical College", type:"Government", level:"Tertiary",
    location:{ lat:23.8500, lng:78.7500, address:"Medical College Road, Sagar", city:"Sagar", district:"Sagar", state:"Madhya Pradesh", pincode:"470001" },
    contact:{ phone:"07582-256789", emergency:"07582-256700" },
    resources:{ icuBeds:{total:35,available:7}, generalBeds:{total:400,available:55}, emergencyBeds:{total:20,available:5}, icuPediatric:{total:8,available:2}, maternity:{total:15,available:3}, isolation:{total:6,available:2}, ventilators:{total:18,available:4}, oxygenBeds:{total:30,available:8}, dialysisMachines:{total:10,available:3}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:18, nursesOnDuty:55, specialistsAvailable:["Cardiology","Neurology","Gastroenterology","Nephrology"], ambulancesTotal:7, ambulancesAvailable:4, oxygenLevel:82, bloodUnitsAvailable:80 },
    status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Neurology","Orthopedics","ENT","Gastroenterology"], traumaCenter:true, avgPatientWait:35 },

  { hospitalId:"HOSP-0009", name:"Umaria District Hospital", type:"Government", level:"Primary",
    location:{ lat:23.5232, lng:80.8422, address:"Civil Hospital Campus, Umaria", city:"Umaria", district:"Umaria", state:"Madhya Pradesh", pincode:"484661" },
    contact:{ phone:"07653-220123" },
    resources:{ icuBeds:{total:5,available:5}, generalBeds:{total:50,available:30}, emergencyBeds:{total:4,available:3}, icuPediatric:{total:1,available:1}, maternity:{total:4,available:3}, isolation:{total:2,available:2}, ventilators:{total:2,available:2}, oxygenBeds:{total:5,available:5}, dialysisMachines:{total:0,available:0}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:3, nursesOnDuty:8, specialistsAvailable:[], ambulancesTotal:1, ambulancesAvailable:1, oxygenLevel:92, bloodUnitsAvailable:8 },
    status:"Active", alertLevel:"Normal", specialties:["General Medicine"], traumaCenter:false, avgPatientWait:8 },

  { hospitalId:"HOSP-0010", name:"Care CHL Hospital Indore", type:"Private", level:"Quaternary",
    location:{ lat:22.7196, lng:75.8577, address:"AB Road, Indore", city:"Indore", district:"Indore", state:"Madhya Pradesh", pincode:"452001" },
    contact:{ phone:"0731-4747474", emergency:"0731-4747400", email:"info@carechl.com" },
    resources:{ icuBeds:{total:100,available:22}, generalBeds:{total:500,available:90}, emergencyBeds:{total:50,available:12}, icuPediatric:{total:20,available:5}, maternity:{total:25,available:6}, isolation:{total:15,available:4}, ventilators:{total:45,available:12}, oxygenBeds:{total:80,available:20}, dialysisMachines:{total:20,available:8}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:40, nursesOnDuty:120, specialistsAvailable:["Cardiology","Neurology","Oncology","Nephrology","Transplant","Neurosurgery"], ambulancesTotal:12, ambulancesAvailable:7, oxygenLevel:98, bloodUnitsAvailable:200 },
    status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","Oncology","Nephrology","Orthopedics","Transplant","Neurosurgery"], traumaCenter:true, covidWard:true, avgPatientWait:20 },

  { hospitalId:"HOSP-0011", name:"Hamidia Hospital Bhopal", type:"Government", level:"Tertiary",
    location:{ lat:23.2599, lng:77.4126, address:"Royal Market, Bhopal", city:"Bhopal", district:"Bhopal", state:"Madhya Pradesh", pincode:"462001" },
    contact:{ phone:"0755-2540222", emergency:"0755-2540200" },
    resources:{ icuBeds:{total:60,available:15}, generalBeds:{total:800,available:120}, emergencyBeds:{total:50,available:10}, icuPediatric:{total:15,available:4}, maternity:{total:35,available:8}, isolation:{total:12,available:3}, ventilators:{total:25,available:6}, oxygenBeds:{total:50,available:12}, dialysisMachines:{total:12,available:4}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:30, nursesOnDuty:90, specialistsAvailable:["Cardiology","Neurology","Burns","Orthopedics","Oncology"], ambulancesTotal:8, ambulancesAvailable:5, oxygenLevel:80, bloodUnitsAvailable:150 },
    status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Neurology","Burns","Orthopedics","Oncology","General Surgery"], traumaCenter:true, avgPatientWait:45 },

  { hospitalId:"HOSP-0012", name:"Chirayu Medical College Bhopal", type:"Private", level:"Tertiary",
    location:{ lat:23.2800, lng:77.4600, address:"Bairagarh, Bhopal", city:"Bhopal", district:"Bhopal", state:"Madhya Pradesh", pincode:"462030" },
    contact:{ phone:"0755-4290000", emergency:"0755-4290001" },
    resources:{ icuBeds:{total:50,available:18}, generalBeds:{total:350,available:70}, emergencyBeds:{total:30,available:8}, icuPediatric:{total:12,available:4}, maternity:{total:20,available:6}, isolation:{total:10,available:3}, ventilators:{total:20,available:7}, oxygenBeds:{total:40,available:10}, dialysisMachines:{total:10,available:4}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:22, nursesOnDuty:65, specialistsAvailable:["Cardiology","Neurology","Orthopedics","Nephrology"], ambulancesTotal:6, ambulancesAvailable:4, oxygenLevel:92, bloodUnitsAvailable:100 },
    status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","Orthopedics","Nephrology","General Surgery"], traumaCenter:true, avgPatientWait:25 },

  { hospitalId:"HOSP-0013", name:"Maharaja Yashwant Rao Hospital", type:"Government", level:"Tertiary",
    location:{ lat:22.7200, lng:75.8700, address:"MYH Road, Indore", city:"Indore", district:"Indore", state:"Madhya Pradesh", pincode:"452001" },
    contact:{ phone:"0731-2527000", emergency:"0731-2527001" },
    resources:{ icuBeds:{total:70,available:20}, generalBeds:{total:700,available:100}, emergencyBeds:{total:45,available:10}, icuPediatric:{total:18,available:5}, maternity:{total:30,available:7}, isolation:{total:14,available:4}, ventilators:{total:28,available:8}, oxygenBeds:{total:55,available:15}, dialysisMachines:{total:15,available:5}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:35, nursesOnDuty:100, specialistsAvailable:["Cardiology","Neurology","Orthopedics","Oncology","Nephrology"], ambulancesTotal:10, ambulancesAvailable:6, oxygenLevel:76, bloodUnitsAvailable:180 },
    status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Neurology","Orthopedics","Oncology","Nephrology","ENT"], traumaCenter:true, avgPatientWait:50 },

  { hospitalId:"HOSP-0014", name:"District Hospital Rewa", type:"Government", level:"Secondary",
    location:{ lat:24.5362, lng:81.3036, address:"Civil Lines, Rewa", city:"Rewa", district:"Rewa", state:"Madhya Pradesh", pincode:"486001" },
    contact:{ phone:"07662-255000", emergency:"07662-255001" },
    resources:{ icuBeds:{total:20,available:6}, generalBeds:{total:200,available:35}, emergencyBeds:{total:15,available:4}, icuPediatric:{total:5,available:2}, maternity:{total:12,available:4}, isolation:{total:5,available:2}, ventilators:{total:8,available:3}, oxygenBeds:{total:15,available:5}, dialysisMachines:{total:4,available:2}, ctScan:true, mri:false, xray:true, bloodBank:true, doctorsOnDuty:10, nursesOnDuty:28, specialistsAvailable:["General Surgery","Gynecology"], ambulancesTotal:4, ambulancesAvailable:3, oxygenLevel:85, bloodUnitsAvailable:40 },
    status:"Active", alertLevel:"Normal", specialties:["General Medicine","General Surgery","Gynecology","Pediatrics"], traumaCenter:false, avgPatientWait:30 },

  { hospitalId:"HOSP-0015", name:"Gwalior Government Hospital", type:"Government", level:"Tertiary",
    location:{ lat:26.2183, lng:78.1828, address:"Hospital Road, Gwalior", city:"Gwalior", district:"Gwalior", state:"Madhya Pradesh", pincode:"474001" },
    contact:{ phone:"0751-2600100", emergency:"0751-2600101" },
    resources:{ icuBeds:{total:45,available:10}, generalBeds:{total:450,available:65}, emergencyBeds:{total:25,available:6}, icuPediatric:{total:10,available:3}, maternity:{total:18,available:5}, isolation:{total:8,available:2}, ventilators:{total:20,available:5}, oxygenBeds:{total:35,available:9}, dialysisMachines:{total:10,available:3}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:20, nursesOnDuty:60, specialistsAvailable:["Cardiology","Neurology","Orthopedics"], ambulancesTotal:7, ambulancesAvailable:4, oxygenLevel:88, bloodUnitsAvailable:90 },
    status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Neurology","Orthopedics","General Surgery","ENT"], traumaCenter:true, avgPatientWait:40 },
];

// ── AMBULANCES DATA ───────────────────────────────────────────
const buildAmbs = (hospitalMap) => [
  { ambulanceId:"AMB-0001", name:"Victoria ALS-1", type:"ALS", registrationNo:"MP-20-AB-1001", driver:"Ramesh Kumar", driverPhone:"9876543201", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","IV Kit","Stretcher"], location:{ lat:23.183, lng:79.988, address:"Victoria Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0001"], fuelLevel:92, speed:0 },
  { ambulanceId:"AMB-0002", name:"Victoria BLS-2", type:"BLS", registrationNo:"MP-20-AB-1002", driver:"Suresh Singh", driverPhone:"9876543202", crewCount:2, equipment:["Oxygen","First Aid","Stretcher","BP Kit"], location:{ lat:23.180, lng:79.985, address:"Victoria Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0001"], fuelLevel:78, speed:0 },
  { ambulanceId:"AMB-0003", name:"NSCB ALS-1", type:"ALS", registrationNo:"MP-20-CD-2001", driver:"Pradeep Verma", driverPhone:"9876543203", crewCount:3, equipment:["Defibrillator","Oxygen","Ventilator","ECG","IV Kit"], location:{ lat:23.174, lng:79.958, address:"NSCB Hospital Base" }, status:"Dispatched", hospital:hospitalMap["HOSP-0002"], fuelLevel:65, speed:55 },
  { ambulanceId:"AMB-0004", name:"NSCB Neo-1", type:"Neonatal", registrationNo:"MP-20-CD-2002", driver:"Anita Joshi", driverPhone:"9876543204", crewCount:3, equipment:["Incubator","Oxygen","IV Pump","Monitor"], location:{ lat:23.176, lng:79.960, address:"NSCB Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0002"], fuelLevel:88, speed:0 },
  { ambulanceId:"AMB-0005", name:"NSCB BLS-3", type:"BLS", registrationNo:"MP-20-CD-2003", driver:"Vijay Mishra", driverPhone:"9876543205", crewCount:2, equipment:["Oxygen","First Aid","Stretcher"], location:{ lat:23.175, lng:79.957, address:"NSCB Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0002"], fuelLevel:95, speed:0 },
  { ambulanceId:"AMB-0006", name:"Gokuldas BLS-1", type:"BLS", registrationNo:"MP-20-EF-3001", driver:"Mohan Das", driverPhone:"9876543206", crewCount:2, equipment:["Oxygen","First Aid","Stretcher","BP Monitor"], location:{ lat:23.183, lng:79.990, address:"Gokuldas Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0003"], fuelLevel:95, speed:0 },
  { ambulanceId:"AMB-0007", name:"Katni Govt ALS-1", type:"ALS", registrationNo:"MP-07-GH-4001", driver:"Rajesh Tiwari", driverPhone:"9876543207", crewCount:2, equipment:["Oxygen","ECG","IV Kit"], location:{ lat:23.831, lng:80.405, address:"City Hospital Katni Base" }, status:"Available", hospital:hospitalMap["HOSP-0004"], fuelLevel:55, speed:0 },
  { ambulanceId:"AMB-0008", name:"Sanjivani ALS-1", type:"ALS", registrationNo:"MP-20-IJ-5001", driver:"Deepak Sharma", driverPhone:"9876543208", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","IV Kit"], location:{ lat:23.167, lng:79.934, address:"Sanjivani Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0005"], fuelLevel:82, speed:0 },
  { ambulanceId:"AMB-0009", name:"Narsinghpur Govt BLS-1", type:"BLS", registrationNo:"MP-25-KL-6001", driver:"Manoj Pandey", driverPhone:"9876543209", crewCount:2, equipment:["Oxygen","First Aid"], location:{ lat:22.947, lng:79.195, address:"District Hospital Narsinghpur Base" }, status:"Available", hospital:hospitalMap["HOSP-0006"], fuelLevel:60, speed:0 },
  { ambulanceId:"AMB-0010", name:"Apollo Sagar ALS-1", type:"ALS", registrationNo:"MP-14-MN-7001", driver:"Santosh Gupta", driverPhone:"9876543210", crewCount:3, equipment:["Defibrillator","Oxygen","Ventilator","ECG"], location:{ lat:23.840, lng:78.738, address:"Apollo Clinic Sagar Base" }, status:"Returning", hospital:hospitalMap["HOSP-0007"], fuelLevel:70, speed:45 },
  { ambulanceId:"AMB-0011", name:"Apollo Sagar BLS-2", type:"BLS", registrationNo:"MP-14-MN-7002", driver:"Priya Yadav", driverPhone:"9876543211", crewCount:2, equipment:["Oxygen","First Aid","Stretcher"], location:{ lat:23.839, lng:78.737, address:"Apollo Clinic Sagar Base" }, status:"Available", hospital:hospitalMap["HOSP-0007"], fuelLevel:90, speed:0 },
  { ambulanceId:"AMB-0012", name:"Bundelkhand ALS-1", type:"ALS", registrationNo:"MP-14-OP-8001", driver:"Kiran Tiwari", driverPhone:"9876543212", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","Blood Bank Mini"], location:{ lat:23.851, lng:78.751, address:"Bundelkhand MC Base" }, status:"Available", hospital:hospitalMap["HOSP-0008"], fuelLevel:90, speed:0 },
  { ambulanceId:"AMB-0013", name:"Bundelkhand BLS-2", type:"BLS", registrationNo:"MP-14-OP-8002", driver:"Sushil Kumar", driverPhone:"9876543213", crewCount:2, equipment:["Oxygen","First Aid","IV Kit"], location:{ lat:23.850, lng:78.750, address:"Bundelkhand MC Base" }, status:"Available", hospital:hospitalMap["HOSP-0008"], fuelLevel:75, speed:0 },
  { ambulanceId:"AMB-0014", name:"CHL Indore ALS-1", type:"ALS", registrationNo:"MP-09-QR-0001", driver:"Sanjay Mehta", driverPhone:"9876543214", crewCount:3, equipment:["Defibrillator","Ventilator","ECG","IV Pump","Oxygen"], location:{ lat:22.720, lng:75.858, address:"CHL Hospital Indore Base" }, status:"Available", hospital:hospitalMap["HOSP-0010"], fuelLevel:97, speed:0 },
  { ambulanceId:"AMB-0015", name:"CHL Indore ALS-2", type:"ALS", registrationNo:"MP-09-QR-0002", driver:"Ravi Patel", driverPhone:"9876543215", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","IV Kit","Monitor"], location:{ lat:22.719, lng:75.857, address:"CHL Hospital Indore Base" }, status:"Dispatched", hospital:hospitalMap["HOSP-0010"], fuelLevel:88, speed:60 },
  { ambulanceId:"AMB-0016", name:"CHL Indore BLS-3", type:"BLS", registrationNo:"MP-09-QR-0003", driver:"Neha Sharma", driverPhone:"9876543216", crewCount:2, equipment:["Oxygen","First Aid","Stretcher"], location:{ lat:22.718, lng:75.856, address:"CHL Hospital Indore Base" }, status:"Available", hospital:hospitalMap["HOSP-0010"], fuelLevel:85, speed:0 },
  { ambulanceId:"AMB-0017", name:"Hamidia Bhopal ALS-1", type:"ALS", registrationNo:"MP-04-ST-1101", driver:"Arun Verma", driverPhone:"9876543217", crewCount:3, equipment:["Defibrillator","Oxygen","Ventilator","ECG"], location:{ lat:23.261, lng:77.413, address:"Hamidia Hospital Bhopal Base" }, status:"Available", hospital:hospitalMap["HOSP-0011"], fuelLevel:93, speed:0 },
  { ambulanceId:"AMB-0018", name:"Hamidia Bhopal BLS-2", type:"BLS", registrationNo:"MP-04-ST-1102", driver:"Kamla Devi", driverPhone:"9876543218", crewCount:2, equipment:["Oxygen","First Aid","BP Kit"], location:{ lat:23.260, lng:77.412, address:"Hamidia Hospital Bhopal Base" }, status:"Available", hospital:hospitalMap["HOSP-0011"], fuelLevel:72, speed:0 },
  { ambulanceId:"AMB-0019", name:"MYH Indore ALS-1", type:"ALS", registrationNo:"MP-09-UV-1301", driver:"Gopal Singh", driverPhone:"9876543219", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","Stretcher"], location:{ lat:22.721, lng:75.871, address:"MYH Hospital Indore Base" }, status:"Available", hospital:hospitalMap["HOSP-0013"], fuelLevel:80, speed:0 },
  { ambulanceId:"AMB-0020", name:"Gwalior Govt ALS-1", type:"ALS", registrationNo:"MP-07-WX-1501", driver:"Harish Tomar", driverPhone:"9876543220", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","IV Pump"], location:{ lat:26.219, lng:78.183, address:"Gwalior Govt Hospital Base" }, status:"Available", hospital:hospitalMap["HOSP-0015"], fuelLevel:86, speed:0 },
];

// ── SEED FUNCTION ─────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri || uri.includes("local stotage")) {
    console.error("❌ Set a real MONGO_URI in backend/.env first");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB");

  // ── 1. Hospitals ───────────────────────────────────────────
  await Hospital.deleteMany({});
  const hospDocs = await Hospital.insertMany(HOSPITALS);
  console.log(`✅ Seeded ${hospDocs.length} hospitals`);

  // Build hospital map (hospitalId → _id)
  const hospitalMap = {};
  for (const h of hospDocs) hospitalMap[h.hospitalId] = h._id;

  // ── 2. Ambulances ──────────────────────────────────────────
  await Ambulance.deleteMany({});
  const ambDocs = await Ambulance.insertMany(buildAmbs(hospitalMap));
  console.log(`✅ Seeded ${ambDocs.length} ambulances`);

  // Build ambulance map (ambulanceId → _id)
  const ambMap = {};
  for (const a of ambDocs) ambMap[a.ambulanceId] = a._id;

  // ── 3. Users ───────────────────────────────────────────────
  await User.deleteMany({});

  const hash = async p => bcrypt.hash(p, 12);

  const users = [
    // Admin
    { name:"System Admin",          email:"admin@healthcare.local",          password: await hash("Admin@123"),    role:"Admin",             accountStatus:"active", isActive:true },
    // Central Authority
    { name:"Central Authority",     email:"central@healthcare.local",        password: await hash("Central@123"),  role:"CentralAuthority",  accountStatus:"active", isActive:true },
    // Hospital Operators — one per hospital
    { name:"Victoria Operator",     email:"victoria@healthcare.local",       password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0001"] },
    { name:"NSCB Operator",         email:"nscb@healthcare.local",           password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0002"] },
    { name:"Gokuldas Operator",     email:"gokuldas@healthcare.local",       password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0003"] },
    { name:"Katni Hospital Op",     email:"katni@healthcare.local",          password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0004"] },
    { name:"Sanjivani Operator",    email:"sanjivani@healthcare.local",      password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0005"] },
    { name:"Apollo Sagar Operator", email:"apollo-sagar@healthcare.local",   password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0007"] },
    { name:"CHL Indore Operator",   email:"chl-indore@healthcare.local",     password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0010"] },
    { name:"Hamidia Bhopal Operator",email:"hamidia@healthcare.local",       password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0011"] },
    { name:"Chirayu Bhopal Operator",email:"chirayu@healthcare.local",       password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0012"] },
    { name:"MYH Indore Operator",   email:"myh@healthcare.local",            password: await hash("Hospital@123"), role:"HospitalOperator",  accountStatus:"active", isActive:true, hospitalId: hospitalMap["HOSP-0013"] },
    // Ambulance Operators — key drivers
    { name:"Ramesh Kumar (AMB-001)",email:"driver001@healthcare.local",      password: await hash("Driver@123"),   role:"AmbulanceOperator", accountStatus:"active", isActive:true, ambulanceId: ambMap["AMB-0001"] },
    { name:"Pradeep Verma (AMB-003)",email:"driver003@healthcare.local",     password: await hash("Driver@123"),   role:"AmbulanceOperator", accountStatus:"active", isActive:true, ambulanceId: ambMap["AMB-0003"] },
    { name:"Santosh Gupta (AMB-010)",email:"driver010@healthcare.local",     password: await hash("Driver@123"),   role:"AmbulanceOperator", accountStatus:"active", isActive:true, ambulanceId: ambMap["AMB-0010"] },
    { name:"Sanjay Mehta (AMB-014)", email:"driver014@healthcare.local",     password: await hash("Driver@123"),   role:"AmbulanceOperator", accountStatus:"active", isActive:true, ambulanceId: ambMap["AMB-0014"] },
    { name:"Arun Verma (AMB-017)",  email:"driver017@healthcare.local",      password: await hash("Driver@123"),   role:"AmbulanceOperator", accountStatus:"active", isActive:true, ambulanceId: ambMap["AMB-0017"] },
  ];

  const userDocs = await User.insertMany(users);
  console.log(`✅ Seeded ${userDocs.length} users`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("   LOGIN CREDENTIALS");
  console.log("═══════════════════════════════════════════════════");
  console.log("\n🔑 ADMIN:");
  console.log("   admin@healthcare.local / Admin@123");
  console.log("\n🏛 CENTRAL AUTHORITY:");
  console.log("   central@healthcare.local / Central@123");
  console.log("\n🏥 HOSPITAL OPERATORS (password: Hospital@123):");
  console.log("   victoria@healthcare.local   → Victoria Govt Hospital");
  console.log("   nscb@healthcare.local        → NSCB Medical College");
  console.log("   gokuldas@healthcare.local    → Gokuldas Hospital");
  console.log("   katni@healthcare.local       → City Hospital Katni");
  console.log("   sanjivani@healthcare.local   → Sanjivani Hospital");
  console.log("   apollo-sagar@healthcare.local→ Apollo Clinic Sagar");
  console.log("   chl-indore@healthcare.local  → CHL Hospital Indore");
  console.log("   hamidia@healthcare.local     → Hamidia Hospital Bhopal");
  console.log("   chirayu@healthcare.local     → Chirayu Hospital Bhopal");
  console.log("   myh@healthcare.local         → MYH Hospital Indore");
  console.log("\n🚑 AMBULANCE DRIVERS (password: Driver@123):");
  console.log("   driver001@healthcare.local → AMB-0001 (Ramesh Kumar)");
  console.log("   driver003@healthcare.local → AMB-0003 (Pradeep Verma)");
  console.log("   driver010@healthcare.local → AMB-0010 (Santosh Gupta)");
  console.log("   driver014@healthcare.local → AMB-0014 (Sanjay Mehta)");
  console.log("   driver017@healthcare.local → AMB-0017 (Arun Verma)");
  console.log("\n✅ Citizen: No login required — open website directly");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(e => { console.error("❌ Seed error:", e.message); process.exit(1); });
