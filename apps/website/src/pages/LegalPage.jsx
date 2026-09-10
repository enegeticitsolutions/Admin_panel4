import React, { useState, useEffect } from "react";

export default function LegalPage({ initialTab = "terms", setActivePage }) {
  const getTabFromHash = () => {
    const rawHash = (window.location.hash || "").replace("#", "").toLowerCase();
    if (rawHash === "privacy") return "privacy";
    if (rawHash === "refund-policy" || rawHash === "refund") return "refund";
    if (rawHash === "cookie-policy" || rawHash === "cookie") return "cookie";
    return "terms";
  };

  const [activeTab, setActiveTab] = useState(getTabFromHash);

  useEffect(() => {
    setActiveTab(getTabFromHash());
  }, [initialTab]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    const hashMap = {
      terms: "terms",
      privacy: "privacy",
      refund: "refund-policy",
      cookie: "cookie-policy",
    };
    if (hashMap[tabId]) {
      window.location.hash = `#${hashMap[tabId]}`;
    }
  };

  return (
    <div
      className="legal-page-container"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        paddingTop: "110px",
        paddingBottom: "80px",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 24px" }}>
        {/* Breadcrumb & Navigation */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setActivePage ? setActivePage("home") : (window.location.hash = "#home")}
            style={{
              background: "none",
              border: "none",
              color: "var(--orange, #fe6700)",
              fontWeight: "700",
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: 0,
            }}
          >
            ← Back to Home
          </button>
        </div>

        {/* Header Title Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "32px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: "700",
              color: "var(--orange, #fe6700)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            MaiHoonNa Eldercare Legal Center
          </span>
          <h1 style={{ fontSize: "2rem", fontWeight: "800", color: "#0f172a", margin: "6px 0 12px" }}>
            {activeTab === "terms" && "Terms of Service"}
            {activeTab === "privacy" && "Privacy Policy"}
            {activeTab === "refund" && "Refund & Cancellation Policy"}
            {activeTab === "cookie" && "Cookie Policy"}
          </h1>
          <p style={{ fontSize: "0.95rem", color: "#64748b", margin: 0, lineHeight: "1.6" }}>
            Last revised: January 2026. Please read these terms carefully before using MaiHoonNa's senior care services, mobile apps, or digital platforms.
          </p>

          {/* Tab Switcher Pills */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "24px",
              flexWrap: "wrap",
              borderTop: "1px solid #f1f5f9",
              paddingTop: "20px",
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
                onClick={() => handleTabClick(tab.id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: activeTab === tab.id ? "1.5px solid #fe6700" : "1px solid #e2e8f0",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: activeTab === tab.id ? "#fe6700" : "#ffffff",
                  color: activeTab === tab.id ? "#ffffff" : "#475569",
                  boxShadow: activeTab === tab.id ? "0 4px 12px rgba(254, 103, 0, 0.25)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "36px 32px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            color: "#334155",
            fontSize: "0.95rem",
            lineHeight: "1.75",
          }}
        >
          {activeTab === "terms" && (
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: 0, marginBottom: "10px" }}>
                1. Acceptance of Terms & Services
              </h2>
              <p>
                By registering on or using the MaiHoonNa mobile application or website, you agree to comply with and be bound by these Terms of Service. These terms apply to all subscribers, senior beneficiaries, family members, and visitors.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                2. Nature of Elder Care & Companion Services
              </h2>
              <p>
                MaiHoonNa provides non-medical senior companionship, recurring home visits through verified Care Mitras, vitals logging, social interaction circles (Saathi Network), and family visibility tracking.
              </p>
              <p>
                <strong>Important Notice:</strong> MaiHoonNa is not an emergency hospital or emergency medical room. Our Care Mitras provide non-medical companionship and assistance. In case of acute medical emergencies, our platform helps trigger designated family contacts and public emergency emergency lines.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                3. User Account Security & Authentication
              </h2>
              <p>
                You must be at least 18 years of age to register as a subscriber. You are responsible for ensuring that all beneficiary information, contact phone numbers, and address details submitted under your profile are accurate and up to date.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                4. Code of Conduct & Safety
              </h2>
              <p>
                All Care Mitras are background-verified and trained. We maintain a zero-tolerance policy against any form of harassment, discrimination, or unsafe working conditions during companion visits.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                5. Subscriptions, Payments & Billing
              </h2>
              <p>
                Subscriptions are billed according to the chosen package duration (monthly, quarterly, or annually). All online payments are encrypted and processed through certified RBI-compliant payment gateways.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                6. Contact & Grievance Officer
              </h2>
              <p>
                For questions, clarifications, or grievances regarding these terms, please contact our support team at{" "}
                <a href="mailto:info@maihoonna.com" style={{ color: "#fe6700", fontWeight: "700" }}>
                  info@maihoonna.com
                </a>
                .
              </p>
            </div>
          )}

          {activeTab === "privacy" && (
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: 0, marginBottom: "10px" }}>
                1. Information We Collect
              </h2>
              <p>
                To provide safe and personalized elder care services, MaiHoonNa collects information including:
              </p>
              <ul style={{ paddingLeft: "24px", margin: "12px 0" }}>
                <li><strong>Account Information:</strong> Full name, phone number, email address, and age of subscribers and beneficiaries.</li>
                <li><strong>Service Addresses:</strong> House/flat number, landmark, area, city, and pincode for accurate companion dispatch.</li>
                <li><strong>Emergency Contacts:</strong> Names, relationships, and emergency phone numbers designated by family members.</li>
                <li><strong>Health & Activity Notes:</strong> Daily wellness check-in summaries, visit feedback, and activity logs.</li>
              </ul>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                2. How We Use Your Data
              </h2>
              <p>
                We use your data solely to:
              </p>
              <ul style={{ paddingLeft: "24px", margin: "12px 0" }}>
                <li>Authenticate your login and verify mobile OTPs securely without requiring passwords.</li>
                <li>Coordinate, dispatch, and track Care Mitra senior visits.</li>
                <li>Deliver real-time visit reports and emergency SOS notifications to family members.</li>
                <li>Maintain safety and service compliance across all visits.</li>
              </ul>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                3. Privacy Protection & Non-Disclosure
              </h2>
              <p>
                MaiHoonNa <strong>does not sell, rent, or trade</strong> your personal or health data to third-party marketing companies or advertisers. Data is stored on secure cloud servers with end-to-end encryption in transit (TLS 1.3) and at rest.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                4. Account & Data Deletion Rights
              </h2>
              <p>
                You retain complete ownership of your data. You may request profile updates or permanent account deletion at any time directly through the mobile app settings or by writing to{" "}
                <a href="mailto:support@maihoonna.in" style={{ color: "#fe6700", fontWeight: "700" }}>
                  support@maihoonna.in
                </a>
                .
              </p>
            </div>
          )}

          {activeTab === "refund" && (
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: 0, marginBottom: "10px" }}>
                1. 7-Day Satisfaction Guarantee
              </h2>
              <p>
                We stand behind our senior care companions. If you are not satisfied after your senior's first Care Mitra visit, you may request a 100% refund within 7 days of package activation.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                2. Unused Visit Rollovers
              </h2>
              <p>
                Unused visits from active subscriptions automatically roll over up to 60 days so your family never loses paid care time.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                3. Refund Processing
              </h2>
              <p>
                Refunds are credited back to the original payment source (UPI, Card, or Net Banking) within 5-7 business days.
              </p>
            </div>
          )}

          {activeTab === "cookie" && (
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: 0, marginBottom: "10px" }}>
                1. Essential Session Cookies
              </h2>
              <p>
                We use secure, first-party authentication tokens and essential cookies to maintain your login session and language preferences.
              </p>

              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginTop: "24px", marginBottom: "10px" }}>
                2. No Invasive Tracking
              </h2>
              <p>
                MaiHoonNa does not employ intrusive cross-website behavioral advertising cookies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
