import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Lib_Home.css";
import usePageMeta from "../../../../hooks/usePageMeta";
import Sidebar from "../Sidebar/Lib_Sidebar";
import Overview from "./QuickActions/Overview/Overview";
import Register from "./QuickActions/Register/Register";
import NewBooks from "./QuickActions/NewBooks/NewBooks";
import Request from "./QuickActions/BookRequest/BookRequest";

const LibrarianDashboard: React.FC = () => {
  usePageMeta("Librarian Dashboard - Home", "/LibraX Square Logo 1.png");
  const navigate = useNavigate();

  const [memberName, setMemberName] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    sessionStorage.getItem("sidebarCollapsed") === "true"
  );

  const [activeQuickAction, setActiveQuickAction] = useState<string>("overview");
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

  // Session state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SESSION_DURATION_MINUTES = 600;
  const WARNING_BEFORE_EXPIRY_MINUTES = 5;

  const handleSessionExpired = () => {
    localStorage.removeItem("auth_token");
    sessionStorage.clear();
    setShowSessionWarning(false);
    setShowSessionExpiredModal(true);

    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);
  };

  const resetInactivityTimer = () => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    warningTimeoutRef.current = setTimeout(
      () => setShowSessionWarning(true),
      (SESSION_DURATION_MINUTES - WARNING_BEFORE_EXPIRY_MINUTES) * 60 * 1000
    );

    sessionTimeoutRef.current = setTimeout(
      () => handleSessionExpired(),
      SESSION_DURATION_MINUTES * 60 * 1000
    );
  };

  useEffect(() => {
    const userType = sessionStorage.getItem("user_type");
    if (userType !== "staff") return;

    setMemberName(sessionStorage.getItem("user_name") || "Librarian");
    resetInactivityTimer();

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click", "mousemove"];
    events.forEach((event) => document.addEventListener(event, resetInactivityTimer, true));

    return () => {
      events.forEach((event) => document.removeEventListener(event, resetInactivityTimer, true));
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Live Date & Time Integration
  const [currentDateTime, setCurrentDateTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        year: "numeric",
        month: isMobile ? "short" : "long",
        day: "2-digit",
        weekday: isMobile ? "short" : "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setCurrentDateTime(formatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [isMobile]);

  const showReturnBook = false; // toggle this later when needed

  return (
    <div className="page-layout">
      {/* Session Modals */}
      {showSessionWarning && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Session Expiring Soon</h2>
            <p>Your session will expire in {WARNING_BEFORE_EXPIRY_MINUTES} minutes.</p>
            <button
              onClick={() => {
                setShowSessionWarning(false);
                resetInactivityTimer();
              }}
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}

      {showSessionExpiredModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Session Expired</h2>
            <p>Redirecting to login...</p>
          </div>
        </div>
      )}

      <Sidebar
        onCollapse={(state: boolean) => {
          setSidebarCollapsed(state);
          sessionStorage.setItem("sidebarCollapsed", String(state));
          window.dispatchEvent(new Event("storage"));
        }}
      />

      <main
        className="main-content"
        style={{ marginLeft: isMobile ? "0" : (sidebarCollapsed ? "85px" : "250px") }}
      >
        {/* Combined Header Section */}
        <header className="dashboard-header combined">
          <div className="header-left">
            <h1 className="welcome-title">
              {getGreeting()}, {isMobile ? (memberName?.split(" ")[0] || "User") : (memberName || "User")} 👋
            </h1>
          </div>
          <div className="datetime-display">{currentDateTime}</div>
        </header>

        {/* Summary Cards */}
        {/* <div className="summary-cards">
          {[
            { title: "Total Books", value: 12345, color: "blue" },
            { title: "Borrowed Books", value: 12345, color: "blue" },
            { title: "Overdue Books", value: 12345, color: "red" },
            { title: "Total Members", value: 12345, color: "blue" },
          ].map((card) => (
            <div className="summary-card" key={card.title}>
              <div className="card-title">{card.title}</div>
              <div className={`card-value ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div> */}

        {/* Quick Actions Tab Pane */}
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="tab-header">

            {["overview", "addBook", "registerMember", "bookRequest", ...(showReturnBook ? ["returnBook"] : [])].map((tab) => (
              <button
                key={tab}
                className={activeQuickAction === tab ? "active-tab" : ""}
                onClick={() => setActiveQuickAction(tab)}
              >
                {isMobile ? (
                  tab === "overview" ? "Overview" :
                  tab === "addBook" ? "Add Book" :
                  tab === "registerMember" ? "Register" :
                  tab === "bookRequest" ? "Request" :
                  "Return"
                ) : (
                  tab === "overview" ? "Overview" :
                  tab === "addBook" ? "Add New Book(s)" :
                  tab === "registerMember" ? "Register New Member" :
                  tab === "bookRequest" ? "Book(s) Request" :
                  "Return Book(s)"
                )}
              </button>
            ))}

          </div>
          <div className="tab-content">
            {activeQuickAction === "overview" ? (
              <Overview />
            ) : activeQuickAction === "addBook" ? (
              <NewBooks /> // 👈 Here’s the integration
            ) : activeQuickAction === "registerMember" ? (
              <Register />
            ) :
              activeQuickAction === "bookRequest" ? (
              <Request />
            ) : (
              <p>Content for <strong>{activeQuickAction}</strong> goes here.</p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default LibrarianDashboard;