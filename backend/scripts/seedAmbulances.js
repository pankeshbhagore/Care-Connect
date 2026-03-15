require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose  = require("mongoose");
const Ambulance = require("../models/Ambulance");
const Hospital  = require("../models/Hospital");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const hospitals = await Hospital.find().lean();
  const h = id => hospitals.find(h => h.hospitalId === id)?._id;

  await Ambulance.deleteMany({});
  const ambulances = [
    { ambulanceId:"AMB-0001", name:"Victoria ALS-1", type:"ALS", registrationNo:"MP-20-AB-1001", driver:"Ramesh Kumar", driverPhone:"9876543210", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","IV Kit"], location:{ lat:23.183, lng:79.988, address:"Victoria Hospital Jabalpur" }, status:"Available", hospital:h("HOSP-0001"), fuelLevel:92 },
    { ambulanceId:"AMB-0002", name:"Victoria BLS-2", type:"BLS", registrationNo:"MP-20-AB-1002", driver:"Suresh Singh", driverPhone:"9876543211", crewCount:2, equipment:["Oxygen","First Aid"], location:{ lat:23.180, lng:79.985, address:"Victoria Hospital Jabalpur" }, status:"Available", hospital:h("HOSP-0001"), fuelLevel:78 },
    { ambulanceId:"AMB-0003", name:"NSCB ALS-1", type:"ALS", registrationNo:"MP-20-CD-2001", driver:"Pradeep Verma", driverPhone:"9876543212", crewCount:3, equipment:["Defibrillator","Oxygen","Ventilator","ECG"], location:{ lat:23.174, lng:79.958, address:"NSCB Hospital Jabalpur" }, status:"Dispatched", hospital:h("HOSP-0002"), fuelLevel:65 },
    { ambulanceId:"AMB-0004", name:"NSCB Neo-1", type:"Neonatal", registrationNo:"MP-20-CD-2002", driver:"Anita Joshi", driverPhone:"9876543213", crewCount:3, equipment:["Incubator","Oxygen","IV Pump"], location:{ lat:23.176, lng:79.960, address:"NSCB Hospital Jabalpur" }, status:"Available", hospital:h("HOSP-0002"), fuelLevel:88 },
    { ambulanceId:"AMB-0005", name:"Gokuldas BLS-1", type:"BLS", registrationNo:"MP-20-EF-3001", driver:"Vijay Patel", driverPhone:"9876543214", crewCount:2, equipment:["Oxygen","First Aid","Stretcher"], location:{ lat:23.183, lng:79.990, address:"Gokuldas Hospital Jabalpur" }, status:"Available", hospital:h("HOSP-0003"), fuelLevel:95 },
    { ambulanceId:"AMB-0006", name:"Katni Govt ALS-1", type:"ALS", registrationNo:"MP-07-GH-4001", driver:"Mohan Das", driverPhone:"9876543215", crewCount:2, equipment:["Oxygen","ECG"], location:{ lat:23.831, lng:80.405, address:"City Hospital Katni" }, status:"Available", hospital:h("HOSP-0004"), fuelLevel:55 },
    { ambulanceId:"AMB-0007", name:"Sanjivani ALS-1", type:"ALS", registrationNo:"MP-20-IJ-5001", driver:"Rajesh Sharma", driverPhone:"9876543216", crewCount:3, equipment:["Defibrillator","Oxygen","ECG"], location:{ lat:23.167, lng:79.934, address:"Sanjivani Hospital Jabalpur" }, status:"Available", hospital:h("HOSP-0005"), fuelLevel:82 },
    { ambulanceId:"AMB-0008", name:"Apollo Sagar ALS-1", type:"ALS", registrationNo:"MP-14-KL-7001", driver:"Deepak Gupta", driverPhone:"9876543217", crewCount:3, equipment:["Defibrillator","Oxygen","Ventilator"], location:{ lat:23.840, lng:78.738, address:"Apollo Clinic Sagar" }, status:"Returning", hospital:h("HOSP-0007"), fuelLevel:70 },
    { ambulanceId:"AMB-0009", name:"Bundelkhand ALS-1", type:"ALS", registrationNo:"MP-14-MN-8001", driver:"Kiran Tiwari", driverPhone:"9876543218", crewCount:3, equipment:["Defibrillator","Oxygen","ECG","Blood Bank Mini"], location:{ lat:23.851, lng:78.751, address:"Bundelkhand MC Sagar" }, status:"Available", hospital:h("HOSP-0008"), fuelLevel:90 },
    { ambulanceId:"AMB-0010", name:"CHL Indore ALS-1", type:"ALS", registrationNo:"MP-09-OP-0001", driver:"Sanjay Mehta", driverPhone:"9876543219", crewCount:3, equipment:["Defibrillator","Ventilator","ECG","IV Pump","Oxygen"], location:{ lat:22.720, lng:75.858, address:"Care CHL Hospital Indore" }, status:"Available", hospital:h("HOSP-0010"), fuelLevel:97 },
    { ambulanceId:"AMB-0011", name:"CHL Indore BLS-2", type:"BLS", registrationNo:"MP-09-OP-0002", driver:"Priya Yadav", driverPhone:"9876543220", crewCount:2, equipment:["Oxygen","First Aid"], location:{ lat:22.718, lng:75.856, address:"Care CHL Hospital Indore" }, status:"Available", hospital:h("HOSP-0010"), fuelLevel:85 },
    { ambulanceId:"AMB-0012", name:"Narsinghpur Govt BLS-1", type:"BLS", registrationNo:"MP-25-QR-6001", driver:"Manoj Pandey", driverPhone:"9876543221", crewCount:2, equipment:["Oxygen","First Aid"], location:{ lat:22.947, lng:79.195, address:"District Hospital Narsinghpur" }, status:"Available", hospital:h("HOSP-0006"), fuelLevel:60 },
  ];

  const docs = await Ambulance.insertMany(ambulances);
  console.log(`✅ Seeded ${docs.length} ambulances`);
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
