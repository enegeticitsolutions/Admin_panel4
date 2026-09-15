import React, { useState, useRef, useEffect } from "react";
import { sendOtp, verifyOtp, registerUser, loginWithPassword } from "../../services/api";

export default function AuthModal({ isOpen, onClose, onSuccess, initialPhone = "", initialView = "PHONE" }) {
  const [view, setView] = useState(initialView); // 'PHONE' | 'OTP' | 'REGISTER' | 'PASSWORD_LOGIN'
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(60);

  const otpRefs = useRef([]);

  useEffect(() => {
    let interval;
    if (view === "OTP" && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, resendTimer]);

  if (!isOpen) return null;

  const handlePhoneSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (loading || (view === "OTP" && resendTimer > 0)) return;
    setError("");
    setInfoMessage("");

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(cleanPhone);
      setInfoMessage(`6-digit OTP sent to +91 ${cleanPhone}`);
      setResendTimer(60);
      setView("OTP");
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, idx) => {
    const newOtp = [...otp];
    newOtp[idx] = val.slice(-1);
    setOtp(newOtp);

    if (val && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(phone, enteredOtp);
      if (res.isNewUser) {
        setInfoMessage("Phone verified! Please complete your account profile.");
        setView("REGISTER");
      } else if (res.user && res.token) {
        onSuccess(res.user, res.token);
        onClose();
      } else {
        setError("Verification response invalid. Please try again.");
      }
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18) {
      setError("Please enter a valid age (18+).");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({ phoneRaw: phone, name, age: ageNum, password });
      onSuccess(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err.message || "Account creation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithPassword({ phoneRaw: cleanPhone, password });
      onSuccess(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err.message || "Login failed. Invalid phone or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1000 }}>
      <div className="modal-card" style={{ maxWidth: "440px", padding: "32px" }}>
        <button onClick={onClose} className="modal-close" aria-label="Close modal">
          ✕
        </button>

        {/* View Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              margin: "0 auto 12px",
              borderRadius: "50%",
              background: "var(--orange-soft, #fff0e7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            {view === "REGISTER" ? "📝" : "🔐"}
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#111827", margin: "0 0 6px" }}>
            {view === "PHONE" && "Login / Sign Up"}
            {view === "OTP" && "Verify Mobile OTP"}
            {view === "REGISTER" && "Create Account"}
            {view === "PASSWORD_LOGIN" && "Login with Password"}
          </h2>
          <p style={{ fontSize: "0.88rem", color: "#6b7280", margin: 0 }}>
            {view === "PHONE" && "Enter your 10-digit mobile number to receive a 1-time password"}
            {view === "OTP" && `We sent a code to +91 ${phone.replace(/\D/g, "").slice(-10)}`}
            {view === "REGISTER" && "Set up your account details to manage subscriptions & care"}
            {view === "PASSWORD_LOGIN" && "Log into your existing MaiHoonNa account"}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: "0.85rem",
              marginBottom: "16px",
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            {error}
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#dcfce7",
              color: "#166534",
              fontSize: "0.85rem",
              marginBottom: "16px",
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            {infoMessage}
          </div>
        )}

        {/* View 1: PHONE INPUT */}
        {view === "PHONE" && (
          <form onSubmit={handlePhoneSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "6px" }}>
                Mobile Phone Number
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <span
                  style={{
                    padding: "12px 14px",
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontWeight: "600",
                    color: "#374151",
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  required
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "1rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 10}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                background: "var(--orange, #fe6700)",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "1rem",
                border: "none",
                opacity: loading || phone.length < 10 ? 0.6 : 1,
                cursor: loading || phone.length < 10 ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>

            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setView("PASSWORD_LOGIN")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--orange, #fe6700)",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Login with Password instead
              </button>
            </div>
          </form>
        )}

        {/* View 2: OTP VERIFICATION */}
        {view === "OTP" && (
          <form onSubmit={handleVerifyOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  style={{
                    width: "48px",
                    height: "54px",
                    textAlign: "center",
                    fontSize: "1.3rem",
                    fontWeight: "700",
                    borderRadius: "10px",
                    border: digit ? "2px solid var(--orange, #fe6700)" : "1px solid #d1d5db",
                    background: digit ? "#fff5ee" : "#ffffff",
                    outline: "none",
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                background: "var(--orange, #fe6700)",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "1rem",
                border: "none",
                opacity: loading || otp.join("").length !== 6 ? 0.6 : 1,
                cursor: loading || otp.join("").length !== 6 ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <button
                type="button"
                onClick={() => {
                  setOtp(["", "", "", "", "", ""]);
                  setView("PHONE");
                }}
                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}
              >
                ← Change Number
              </button>
              <button
                type="button"
                onClick={handlePhoneSubmit}
                disabled={resendTimer > 0 || loading}
                style={{
                  background: "none",
                  border: "none",
                  color: resendTimer > 0 ? "#9ca3af" : "var(--orange, #fe6700)",
                  fontWeight: "600",
                  cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                }}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {/* View 3: ACCOUNT REGISTRATION */}
        {view === "REGISTER" && (
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                Age *
              </label>
              <input
                type="number"
                placeholder="e.g. 35"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={18}
                max={120}
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                Create Password *
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                background: "var(--orange, #fe6700)",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "1rem",
                border: "none",
                marginTop: "6px",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating Account..." : "Create Account & Login"}
            </button>
          </form>
        )}

        {/* View 4: PASSWORD LOGIN */}
        {view === "PASSWORD_LOGIN" && (
          <form onSubmit={handlePasswordLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                Mobile Phone Number
              </label>
              <input
                type="tel"
                placeholder="10-digit phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                background: "var(--orange, #fe6700)",
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "1rem",
                border: "none",
                marginTop: "6px",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div style={{ textAlign: "center", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setView("PHONE")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--orange, #fe6700)",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ← Back to Login with OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
