/**
 * Email Service — Nodemailer
 * Handles: Hospital verification emails, reminders, notifications
 * Falls back gracefully if email not configured
 */
const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  // Check if email is configured
  if (!process.env.EMAIL_USER || process.env.EMAIL_PASS === "ldbm uyhk mtqa zoko") {
    console.warn("[Email] Not configured — using Ethereal (test) transport");
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter;
}

// Create a test account for dev mode
async function getTestTransport() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email", port: 587, secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

// ── Send hospital verification email ──────────────────────────
exports.sendVerificationEmail = async (hospital, token) => {
  const link = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-hospital/${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head><style>
      body { font-family: 'Segoe UI', sans-serif; background:#f4f6f9; margin:0; padding:0; }
      .container { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
      .header { background:linear-gradient(135deg,#0055aa,#0088cc); padding:32px; text-align:center; }
      .header h1 { color:#fff; margin:0; font-size:24px; letter-spacing:1px; }
      .header p  { color:rgba(255,255,255,0.8); margin:6px 0 0; font-size:14px; }
      .body { padding:32px; }
      .body h2 { color:#0d1e35; font-size:20px; margin:0 0 12px; }
      .body p  { color:#4e5d6c; line-height:1.7; font-size:14px; }
      .hospital-card { background:#f0f8ff; border:1px solid #cce4ff; border-radius:8px; padding:16px; margin:16px 0; }
      .hospital-card h3 { color:#0055aa; margin:0 0 8px; font-size:16px; }
      .hospital-card p  { margin:4px 0; color:#4e5d6c; font-size:13px; }
      .btn { display:inline-block; background:#0088cc; color:#fff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:16px; font-weight:600; letter-spacing:0.5px; margin:20px 0; }
      .btn:hover { background:#0066aa; }
      .warning { background:#fff8e1; border:1px solid #ffd600; border-radius:8px; padding:12px 16px; margin-top:16px; font-size:12px; color:#856404; }
      .footer { background:#f4f6f9; padding:20px; text-align:center; font-size:12px; color:#8a9aac; }
      .steps { counter-reset: step; margin:16px 0; }
      .step  { display:flex; gap:12px; align-items:flex-start; margin-bottom:12px; }
      .step-num { background:#0088cc; color:#fff; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0; margin-top:2px; }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 CareConnect Platform</h1>
          <p>AI Emergency Response & Hospital Coordination</p>
        </div>
        <div class="body">
          <h2>Complete Your Hospital Registration</h2>
          <p>You have been invited to join the <strong>CareConnect Healthcare Platform</strong>. Please complete your registration by filling in your hospital's details.</p>
          
          <div class="hospital-card">
            <h3>🏥 ${hospital.name}</h3>
            <p>📍 ${hospital.location?.address || hospital.location?.city || "Location pending"}</p>
            <p>📞 ${hospital.contact?.phone || "Phone pending"}</p>
            <p>🏷️ ${hospital.type} · ${hospital.tier}</p>
          </div>

          <p><strong>What to do next:</strong></p>
          <div class="steps">
            <div class="step"><div class="step-num">1</div><div>Click the button below to open the registration form</div></div>
            <div class="step"><div class="step-num">2</div><div>Fill in your hospital's resources (ICU beds, ventilators, staff, etc.)</div></div>
            <div class="step"><div class="step-num">3</div><div>Confirm and submit — your account will be activated</div></div>
            <div class="step"><div class="step-num">4</div><div>Log in to start managing your hospital's resources in real-time</div></div>
          </div>

          <div style="text-align:center;">
            <a href="${link}" class="btn">✅ Complete Registration →</a>
          </div>
          
          <p style="font-size:12px;color:#8a9aac;">Or copy this link: <a href="${link}" style="color:#0088cc;">${link}</a></p>

          <div class="warning">
            ⏰ <strong>This link expires in 48 hours.</strong> If you don't complete registration within this time, please contact your administrator to resend the link.
          </div>
        </div>
        <div class="footer">
          <p>CareConnect Platform · AI Emergency Response System</p>
          <p>This email was sent to ${hospital.contact?.email || "your registered email"}. If you believe this is an error, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    let t = getTransporter();
    let info;
    
    if (!t) {
      // Dev mode — use Ethereal test account
      t = await getTestTransport();
      info = await t.sendMail({
        from: `"CareConnect" <test@careconnect.local>`,
        to: hospital.contact?.email || hospital.registrationEmail,
        subject: `[CareConnect] Complete Hospital Registration — ${hospital.name}`,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Email] TEST MODE — Preview: ${previewUrl}`);
      return { success: true, preview: previewUrl, messageId: info.messageId };
    }

    info = await t.sendMail({
      from: process.env.EMAIL_FROM || `"CareConnect" <${process.env.EMAIL_USER}>`,
      to: hospital.contact?.email || hospital.registrationEmail,
      subject: `[CareConnect] Complete Hospital Registration — ${hospital.name}`,
      html,
    });
    console.log(`[Email] Sent to ${hospital.contact?.email} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch(e) {
    console.error("[Email] Failed:", e.message);
    return { success: false, error: e.message };
  }
};

// ── Resource update reminder email ────────────────────────────
exports.sendResourceReminder = async (hospital, hoursStale) => {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
      <h2 style="color:#ff8f00">⚠️ Resource Update Reminder</h2>
      <p>Dear ${hospital.name} team,</p>
      <p>Your hospital's resource data was last updated <strong>${hoursStale} hours ago</strong>. Please log in and update your current resource availability to ensure patients are directed to the correct facilities.</p>
      <div style="background:#fff8e1;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #ffd600">
        <strong>Last updated:</strong> ${new Date(hospital.lastUpdated).toLocaleString()}<br/>
        <strong>Current ICU:</strong> ${hospital.resources?.icuBeds?.available}/${hospital.resources?.icuBeds?.total}<br/>
        <strong>Current O₂:</strong> ${hospital.resources?.oxygenLevel}%
      </div>
      <p>Login at: <a href="${process.env.FRONTEND_URL}/staff">${process.env.FRONTEND_URL}/staff</a></p>
      <p style="color:#8a9aac;font-size:12px">CareConnect Platform</p>
    </div>
  `;
  
  try {
    let t = getTransporter();
    if (!t) { console.log(`[Email] Reminder (dev): ${hospital.name}`); return { success: true }; }
    await t.sendMail({
      from: process.env.EMAIL_FROM,
      to: hospital.contact?.email,
      subject: `⚠️ Resource Update Needed — ${hospital.name}`,
      html,
    });
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
};
