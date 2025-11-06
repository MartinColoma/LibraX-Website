const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const router = express.Router();

console.log("🔧 bookrequests.js module loaded!");

// ✅ Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Fetch all book requests with detailed information
router.get("/book-requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("book_requests")
      .select(`
        request_id,
        request_date,
        due_date,
        status,
        remarks,
        users!book_requests_user_id_fkey (
          user_id,
          first_name,
          last_name,
          email,
          address,
          student_faculty_id
        ),
        books!book_requests_book_id_fkey (
          book_id,
          title,
          publisher,
          publication_year,
          categories!books_category_id_fkey (
            category_name
          ),
          book_authors!book_authors_book_id_fkey (
            authors!book_authors_author_id_fkey (
              name
            )
          )
        ),
        book_copies!book_requests_copy_id_fkey (
          copy_id,
          status,
          book_condition
        )
      `)
      .eq("status", "Pending Approval") // ✅ Only fetch pending requests
      .order("request_date", { ascending: false });

    if (error) {
      console.error("Error fetching book requests:", error);
      return res.status(500).json({ error: error.message });
    }

    const formattedRequests = data.map((request) => {
      const authorName = request.books?.book_authors?.[0]?.authors?.name || "Unknown Author";

      return {
        request_id: request.request_id,
        book_title: request.books?.title || "Unknown Title",
        borrower_name: `${request.users?.first_name || ""} ${request.users?.last_name || ""}`.trim(),
        borrower_id: request.users?.student_faculty_id || request.users?.user_id || "",
        borrower_email: request.users?.email || "",
        borrower_address: request.users?.address || "",
        request_date: request.request_date,
        due_date: request.due_date,
        status: request.status,
        remarks: request.remarks,
        author_name: authorName,
        publisher: request.books?.publisher || "",
        publication_year: request.books?.publication_year || null,
        genre: request.books?.categories?.category_name || "Fiction",
        copy_id: request.book_copies?.copy_id || null,
        copy_status: request.book_copies?.status || null,
        copy_condition: request.book_copies?.book_condition || null,
      };
    });

    res.json(formattedRequests);
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

console.log("✅ Registered: GET /book-requests");

// POST - Approve book request (MUST BE BEFORE /:requestId ROUTES!)
router.post('/book-requests/:requestId/approve', async (req, res) => {
  console.log('🎯🎯🎯 APPROVE ROUTE HIT! 🎯🎯🎯');
  console.log('Request ID:', req.params.requestId);
  console.log('Body:', req.body);
  
  try {
    const { requestId } = req.params;
    const { due_date, nfc_uid } = req.body;

    console.log('📥 Approve request received:', { requestId, due_date, nfc_uid });

    if (!due_date || !nfc_uid) {
      return res.status(400).json({ 
        error: 'Due date and NFC UID are required' 
      });
    }

    // 1. Get the book request details
    const { data: request, error: requestError } = await supabase
      .from('book_requests')
      .select(`
        *,
        users!book_requests_user_id_fkey (user_id),
        books!book_requests_book_id_fkey (book_id)
      `)
      .eq('request_id', requestId)
      .single();

    if (requestError) throw requestError;
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'Pending Approval') {
      return res.status(400).json({ 
        error: 'Only pending requests can be approved' 
      });
    }

    // 2. Find the book copy by NFC UID
    const { data: bookCopy, error: copyError } = await supabase
      .from('book_copies')
      .select('*')
      .eq('nfc_uid', nfc_uid)
      .eq('book_id', request.book_id)
      .eq('status', 'Available')
      .single();

    if (copyError || !bookCopy) {
      return res.status(404).json({ 
        error: 'Book copy not found or not available' 
      });
    }

    // 3. Generate borrow_id
    const borrow_id = `BRW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // 4. Create borrowed_books record
    const { data: borrowedBook, error: borrowError } = await supabase
      .from('borrowed_books')
      .insert([
        {
          borrow_id,
          user_id: request.user_id,
          copy_id: bookCopy.copy_id,
          book_id: request.book_id,
          borrow_date: new Date().toISOString(),
          due_date,
          status: 'Borrowed',
          fine_amount: 0
        }
      ])
      .select()
      .single();

    if (borrowError) throw borrowError;

    // 5. Update book_requests status
    const { error: updateRequestError } = await supabase
      .from('book_requests')
      .update({ 
        status: 'Approved',
        due_date,
        copy_id: bookCopy.copy_id
      })
      .eq('request_id', requestId);

    if (updateRequestError) throw updateRequestError;

    // 6. Update book_copies status to 'Borrowed'
    const { error: updateCopyError } = await supabase
      .from('book_copies')
      .update({ status: 'Borrowed' })
      .eq('copy_id', bookCopy.copy_id);

    if (updateCopyError) throw updateCopyError;

    // 7. Update available_copies count in books table
    const { error: updateBooksError } = await supabase
      .rpc('decrement_available_copies', { book_id_param: request.book_id });

    if (updateBooksError) {
      const { data: book } = await supabase
        .from('books')
        .select('available_copies')
        .eq('book_id', request.book_id)
        .single();

      if (book) {
        await supabase
          .from('books')
          .update({ available_copies: Math.max(0, book.available_copies - 1) })
          .eq('book_id', request.book_id);
      }
    }

    // 8. Create inventory log
    const log_id = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await supabase
      .from('inventory_logs')
      .insert([
        {
          log_id,
          copy_id: bookCopy.copy_id,
          action: 'Book Issued',
          performed_by: 'Librarian',
          log_date: new Date().toISOString()
        }
      ]);

    console.log('✅ Request approved successfully:', borrow_id);

    res.json({
      success: true,
      message: 'Request approved successfully',
      borrow_id,
      borrowedBook
    });

  } catch (error) {
    console.error('❌ Error approving request:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log("✅ Registered: POST /book-requests/:requestId/approve");

// GET: Fetch a single book request by ID
router.get("/book-requests/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;

    const { data, error } = await supabase
      .from("book_requests")
      .select(`
        request_id,
        request_date,
        due_date,
        status,
        remarks,
        users!book_requests_user_id_fkey (
          user_id,
          first_name,
          last_name,
          email,
          address,
          student_faculty_id
        ),
        books!book_requests_book_id_fkey (
          book_id,
          title,
          publisher,
          publication_year,
          categories!books_category_id_fkey (
            category_name
          ),
          book_authors!book_authors_book_id_fkey (
            authors!book_authors_author_id_fkey (
              name
            )
          )
        ),
        book_copies!book_requests_copy_id_fkey (
          copy_id,
          status,
          book_condition
        )
      `)
      .eq("request_id", requestId)
      .single();

    if (error) {
      console.error("Error fetching book request:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Book request not found" });
    }

    const authorName = data.books?.book_authors?.[0]?.authors?.name || "Unknown Author";

    const formattedRequest = {
      request_id: data.request_id,
      book_title: data.books?.title || "Unknown Title",
      borrower_name: `${data.users?.first_name || ""} ${data.users?.last_name || ""}`.trim(),
      borrower_id: data.users?.student_faculty_id || data.users?.user_id || "",
      borrower_email: data.users?.email || "",
      borrower_address: data.users?.address || "",
      request_date: data.request_date,
      due_date: data.due_date,
      status: data.status,
      remarks: data.remarks,
      author_name: authorName,
      publisher: data.books?.publisher || "",
      publication_year: data.books?.publication_year || null,
      genre: data.books?.categories?.category_name || "Fiction",
      copy_id: data.book_copies?.copy_id || null,
      copy_status: data.book_copies?.status || null,
      copy_condition: data.book_copies?.book_condition || null,
    };

    res.json(formattedRequest);
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

console.log("✅ Registered: GET /book-requests/:requestId");

// PUT: Update book request
router.put("/book-requests/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, due_date, remarks } = req.body;

    const updateData = {};
    
    if (status) {
      if (!["Approved", "Rejected", "Completed", "Pending Approval"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      updateData.status = status;
    }
    
    if (due_date) updateData.due_date = due_date;
    if (remarks !== undefined) updateData.remarks = remarks || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("book_requests")
      .update(updateData)
      .eq("request_id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error updating book request:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Book request updated successfully", data });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

console.log("✅ Registered: PUT /book-requests/:requestId");

// Other routes...
router.post('/scan-request', async (req, res) => {
  try {
    const { session_id, scan_type } = req.body;

    const { data, error } = await supabase
      .from('scan_requests')
      .insert([{ session_id, scan_type: scan_type || 'book_issue', status: 'pending' }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating scan request:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/scan-result/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data, error } = await supabase
      .from('scan_requests')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Scan request not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching scan result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export function to mount routes
const librarianBookRequestRoutes = (app) => {
  console.log("🔧 Mounting book request routes to /api/librarian/quick-actions");
  app.use("/api/librarian/quick-actions", router);
  console.log("✅ Book request router mounted successfully!");
};

module.exports = librarianBookRequestRoutes;