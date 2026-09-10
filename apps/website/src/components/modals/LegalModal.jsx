import React, { useState, useEffect } from "react";

export default function LegalModal({ isOpen, onClose, initialTab = "terms", onAccept }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="legal-modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        className="legal-modal-card"
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "700",
                color: "#fe6700",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              MaiHoonNa Eldercare Legal
            </span>
            <h3 style={{ margin: "2px 0 0", fontSize: "1.25rem", fontWeight: "800", color: "#0f172a" }}>
              {activeTab === "terms" && "Terms of Service"}
              {activeTab === "privacy" && "Privacy Policy"}
              {activeTab === "refund" && "Refund & Cancellation Policy"}
              {activeTab === "cookie" && "Cookie Policy"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#64748b",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "10px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #f1f5f9",
            overflowX: "auto",
          }}
        >
          {[
            { id: "terms", label: "Terms of Service" },
            { id: "privacy", label: "Privacy Policy" },
            { id: "refund", label: "Refund Policy" },
            { id: "cookie", label: "Cookie Policy" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "none",
                fontSize: "0.82rem",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                background: activeTab === tab.id ? "#fe6700" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "#64748b",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Content */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            color: "#334155",
            fontSize: "0.88rem",
            lineHeight: "1.65",
          }}
        >
          {activeTab === "terms" && (
            <div>
              <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.8rem" }}>
                Last Updated: January 2026 • MaiHoonNa Eldercare Private Limited
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>1. Acceptance of Terms</h4>
              <p>
                By accessing or registering on the MaiHoonNa website, mobile applications, or our senior care platform, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use our services.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>2. Nature of Services</h4>
              <p>
                MaiHoonNa provides non-medical elder companionship, subscription management, Care Mitra home visits, digital vitals logging, emergency coordinate triggers, and community Saathi network circles. MaiHoonNa does not operate as an emergency medical hospital, and our companions are trained facilitators, not licensed medical doctors.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>3. User Account and Responsibilities</h4>
              <p>
                You must be at least 18 years old to create an account. You agree to provide accurate and complete information about yourself and any senior beneficiaries you register under your account. You are responsible for maintaining the confidentiality of your account access.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>4. Care Mitra Home Visits & Code of Conduct</h4>
              <p>
                All Care Mitras undergo verified background verification. Subscribers and beneficiaries agree to maintain a safe, respectful, and harassment-free environment during all in-person and digital companion sessions.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>5. Subscriptions and Payments</h4>
              <p>
                Subscriptions are billed on a monthly, quarterly, or annual recurring basis as chosen during checkout. Payment processing is handled via secure payment gateways. Renewal and cancellation policies apply as outlined in our Refund Policy.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>6. Contact & Grievances</h4>
              <p>
                For questions regarding these Terms, contact our legal team at{" "}
                <a href="mailto:info@maihoonna.com" style={{ color: "#fe6700", fontWeight: "600" }}>
                  info@maihoonna.com
                </a>
                .
              </p>
            </div>
          )}

          {activeTab === "privacy" && (
            <div>
              <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.8rem" }}>
                Last Updated: January 2026 • MaiHoonNa Eldercare Private Limited
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>1. Information We Collect</h4>
              <p>
                We collect personal information necessary to deliver and coordinate senior care services, including:
              </p>
              <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
                <li>Subscriber and beneficiary names, phone numbers, email addresses, and ages.</li>
                <li>Service addresses, city, and pincodes for Care Mitra matching and dispatch.</li>
                <li>Emergency contact names and phone numbers.</li>
                <li>Health notes, wellness check-in records, and caregiver visit summaries shared voluntarily.</li>
              </ul>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>2. How We Use Your Data</h4>
              <p>
                Your data is strictly used to:
              </p>
              <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
                <li>Schedule and verify Care Mitra companion visits.</li>
                <li>Send OTP authentication codes and visit status alerts via SMS/WhatsApp.</li>
                <li>Trigger emergency notifications to designated family members when requested.</li>
                <li>Improve platform safety, companion training, and service quality.</li>
              </ul>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>3. Data Privacy & Non-Sale of Data</h4>
              <p>
                MaiHoonNa <strong>never sells</strong> your personal or health information to third-party advertisers or data brokers. All data is encrypted in transit (TLS 1.3) and at rest.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>4. Your Rights & Account Deletion</h4>
              <p>
                You may request access to, correction of, or permanent deletion of your personal data at any time through the mobile app settings or by writing to{" "}
                <a href="mailto:support@maihoonna.in" style={{ color: "#fe6700", fontWeight: "600" }}>
                  support@maihoonna.in
                </a>
                .
              </p>
            </div>
          )}

          {activeTab === "refund" && (
            <div>
              <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.8rem" }}>
                Last Updated: January 2026 • MaiHoonNa Eldercare Private Limited
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>1. 7-Day Satisfaction Guarantee</h4>
              <p>
                New subscribers who are not completely satisfied with their initial Care Mitra visit may request a full refund within 7 days of package activation, no questions asked.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>2. Unused Visit Rollovers & Cancellations</h4>
              <p>
                Active subscription visits that cannot be utilized during a billing cycle may roll over up to 60 days. Subscription cancellations take effect at the end of the current billing cycle.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>3. Processing Time</h4>
              <p>
                Approved refunds are processed to the original payment method within 5 to 7 business days.
              </p>
            </div>
          )}

          {activeTab === "cookie" && (
            <div>
              <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.8rem" }}>
                Last Updated: January 2026 • MaiHoonNa Eldercare Private Limited
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>1. Use of Cookies</h4>
              <p>
                We use essential session cookies and local storage to keep you logged in securely and remember your active preferences. We do not use intrusive third-party cross-site tracking cookies.
              </p>

              <h4 style={{ color: "#0f172a", margin: "16px 0 6px" }}>2. Managing Preferences</h4>
              <p>
                You can configure your browser to block or alert you about cookies, though some parts of the portal may not function properly without essential session cookies.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Questions? Contact <a href="mailto:info@maihoonna.com" style={{ color: "#fe6700" }}>info@maihoonna.com</a>
          </span>

          <div style={{ display: "flex", gap: "10px" }}>
            {onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--orange, #fe6700)",
                  color: "#ffffff",
                  fontSize: "0.88rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(254, 103, 0, 0.3)",
                }}
              >
                I Agree & Accept
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "0.88rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
