import React, { useState, useRef, useEffect } from "react";
import { sendOtp, verifyOtp, registerWithOtp } from "../services/api";
import logo from "../assets/logo.svg";
import { LEGAL_CONFIG } from "../constants/legal";
import { ShieldCheck } from "lucide-react";
import TurnstileWidget from "../components/TurnstileWidget";

export default function AuthPage({ onAuthSuccess, onGoBack, initialView = "LOGIN" }) {
  // mode: 'LOGIN' | 'REGISTER'
  const [mode, setMode] = useState(initialView === "REGISTER" ? "REGISTER" : "LOGIN");
  // sub-steps:
  // for LOGIN: 'PHONE' | 'OTP'
  // for REGISTER: 'FORM' | 'OTP'
  const [loginStep, setLoginStep] = useState("PHONE");
  const [registerStep, setRegisterStep] = useState("FORM");

  // Registration & Login Form State
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("30");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [dpdpConsent, setDpdpConsent] = useState(false);

  // Cloudflare Turnstile Verification State
  const [turnstileToken, setTurnstileToken] = useState("");
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState("");
  const loginTurnstileRef = useRef(null);
  const registerTurnstileRef = useRef(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // 6-digit OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(60);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const otpRefs = useRef([]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval;
    const isOtpActive = (mode === "LOGIN" && loginStep === "OTP") || (mode === "REGISTER" && registerStep === "OTP");
    if (isOtpActive && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode, loginStep, registerStep, resendTimer]);

  const cleanPhoneNumber = (val) => val.replace(/\D/g, "").slice(-10);

  // Switch tabs
  const handleTabSwitch = (newMode) => {
    setError("");
    setInfoMessage("");
    setMode(newMode);
    setOtp(["", "", "", "", "", ""]);
    setTurnstileToken("");
    setRegisterTurnstileToken("");
    loginTurnstileRef.current?.reset();
    registerTurnstileRef.current?.reset();
    if (newMode === "LOGIN") {
      setLoginStep("PHONE");
    } else {
      setRegisterStep("FORM");
    }
  };

  // OTP inputs handler
  const handleOtpChange = (val, idx) => {
    const rawVal = val.replace(/\D/g, "");
    if (rawVal.length > 1) {
      // Pasted multi-digit OTP
      const pasted = rawVal.slice(0, 6).split("");
      const newOtp = [...otp];
      pasted.forEach((ch, i) => {
        if (idx + i < 6) newOtp[idx + i] = ch;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(idx + pasted.length, 5);
      otpRefs.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[idx] = rawVal.slice(-1);
    setOtp(newOtp);

    if (rawVal && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  // ─── LOGIN FLOW ──────────────────────────────────────────────────────────

  // 1. Send Login OTP
  const handleLoginSendOtp = async (e) => {
    e?.preventDefault();
    setError("");
    setInfoMessage("");

    const cleanPhone = cleanPhoneNumber(phone);
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the human security verification below before requesting OTP.");
      return;
    }

    setLoading(true);
    try {
      await sendOtp(cleanPhone, turnstileToken);
      setInfoMessage(`We've sent a 6-digit verification code to +91 ${cleanPhone}`);
      setLoginStep("OTP");
      setResendTimer(60);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.");
      setTurnstileToken("");
      loginTurnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify Login OTP
  const handleLoginVerifyOtp = async (e) => {
    e?.preventDefault();
    setError("");
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = cleanPhoneNumber(phone);
      const res = await verifyOtp(cleanPhone, enteredOtp);

      if (res.isNewUser) {
        // Phone verified but user has no account yet -> switch to Register form
        setInfoMessage("Phone verified! Please complete your details below to create your account.");
        setMode("REGISTER");
        setRegisterStep("FORM");
        setConsentGiven(true);
      } else if (res.user && res.token) {
        onAuthSuccess(res.user, res.token);
      } else {
        setError("Verification response invalid. Please try again.");
      }
    } catch (err) {
      setError(err.message || "OTP verification failed. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── REGISTER FLOW ───────────────────────────────────────────────────────

  // 1. Initiate Register -> Validate form and send OTP
  const handleRegisterFormSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setInfoMessage("");

    const cleanPhone = cleanPhoneNumber(phone);
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      setError("Please enter a valid age (18-120).");
      return;
    }
    if (!consentGiven) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    if (turnstileSiteKey && !registerTurnstileToken) {
      setError("Please complete the human security verification below before requesting OTP.");
      return;
    }

    setLoading(true);
    try {
      await sendOtp(cleanPhone, registerTurnstileToken);
      setInfoMessage(`We've sent a 6-digit verification code to +91 ${cleanPhone}`);
      setRegisterStep("OTP");
      setResendTimer(60);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err.message || "Failed to send verification code. Please check your connection.");
      setRegisterTurnstileToken("");
      registerTurnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP & complete registration via register-otp
  const handleRegisterVerifyAndCreate = async (e) => {
    e?.preventDefault();
    setError("");
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    const cleanPhone = cleanPhoneNumber(phone);
    const ageNum = parseInt(age, 10) || 30;

    setLoading(true);
    try {
      // 1. Verify the OTP code first
      await verifyOtp(cleanPhone, enteredOtp);

      // 2. Complete OTP-based registration (stores user without requiring password)
      const regRes = await registerWithOtp({
        phoneRaw: cleanPhone,
        name: name.trim(),
        age: ageNum,
        email: email.trim() || undefined,
        pincode: pincode.trim() || undefined,
        location: location.trim() || undefined,
      });

      if (regRes.user && regRes.token) {
        onAuthSuccess(regRes.user, regRes.token);
      } else {
        setError("Account creation completed but session could not be established.");
      }
    } catch (err) {
      setError(err.message || "Verification & registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Code Handler ──────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    const cleanPhone = cleanPhoneNumber(phone);
    if (cleanPhone.length !== 10) return;

    setLoading(true);
    try {
      await sendOtp(cleanPhone);
      setResendTimer(60);
      setInfoMessage(`A fresh 6-digit verification code has been sent to +91 ${cleanPhone}`);
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "REGISTER";

  return (
    <div className="auth-page-container">
      {/* ── Left Hero Side ── */}
      <div className="auth-hero-side">
        <div style={{ zIndex: 2, maxWidth: "520px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
            <button onClick={onGoBack} className="auth-back-btn" style={{ margin: 0 }}>
              ← Back
            </button>
            <div className="auth-badge" style={{ margin: 0 }}>
              India's Senior Care Ecosystem
            </div>
          </div>

          <h1 className="auth-hero-title">
            Care for your loved ones, <span style={{ color: "#ffedd5" }}>simplified.</span>
          </h1>

          <p className="auth-hero-desc">
            Seamlessly log in with OTP or register your account to coordinate verified Care Mitras, monitor daily vitals, and ensure complete family peace of mind.
          </p>

          <div className="auth-features-list">
            {[
              { icon: "🛡️", title: "100% Verified Care Mitras", desc: "Background checked and trained companions" },
              { icon: "📊", title: "Vitals & Happiness Score", desc: "Live monitoring of health trends and mood" },
              { icon: "🚨", title: "24/7 Emergency Response", desc: "Instant alert button for complete family safety" },
              { icon: "⚡", title: "Instant OTP Authentication", desc: "No passwords to remember, login securely in seconds" },
            ].map((f, i) => (
              <div key={i} className="auth-feature-item">
                <span className="auth-feature-icon">{f.icon}</span>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-copyright">
          © 2026 MaiHoonNa Care Technologies. All rights reserved.
        </div>
      </div>

      {/* ── Right Form Side ── */}
      <div className="auth-form-side">
        <div className={`auth-form-card ${isRegister ? "auth-card--register" : "auth-card--login"}`}>
          {/* Header Brand */}
          <div className="auth-header-brand" style={{ marginBottom: "16px", textAlign: "center" }}>
            <img
              src={logo}
              alt="MaiHoonNa"
              className="auth-brand-logo"
              style={{ height: "36px", margin: "0 auto 10px", display: "block" }}
            />

            {/* Tab Switcher */}
            <div
              className="auth-tab-switcher"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#f1f5f9",
                padding: "3px",
                borderRadius: "12px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                onClick={() => handleTabSwitch("LOGIN")}
                style={{
                  padding: "8px",
                  borderRadius: "9px",
                  border: "none",
                  fontWeight: "700",
                  fontSize: "0.9rem",
                  background: !isRegister ? "#ffffff" : "transparent",
                  color: !isRegister ? "#0f172a" : "#64748b",
                  boxShadow: !isRegister ? "0 2px 6px rgba(0, 0, 0, 0.08)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("REGISTER")}
                style={{
                  padding: "8px",
                  borderRadius: "9px",
                  border: "none",
                  fontWeight: "700",
                  fontSize: "0.9rem",
                  background: isRegister ? "#ffffff" : "transparent",
                  color: isRegister ? "#0f172a" : "#64748b",
                  boxShadow: isRegister ? "0 2px 6px rgba(0, 0, 0, 0.08)" : "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Create Account
              </button>
            </div>

            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0f172a", margin: "0 0 4px" }}>
              {!isRegister && loginStep === "PHONE" && "Welcome to MaiHoonNa"}
              {!isRegister && loginStep === "OTP" && "Enter Verification Code"}
              {isRegister && registerStep === "FORM" && "Create Your Account"}
              {isRegister && registerStep === "OTP" && "Verify Mobile Number"}
            </h2>

            <p style={{ fontSize: "0.84rem", color: "#64748b", margin: 0 }}>
              {!isRegister && loginStep === "PHONE" && "Enter your 10-digit mobile number to log in via OTP."}
              {!isRegister && loginStep === "OTP" && `We sent a 6-digit verification code to +91 ${cleanPhoneNumber(phone)}`}
              {isRegister && registerStep === "FORM" && "Fill in your basic details to get started. No password needed!"}
              {isRegister && registerStep === "OTP" && `Enter the 6-digit OTP code sent to +91 ${cleanPhoneNumber(phone)}`}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.85rem",
                marginBottom: "14px",
                fontWeight: "500",
              }}
            >
              {error}
            </div>
          )}

          {/* Info Alert */}
          {infoMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "0.85rem",
                marginBottom: "14px",
                fontWeight: "500",
              }}
            >
              {infoMessage}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 1: LOGIN (PHONE INPUT)
          ══════════════════════════════════════════════════════════════════ */}
          {!isRegister && loginStep === "PHONE" && (
            <form onSubmit={handleLoginSendOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Mobile Phone Number *
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "#f1f5f9",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "10px",
                      fontWeight: "700",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  >
                    +91
                  </div>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                    required
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Cloudflare Turnstile Human Verification */}
              {turnstileSiteKey && (
                <div style={{ margin: "4px 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      marginBottom: "4px",
                      color: "#64748b",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                    }}
                  >
                    <ShieldCheck size={16} color="var(--orange, #fe6700)" />
                    <span>Verify You Are Human</span>
                  </div>
                  <TurnstileWidget
                    ref={loginTurnstileRef}
                    siteKey={turnstileSiteKey}
                    onVerify={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken("")}
                    onError={() => {
                      setTurnstileToken("");
                      setError("Security verification challenge failed. Please retry.");
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cleanPhoneNumber(phone).length < 10 || (Boolean(turnstileSiteKey) && !turnstileToken)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "var(--orange, #fe6700)",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "1rem",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(254, 103, 0, 0.35)",
                  opacity: loading || cleanPhoneNumber(phone).length < 10 || (Boolean(turnstileSiteKey) && !turnstileToken) ? 0.6 : 1,
                  cursor: loading || cleanPhoneNumber(phone).length < 10 || (Boolean(turnstileSiteKey) && !turnstileToken) ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Sending OTP..." : "Send Verification OTP"}
              </button>

              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => handleTabSwitch("REGISTER")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Don't have an account? <span style={{ color: "var(--orange, #fe6700)", fontWeight: "700" }}>Sign Up</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 2: LOGIN (OTP VERIFICATION)
          ══════════════════════════════════════════════════════════════════ */}
          {!isRegister && loginStep === "OTP" && (
            <form onSubmit={handleLoginVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="auth-otp-grid">
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
                    className="auth-otp-input"
                    autoFocus={idx === 0}
                    style={{
                      border: digit ? "2px solid var(--orange, #fe6700)" : "1.5px solid #cbd5e1",
                      background: digit ? "#fff8f3" : "#ffffff",
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
                  boxShadow: "0 4px 14px rgba(254, 103, 0, 0.35)",
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
                    setLoginStep("PHONE");
                  }}
                  style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer" }}
                >
                  ← Change Number
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendTimer > 0 ? "#94a3b8" : "var(--orange, #fe6700)",
                    fontWeight: "700",
                    cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 3: REGISTER (FORM INPUT - MATCHES MOBILE APP REGISTER.TSX)
          ══════════════════════════════════════════════════════════════════ */}
          {isRegister && registerStep === "FORM" && (
            <form onSubmit={handleRegisterFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Full Name */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.92rem" }}
                />
              </div>

              {/* Email Address (Optional) */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                  Email Address <span style={{ color: "#94a3b8", fontWeight: "400" }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.92rem" }}
                />
              </div>

              {/* Phone + Age Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                    Mobile Number *
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <div
                      style={{
                        padding: "11px 8px",
                        background: "#f1f5f9",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: "10px",
                        fontWeight: "700",
                        color: "#0f172a",
                        fontSize: "0.9rem",
                      }}
                    >
                      +91
                    </div>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      required
                      style={{
                        flex: 1,
                        padding: "11px 10px",
                        borderRadius: "10px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "0.92rem",
                        fontWeight: "600",
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                    Age *
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={18}
                    max={120}
                    required
                    style={{ width: "100%", padding: "11px 10px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.92rem" }}
                  />
                </div>
              </div>

              {/* Service Location / Pincode */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                    Pincode <span style={{ color: "#94a3b8", fontWeight: "400" }}>(Opt)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 110001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    style={{ width: "100%", padding: "11px 10px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.92rem" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#334155", display: "block", marginBottom: "4px" }}>
                    City / Area <span style={{ color: "#94a3b8", fontWeight: "400" }}>(Opt)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ width: "100%", padding: "11px 10px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.92rem" }}
                  />
                </div>
              </div>

              {/* Terms & Privacy Consent Checkbox (Matching App) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: "#fff8f3",
                  border: "1px solid #ffd7bc",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  margin: "4px 0",
                  cursor: "pointer",
                }}
                onClick={() => setConsentGiven(!consentGiven)}
              >
                <input
                  type="checkbox"
                  id="auth-consent"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{
                    accentColor: "var(--orange, #fe6700)",
                    marginTop: "2px",
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor="auth-consent"
                  style={{
                    fontSize: "0.76rem",
                    color: "#475569",
                    lineHeight: "1.4",
                    cursor: "pointer",
                    margin: 0,
                  }}
                >
                  I agree that MaiHoonNa may collect and use my information to provide elder care coordination services. I accept the{" "}
                  <a
                    href={LEGAL_CONFIG.TERMS_OF_SERVICE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: "var(--orange, #fe6700)",
                      fontWeight: "700",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Terms of Service
                  </a>
                  .
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: "#fff8f3",
                  border: "1px solid #ffd7bc",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  margin: "4px 0",
                  cursor: "pointer",
                }}
                onClick={() => setDpdpConsent(!dpdpConsent)}
              >
                <input
                  type="checkbox"
                  id="auth-dpdp-consent"
                  checked={dpdpConsent}
                  onChange={(e) => {
                    setDpdpConsent(e.target.checked);
                    setError("");
                  }}
                  style={{
                    accentColor: "var(--orange, #fe6700)",
                    marginTop: "2px",
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor="auth-dpdp-consent"
                  style={{
                    fontSize: "0.76rem",
                    color: "#475569",
                    lineHeight: "1.4",
                    cursor: "pointer",
                    margin: 0,
                  }}
                >
                  I have read and agree to the{" "}
                  <a
                    href={LEGAL_CONFIG.PRIVACY_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: "var(--orange, #fe6700)",
                      fontWeight: "700",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Privacy Policy
                  </a>{" "}
                  and consent to processing of my personal data under the DPDP Act, 2023.
                </label>
              </div>

              {/* Cloudflare Turnstile Human Verification */}
              {turnstileSiteKey && (
                <div style={{ margin: "4px 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      marginBottom: "4px",
                      color: "#64748b",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                    }}
                  >
                    <ShieldCheck size={16} color="var(--orange, #fe6700)" />
                    <span>Verify You Are Human</span>
                  </div>
                  <TurnstileWidget
                    ref={registerTurnstileRef}
                    siteKey={turnstileSiteKey}
                    onVerify={(token) => setRegisterTurnstileToken(token)}
                    onExpire={() => setRegisterTurnstileToken("")}
                    onError={() => {
                      setRegisterTurnstileToken("");
                      setError("Security verification challenge failed. Please retry.");
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || cleanPhoneNumber(phone).length < 10 || !name.trim() || !consentGiven || !dpdpConsent || (Boolean(turnstileSiteKey) && !registerTurnstileToken)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "var(--orange, #fe6700)",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "1rem",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(254, 103, 0, 0.35)",
                  opacity: loading || cleanPhoneNumber(phone).length < 10 || !name.trim() || !consentGiven || !dpdpConsent || (Boolean(turnstileSiteKey) && !registerTurnstileToken) ? 0.6 : 1,
                  cursor: loading || cleanPhoneNumber(phone).length < 10 || !name.trim() || !consentGiven || !dpdpConsent || (Boolean(turnstileSiteKey) && !registerTurnstileToken) ? "not-allowed" : "pointer",
                  marginTop: "2px",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Sending Verification Code..." : "Send Verification Code"}
              </button>

              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => handleTabSwitch("LOGIN")}
                  style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  Already have an account? <span style={{ color: "var(--orange, #fe6700)", fontWeight: "700" }}>Log In</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 4: REGISTER (OTP VERIFICATION & ACCOUNT CREATION)
          ══════════════════════════════════════════════════════════════════ */}
          {isRegister && registerStep === "OTP" && (
            <form onSubmit={handleRegisterVerifyAndCreate} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="auth-otp-grid">
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
                    className="auth-otp-input"
                    autoFocus={idx === 0}
                    style={{
                      border: digit ? "2px solid var(--orange, #fe6700)" : "1.5px solid #cbd5e1",
                      background: digit ? "#fff8f3" : "#ffffff",
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
                  boxShadow: "0 4px 14px rgba(254, 103, 0, 0.35)",
                  opacity: loading || otp.join("").length !== 6 ? 0.6 : 1,
                  cursor: loading || otp.join("").length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Creating Account..." : "Verify & Create Account"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <button
                  type="button"
                  onClick={() => setRegisterStep("FORM")}
                  style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer" }}
                >
                  ← Edit Details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: resendTimer > 0 ? "#94a3b8" : "var(--orange, #fe6700)",
                    fontWeight: "700",
                    cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="auth-mobile-header">
          <button onClick={onGoBack} className="auth-mobile-back-btn">
            ← Back to Website
          </button>
        </div>
      </div>
    </div>
  );
}
