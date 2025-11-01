import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Scan, AlertCircle } from 'lucide-react';
import styles from './RequestDetails.module.css';

interface BookRequest {
  request_id: string;
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
  book_id: string;
  user_id: string;
}

interface RequestDetailsModalProps {
  request: BookRequest;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (requestId: string, updatedData: Partial<BookRequest>) => void;
}

export default function RequestDetailsModal({
  request,
  isOpen,
  onClose,
  onUpdate,
}: RequestDetailsModalProps) {
  const [dueDate, setDueDate] = useState(request.due_date);
  const [isApproving, setIsApproving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedNFC, setScannedNFC] = useState<string | null>(null);
  const [showNFCModal, setShowNFCModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [usbNFCMode, setUsbNFCMode] = useState(false);
  const [nfcMessage, setNfcMessage] = useState("");
  
  const nfcAbortControllerRef = useRef<AbortController | null>(null);
  const ndefReaderRef = useRef<any>(null);

  if (!isOpen) return null;

  // Utility: Convert USB decimal UID to colon-separated hex
  const convertDecimalUidToHex = (decimalUid: string | number): string => {
    let num = typeof decimalUid === "string" ? parseInt(decimalUid, 10) : decimalUid;
    let hex = num.toString(16).padStart(8, "0");
    hex = hex.match(/../g)?.reverse().join("") || hex;
    return hex.match(/../g)?.join(":") || hex;
  };

  // Detect NFC / USB NFC mode
  useEffect(() => {
    const checkNFCSupport = async () => {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      if ("NDEFReader" in window && isMobile) {
        try {
          const permission = await navigator.permissions.query({ name: "nfc" as any });
          setNfcSupported(permission.state !== "denied");
          setUsbNFCMode(false);
          console.log("✅ Native NFC (Web NFC API) is supported on mobile");
        } catch {
          setNfcSupported(false);
          setUsbNFCMode(false);
        }
      } else {
        setUsbNFCMode(true);
        setNfcSupported(false);
        console.log("🖥️ USB NFC Reader mode enabled");
      }
    };

    if (isOpen) {
      checkNFCSupport();
    }
  }, [isOpen]);

  // Global USB NFC listener (only when scanning)
  useEffect(() => {
    if (!usbNFCMode || !isScanning) return;

    let buffer = "";
    const handleGlobalKey = (e: KeyboardEvent) => {
      // NFC reader usually ends with Enter
      if (e.key === "Enter") {
        if (buffer.trim()) {
          const nfcDataHex = convertDecimalUidToHex(buffer.trim());
          setScannedNFC(nfcDataHex);
          setNfcMessage(`✅ USB NFC Reader: ${nfcDataHex}`);
          setIsScanning(false);
          setShowNFCModal(false);
          setError(null);
        }
        buffer = "";
        e.preventDefault();
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [usbNFCMode, isScanning]);

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

  const startNFCScan = async () => {
    setIsScanning(true);
    setShowNFCModal(true);
    setError(null);
    setNfcMessage("");

    // USB NFC Mode - just wait for keyboard input
    if (usbNFCMode) {
      setNfcMessage("🖥️ USB NFC Reader Mode: Hold book near the reader...");
      return;
    }

    // Native NFC Mode
    if (!nfcSupported) {
      setError("Native NFC is not supported on this device.");
      setIsScanning(false);
      setShowNFCModal(false);
      return;
    }

    setNfcMessage("📱 Waiting for NFC tag... Please hold device near book's NFC tag");
    nfcAbortControllerRef.current = new AbortController();

    try {
      const ndef = new (window as any).NDEFReader();
      ndefReaderRef.current = ndef;

      ndef.onreading = (event: any) => {
        const { message } = event;
        let nfcData = "";

        if (message && message.records) {
          for (const record of message.records) {
            if (record.recordType === "text" || record.recordType === "uri") {
              try {
                const decoder = new TextDecoder();
                nfcData = decoder.decode(record.data);
                break;
              } catch (e) {
                console.error("Error decoding record:", e);
              }
            }
          }
        }

        if (!nfcData && event.serialNumber) {
          nfcData = event.serialNumber;
        }

        if (nfcData) {
          setScannedNFC(nfcData);
          setNfcMessage(`✅ NFC tag read successfully: ${nfcData}`);
          setError(null);
          stopNFCReading();
        } else {
          setNfcMessage("⚠️ NFC tag read but no data found. Try again.");
        }
      };

      ndef.onreadingerror = (error: any) => {
        console.error("❌ NFC reading error:", error);
        setNfcMessage("❌ Error reading NFC tag. Please try again.");
        setError("Error reading NFC tag. Please try again.");
      };

      await ndef.scan({ signal: nfcAbortControllerRef.current.signal });
      console.log("✅ NFC scan started successfully");
    } catch (err: any) {
      console.error("NFC error:", err);
      setIsScanning(false);
      setShowNFCModal(false);
      setError(`NFC error: ${err.message || "Unknown error"}`);
      setNfcMessage(`❌ NFC error: ${err.message || "Unknown error"}`);
    }
  };

  const stopNFCReading = () => {
    if (nfcAbortControllerRef.current) {
      nfcAbortControllerRef.current.abort();
    }
    setIsScanning(false);
    setShowNFCModal(false);
  };

  const handleApproveRequest = async () => {
    // Validation
    if (!dueDate) {
      setError('Please set a due date before approving the request.');
      return;
    }

    if (!scannedNFC) {
      setError('Please scan the book NFC tag before approving.');
      return;
    }

    // Validate due date is in the future
    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDateObj < today) {
      setError('Due date must be in the future.');
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(
        `https://librax-website-frontend.onrender.com/api/librarian/quick-actions/book-requests/${request.request_id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            due_date: dueDate,
            nfc_uid: scannedNFC,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve request');
      }

      onUpdate(request.request_id, { 
        status: 'Approved',
        due_date: dueDate 
      });
      
      alert(
        `✅ Request Approved Successfully!\n\n` +
        `Borrow ID: ${result.borrow_id}\n` +
        `Book: ${request.book_title}\n` +
        `Borrower: ${request.borrower_name}\n` +
        `Due Date: ${new Date(dueDate).toLocaleDateString()}`
      );
      
      onClose();
    } catch (err) {
      console.error('Error approving request:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve request. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const cancelNFCScan = () => {
    stopNFCReading();
    setScannedNFC(null);
    setNfcMessage("");
  };

  const getMinDueDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Close modal"
          >
            <X size={32} />
          </button>

          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Request Details</h2>

            {/* Error Message */}
            {error && (
              <div className={styles.errorBanner}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* Member Details Section */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Member Details</h3>
              <div className={styles.detailsBox}>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Name:</span>
                  <span className={styles.value}>{request.borrower_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.labelRed}>ID Number:</span>
                  <span className={styles.value}>{request.borrower_id}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.labelRed}>Email:</span>
                  <span className={styles.value}>{request.borrower_email}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.labelRed}>Address:</span>
                  <span className={styles.value}>{request.borrower_address}</span>
                </div>
              </div>
            </section>

            {/* Book Details Section */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Book Details</h3>
              <div className={styles.detailsBox}>
                <p className={styles.bookLabel}>Book</p>
                <h4 className={styles.bookTitle}>{request.book_title}</h4>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Author:</span>
                  <span className={styles.value}>{request.author_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Publisher:</span>
                  <span className={styles.value}>
                    {request.publisher || "N/A"}
                    {request.publication_year && ` (${request.publication_year})`}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Genre:</span>
                  <span className={styles.value}>{request.genre}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Status:</span>
                  <span className={`${styles.statusBadge} ${styles[request.status.toLowerCase().replace(' ', '')]}`}>
                    {request.status}
                  </span>
                </div>
              </div>
            </section>

            {/* Date Details Section */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Date Information</h3>
              
              <div className={styles.dateBox}>
                <div className={styles.dateItem}>
                  <span className={styles.dateLabel}>Request Date:</span>
                  <span className={styles.dateValue}>{formatDateTime(request.request_date)}</span>
                </div>
              </div>

              <div className={styles.dateBox}>
                <div className={styles.dateItem}>
                  <label htmlFor="due-date" className={styles.dateLabel}>
                    Due Date: <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={getMinDueDate()}
                    className={styles.dateInput}
                    disabled={request.status === 'Approved'}
                    required
                  />
                </div>
              </div>
            </section>

            {/* NFC Scanning Section */}
            {(request.status === 'Pending' || request.status === 'Pending Approval') && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Book Copy <span className={styles.required}>*</span>
                  <span className={styles.nfcModeIndicator}>
                    {nfcSupported ? " (📱 Mobile NFC)" : " (🖥️ USB Reader)"}
                  </span>
                </h3>
                <div className={styles.nfcSection}>
                  {!scannedNFC ? (
                    <>
                      <button
                        onClick={startNFCScan}
                        className={styles.scanBtn}
                        disabled={isScanning}
                      >
                        <Scan size={20} />
                        {isScanning ? 'Scanning...' : 'Scan Book NFC Tag'}
                      </button>
                      {usbNFCMode && !nfcSupported && (
                        <p className={styles.nfcHint}>
                          💡 USB NFC Reader Mode: Position reader near book to scan
                        </p>
                      )}
                    </>
                  ) : (
                    <div className={styles.nfcResult}>
                      <CheckCircle size={20} className={styles.successIcon} />
                      <div className={styles.nfcInfo}>
                        <span className={styles.nfcLabel}>NFC Tag Scanned:</span>
                        <span className={styles.nfcValue}>{scannedNFC}</span>
                      </div>
                      <button
                        onClick={() => {
                          setScannedNFC(null);
                          setError(null);
                          setNfcMessage("");
                        }}
                        className={styles.rescanBtn}
                      >
                        Rescan
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Remarks Section */}
            {request.remarks && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Remarks</h3>
                <div className={styles.remarksBox}>
                  <p>{request.remarks}</p>
                </div>
              </section>
            )}

            {/* Action Buttons */}
            {(request.status === 'Pending' || request.status === 'Pending Approval') && (
              <div className={styles.actionButtons}>
                <button
                  onClick={handleApproveRequest}
                  disabled={isApproving || !dueDate || !scannedNFC}
                  className={styles.approveBtn}
                  title={
                    !dueDate 
                      ? 'Please set a due date' 
                      : !scannedNFC 
                      ? 'Please scan the book NFC tag' 
                      : 'Approve this request'
                  }
                >
                  <CheckCircle size={20} />
                  {isApproving ? 'Approving...' : 'Approve Request'}
                </button>
              </div>
            )}

            {/* Approval Checklist */}
            {(request.status === 'Pending' || request.status === 'Pending Approval') && (
              <div className={styles.checklist}>
                <p className={styles.checklistTitle}>Before Approving:</p>
                <div className={styles.checklistItem}>
                  <CheckCircle 
                    size={16} 
                    className={dueDate ? styles.checkComplete : styles.checkIncomplete} 
                  />
                  <span>Set due date</span>
                </div>
                <div className={styles.checklistItem}>
                  <CheckCircle 
                    size={16} 
                    className={scannedNFC ? styles.checkComplete : styles.checkIncomplete} 
                  />
                  <span>Scan book NFC tag ({usbNFCMode ? "USB Reader" : "Mobile NFC"})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NFC Scanning Modal */}
      {showNFCModal && (
        <div className={styles.nfcModalOverlay}>
          <div className={styles.nfcModal}>
            <div className={styles.scanAnimation}>
              <Scan size={64} className={styles.scanIcon} />
            </div>
            <h3>
              {usbNFCMode ? "USB NFC Reader" : "Mobile NFC Scanning"}
            </h3>
            <p>{nfcMessage || "Please place the book near the NFC reader..."}</p>
            <button onClick={cancelNFCScan} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}