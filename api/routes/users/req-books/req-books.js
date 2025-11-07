const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UserReqBooks = (app) => {
  
  

  // ⚠️ IMPORTANT: Mount the router
  app.use("/api/user/req-books", router);
  console.log("✅ User Requested Book routes registered ");
};

module.exports = UserReqBooks;