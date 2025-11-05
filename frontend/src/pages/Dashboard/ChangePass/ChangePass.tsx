// src/pages/Dashboard/User/Sidebar/ChangePass.tsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import styles from "./ChangePass.module.css";

interface ChangePassProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePass: React.FC<ChangePassProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  
  // Show/hide password states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const API_BASE_URL = "https://librax-website-frontend.onrender.com/api";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessageType("error");
      return setMessage("⚠️ All fields are required.");
    }
    if (newPassword !== confirmPassword) {
      setMessageType("error");
      return setMessage("❌ New passwords do not match.");
    }
    if (newPassword.length < 8) {
      setMessageType("error");
      return setMessage("⚠️ Password must be at least 8 characters long.");
    }
    if (currentPassword === newPassword) {
      setMessageType("error");
      return setMessage("⚠️ New password must be different from current password.");
    }

    try {
      setLoading(true);
      setMessage("");

      const token = localStorage.getItem("auth_token");

      if (!token) {
        setMessageType("error");
        setMessage("❌ Session expired. Please log in again.");
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/change-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessageType("success");
      setMessage(response.data.message || "✅ Password changed successfully.");
      
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        setMessage("");
      }, 2000);

    } catch (error: any) {
      console.error("Error changing password:", error);
      setMessageType("error");
      setMessage(
        error.response?.data?.error || 
        "❌ Failed to change password. Please check your current password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  // Render modal content
  const modalContent = (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Change Password</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Current Password */}
          <label>Current Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              disabled={loading}
              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* New Password */}
          <label>New Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowNewPassword(!showNewPassword)}
              disabled={loading}
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Confirm New Password */}
          <label>Confirm New Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && (
            <p className={`${styles.message} ${messageType === "success" ? styles.success : styles.error}`}>
              {message}
            </p>
          )}

          <div className={styles.buttons}>
            <button
              type="button"
              onClick={handleClose}
              className={styles.cancelBtn}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? "Saving..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Use portal to render modal outside the sidebar hierarchy
  return createPortal(modalContent, document.body);
};

export default ChangePass;