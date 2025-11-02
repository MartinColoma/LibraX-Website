import { useState, useEffect } from 'react';
import './BookRequest.css';
import RequestDetailsModal from './RequestDetails';

export interface BookRequest {
  request_id: string;
  book_id: string;
  user_id: string;
  book_title: string;
  borrower_name: string;
  borrower_id: string;
  borrower_email: string;
  borrower_address: string;
  request_date: string;
  due_date: string;
  status: string;
  remarks: string;
  author_name: string;
  publisher: string;
  publication_year: number;
  genre: string;
}


export default function BookRequestsPage() {
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookRequest | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBookRequests();
  }, []);

  const fetchBookRequests = async () => {
    try {
      const response = await fetch('https://librax-website-frontend.onrender.com/api/librarian/quick-actions/book-requests');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching book requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: BookRequest) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
  };

  const handleUpdateRequest = (requestId: string, updatedData: Partial<BookRequest>) => {
    setRequests(requests.map(req => 
      req.request_id === requestId 
        ? { ...req, ...updatedData }
        : req
    ));
    
    if (selectedRequest && selectedRequest.request_id === requestId) {
      setSelectedRequest({ ...selectedRequest, ...updatedData });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="book-requests-container">
      <div className="book-requests-header">
        <h2>Book Requests</h2>
        <button className="issue-book-btn">
          Issue Book
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="no-data">No book requests found.</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-wrapper">
            <table className="book-requests-table">
              <thead>
                <tr>
                  <th>Book Title</th>
                  <th>Borrower</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.request_id}>
                    <td>{request.book_title}</td>
                    <td>{request.borrower_name}</td>
                    <td>{formatDateTime(request.request_date)}</td>
                    <td>
                      <span className={`status-badge ${request.status.toLowerCase()}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleViewRequest(request)}
                        className="view-request-btn"
                      >
                        View Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-cards">
            {requests.map((request) => (
              <div key={request.request_id} className="request-card">
                <div className="card-header">
                  <span className="card-title">{request.book_title}</span>
                </div>
                <div className="card-body">
                  <div className="card-row">
                    <span className="card-label">Borrower:</span>
                    <span className="card-value">{request.borrower_name}</span>
                  </div>
                  <div className="card-row">
                    <span className="card-label">Request Date:</span>
                    <span className="card-value">{formatDateTime(request.request_date)}</span>
                  </div>
                  <div className="card-row">
                    <span className="card-label">Due Date:</span>
                    <span className="card-value">{formatDate(request.due_date)}</span>
                  </div>
                  <div className="card-row">
                    <span className="card-label">Status:</span>
                    <span className="card-value">
                      <span className={`status-badge ${request.status.toLowerCase()}`}>
                        {request.status}
                      </span>
                    </span>
                  </div>
                  <div className="card-actions">
                    <button
                      onClick={() => handleViewRequest(request)}
                      className="view-request-btn"
                    >
                      View Request
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          isOpen={showModal}
          onClose={closeModal}
          onUpdate={handleUpdateRequest}
        />
      )}
    </div>
  );
}