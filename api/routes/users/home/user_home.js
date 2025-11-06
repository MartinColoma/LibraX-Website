const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UserHomeRoute = (app) => {
  
  // Get recent library visits (attendance records)
  router.get("/recent-visits/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 100 } = req.query; // Default to 100 instead of 5

      console.log(`📊 Fetching recent visits for user: ${userId}`); // DEBUG LOG

      const { data, error } = await supabase
        .from("attendance")
        .select(`
          attendance_id,
          scan_time,
          status,
          remarks,
          reader_number
        `)
        .eq("user_id", userId)
        .order("scan_time", { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });

    } catch (error) {
      console.error("Error fetching recent visits:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recent visits",
        error: error.message
      });
    }
  });

  // Get recent borrowed books
  router.get("/recent-borrows/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { limit = 100 } = req.query; // Default to 100 instead of 5

      console.log(`📚 Fetching recent borrows for user: ${userId}`); // DEBUG LOG

      const { data, error } = await supabase
        .from("borrowed_books")
        .select(`
          borrow_id,
          borrow_date,
          due_date,
          return_date,
          status,
          fine_amount,
          books:book_id (
            book_id,
            title,
            subtitle,
            isbn
          ),
          book_copies:copy_id (
            copy_id,
            book_condition
          )
        `)
        .eq("user_id", userId)
        .order("borrow_date", { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });

    } catch (error) {
      console.error("Error fetching recent borrows:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recent borrowed books",
        error: error.message
      });
    }
  });

  // Get dashboard summary statistics
  router.get("/dashboard-stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      console.log(`📈 Fetching dashboard stats for user: ${userId}`); // DEBUG LOG

      // Get total visits count
      const { count: visitsCount } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get currently borrowed books count
      const { count: currentBorrowsCount } = await supabase
        .from("borrowed_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "Borrowed");

      // Get total borrowed books count (all time)
      const { count: totalBorrowsCount } = await supabase
        .from("borrowed_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get pending requests count
      const { count: pendingRequestsCount } = await supabase
        .from("book_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "Pending");

      // Get total fines
      const { data: finesData } = await supabase
        .from("borrowed_books")
        .select("fine_amount")
        .eq("user_id", userId)
        .gt("fine_amount", 0);

      const totalFines = finesData?.reduce((sum, record) => 
        sum + parseFloat(record.fine_amount || 0), 0) || 0;

      res.status(200).json({
        success: true,
        data: {
          totalVisits: visitsCount || 0,
          currentlyBorrowed: currentBorrowsCount || 0,
          totalBorrowed: totalBorrowsCount || 0,
          pendingRequests: pendingRequestsCount || 0,
          totalFines: totalFines.toFixed(2)
        }
      });

    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch dashboard statistics",
        error: error.message
      });
    }
  });

  // ⚠️ IMPORTANT: Mount the router
  app.use("/api/user/home", router);
  console.log("✅ User home routes registered at /api/user/home");
};

module.exports = UserHomeRoute;