import { useState } from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBooks.module.css';
import axios from 'axios';
import usePageMeta from "../../../../hooks/usePageMeta";
import Sidebar from "../Sidebar/Sidebar";

interface Book {
  book_id: string;
  title: string;
  author?: string;
  publisher?: string;
  publication_year?: number;
  genre?: string;
  available?: number;
  total?: number;
  isbn?: string;
}

const searchTypes = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'subject', label: 'Subject' },
];

// Match backend mount path
const API_BASE_URL = "https://librax-website-frontend.onrender.com/api/user";

export default function OPAC() {
  usePageMeta("User Dashboard - Search Books", "/LibraX Square Logo 1.png");

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    sessionStorage.getItem("sidebarCollapsed") === "true"
  );

  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('keyword');
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Request confirmation states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchType(e.target.value);
    setResults([]);
    setQuery('');
    setSearched(false);
  };

  const performSearch = async (searchQuery: string) => {
    if (searchQuery.trim() === '') {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/search?type=${searchType}&query=${encodeURIComponent(searchQuery)}`
      );

      console.log('API Response:', data);

      if (Array.isArray(data)) {
        setResults(data);
      } else if (data?.results && Array.isArray(data.results)) {
        setResults(data.results);
      } else if (data?.data && Array.isArray(data.data)) {
        setResults(data.data);
      } else {
        setResults([]);
      }

      setSearched(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      performSearch(value);
    }, 300);

    setDebounceTimer(timer);
  };

  // Open request modal
  const openRequestModal = (book: Book) => {
    setSelectedBook(book);
    setShowRequestModal(true);
    setPasswordInput('');
    setPasswordError('');
    setShowPassword(false);
    setRequestSuccess(false);
  };

  // Close request modal
  const closeRequestModal = () => {
    setShowRequestModal(false);
    setSelectedBook(null);
    setPasswordInput('');
    setPasswordError('');
    setShowPassword(false);
    setRequestSuccess(false);
    setIsSubmitting(false);
  };

  // Submit book request with password verification
const handleRequestSubmit = async () => {
  if (!passwordInput || !selectedBook) return;

  const userId = sessionStorage.getItem('user_id');
  if (!userId) {
    setPasswordError('User not logged in. Please login again.');
    return;
  }

  setIsSubmitting(true);
  setPasswordError('');

  try {
    // ✅ Correct verify-password endpoint
    const verifyResp = await axios.post(`${API_BASE_URL}/verify-password`, {
      user_id: userId,
      password: passwordInput,
    });

    if (verifyResp.data.success) {
      // Password verified, now submit book request
      const requestResp = await axios.post(`${API_BASE_URL}/books/request`, {
        user_id: userId,
        book_id: selectedBook.book_id,
      });

      if (requestResp.data.success) {
        setRequestSuccess(true);
        setTimeout(() => {
          closeRequestModal();
          if (query) performSearch(query); // Refresh search results
        }, 2000);
      } else {
        setPasswordError(requestResp.data.message || 'Failed to submit request');
      }
    }
  } catch (error: any) {
    console.error('Request error:', error);
    if (error.response && error.response.status === 401) {
      setPasswordError('Incorrect password. Please try again.');
    } else {
      setPasswordError('Failed to submit request. Please try again.');
    }
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="page-layout">
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
          marginLeft: sidebarCollapsed ? "85px" : "250px",
          transition: "margin 0.3s ease",
        }}
      >
        <div className={styles.opacContainer}>
          <div className={styles.opacMain}>
            <h2 className={styles.pageTitle}>Search Books</h2>

            <div className={styles.searchBar}>
              <select
                className={styles.searchDropdown}
                value={searchType}
                onChange={handleTypeChange}
              >
                {searchTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search Library Catalog"
                value={query}
                onChange={handleSearch}
              />

              <button
                className={styles.searchBtn}
                tabIndex={-1}
                type="button"
                aria-label="Search"
                disabled
              >
                <Search size={26} />
              </button>
            </div>

            {loading ? (
              <p className={styles.searchHint}>Loading...</p>
            ) : !searched && query === '' ? (
              <p className={styles.searchHint}>
                Enter a search query to show results
              </p>
            ) : (
              <div className={styles.resultsContainer}>
                <p className={styles.resultCount}>Results: {results.length}</p>

                {results.length === 0 ? (
                  <p className={styles.searchHint}>No books found.</p>
                ) : (
                  results.map((book) => {
                    const availableCopies = parseInt(book.available?.toString() || '0', 10);
                    const totalCopies = parseInt(book.total?.toString() || '0', 10);
                    const isAvailable = availableCopies > 0;

                    return (
                      <div key={book.book_id} className={styles.bookCard}>
                        <div className={styles.bookDetails}>
                          <p className={styles.bookType}>Book</p>
                          <h3 className={styles.bookTitle}>{book.title}</h3>
                          <p className={styles.bookMeta}>
                            Author: {book.author || 'N/A'}
                            <br />
                            Publisher: {book.publisher || 'N/A'} •{' '}
                            {book.publication_year || 'N/A'}
                            <br />
                            Genre: {book.genre || 'N/A'}
                          </p>
                          <p
                            className={
                              isAvailable
                                ? styles.available
                                : styles.notAvailable
                            }
                          >
                            {isAvailable ? (
                              <>
                                ✅ <strong>Available:</strong> {availableCopies} of{' '}
                                {totalCopies} copies remaining
                              </>
                            ) : (
                              <>
                                ❌ <strong>Not Available:</strong>{' '}
                                {availableCopies} of {totalCopies} copies
                                remaining
                              </>
                            )}
                          </p>
                        </div>

                        <div className={styles.bookAction}>
                          <button
                            className={`${styles.requestBtn} ${
                              !isAvailable ? styles.disabledBtn : ''
                            }`}
                            disabled={!isAvailable}
                            onClick={() => openRequestModal(book)}
                          >
                            Request Item
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Request Confirmation Modal */}
          {showRequestModal && selectedBook && (
            <div className={styles.modalOverlay} onClick={closeRequestModal}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.modalTitle}>Confirm Book Request</h3>

                <div className={styles.modalContent}>
                  <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Book Details</h4>
                    <p><strong>Title:</strong> {selectedBook.title}</p>
                    <p><strong>Author:</strong> {selectedBook.author || 'N/A'}</p>
                    <p><strong>Publisher:</strong> {selectedBook.publisher || 'N/A'}</p>
                    {selectedBook.isbn && (
                      <p><strong>ISBN:</strong> {selectedBook.isbn}</p>
                    )}
                  </div>

                  {!requestSuccess && (
                    <div className={styles.section}>
                      <h4 className={styles.sectionTitle}>Enter Your Password</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordInput}
                          className={styles.searchInput}
                          placeholder="Enter your password"
                          onChange={(e) => setPasswordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRequestSubmit();
                            }
                          }}
                          disabled={isSubmitting}
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isSubmitting}
                          style={{
                            padding: '8px 12px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: '#f5f5f5'
                          }}
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {passwordError && (
                        <p className={styles.notAvailable} style={{ marginTop: '10px' }}>
                          {passwordError}
                        </p>
                      )}
                    </div>
                  )}

                  {requestSuccess && (
                    <div className={styles.section}>
                      <p className={styles.available}>
                        ✅ Request submitted successfully!
                      </p>
                    </div>
                  )}
                </div>

                <div className={styles.modalActions}>
                  <button
                    className={styles.cancelBtn}
                    onClick={closeRequestModal}
                    disabled={isSubmitting || requestSuccess}
                  >
                    {requestSuccess ? 'Close' : 'Cancel'}
                  </button>

                  {!requestSuccess && (
                    <button
                      className={styles.requestBtn}
                      onClick={handleRequestSubmit}
                      disabled={!passwordInput || isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Confirm Request'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}