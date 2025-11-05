// =========================================
// 📚 User — Search, Book Request & Auth Routes (Merged)
// =========================================

const express = require("express");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");

module.exports = (app) => {
  const router = express.Router();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // =========================================
  // 🔍 GET /api/user/search - OPAC Search
  // =========================================
  router.get("/search", async (req, res) => {
    try {
      const { type = "keyword", query = "" } = req.query;

      console.log(`[OPAC Search] type=${type}, query=${query}`);

      if (!query.trim()) {
        return res.status(200).json([]);
      }

      let bookIds = new Set();

      // STEP 1: Find matching book IDs (no joins to avoid duplicates)
      if (type === "keyword") {
        // Search title
        const titleResult = await supabase.from("books").select("book_id, title");
        const allBooks = titleResult.data || [];

        if (allBooks) {
          allBooks.forEach((book) => {
            if (book.title.toLowerCase().includes(query.toLowerCase())) {
              bookIds.add(book.book_id);
            }
          });
        }

        // Search category
        const categoryResult = await supabase
          .from("books")
          .select("book_id, categories(category_name)");

        const allBooksWithCategory = categoryResult.data || [];

        if (allBooksWithCategory) {
          allBooksWithCategory.forEach((book) => {
            if (
              book.categories &&
              book.categories.category_name &&
              book.categories.category_name.toLowerCase().includes(query.toLowerCase())
            ) {
              bookIds.add(book.book_id);
            }
          });
        }

        // Search authors
        const authorResult = await supabase
          .from("book_authors")
          .select("book_id, authors(name)");

        const allAuthors = authorResult.data || [];

        if (allAuthors) {
          allAuthors.forEach((item) => {
            if (
              item.authors &&
              item.authors.name &&
              item.authors.name.toLowerCase().includes(query.toLowerCase())
            ) {
              bookIds.add(item.book_id);
            }
          });
        }
      } else if (type === "title") {
        const titleResult = await supabase.from("books").select("book_id, title");
        const allBooks = titleResult.data || [];

        if (allBooks) {
          allBooks.forEach((book) => {
            if (book.title.toLowerCase().includes(query.toLowerCase())) {
              bookIds.add(book.book_id);
            }
          });
        }
      } else if (type === "author") {
        const authorResult = await supabase
          .from("book_authors")
          .select("book_id, authors(name)");

        const allAuthors = authorResult.data || [];

        if (allAuthors) {
          allAuthors.forEach((item) => {
            if (
              item.authors &&
              item.authors.name &&
              item.authors.name.toLowerCase().includes(query.toLowerCase())
            ) {
              bookIds.add(item.book_id);
            }
          });
        }
      } else if (type === "subject") {
        const categoryResult = await supabase
          .from("books")
          .select("book_id, categories(category_name)");

        const allBooksWithCategory = categoryResult.data || [];

        if (allBooksWithCategory) {
          allBooksWithCategory.forEach((book) => {
            if (
              book.categories &&
              book.categories.category_name &&
              book.categories.category_name.toLowerCase().includes(query.toLowerCase())
            ) {
              bookIds.add(book.book_id);
            }
          });
        }
      }

      if (bookIds.size === 0) {
        console.log("[OPAC Search] No matching books found");
        return res.status(200).json([]);
      }

      // STEP 2: Fetch full book data with authors
      const booksResult = await supabase
        .from("books")
        .select(
          `
          book_id,
          isbn,
          title,
          subtitle,
          description,
          publisher,
          publication_year,
          edition,
          language,
          date_added,
          available_copies,
          total_copies,
          categories:category_id(category_name),
          book_authors(authors(name))
        `
        )
        .in("book_id", Array.from(bookIds));

      const booksData = booksResult.data || [];

      // STEP 3: Format data
      const formattedData = booksData.map((book) => {
        const authorNames = book.book_authors
          ? book.book_authors
              .map((ba) => (ba.authors ? ba.authors.name : null))
              .filter(Boolean)
              .join(", ")
          : "N/A";

        return {
          book_id: book.book_id,
          isbn: book.isbn,
          title: book.title,
          subtitle: book.subtitle,
          description: book.description,
          publisher: book.publisher || "N/A",
          publication_year: book.publication_year || "N/A",
          edition: book.edition || "N/A",
          author: authorNames || "N/A",
          genre: book.categories ? book.categories.category_name : "N/A",
          language: book.language || "English",
          date_added: book.date_added,
          available: book.available_copies || 0,
          total: book.total_copies || 0,
        };
      });

      console.log(`[OPAC Search] Found ${formattedData.length} results`);
      return res.status(200).json(formattedData);
    } catch (err) {
      console.error("OPAC search exception:", err);
      return res.status(500).json({
        success: false,
        message: "Search failed",
        error: err.message,
      });
    }
  });

  // =========================================
  // 🔐 POST /api/user/verify-password
  // =========================================
  router.post("/verify-password", async (req, res) => {
    try {
      const { user_id, password } = req.body;
      if (!user_id || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing user_id or password" 
        });
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("password_hash")
        .eq("user_id", user_id)
        .single();

      if (error || !user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        return res.json({ 
          success: true, 
          message: "Password verified" 
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: "Incorrect password" 
        });
      }
    } catch (err) {
      console.error("Password verify error:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Server error" 
      });
    }
  });

  // =========================================
  // 📖 POST /api/user/books/request
  // =========================================
  router.post("/books/request", async (req, res) => {
    const { user_id, book_id } = req.body;

    if (!user_id || !book_id) {
      return res.status(400).json({
        success: false,
        message: "Missing user_id or book_id",
      });
    }

    try {
      // 🔹 Get book details
      const { data: book, error: bookError } = await supabase
        .from("books")
        .select("book_id, available_copies")
        .eq("book_id", book_id)
        .single();

      if (bookError || !book) {
        return res.status(404).json({
          success: false,
          message: "Book not found",
        });
      }

      if (book.available_copies <= 0) {
        return res.status(400).json({
          success: false,
          message: "No available copies",
        });
      }

      // 🔹 Create request with status 'Pending Approval'
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { error: insertError } = await supabase
        .from("book_requests")
        .insert([
          {
            request_id: "req_" + Date.now(),
            user_id: user_id,
            book_id: book_id,
            request_date: new Date().toISOString(),
            due_date: dueDate.toISOString().slice(0, 10),
            status: "Pending Approval",
          },
        ]);

      if (insertError) {
        console.error("Insert error:", insertError);
        return res.status(500).json({
          success: false,
          message: "Failed to create request",
        });
      }

      // 🔹 Deduct available copies
      const { error: updateError } = await supabase
        .from("books")
        .update({ available_copies: book.available_copies - 1 })
        .eq("book_id", book_id);

      if (updateError) {
        console.error("Update error:", updateError);
        return res.status(500).json({
          success: false,
          message: "Failed to update book copies",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Book request created and pending approval",
      });
    } catch (err) {
      console.error("Book request error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to process book request",
        error: err.message,
      });
    }
  });

  // Mount router to main app
  app.use("/api/user", router);
};