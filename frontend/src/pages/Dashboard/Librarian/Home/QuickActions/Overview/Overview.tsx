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

interface Visit {
  id: number;
  user_id: string;
  name: string;
  user_type: string;
  reader_number: number;
  scan_time: string;
  status: string;
  remarks: string | null;
}

interface Book {
  id: string;
  title: string;
  isbn: string;
  publisher: string;
  publication_year: string | number;
  category: string;
  available_copies: number;
  total_copies: number;
  date_added: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  hasMore: boolean;
}

const API_BASE = "https://librax-website-frontend.onrender.com/api/librarian/overview";

const Overview: React.FC = () => {
  usePageMeta("Home - Overview", "/LibraX Square Logo 1.png");

  const [users, setUsers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  
  const [usersLoading, setUsersLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);
  
  const [usersPagination, setUsersPagination] = useState<Pagination | null>(null);
  const [visitsPagination, setVisitsPagination] = useState<Pagination | null>(null);
  const [booksPagination, setBooksPagination] = useState<Pagination | null>(null);
  
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch recent users
  const fetchUsers = async (page: number = 1) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recent-users?page=${page}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
        setUsersPagination(json.pagination);
      }
    } catch (err) {
      console.error("Error fetching recent users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch recent visits
  const fetchVisits = async (page: number = 1) => {
    setVisitsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recent-visits?page=${page}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        setVisits(json.data);
        setVisitsPagination(json.pagination);
      }
    } catch (err) {
      console.error("Error fetching recent visits:", err);
    } finally {
      setVisitsLoading(false);
    }
  };

  // Fetch recent books
  const fetchBooks = async (page: number = 1) => {
    setBooksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/recent-books?page=${page}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        setBooks(json.data);
        setBooksPagination(json.pagination);
      }
    } catch (err) {
      console.error("Error fetching recent books:", err);
    } finally {
      setBooksLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchVisits();
    fetchBooks();
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Pagination controls component
  const PaginationControls = ({
    pagination,
    onPageChange,
    loading,
  }: {
    pagination: Pagination | null;
    onPageChange: (page: number) => void;
    loading: boolean;
  }) => {
    if (!pagination || pagination.totalPages <= 1) return null;

    return (
      <div className="pagination-controls">
        <button
          onClick={() => onPageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage === 1 || loading}
          className="pagination-btn"
        >
          Previous
        </button>
        <span className="pagination-info">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(pagination.currentPage + 1)}
          disabled={!pagination.hasMore || loading}
          className="pagination-btn"
        >
          Next
        </button>
      </div>
    );
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  );

  return (
    <div className="overview-container">
      {/* RECENT USERS SECTION */}
      <section className="overview-section">
        <h2>Recently Created User Accounts</h2>
        {usersLoading ? (
          <LoadingSpinner />
        ) : users.length === 0 ? (
          <p className="no-data">No users found.</p>
        ) : (
          <>
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
                        <td>{(usersPagination?.currentPage! - 1) * 10 + index + 1}</td>
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
              <div className="mobile-cards">
                {users.map((u, index) => (
                  <div key={u.id} className="user-card">
                    <div className="card-header">
                      <span className="card-number">
                        #{(usersPagination?.currentPage! - 1) * 10 + index + 1}
                      </span>
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
            <PaginationControls
              pagination={usersPagination}
              onPageChange={fetchUsers}
              loading={usersLoading}
            />
          </>
        )}
      </section>

      {/* RECENT VISITS SECTION */}
      <section className="overview-section">
        <h2>Recent Library Visits</h2>
        {visitsLoading ? (
          <LoadingSpinner />
        ) : visits.length === 0 ? (
          <p className="no-data">No visits recorded.</p>
        ) : (
          <>
            {!isMobile ? (
              <div className="table-wrapper">
                <table className="overview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>User Type</th>
                      <th>Reader</th>
                      <th>Scan Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v, index) => (
                      <tr key={v.id}>
                        <td>{(visitsPagination?.currentPage! - 1) * 10 + index + 1}</td>
                        <td>{v.name}</td>
                        <td>{v.user_type}</td>
                        <td>Reader {v.reader_number}</td>
                        <td>{formatTime(v.scan_time)}</td>
                        <td>
                          <span className="status-badge active">{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mobile-cards">
                {visits.map((v, index) => (
                  <div key={v.id} className="user-card">
                    <div className="card-header">
                      <span className="card-number">
                        #{(visitsPagination?.currentPage! - 1) * 10 + index + 1}
                      </span>
                      <span className="status-badge active">{v.status}</span>
                    </div>
                    <div className="card-body">
                      <div className="card-row">
                        <span className="card-label">Name:</span>
                        <span className="card-value">{v.name}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Type:</span>
                        <span className="card-value">{v.user_type}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Reader:</span>
                        <span className="card-value">Reader {v.reader_number}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Time:</span>
                        <span className="card-value">{formatTime(v.scan_time)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationControls
              pagination={visitsPagination}
              onPageChange={fetchVisits}
              loading={visitsLoading}
            />
          </>
        )}
      </section>

      {/* RECENT BOOKS SECTION */}
      <section className="overview-section">
        <h2>Recently Added Books</h2>
        {booksLoading ? (
          <LoadingSpinner />
        ) : books.length === 0 ? (
          <p className="no-data">No books found.</p>
        ) : (
          <>
            {!isMobile ? (
              <div className="table-wrapper">
                <table className="overview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>ISBN</th>
                      <th>Publisher</th>
                      <th>Category</th>
                      <th>Copies</th>
                      <th>Date Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((b, index) => (
                      <tr key={b.id}>
                        <td>{(booksPagination?.currentPage! - 1) * 10 + index + 1}</td>
                        <td>{b.title}</td>
                        <td>{b.isbn}</td>
                        <td>{b.publisher}</td>
                        <td>{b.category}</td>
                        <td>
                          {b.available_copies}/{b.total_copies}
                        </td>
                        <td>{formatDate(b.date_added)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mobile-cards">
                {books.map((b, index) => (
                  <div key={b.id} className="user-card">
                    <div className="card-header">
                      <span className="card-number">
                        #{(booksPagination?.currentPage! - 1) * 10 + index + 1}
                      </span>
                      <span className="status-badge active">
                        {b.available_copies}/{b.total_copies}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="card-row">
                        <span className="card-label">Title:</span>
                        <span className="card-value">{b.title}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">ISBN:</span>
                        <span className="card-value">{b.isbn}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Publisher:</span>
                        <span className="card-value">{b.publisher}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Category:</span>
                        <span className="card-value">{b.category}</span>
                      </div>
                      <div className="card-row">
                        <span className="card-label">Added:</span>
                        <span className="card-value">{formatDate(b.date_added)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationControls
              pagination={booksPagination}
              onPageChange={fetchBooks}
              loading={booksLoading}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default Overview;