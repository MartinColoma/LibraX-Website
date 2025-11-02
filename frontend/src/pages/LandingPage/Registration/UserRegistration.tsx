import React, { useState, useRef, useEffect } from "react";
import styles from "./UserRegistration.module.css";

interface Props {
  onClose: () => void;
}

const UserRegistration: React.FC<Props> = ({ onClose }) => {
  const [form, setForm] = useState({
    role: "",
    firstName: "",
    lastName: "",
    gender: "",
    birthday: "",
    idNumber: "",
    email: "",
    nfcUid: "",
  });

  const [loading, setLoading] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [nfcMessage, setNfcMessage] = useState("");
  const [usbNFCMode, setUsbNFCMode] = useState(false);
  const nfcAbortControllerRef = useRef<AbortController | null>(null);
  const nfcInputRef = useRef<HTMLInputElement>(null);
  const ndefReaderRef = useRef<any>(null);

  // Utility: Convert USB decimal UID to colon-separated hex
  const convertDecimalUidToHex = (decimalUid: string | number): string => {
    let num = typeof decimalUid === "string" ? parseInt(decimalUid, 10) : decimalUid;
    let hex = num.toString(16).padStart(8, "0"); // 32-bit UID
    hex = hex.match(/../g)?.reverse().join("") || hex; // little-endian correction
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

    checkNFCSupport();
  }, []);

  // Global USB NFC listener
  useEffect(() => {
    if (!usbNFCMode) return;

    let buffer = "";
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Usually NFC reader ends with Enter
      if (e.key === "Enter") {
        if (buffer.trim()) {
          const nfcDataHex = convertDecimalUidToHex(buffer.trim());
          setForm(prev => ({ ...prev, nfcUid: nfcDataHex }));
          setNfcMessage(`✅ USB NFC Reader: ${nfcDataHex}`);
          if (nfcInputRef.current) nfcInputRef.current.value = nfcDataHex;
        }
        buffer = "";
        e.preventDefault();
      } else if (e.key.length === 1) {
        buffer += e.key; // accumulate characters from NFC reader
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [usbNFCMode]);

  const startNFCReading = async () => {
    if (!nfcSupported) {
      alert("Native NFC is not supported. Using USB NFC Reader mode if available.");
      return;
    }
    setNfcReading(true);
    setNfcMessage("📱 Waiting for NFC tag... Please hold device near NFC tag");
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
          setForm(prev => ({ ...prev, nfcUid: nfcData }));
          setNfcMessage(`✅ NFC tag read successfully: ${nfcData}`);
          stopNFCReading();
        } else {
          setNfcMessage("⚠️ NFC tag read but no data found. Try again.");
        }
      };

      ndef.onreadingerror = (error: any) => {
        console.error("❌ NFC reading error:", error);
        setNfcMessage("❌ Error reading NFC tag. Please try again.");
      };

      await ndef.scan({ signal: nfcAbortControllerRef.current.signal });
      console.log("✅ NFC scan started successfully");
    } catch (error: any) {
      console.error("NFC error:", error);
      setNfcReading(false);
      setNfcMessage(`❌ NFC error: ${error.message || "Unknown error"}`);
    }
  };

  const stopNFCReading = () => {
    if (nfcAbortControllerRef.current) nfcAbortControllerRef.current.abort();
    setNfcReading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("https://librax-website-frontend.onrender.com/api/register", { // http://localhost:10000 for local testing
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      alert(data.message || "User registered successfully");
      if (res.ok) onClose();
    } catch {
      alert("Failed to register user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      {loading && <div className={styles.loadingOverlay}></div>}
      <div className={styles.modal}>
        <div className={styles.formSection}>
          <h2 className={styles.title}>Register New User Account</h2>

          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Membership Type */}
            <div className={styles.row1}>
              <label>
                Membership Type (Role):
                <select name="role" value={form.role} onChange={handleChange} required>
                  <option value="">Select Membership Type</option>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                  {/* <option value="Librarian">Librarian</option> */}
                </select>
              </label>
            </div>

            {/* Name */}
            <div className={styles.row2}>
              <label>
                First Name:
                <input name="firstName" type="text" value={form.firstName} onChange={handleChange} required placeholder="Enter your first name"/>
              </label>
              <label>
                Last Name:
                <input name="lastName" type="text" value={form.lastName} onChange={handleChange} required placeholder="Enter your first name"/>
              </label>
            </div>

            {/* Gender & Birthday */}
            <div className={styles.row2}>
              <label>
                Gender:
                <select name="gender" value={form.gender} onChange={handleChange} required>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </label>
              <label>
                Birthday:
                <input name="birthday" type="date" value={form.birthday} onChange={handleChange} required />
              </label>
            </div>

            {/* Email & ID */}
            <div className={styles.row2}>
              <label>
                Email:
                <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="Enter your institutional email"/>
              </label>
              <label>
                Student/Faculty ID:
                <input name="idNumber" type="text" value={form.idNumber} onChange={handleChange} required placeholder="Enter your student/faculty id number"/>
              </label>
            </div>

            {/* NFC Section */}
            <div className={styles.nfcSection} style={{ marginBottom: "15px", border: "2px solid var(--red)" }}>
              <h3 className={styles.nfcTitle}>{nfcSupported ? "📱 Native NFC" : "🖥️ USB NFC Reader"}</h3>

              <label>
                NFC Card UID (Optional):
                <input
                  ref={nfcInputRef}
                  className={styles.nfcInput}
                  name="nfcUid"
                  type="text"
                  placeholder={usbNFCMode ? "Hold USB reader near card to scan" : "Will be populated by NFC read"}
                  value={form.nfcUid}
                  readOnly
                  style={{
                    backgroundColor: form.nfcUid ? "#e8f5e9" : "#f5f5f5",
                    borderColor: form.nfcUid ? "green" : "#ccc",
                    cursor: "not-allowed",
                  }}
                />
              </label>

              {nfcSupported && (
                <button type="button" onClick={nfcReading ? stopNFCReading : startNFCReading} className={nfcReading ? styles.nfcButtonStop : styles.nfcButton}>
                  {nfcReading ? "🛑 Stop NFC Reading" : "📱 Start NFC Reading"}
                </button>
              )}

              {usbNFCMode && !nfcSupported && (
                <p className={styles.nfcHint}>💡 USB NFC Reader Mode: Position reader near card to scan</p>
              )}

              {nfcMessage && (
                <p className={nfcMessage.includes("✅") ? styles.nfcSuccess : nfcMessage.includes("⏹️") ? styles.nfcHint : styles.nfcError}>
                  {nfcMessage}
                </p>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.createBtn}>
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserRegistration;