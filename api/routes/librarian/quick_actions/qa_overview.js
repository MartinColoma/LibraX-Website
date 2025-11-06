const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// ✅ Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const librarianOverviewRoutes = (app) => {
  // 🧠 GET recent users with pagination
  router.get("/recent-users", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      // Get paginated data
      const { data, error } = await supabase
        .from("users")
        .select(`user_id, first_name, last_name, email, user_type, status, created_at`)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const users = data.map((u) => ({
        id: u.user_id,
        name: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        role: u.user_type,
        status: u.status,
        created_at: u.created_at,
      }));

      res.json({
        success: true,
        data: users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
          hasMore: offset + limit < count,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching recent users:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  });

// 🧠 GET today's library visits with pagination
router.get("/recent-visits", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // 🔹 Compute start & end of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Convert to ISO for Supabase filtering
    const startISO = startOfToday.toISOString();
    const endISO = endOfToday.toISOString();

    // Get total count of today's visits
    const { count, error: countError } = await supabase
      .from("attendance_view")
      .select("*", { count: "exact", head: true })
      .gte("scan_time", startISO)
      .lt("scan_time", endISO);

    if (countError) throw countError;

    // Get today's visits with pagination
    const { data, error } = await supabase
      .from("attendance_view")
      .select("*")
      .gte("scan_time", startISO)
      .lt("scan_time", endISO)
      .order("scan_time", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const visits = data.map((v) => ({
      id: v.attendance_id,
      user_id: v.user_id,
      name: `${v.first_name || "Unknown"} ${v.last_name || "User"}`.trim(),
      user_type: v.user_type || "N/A",
      reader_number: v.reader_number,
      scan_time: v.scan_time,
      status: v.status,
      remarks: v.remarks,
    }));

    res.json({
      success: true,
      data: visits,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalRecords: count,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching today's visits:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


  // 🧠 GET recently added books with pagination
  router.get("/recent-books", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await supabase
        .from("books")
        .select("*", { count: "exact", head: true });

      // Get paginated data with category details
      const { data, error } = await supabase
        .from("books")
        .select(`
          book_id,
          title,
          isbn,
          publisher,
          publication_year,
          available_copies,
          total_copies,
          date_added,
          categories (
            category_name
          )
        `)
        .order("date_added", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const books = data.map((b) => ({
        id: b.book_id,
        title: b.title,
        isbn: b.isbn || "N/A",
        publisher: b.publisher || "N/A",
        publication_year: b.publication_year || "N/A",
        category: b.categories?.category_name || "Uncategorized",
        available_copies: b.available_copies,
        total_copies: b.total_copies,
        date_added: b.date_added,
      }));

      res.json({
        success: true,
        data: books,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
          hasMore: offset + limit < count,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching recent books:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  });

  // ✅ Mount router at base path
  app.use("/api/librarian/overview", router);
};

module.exports = librarianOverviewRoutes;