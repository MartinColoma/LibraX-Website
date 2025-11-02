const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fetch = require("node-fetch");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateUserId(role) {
  const prefixMap = {
    Student: "S",
    Faculty: "F",
    Librarian: "L",
    Admin: "A",
  };
  const prefix = prefixMap[role] || "U";
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${year}${randomDigits}`;
}

function getUserType(role) {
  const staffRoles = ["Librarian", "Admin"];
  return staffRoles.includes(role) ? "staff" : "member";
}

module.exports = function registrationRoutes(app) {
  app.post("/api/register", async (req, res) => {
    try {
      const {
        role,
        firstName,
        lastName,
        gender,
        birthday,
        idNumber,
        email,
        nfcUid,
      } = req.body;

      if (!email || !role || !firstName || !lastName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check NFC UID uniqueness
      if (nfcUid) {
        const { data: existingNFC } = await supabase
          .from("users")
          .select("user_id")
          .eq("nfc_uid", nfcUid)
          .single();
        if (existingNFC) {
          return res.status(400).json({ message: "❌ NFC UID already registered" });
        }
      }

      // Check email uniqueness
      const { data: existingEmail } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", email)
        .single();
      if (existingEmail) {
        return res.status(400).json({ message: "❌ Email already registered" });
      }

      // Generate ID, temp password, user type
      const userId = generateUserId(role);
      const tempPassword = crypto.randomBytes(4).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const userType = getUserType(role);

      // Insert to database (removed address and phone_number)
      const { data, error } = await supabase
        .from("users")
        .insert([
          {
            user_id: userId,
            user_type: userType,
            role,
            first_name: firstName,
            last_name: lastName,
            gender,
            birthday,
            email,
            student_faculty_id: idNumber,
            password_hash: passwordHash,
            nfc_uid: nfcUid || null,
            status: "Active",
            date_registered: new Date().toISOString().split("T")[0],
          },
        ])
        .select();

      if (error) throw error;

      // Call Vercel serverless function for email sending (removed address and phone)
      await fetch("https://libra-x-email.vercel.app/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          role,
          gender,
          birthday,
          idNumber,
          nfcUid,
          tempPassword,
        }),
      });

      return res.status(200).json({
        message: "✅ User registered successfully",
        userId,
        tempPassword,
        data: data[0],
      });
    } catch (err) {
      console.error("❌ Error registering user:", err);
      return res.status(500).json({
        message: "❌ Failed to register user",
        error: err.message,
      });
    }
  });
};