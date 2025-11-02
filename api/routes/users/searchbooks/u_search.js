// =========================================
// 🔍 User — OPAC Search Route (Refactored for function export)
// =========================================

const express = require("express");
const { createClient } = require("@supabase/supabase-js");

module.exports = (app) => {
  const router = express.Router();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET /api/user/search?type=keyword&query=harry
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

  // Mount to main app
  app.use("/api/user", router);
};
