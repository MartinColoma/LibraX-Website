import React, { useEffect, useState } from "react";
import "./Overview.css";
import usePageMeta from "../../../../../../hooks/usePageMeta";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const Overview: React.FC = () => {
    usePageMeta("Home - Overview", "/LibraX Square Logo 1.png");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchRecentUsers = async () => {
    try {
      const res = await fetch(
        "https://librax-website-frontend.onrender.com/api/librarian/overview/recent-users",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // you can add auth headers here if needed
            // "Authorization": `Bearer ${token}`
          },
        }
      );

      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error("Error fetching recent users:", err);
    } finally {
      setLoading(false);
    }
  };

    fetchRecentUsers();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isMobile) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="overview-container">
        <div className="loading-spinner">Loading recent users...</div>
      </div>
    );
  }

  return (
    <div className="overview-container">
      <h2>Recently Created User Accounts</h2>
      {users.length === 0 ? (
        <p className="no-data">No users found.</p>
      ) : (
        <>
          {/* Desktop Table View */}
          {!isMobile ? (
            <div className="table-wrapper">
              <table className="overview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u.id}>
                      <td>{index + 1}</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            u.status.toLowerCase() === "active" ? "active" : "inactive"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Mobile Card View */
            <div className="mobile-cards">
              {users.map((u, index) => (
                <div key={u.id} className="user-card">
                  <div className="card-header">
                    <span className="card-number">#{index + 1}</span>
                    <span
                      className={`status-badge ${
                        u.status.toLowerCase() === "active" ? "active" : "inactive"
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="card-row">
                      <span className="card-label">Name:</span>
                      <span className="card-value">{u.name}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Email:</span>
                      <span className="card-value card-email">{u.email}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Role:</span>
                      <span className="card-value">{u.role}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Created:</span>
                      <span className="card-value">{formatDate(u.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Overview;