const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// ✅ Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const librarianOverviewRoutes = (app) => {
  // 🧠 GET recent users
  router.get("/recent-users", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select(`user_id, first_name, last_name, email, user_type, status, created_at`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const users = data.map((u) => ({
        id: u.user_id,
        name: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        role: u.user_type,
        status: u.status,
        created_at: u.created_at,
      }));

      res.json({ success: true, data: users });
    } catch (error) {
      console.error("❌ Error fetching recent users:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  });

  // ✅ Mount router at base path
  app.use("/api/librarian/overview", router);
};

module.exports = librarianOverviewRoutes;
