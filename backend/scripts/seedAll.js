/**
 * MASTER SEED SCRIPT — Seeds everything in correct order
 * Run: node scripts/seedAll.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const User      = require("../models/User");
const Hospital  = require("../models/Hospital");
const Ambulance = require("../models/Ambulance");

// ── HOSPITALS DATA ────────────────────────────────────────────
const HOSPITALS = [
  {
    hospitalId: "HOSP-0001",
    name: "Victoria Government Hospital",
    type: "Government",
    level: "Tertiary",
    location: {
      lat: 23.1815,
      lng: 79.9864,
      address: "Napier Town, Jabalpur",
      city: "Jabalpur",
      district: "Jabalpur",
      state: "Madhya Pradesh",
      pincode: "482001"
    },
    contact: {
      phone: "0761-4012345",
      emergency: "0761-4012300"
    },
    resources: {
      icuBeds: { total: 40, available: 8 },
      generalBeds: { total: 300, available: 45 },
      ventilators: { total: 15, available: 3 }
    },
    status: "Active",
    specialties: ["Cardiology", "Neurology"]
  },

  {
    hospitalId: "HOSP-0002",
    name: "NSCB Medical College",
    type: "Government",
    level: "Quaternary",
    location: {
      lat: 23.1736,
      lng: 79.9571,
      address: "Medical College Road, Jabalpur",
      city: "Jabalpur",
      district: "Jabalpur",
      state: "Madhya Pradesh",
      pincode: "482003"
    },
    contact: {
      phone: "0761-2368000"
    },
    resources: {
      icuBeds: { total: 80, available: 12 },
      generalBeds: { total: 600, available: 88 }
    },
    status: "Active",
    specialties: ["Cardiology", "Neurology", "Oncology"]
  },

  {
    hospitalId: "HOSP-0010",
    name: "Care CHL Hospital Indore",
    type: "Private",
    level: "Quaternary",
    location: {
      lat: 22.7196,
      lng: 75.8577,
      address: "AB Road, Indore",
      city: "Indore",
      district: "Indore",
      state: "Madhya Pradesh",
      pincode: "452001"
    },
    contact: {
      phone: "0731-4747474"
    },
    resources: {
      icuBeds: { total: 100, available: 22 },
      generalBeds: { total: 500, available: 90 }
    },
    status: "Active",
    specialties: ["Cardiology", "Neurology", "Oncology"]
  }
];

// ── AMBULANCES DATA ───────────────────────────────────────────
const buildAmbs = (hospitalMap) => [
  {
    ambulanceId: "AMB-0001",
    name: "Victoria ALS-1",
    type: "ALS",
    driver: "Ramesh Kumar",
    driverPhone: "9876543201",
    location: { lat: 23.183, lng: 79.988 },
    status: "Available",
    hospital: hospitalMap["HOSP-0001"]
  },
  {
    ambulanceId: "AMB-0002",
    name: "NSCB ALS-1",
    type: "ALS",
    driver: "Pradeep Verma",
    driverPhone: "9876543203",
    location: { lat: 23.174, lng: 79.958 },
    status: "Available",
    hospital: hospitalMap["HOSP-0002"]
  }
];

// ── SEED FUNCTION ─────────────────────────────────────────────
async function seed() {
  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      console.error("❌ MONGO_URI missing in .env");
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    // ── 1. Hospitals ─────────────────────────
    await Hospital.deleteMany({});
    const hospDocs = await Hospital.insertMany(HOSPITALS);
    console.log(`✅ Seeded ${hospDocs.length} hospitals`);

    const hospitalMap = {};
    hospDocs.forEach(h => hospitalMap[h.hospitalId] = h._id);

    // ── 2. Ambulances ───────────────────────
    await Ambulance.deleteMany({});
    const ambDocs = await Ambulance.insertMany(buildAmbs(hospitalMap));
    console.log(`✅ Seeded ${ambDocs.length} ambulances`);

    const ambMap = {};
    ambDocs.forEach(a => ambMap[a.ambulanceId] = a._id);

    // ── 3. Users ────────────────────────────
    await User.deleteMany({});

    const hash = async (p) => bcrypt.hash(p, 10);

    const users = [
      {
        name: "Admin",
        email: "admin@healthcare.local",
        password: await hash("Admin@123"),
        role: "Admin"
      },
      {
        name: "Victoria Operator",
        email: "victoria@healthcare.local",
        password: await hash("Hospital@123"),
        role: "HospitalOperator",
        hospitalId: hospitalMap["HOSP-0001"]
      },
      {
        name: "Driver 1",
        email: "driver001@healthcare.local",
        password: await hash("Driver@123"),
        role: "AmbulanceOperator",
        ambulanceId: ambMap["AMB-0001"]
      }
    ];

    const userDocs = await User.insertMany(users);
    console.log(`✅ Seeded ${userDocs.length} users`);

    await mongoose.disconnect();
    console.log("✅ Disconnected");

    process.exit(0);

  } catch (e) {
    console.error("❌ Seed error:", e.message);
    process.exit(1);
  }
}

seed();
