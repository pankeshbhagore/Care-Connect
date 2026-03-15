// require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
// const mongoose = require("mongoose");
// const Hospital = require("../models/Hospital");

// const hospitals = [
//   { hospitalId:"HOSP-0001", name:"Victoria Government Hospital", type:"Government", level:"Tertiary",
//     location:{ lat:23.1815, lng:79.9864, address:"Napier Town", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482001" },
//     contact:{ phone:"0761-4012345", emergency:"0761-4012300", email:"victoria@mphealth.gov.in" },
//     resources:{ icuBeds:{total:40,available:8}, generalBeds:{total:300,available:45}, emergencyBeds:{total:20,available:5}, icuPediatric:{total:10,available:2}, maternity:{total:20,available:4}, isolation:{total:8,available:2}, ventilators:{total:15,available:3}, oxygenBeds:{total:30,available:6}, dialysisMachines:{total:8,available:2}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:12, nursesOnDuty:35, specialistsAvailable:["Cardiology","Neurology","Orthopedics"], ambulancesTotal:6, ambulancesAvailable:3, oxygenLevel:72, bloodUnitsAvailable:45 },
//     status:"Active", alertLevel:"Orange", specialties:["Cardiology","Neurology","Orthopedics","General Surgery","Pediatrics"], traumaCenter:true, avgPatientWait:25 },

//   { hospitalId:"HOSP-0002", name:"NSCB Medical College Hospital", type:"Government", level:"Quaternary",
//     location:{ lat:23.1736, lng:79.9571, address:"Medical College Road", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482003" },
//     contact:{ phone:"0761-2368000", emergency:"0761-2368001", email:"nscb@mphealth.gov.in" },
//     resources:{ icuBeds:{total:80,available:12}, generalBeds:{total:600,available:88}, emergencyBeds:{total:40,available:8}, icuPediatric:{total:20,available:3}, maternity:{total:40,available:8}, isolation:{total:20,available:4}, ventilators:{total:30,available:5}, oxygenBeds:{total:60,available:10}, dialysisMachines:{total:15,available:4}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:25, nursesOnDuty:80, specialistsAvailable:["Cardiology","Neurology","Oncology","Nephrology"], ambulancesTotal:10, ambulancesAvailable:5, oxygenLevel:65, bloodUnitsAvailable:120 },
//     status:"Active", alertLevel:"Orange", specialties:["Cardiology","Neurology","Oncology","Nephrology","Orthopedics","ENT"], traumaCenter:true, covidWard:true, avgPatientWait:40 },

//   { hospitalId:"HOSP-0003", name:"Gokuldas Hospital", type:"Private", level:"Secondary",
//     location:{ lat:23.1823, lng:79.9901, address:"Wright Town", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482002" },
//     contact:{ phone:"0761-4089000", emergency:"0761-4089001" },
//     resources:{ icuBeds:{total:20,available:5}, generalBeds:{total:100,available:22}, emergencyBeds:{total:10,available:3}, icuPediatric:{total:5,available:1}, maternity:{total:10,available:3}, isolation:{total:4,available:1}, ventilators:{total:8,available:2}, oxygenBeds:{total:15,available:4}, dialysisMachines:{total:4,available:1}, ctScan:true, mri:false, xray:true, bloodBank:true, doctorsOnDuty:8, nursesOnDuty:20, specialistsAvailable:["Cardiology","Orthopedics"], ambulancesTotal:3, ambulancesAvailable:2, oxygenLevel:85, bloodUnitsAvailable:30 },
//     status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Orthopedics","General Surgery","Gynecology"], traumaCenter:false, avgPatientWait:15 },

