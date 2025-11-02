const express = require("express");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");

module.exports = (app) => {
  const router = express.Router();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 🔹 POST /api/user/verify-password
  router.post("/verify-password", async (req, res) => {
    try {
      const { user_id, password } = req.body;
      if (!user_id || !password) {
        return res.status(400).json({ success: false, message: "Missing user_id or password" });
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("password_hash")
        .eq("user_id", user_id)
        .single();

      if (error || !user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        return res.json({ success: true, message: "Password verified" });
      } else {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }
    } catch (err) {
      console.error("Password verify error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Mount router to base path
  app.use("/api/user", router);
};
