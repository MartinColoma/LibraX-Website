import React, { useState, useRef, useEffect } from "react";
import "./Register.css";
import usePageMeta from "../../../../../../hooks/usePageMeta";

const Register: React.FC = () => {
  usePageMeta("Home - Register New user", "/LibraX Square Logo 1.png");

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

  // Detect NFC support on mount
  useEffect(() => {
    const checkNFCSupport = async () => {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      if ("NDEFReader" in window && isMobile) {
        try {
          const permission = await navigator.permissions.query({
            name: "nfc" as any,
          });
          setNfcSupported(permission.state !== "denied");
          setUsbNFCMode(false);
          console.log("✅ Native NFC (Web NFC API) is supported on mobile");
        } catch {
          setNfcSupported(false);
          setUsbNFCMode(true);
          console.log("⚠️ Native NFC not supported — switching to USB mode");
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
          setForm((prev) => ({ ...prev, nfcUid: nfcDataHex }));
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

  // Start NFC Reading
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
        console.log("📖 NFC Tag Detected:", event);
        const { message, serialNumber } = event;
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

        if (!nfcData && serialNumber) {
          nfcData = serialNumber;
        }

        if (nfcData) {
          setForm((prev) => ({ ...prev, nfcUid: nfcData }));
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
      if (error.name === "AbortError") {
        setNfcMessage("⏹️ NFC reading cancelled.");
      } else if (error.name === "NotAllowedError") {
        setNfcMessage("❌ NFC permission denied.");
      } else {
        setNfcMessage(`❌ Error: ${error.message}`);
      }
      setNfcReading(false);
    }
  };

  const stopNFCReading = () => {
    if (nfcAbortControllerRef.current) nfcAbortControllerRef.current.abort();
    setNfcReading(false);
  };

  // Form handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("https://librax-website-frontend.onrender.com/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setForm({
          role: "",
          firstName: "",
          lastName: "",
          gender: "",
          birthday: "",
          idNumber: "",
          email: "",
          nfcUid: "",
        });
        setNfcMessage("");
      } else {
        alert(data.message || "Registration failed");
      }
    } catch {
      alert("Failed to register user.");
    } finally {
      setLoading(false);
    }
  };

  // Check if NFC card is scanned
  const isNfcScanned = form.nfcUid.trim() !== "";

  return (
    <div className="register-form-container">
      <h2>Register New Member</h2>
      <form className="register-form" onSubmit={handleSubmit}>
        {/* Role Selection */}
        <div className="form-row">
          <label>
            Membership Type:
            <select name="role" value={form.role} onChange={handleChange} required>
              <option value="">Select Membership Type</option>
              <option value="Student">Student</option>
              <option value="Faculty">Faculty</option>
              <option value="Librarian">Librarian</option>
            </select>
          </label>
        </div>

        {/* Basic Info */}
        <div className="form-row">
          <label>
            First Name:
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              placeholder="Enter first name"
            />
          </label>
          <label>
            Last Name:
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              placeholder="Enter last name"
            />
          </label>
        </div>

        <div className="form-row">
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
            <input type="date" name="birthday" value={form.birthday} onChange={handleChange} required />
          </label>
        </div>

        <div className="form-row">
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="Enter institutional email"
            />
          </label>
          <label>
            Student/Faculty ID:
            <input
              type="text"
              name="idNumber"
              value={form.idNumber}
              onChange={handleChange}
              required
              placeholder="Enter student/faculty ID number"
            />
          </label>
        </div>

        {/* NFC Section */}
        <div className="nfc-section">
          <h3>{nfcSupported ? "📱 Native NFC" : "🖥️ USB NFC Reader"}</h3>

          <label>
            NFC Card UID (Required):
            <input
              ref={nfcInputRef}
              name="nfcUid"
              type="text"
              value={form.nfcUid}
              readOnly
              placeholder={
                usbNFCMode
                  ? "Hold USB reader near card to scan"
                  : "Will be populated by NFC read"
              }
              className="nfc-input"
              style={{
                backgroundColor: form.nfcUid ? "#e8f5e9" : "#f5f5f5",
                borderColor: form.nfcUid ? "green" : "#ccc",
                cursor: "not-allowed",
              }}
            />
          </label>

          {/* Start/Stop NFC Button */}
          {nfcSupported && (
            <button
              type="button"
              onClick={nfcReading ? stopNFCReading : startNFCReading}
              className="nfc-btn"
            >
              {nfcReading ? "🛑 Stop NFC Reading" : "📱 Start NFC Reading"}
            </button>
          )}

          {usbNFCMode && !nfcSupported && (
            <p className="nfc-message">💡 USB NFC Reader Mode: Position reader near card to scan</p>
          )}

          {nfcMessage && <p className="nfc-message">{nfcMessage}</p>}
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading || !isNfcScanned}
            style={{
              opacity: isNfcScanned ? 1 : 0.5,
              cursor: isNfcScanned ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Registering..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Register;