//   { hospitalId:"HOSP-0004", name:"City Hospital Katni", type:"Government", level:"Secondary",
//     location:{ lat:23.8299, lng:80.4042, address:"Main Road, Katni", city:"Katni", district:"Katni", state:"Madhya Pradesh", pincode:"483501" },
//     contact:{ phone:"07622-234567", emergency:"07622-234500" },
//     resources:{ icuBeds:{total:15,available:0}, generalBeds:{total:120,available:10}, emergencyBeds:{total:8,available:1}, icuPediatric:{total:4,available:0}, maternity:{total:8,available:1}, isolation:{total:3,available:0}, ventilators:{total:5,available:0}, oxygenBeds:{total:10,available:2}, dialysisMachines:{total:2,available:0}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:5, nursesOnDuty:12, specialistsAvailable:[], ambulancesTotal:2, ambulancesAvailable:1, oxygenLevel:40, bloodUnitsAvailable:5 },
//     status:"Overwhelmed", alertLevel:"Red", specialties:["General Medicine","General Surgery"], traumaCenter:false, avgPatientWait:90 },

//   { hospitalId:"HOSP-0005", name:"Sanjivani Hospital", type:"Private", level:"Secondary",
//     location:{ lat:23.1667, lng:79.9333, address:"Adhartal, Jabalpur", city:"Jabalpur", district:"Jabalpur", state:"Madhya Pradesh", pincode:"482004" },
//     contact:{ phone:"0761-4112233", emergency:"0761-4112200" },
//     resources:{ icuBeds:{total:12,available:4}, generalBeds:{total:60,available:15}, emergencyBeds:{total:6,available:2}, icuPediatric:{total:3,available:1}, maternity:{total:6,available:2}, isolation:{total:3,available:1}, ventilators:{total:5,available:2}, oxygenBeds:{total:10,available:3}, dialysisMachines:{total:3,available:1}, ctScan:true, mri:false, xray:true, bloodBank:true, doctorsOnDuty:6, nursesOnDuty:15, specialistsAvailable:["Cardiology"], ambulancesTotal:2, ambulancesAvailable:2, oxygenLevel:90, bloodUnitsAvailable:20 },
//     status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","General Surgery"], traumaCenter:false, avgPatientWait:10 },

//   { hospitalId:"HOSP-0006", name:"District Hospital Narsinghpur", type:"Government", level:"Primary",
//     location:{ lat:22.9466, lng:79.1940, address:"Civil Lines", city:"Narsinghpur", district:"Narsinghpur", state:"Madhya Pradesh", pincode:"487001" },
//     contact:{ phone:"07792-232345" },
//     resources:{ icuBeds:{total:8,available:3}, generalBeds:{total:80,available:20}, emergencyBeds:{total:5,available:2}, icuPediatric:{total:2,available:1}, maternity:{total:6,available:2}, isolation:{total:2,available:1}, ventilators:{total:3,available:1}, oxygenBeds:{total:8,available:3}, dialysisMachines:{total:1,available:1}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:4, nursesOnDuty:10, specialistsAvailable:[], ambulancesTotal:2, ambulancesAvailable:1, oxygenLevel:78, bloodUnitsAvailable:10 },
//     status:"Active", alertLevel:"Normal", specialties:["General Medicine","Pediatrics"], traumaCenter:false, avgPatientWait:20 },

//   { hospitalId:"HOSP-0007", name:"Apollo Clinic Sagar", type:"Private", level:"Secondary",
//     location:{ lat:23.8388, lng:78.7378, address:"Makroniya, Sagar", city:"Sagar", district:"Sagar", state:"Madhya Pradesh", pincode:"470001" },
//     contact:{ phone:"07582-245678", emergency:"07582-245600" },
//     resources:{ icuBeds:{total:18,available:6}, generalBeds:{total:80,available:18}, emergencyBeds:{total:8,available:3}, icuPediatric:{total:4,available:2}, maternity:{total:8,available:3}, isolation:{total:4,available:2}, ventilators:{total:7,available:3}, oxygenBeds:{total:12,available:4}, dialysisMachines:{total:5,available:2}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:10, nursesOnDuty:25, specialistsAvailable:["Cardiology","Orthopedics","Neurology"], ambulancesTotal:4, ambulancesAvailable:3, oxygenLevel:95, bloodUnitsAvailable:55 },
//     status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","Orthopedics","Oncology"], traumaCenter:true, avgPatientWait:12 },

//   { hospitalId:"HOSP-0008", name:"Bundelkhand Medical College", type:"Government", level:"Tertiary",
//     location:{ lat:23.8500, lng:78.7500, address:"Medical College Road, Sagar", city:"Sagar", district:"Sagar", state:"Madhya Pradesh", pincode:"470001" },
//     contact:{ phone:"07582-256789", emergency:"07582-256700" },
//     resources:{ icuBeds:{total:35,available:7}, generalBeds:{total:400,available:55}, emergencyBeds:{total:20,available:5}, icuPediatric:{total:8,available:2}, maternity:{total:15,available:3}, isolation:{total:6,available:2}, ventilators:{total:18,available:4}, oxygenBeds:{total:30,available:8}, dialysisMachines:{total:10,available:3}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:18, nursesOnDuty:55, specialistsAvailable:["Cardiology","Neurology","Gastroenterology","Nephrology"], ambulancesTotal:7, ambulancesAvailable:4, oxygenLevel:82, bloodUnitsAvailable:80 },
//     status:"Active", alertLevel:"Yellow", specialties:["Cardiology","Neurology","Orthopedics","ENT","Gastroenterology"], traumaCenter:true, avgPatientWait:35 },

//   { hospitalId:"HOSP-0009", name:"Umaria District Hospital", type:"Government", level:"Primary",
//     location:{ lat:23.5232, lng:80.8422, address:"Civil Hospital Campus", city:"Umaria", district:"Umaria", state:"Madhya Pradesh", pincode:"484661" },
//     contact:{ phone:"07653-220123" },
//     resources:{ icuBeds:{total:5,available:5}, generalBeds:{total:50,available:30}, emergencyBeds:{total:4,available:3}, icuPediatric:{total:1,available:1}, maternity:{total:4,available:3}, isolation:{total:2,available:2}, ventilators:{total:2,available:2}, oxygenBeds:{total:5,available:5}, dialysisMachines:{total:0,available:0}, ctScan:false, mri:false, xray:true, bloodBank:false, doctorsOnDuty:3, nursesOnDuty:8, specialistsAvailable:[], ambulancesTotal:1, ambulancesAvailable:1, oxygenLevel:92, bloodUnitsAvailable:8 },
//     status:"Active", alertLevel:"Normal", specialties:["General Medicine"], traumaCenter:false, avgPatientWait:8 },

//   { hospitalId:"HOSP-0010", name:"Care CHL Hospital Indore", type:"Private", level:"Quaternary",
//     location:{ lat:22.7196, lng:75.8577, address:"AB Road, Indore", city:"Indore", district:"Indore", state:"Madhya Pradesh", pincode:"452001" },
//     contact:{ phone:"0731-4747474", emergency:"0731-4747400", email:"info@carechl.com" },
//     resources:{ icuBeds:{total:100,available:22}, generalBeds:{total:500,available:90}, emergencyBeds:{total:50,available:12}, icuPediatric:{total:20,available:5}, maternity:{total:25,available:6}, isolation:{total:15,available:4}, ventilators:{total:45,available:12}, oxygenBeds:{total:80,available:20}, dialysisMachines:{total:20,available:8}, ctScan:true, mri:true, xray:true, bloodBank:true, doctorsOnDuty:40, nursesOnDuty:120, specialistsAvailable:["Cardiology","Neurology","Oncology","Nephrology","Transplant","Neurosurgery"], ambulancesTotal:12, ambulancesAvailable:7, oxygenLevel:98, bloodUnitsAvailable:200 },
//     status:"Active", alertLevel:"Normal", specialties:["Cardiology","Neurology","Oncology","Nephrology","Orthopedics","Transplant","Neurosurgery"], traumaCenter:true, covidWard:true, avgPatientWait:20 },
// ];

// async function seed() {
//   await mongoose.connect(process.env.MONGO_URI);
//   console.log("✅ Connected");
//   await Hospital.deleteMany({});
//   const docs = await Hospital.insertMany(hospitals);
//   console.log(`✅ Seeded ${docs.length} hospitals`);
//   process.exit(0);
// }
// seed().catch(e => { console.error(e); process.exit(1); });
