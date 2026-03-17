/**
 * Hospital Registration Controller
 * Handles: Admin invite, self-registration, email verification, approval
 */
const crypto  = require("crypto");
const Hospital = require("../models/Hospital");
const User     = require("../models/User");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const emailSvc = require("../services/emailService");
const geocode  = require("../services/geocodingService");

// ── ADMIN: Invite a hospital by email ─────────────────────────
exports.adminInviteHospital = async (req, res) => {
  try {
    const { name, email, phone, address, type, level, tier, lat, lng, city, district, state, pincode, region } = req.body;
    if (!name || !email) return res.status(400).json({ message:"name and email required" });

    // Check duplicate
    const exists = await Hospital.findOne({ "contact.email": email.toLowerCase() });
    if (exists) return res.status(400).json({ message:"A hospital with this email already exists" });

    // Auto-generate hospitalId
    const count = await Hospital.countDocuments();
    const hospitalId = `HOSP-${String(count+1).padStart(4,"0")}`;

    // Generate token (48h)
    const token   = crypto.randomBytes(32).toString("hex");
    const expiry  = new Date(Date.now() + 48*60*60*1000);

    // Geocode if lat/lng not provided
    let locData = { lat:parseFloat(lat)||0, lng:parseFloat(lng)||0, address:address||"", city:city||"", district:district||"", state:state||"", pincode:pincode||"", region:region||city||"" };
    if ((!lat || !lng) && address) {
      try {
        const g = await geocode.forwardGeocode(address);
        if (g?.lat) { locData.lat=g.lat; locData.lng=g.lng; }
      } catch(e) {}
    }

    const hospital = await Hospital.create({
      hospitalId, name, type:type||"Government", level:level||"Secondary", tier:tier||"Tier2",
      registeredBy: req.user?.id||null,
      isVerified: false,
      verificationToken: token,
      tokenExpiry: expiry,
      registrationStatus: "email_sent",
      registrationEmail: email.toLowerCase(),
      emailSentAt: new Date(),
      location: locData,
      contact: { phone:phone||"", email:email.toLowerCase(), emergency:"", website:"" },
    });

    // Send email
    const emailResult = await emailSvc.sendVerificationEmail(hospital, token);
    
    const io = req.app.get("io");
    io?.emit("hospitalRegistrationSent", { hospitalId, name, email });

    res.status(201).json({
      hospital, emailSent: emailResult.success,
      previewUrl: emailResult.preview || null,
      message: emailResult.success
        ? `Invitation email sent to ${email}`
        : `Hospital created but email failed: ${emailResult.error}`
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── HOSPITAL: Verify token + complete registration ────────────
exports.getVerificationInfo = async (req, res) => {
  try {
    const { token } = req.params;
    const hospital = await Hospital.findOne({ verificationToken:token, tokenExpiry:{ $gt:new Date() } });
    if (!hospital) {
      // Check if already verified
      const already = await Hospital.findOne({ verificationToken:token });
      if (already?.isVerified) return res.status(200).json({ alreadyVerified:true, hospital:{ name:already.name, email:already.contact.email } });
      return res.status(400).json({ message:"Invalid or expired token. Please contact your administrator to resend the link.", expired:true });
    }
    res.json({
      hospital: {
        name:hospital.name, email:hospital.contact.email, phone:hospital.contact.phone,
        address:hospital.location.address, city:hospital.location.city,
        type:hospital.type, tier:hospital.tier, hospitalId:hospital.hospitalId,
      }
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

exports.completeVerification = async (req, res) => {
  try {
    const { token } = req.params;
    const hospital = await Hospital.findOne({ verificationToken:token, tokenExpiry:{ $gt:new Date() } });
    if (!hospital) return res.status(400).json({ message:"Invalid or expired token", expired:true });
    if (hospital.isVerified) return res.status(400).json({ message:"Already verified", alreadyVerified:true });

    const {
      // Contact & location
      phone, emergency, website,
      address, landmark, city, district, state, pincode,
      // Resources
      icuTotal, icuAvail, bedsTotal, bedsAvail, emergencyBeds, ventTotal, ventAvail,
      oxygenLevel, dialysis, bloodUnits, doctorsOnDuty, nursesOnDuty,
      ctScan, mri, xray, bloodBank, ambulancesTotal, ambulancesAvailable,
      specialties, traumaCenter, covidWard,
      // Account
      operatorName, operatorEmail, operatorPassword,
    } = req.body;

    // Update hospital
    hospital.contact.phone     = phone || hospital.contact.phone;
    hospital.contact.emergency = emergency || "";
    hospital.contact.website   = website || "";
    if (address) hospital.location.address  = address;
    if (landmark) hospital.location.landmark = landmark;
    if (city)     hospital.location.city    = city;
    if (district) hospital.location.district = district;
    if (state)    hospital.location.state   = state;
    if (pincode)  hospital.location.pincode = pincode;

    hospital.resources.icuBeds          = { total:+icuTotal||0, available:+icuAvail||0 };
    hospital.resources.generalBeds      = { total:+bedsTotal||0, available:+bedsAvail||0 };
    hospital.resources.emergencyBeds    = { total:+emergencyBeds||0, available:+emergencyBeds||0 };
    hospital.resources.ventilators      = { total:+ventTotal||0, available:+ventAvail||0 };
    hospital.resources.oxygenLevel      = +oxygenLevel||100;
    hospital.resources.dialysisMachines = { total:+dialysis||0, available:+dialysis||0 };
    hospital.resources.bloodUnitsAvailable  = +bloodUnits||0;
    hospital.resources.doctorsOnDuty    = +doctorsOnDuty||0;
    hospital.resources.nursesOnDuty     = +nursesOnDuty||0;
    hospital.resources.ambulancesTotal  = +ambulancesTotal||0;
    hospital.resources.ambulancesAvailable = +ambulancesAvailable||0;
    hospital.resources.ctScan   = !!ctScan;
    hospital.resources.mri      = !!mri;
    hospital.resources.xray     = !!xray;
    hospital.resources.bloodBank = !!bloodBank;
    if (specialties) hospital.specialties = Array.isArray(specialties) ? specialties : specialties.split(",").map(s=>s.trim()).filter(Boolean);
    if (traumaCenter !== undefined) hospital.traumaCenter = !!traumaCenter;
    if (covidWard    !== undefined) hospital.covidWard    = !!covidWard;

    hospital.isVerified        = true;
    hospital.verifiedAt        = new Date();
    hospital.verificationToken = null;
    hospital.registrationStatus = "verified";
    hospital.status            = "Active";
    hospital.lastUpdated       = new Date();
    await hospital.save();

    // Create operator user account
    let operatorUser = null;
    if (operatorEmail && operatorPassword && operatorName) {
      const existing = await User.findOne({ email:operatorEmail.toLowerCase() });
      if (!existing) {
        const hashed = await bcrypt.hash(operatorPassword, 10);
        operatorUser = await User.create({
          name:operatorName, email:operatorEmail.toLowerCase(), password:hashed,
          role:"HospitalOperator", hospitalId:hospital._id, accountStatus:"active", isActive:true,
        });
      }
    }

    const token2 = operatorUser ? jwt.sign({ id:operatorUser._id, role:operatorUser.role, name:operatorUser.name }, process.env.JWT_SECRET, { expiresIn:"7d" }) : null;

    req.app.get("io")?.emit("hospitalVerified", { hospitalId:hospital._id, name:hospital.name });

    res.json({
      message: "Hospital registration complete! Your account is now active.",
      hospital: { name:hospital.name, hospitalId:hospital.hospitalId },
      operatorCreated: !!operatorUser,
      loginToken: token2,
      loginEmail: operatorEmail,
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── HOSPITAL SELF-REGISTRATION (hospital submits request to admin) ────
exports.selfRegister = async (req, res) => {
  try {
    const { name, email, phone, address, city, district, state, type, lat, lng } = req.body;
    if (!name || !email || !phone) return res.status(400).json({ message:"name, email, phone required" });

    const exists = await Hospital.findOne({ "contact.email":email.toLowerCase() });
    if (exists) return res.status(400).json({ message:"Hospital with this email already registered" });

    const count    = await Hospital.countDocuments();
    const hospitalId = `HOSP-${String(count+1).padStart(4,"0")}`;

    const hospital = await Hospital.create({
      hospitalId, name, type:type||"Private",
      selfRegistered: true,
      registrationStatus: "pending",
      registrationEmail: email.toLowerCase(),
      isVerified: false,
      location: { lat:parseFloat(lat)||0, lng:parseFloat(lng)||0, address:address||"", city:city||"", district:district||"", state:state||"" },
      contact: { phone:phone||"", email:email.toLowerCase() },
      status: "Offline",
    });

    // Notify admin via socket
    req.app.get("io")?.emit("newHospitalRegistrationRequest", { hospital:hospital.toObject(), message:`New hospital registration request: ${name}` });

    res.status(201).json({ message:"Registration request submitted. Admin will review and send you a verification email.", hospitalId:hospital.hospitalId });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── ADMIN: Resend verification email ─────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ message:"Not found" });
    if (hospital.isVerified) return res.status(400).json({ message:"Already verified" });

    const token  = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 48*60*60*1000);
    hospital.verificationToken = token;
    hospital.tokenExpiry       = expiry;
    hospital.registrationStatus = "email_sent";
    hospital.emailSentAt       = new Date();
    hospital.emailResendCount  = (hospital.emailResendCount||0) + 1;
    await hospital.save();

    const result = await emailSvc.sendVerificationEmail(hospital, token);
    res.json({ message:"Verification email resent", emailSent:result.success, preview:result.preview||null });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── ADMIN: Approve / Reject self-registered hospital ─────────
exports.approveHospital = async (req, res) => {
  try {
    const { action, rejectionReason } = req.body; // action: "approve" | "reject"
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ message:"Not found" });

    if (action === "reject") {
      hospital.registrationStatus = "rejected";
      hospital.rejectionReason    = rejectionReason || "Did not meet requirements";
      hospital.status             = "Offline";
      await hospital.save();
      return res.json({ message:"Hospital registration rejected" });
    }

    // Approve: send verification email
    const token  = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 48*60*60*1000);
    hospital.verificationToken  = token;
    hospital.tokenExpiry        = expiry;
    hospital.registrationStatus = "email_sent";
    hospital.approvedBy         = req.user?.id;
    hospital.approvedAt         = new Date();
    hospital.emailSentAt        = new Date();
    await hospital.save();

    const result = await emailSvc.sendVerificationEmail(hospital, token);
    res.json({ message:"Hospital approved and verification email sent", emailSent:result.success, preview:result.preview||null });
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── GET registration status list ─────────────────────────────
exports.getRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { registrationStatus:status } : { registrationStatus:{ $ne:"approved" } };
    const hospitals = await Hospital.find(filter).sort({ createdAt:-1 }).lean();
    res.json(hospitals);
  } catch(e) { res.status(500).json({ error:e.message }); }
};

// ── Forward geocode for address search ───────────────────────
exports.geocodeAddress = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message:"q required" });
    const result = await geocode.forwardGeocode(q);
    res.json(result || []);
  } catch(e) { res.status(200).json([]); }
};
