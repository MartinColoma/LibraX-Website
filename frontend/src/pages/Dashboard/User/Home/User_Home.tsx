import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./User_Home.css";
import usePageMeta from "../../../../hooks/usePageMeta";
import Sidebar from "../Sidebar/Sidebar";

interface Visit {
  attendance_id: number;
  scan_time: string;
  status: string;
  remarks: string | null;
  reader_number: number;
}

interface BorrowedBook {
  borrow_id: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number;
  books: {
    book_id: string;
    title: string;
    subtitle: string | null;
    isbn: string | null;
  };
  book_copies: {
    copy_id: string;
    book_condition: string;
  };
}

// API Base URL
const API_BASE_URL = "https://librax-website-frontend.onrender.com";

const MemberDashboard: React.FC = () => {
  usePageMeta("User Dashboard - Home", "/LibraX Square Logo 1.png");
  const navigate = useNavigate();

  const [memberName, setMemberName] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    sessionStorage.getItem("sidebarCollapsed") === "true"
  );
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

  // Dashboard data states
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [recentBorrows, setRecentBorrows] = useState<BorrowedBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 🕒 Live Date & Time
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

  // 🧠 Session state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SESSION_DURATION_MINUTES = 45;
  const WARNING_BEFORE_EXPIRY_MINUTES = 5;

  const handleSessionExpired = () => {
    console.log("🔒 Session expired, logging out...");
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

    warningTimeoutRef.current = setTimeout(() => {
      console.log("⚠️ Session will expire soon");
      setShowSessionWarning(true);
    }, (SESSION_DURATION_MINUTES - WARNING_BEFORE_EXPIRY_MINUTES) * 60 * 1000);

    sessionTimeoutRef.current = setTimeout(() => {
      handleSessionExpired();
    }, SESSION_DURATION_MINUTES * 60 * 1000);
  };

  // 📊 Fetch dashboard data
  const fetchDashboardData = async (uid: string) => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem("auth_token");

      // Fetch recent visits
      const visitsResponse = await fetch(`${API_BASE_URL}/api/user/home/recent-visits/${uid}?limit=5`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const visitsData = await visitsResponse.json();
      if (visitsData.success) setRecentVisits(visitsData.data);

      // Fetch recent borrows
      const borrowsResponse = await fetch(`${API_BASE_URL}/api/user/home/recent-borrows/${uid}?limit=5`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const borrowsData = await borrowsResponse.json();
      if (borrowsData.success) setRecentBorrows(borrowsData.data);



    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userType = sessionStorage.getItem("user_type");
    if (userType !== "member") return;

    const userName = sessionStorage.getItem("user_name") || "Member";
    const uid = sessionStorage.getItem("user_id") || "";
    
    setMemberName(userName);
    
    if (uid) {
      fetchDashboardData(uid);
    }

    resetInactivityTimer();

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click", "mousemove"];
    events.forEach((event) => document.addEventListener(event, resetInactivityTimer, true));

    return () => {
      events.forEach((event) => document.removeEventListener(event, resetInactivityTimer, true));
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  // 🔄 Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✨ Greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // 📅 Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  // 🕐 Format time helper
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  // 🏷️ Get status badge class
  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "borrowed": return "status-borrowed";
      case "returned": return "status-returned";
      case "overdue": return "status-overdue";
      case "present": return "status-present";
      default: return "status-default";
    }
  };

  return (
    <div className="page-layout">
      {/* ⚠️ Session Warning Modal */}
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

      {/* 🔒 Session Expired Modal */}
      {showSessionExpiredModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Session Expired</h2>
            <p>Your session has expired. Redirecting to login...</p>
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
        style={{
          marginLeft: isMobile ? "0" : sidebarCollapsed ? "85px" : "250px",
          transition: "margin 0.3s ease",
        }}
      >
        {/* 🧭 Combined Header Section */}
        <header className="dashboard-header combined">
          <div className="header-left">
            <h1 className="welcome-title">
              {getGreeting()},{" "}
              {isMobile
                ? memberName?.split(" ")[0] || "User"
                : memberName || "User"}{" "}
              👋
            </h1>
          </div>
          <div className="datetime-display">{currentDateTime}</div>
        </header>

        {/* 💡 Main Dashboard Body */}
        <div className="dashboard-container">
          

          {/* 📋 Recent Activity Section */}
          <div className="activity-section">
            
            {/* Recent Library Visits */}
            <div className="activity-card">
              <div className="activity-header">
                <h2>Recent Library Visits</h2>
                <span className="activity-count">{recentVisits.length} visits</span>
              </div>
              
              {loading ? (
                <div className="loading-state">Loading visits...</div>
              ) : recentVisits.length > 0 ? (
                <div className="table-container">
                  <table className="activity-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Reader</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentVisits.map((visit) => (
                        <tr key={visit.attendance_id}>
                          <td>{formatDate(visit.scan_time)}</td>
                          <td>{formatTime(visit.scan_time)}</td>
                          <td>
                            <span className={`status-badge ${getStatusClass(visit.status)}`}>
                              {visit.status}
                            </span>
                          </td>
                          <td>Reader {visit.reader_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No recent library visits found.</p>
                </div>
              )}
            </div>

            {/* Recent Borrowed Books */}
            <div className="activity-card">
              <div className="activity-header">
                <h2>Recent Borrowed Books</h2>
                <span className="activity-count">{recentBorrows.length} records</span>
              </div>
              
              {loading ? (
                <div className="loading-state">Loading borrowed books...</div>
              ) : recentBorrows.length > 0 ? (
                <div className="table-container">
                  <table className="activity-table">
                    <thead>
                      <tr>
                        <th>Book Title</th>
                        <th>Borrow Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        {!isMobile && <th>Fine</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {recentBorrows.map((borrow) => (
                        <tr key={borrow.borrow_id}>
                          <td className="book-title-cell">
                            <div className="book-title">{borrow.books.title}</div>
                            {borrow.books.subtitle && (
                              <div className="book-subtitle">{borrow.books.subtitle}</div>
                            )}
                          </td>
                          <td>{formatDate(borrow.borrow_date)}</td>
                          <td>{formatDate(borrow.due_date)}</td>
                          <td>
                            <span className={`status-badge ${getStatusClass(borrow.status)}`}>
                              {borrow.status}
                            </span>
                          </td>
                          {!isMobile && (
                            <td className={borrow.fine_amount > 0 ? "fine-amount" : ""}>
                              {borrow.fine_amount > 0 ? `₱${borrow.fine_amount}` : "-"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No borrowed books found.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

export default MemberDashboard;