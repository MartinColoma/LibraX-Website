// =========================================
// 🧠 LibraX API — Main Server Entry
// =========================================

require("dotenv").config(); // ✅ Load environment variables first

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// =========================================
// 🔹 Middleware
// =========================================
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://librax-website.onrender.com",
    ],
    credentials: true,
  })
);

// =========================================
// 🔹 Validate Environment Variables
// =========================================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables. Check your .env file.");
  process.exit(1);
}

// =========================================
// 🔹 Import Route Modules
// =========================================
const authRoutes = require("./routes/auth");
const registrationRoutes = require("./routes/registration");
const verifyTokenRoutes = require("./routes/verify-token");
const librarianOverviewRoutes = require("./routes/librarian/quick_actions/overview");
const newBooksRoute = require("./routes/librarian/quick_actions/newbooks");
const BookReqRoute = require("./routes/librarian/quick_actions/bookrequests");

// =========================================
// 🔹 Serve Static Files (Frontend Build)
// =========================================
app.use(express.static(path.join(__dirname, "..", "dist")));

// =========================================
// 🔹 Health Check Endpoint
// =========================================
app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "✅ API is running" });
});

// =========================================
// 🔹 Mount Routes
// =========================================
console.log("\n🔧 Mounting routes...");
authRoutes(app);
console.log("✅ Auth routes mounted");
registrationRoutes(app);
console.log("✅ Registration routes mounted");
verifyTokenRoutes(app);
console.log("✅ Verify token routes mounted");
librarianOverviewRoutes(app);
console.log("✅ Librarian overview routes mounted");
newBooksRoute(app);
console.log("✅ New books routes mounted");
BookReqRoute(app);
console.log("✅ Book request routes mounted");

// =========================================
// 🔹 ROUTE DEBUGGER - Print All Registered Routes
// =========================================
const printRoutes = () => {
  console.log("\n📋 ===== REGISTERED ROUTES =====");
  
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
      routes.push(`${methods.padEnd(7)} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      // Routes registered on a router
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
          const path = middleware.regexp.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace('^', '')
            .replace('$', '');
          routes.push(`${methods.padEnd(7)} ${path}${handler.route.path}`);
        }
      });
    }
  });
  
  routes.sort().forEach(route => console.log(`  ${route}`));
  console.log("================================\n");
};

// Call the debug function
printRoutes();

// =========================================
// 🔹 Request Logger Middleware (for debugging)
// =========================================
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// =========================================
// 🔹 SPA Catch-All (EXCLUDES API ROUTES)
// =========================================
// Ensures React routes still work, but /api calls go to Express
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

// =========================================
// 🔹 404 Handler (For Unmatched API Routes)
// =========================================
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "❌ Route not found" });
});

// =========================================
// 🔹 Start Server
// =========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 LibraX API running on http://localhost:${PORT}`);
  console.log(`📍 Server started at: ${new Date().toLocaleString()}`);
});