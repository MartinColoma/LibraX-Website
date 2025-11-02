import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

// Pages
import PageNotFound from "./pages/PageNotFound";
import LandingPage from "./pages/LandingPage/Home/Home";
import LoginModal from "./pages/LandingPage/Login/LoginModal";
import RegisterModal from "./pages/LandingPage/Registration/UserRegistration";

// Librarian Pages
import LibHome from "./pages/Dashboard/Librarian/Home/Lib_Home";

// User Pages
import UserHome from "./pages/Dashboard/User/Home/User_Home";
import UserSearch from "./pages/Dashboard/User/SearchBooks/SearchBooks";

// Protected Route
import ProtectedRoute from "./components/ProtectedRoute";

/* 
  ✅ Full-page Login Page Wrapper 
  Handles both direct route (/login) and modal invocation
*/
const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#fff8f0",
      }}
    >
      {/* ✅ In HashRouter, navigate(-1) may not behave predictably, 
          so explicitly route to root or dashboard */}
      <LoginModal
        onClose={() => {
          const lastPath = sessionStorage.getItem("last_path");
          if (lastPath && lastPath !== "/login") {
            navigate(lastPath, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }}
      />
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const location = useLocation();

  // Handle modal background state (for modal routing)
  const state = location.state as { backgroundLocation?: Location };
  const background = state?.backgroundLocation;

  return (
    <>
      {/* Base routes */}
      <Routes location={background || location}>
        <Route path="*" element={<PageNotFound />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ Protected Librarian Routes */}
        <Route
          path="/librarian/dashboard/home"
          element={
            <ProtectedRoute
              allowedUserTypes={["staff"]}
              allowedRoles={["Librarian"]}
            >
              <LibHome />
            </ProtectedRoute>
          }
        />

        {/* ✅ Protected User Routes */}
        <Route
          path="/user/dashboard/home"
          element={
            <ProtectedRoute allowedUserTypes={["member"]}>
              <UserHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/dashboard/search-books"
          element={
            <ProtectedRoute allowedUserTypes={["member"]}>
              <UserSearch />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* ✅ Modal routes (rendered as portals) */}
      {background && (
        <Routes>
          <Route
            path="/login"
            element={createPortal(
              <LoginModal
                onClose={() => {
                  const navigate = window.location.hash.includes("user")
                    ? "#/user/dashboard/home"
                    : "#/";
                  window.location.hash = navigate;
                }}
              />,
              document.body
            )}
          />

          <Route
            path="/register"
            element={createPortal(
              <RegisterModal
                onClose={() => {
                  window.location.hash = "#/";
                }}
              />,
              document.body
            )}
          />
        </Routes>
      )}
    </>
  );
};

export default AppRoutes;
