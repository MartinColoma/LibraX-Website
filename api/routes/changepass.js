// api/routes/changepss.js
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (app) => {
  // =========================================
  // 🔹 Change Password Endpoint (Authenticated Users)
  // =========================================
  app.post("/api/change-password", async (req, res) => {
    try {
      const { current_password, new_password } = req.body;

      // ✅ Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Unauthorized: Missing or invalid token",
        });
      }

      const token = authHeader.split(" ")[1];

      // ✅ Verify and decode JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          error: "Unauthorized: Invalid or expired token",
        });
      }

      // ✅ Extract user_id from token (most secure way)
      const user_id = decoded.userId;

      // ✅ Validate input
      if (!current_password || !new_password) {
        return res.status(400).json({
          error: "Both current password and new password are required",
        });
      }

      // ✅ Validate new password length
      if (new_password.length < 8) {
        return res.status(400).json({
          error: "New password must be at least 8 characters long",
        });
      }

      // ✅ Fetch user from database using token's user_id
      const { data: user, error: fetchError } = await supabase
        .from("users")
        .select("user_id, password_hash, email")
        .eq("user_id", user_id)
        .single();

      if (fetchError || !user) {
        console.error("❌ User fetch error:", fetchError);
        return res.status(404).json({ error: "User not found" });
      }

      // ✅ Verify current password
      const isPasswordValid = await bcrypt.compare(
        current_password,
        user.password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: "Current password is incorrect" 
        });
      }

      // ✅ Check if new password is same as current
      const isSamePassword = await bcrypt.compare(
        new_password,
        user.password_hash
      );

      if (isSamePassword) {
        return res.status(400).json({
          error: "New password must be different from current password",
        });
      }

      // ✅ Hash the new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

      // ✅ Get Manila time for updated_at
      const now = new Date();
      const manilaOffsetMs = 8 * 60 * 60 * 1000;
      const manilaTime = new Date(now.getTime() + manilaOffsetMs);
      const manilaTimeISO = manilaTime.toISOString().replace("Z", "+08:00");

      // ✅ Update password in database
      const { error: updateError } = await supabase
        .from("users")
        .update({ 
          password_hash: newPasswordHash,
          updated_at: manilaTimeISO
        })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("❌ Password update error:", updateError);
        return res.status(500).json({ error: "Failed to update password" });
      }

      console.log(`✅ Password changed successfully for user: ${user.email} (${user_id})`);

      return res.status(200).json({
        message: "✅ Password changed successfully",
        success: true,
      });

    } catch (error) {
      console.error("❌ Change password error:", error);
      return res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  });
};