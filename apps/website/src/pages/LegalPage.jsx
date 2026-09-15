import React, { useState, useEffect } from "react";
import { fetchLegalPolicies } from "../services/api";

// Maps database policy slugs to clean public routes
const TAB_TO_ROUTE_MAP = {
  terms: "terms",
  privacy: "privacy",
  refund: "refund-policy",
  cookie: "cookie-policy",
  "child-safety": "child-safety",
  "saathi-tc": "saathi-tc",
};

// Maps incoming routes/aliases to database policy slugs
const ROUTE_TO_TAB_MAP = {
  terms: "terms",
  "terms-of-service": "terms",
  privacy: "privacy",
  "privacy-policy": "privacy",
  refund: "refund",
  "refund-policy": "refund",
  cookie: "cookie",
  "cookie-policy": "cookie",
  cookies: "cookie",
  "child-safety": "child-safety",
  "child-safety-policy": "child-safety",
  "child-policy": "child-safety",
  "saathi-tc": "saathi-tc",
  "saathi-terms": "saathi-tc",
  saathi: "saathi-tc",
};

export default function LegalPage({ initialTab = "terms", setActivePage }) {
  const normalizeTab = (raw) => {
    const clean = (raw || "").toLowerCase().replace(/^[#/]+|[#/]+$/g, "");
    return ROUTE_TO_TAB_MAP[clean] || "terms";
  };

  const [activeTab, setActiveTab] = useState(() => normalizeTab(initialTab));
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPolicies = () => {
    setLoading(true);
    setError(null);
    fetchLegalPolicies()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPolicies(data);
        } else {
          setError("No legal policies found in the database.");
        }
      })
      .catch((err) => {
        console.error("Error loading policies from database:", err);
        setError("Failed to load legal policies. Please check backend connection.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  // Synchronize active tab whenever initialTab prop changes (e.g., direct navigation, footer link, browser back/forward)
  useEffect(() => {
    setActiveTab(normalizeTab(initialTab));
  }, [initialTab]);

  const handleTabClick = (tabSlug) => {
    setActiveTab(tabSlug);
    const targetRoute = TAB_TO_ROUTE_MAP[tabSlug] || tabSlug;
    if (setActivePage) {
      setActivePage(targetRoute);
    } else {
      try {
        window.history.pushState(null, "", `/${targetRoute}`);
      } catch (e) {
        window.location.pathname = `/${targetRoute}`;
      }
    }
  };

  // Find currently active policy object from database rows
  const currentPolicy =
    policies.find((p) => p.slug === activeTab) ||
    policies[0] ||
    null;

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
      <div style={{ maxWidth: "880px", margin: "0 auto", padding: "0 24px" }}>
        {/* Breadcrumb & Navigation */}
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => (setActivePage ? setActivePage("home") : (window.location.pathname = "/"))}
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

        {/* Loading State */}
        {loading ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "48px 32px",
              textAlign: "center",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid #f1f5f9",
                borderTop: "3px solid #fe6700",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>Loading legal policies from database...</p>
            <style>
              {`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .legal-html-content h1, .legal-html-content h2 { font-size: 1.22rem; font-weight: 800; color: #0f172a; margin-top: 24px; margin-bottom: 10px; }
                .legal-html-content h1:first-child { margin-top: 0; }
                .legal-html-content p { margin-bottom: 14px; }
                .legal-html-content ul { padding-left: 24px; margin: 12px 0; }
                .legal-html-content li { margin-bottom: 6px; }
                .legal-html-content table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e2e8f0; }
                .legal-html-content td, .legal-html-content th { border: 1px solid #e2e8f0; padding: 12px 16px; vertical-align: top; }
                .legal-html-content th { background: #f8fafc; font-weight: 700; color: #0f172a; text-align: left; }
                .legal-html-content td strong, .legal-html-content th strong { font-weight: 700; }
              `}
            </style>
          </div>
        ) : error ? (
          /* Error State */
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "40px 32px",
              textAlign: "center",
              border: "1px solid #fee2e2",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            }}
          >
            <p style={{ color: "#ef4444", fontWeight: "600", marginBottom: "16px" }}>{error}</p>
            <button
              onClick={loadPolicies}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#fe6700",
                color: "#ffffff",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : currentPolicy ? (
          /* Main Content Rendered Directly From Database */
          <>
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

              <h1 style={{ fontSize: "2rem", fontWeight: "800", color: "#0f172a", margin: "6px 0 10px" }}>
                {currentPolicy.title}
              </h1>

              <p style={{ fontSize: "0.95rem", color: "#64748b", margin: 0, lineHeight: "1.6" }}>
                {currentPolicy.summary ||
                  `Last revised: ${currentPolicy.lastUpdated || "January 2026"}. Please read these terms carefully before using MaiHoonNa's senior care services, mobile apps, or digital platforms.`}
              </p>

              {/* Meta Details Pills (Effective Date, Operated by) */}
              {(currentPolicy.effectiveDate || currentPolicy.operatedBy) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "16px",
                    fontSize: "0.82rem",
                    color: "#475569",
                  }}
                >
                  {currentPolicy.effectiveDate && (
                    <div style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: "8px" }}>
                      <strong>Effective:</strong> {currentPolicy.effectiveDate}
                      {currentPolicy.lastUpdated && currentPolicy.lastUpdated !== currentPolicy.effectiveDate && (
                        <span> • <strong>Updated:</strong> {currentPolicy.lastUpdated}</span>
                      )}
                    </div>
                  )}
                  {currentPolicy.operatedBy && (
                    <div style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: "8px" }}>
                      <strong>Operated by:</strong> {currentPolicy.operatedBy}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Database Tabs */}
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
                {policies.map((tab) => {
                  const isSelected = activeTab === tab.slug;
                  return (
                    <button
                      key={tab.slug}
                      type="button"
                      onClick={() => handleTabClick(tab.slug)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "12px",
                        border: isSelected ? "1.5px solid #fe6700" : "1px solid #e2e8f0",
                        fontSize: "0.88rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        background: isSelected ? "#fe6700" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#475569",
                        boxShadow: isSelected ? "0 4px 12px rgba(254, 103, 0, 0.25)" : "none",
                      }}
                    >
                      {tab.tabLabel || tab.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Policy Content Card */}
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
              {Array.isArray(currentPolicy.sections) && currentPolicy.sections.length > 0 ? (
                currentPolicy.sections.map((section, idx) => (
                  <div key={section.id || idx} style={{ marginBottom: idx < currentPolicy.sections.length - 1 ? "28px" : "0" }}>
                    {section.title && (
                      <h2
                        style={{
                          fontSize: "1.22rem",
                          fontWeight: "800",
                          color: "#0f172a",
                          marginTop: idx === 0 ? 0 : "24px",
                          marginBottom: "10px",
                        }}
                      >
                        {section.title}
                      </h2>
                    )}

                    {section.content && section.isHtml ? (
                      <div 
                        className="legal-html-content"
                        style={{ color: "#334155" }}
                        dangerouslySetInnerHTML={{ __html: section.content }} 
                      />
                    ) : section.content && (
                      <div style={{ whiteSpace: "pre-line", color: "#334155" }}>
                        {section.content}
                      </div>
                    )}

                    {/* Bullet list items if provided in DB */}
                    {Array.isArray(section.listItems) && section.listItems.length > 0 && (
                      <ul style={{ paddingLeft: "24px", margin: "12px 0" }}>
                        {section.listItems.map((item, itemIdx) => (
                          <li key={itemIdx} style={{ marginBottom: "6px" }}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Callout / Warning box from DB */}
                    {section.callout && (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "14px 18px",
                          borderRadius: "12px",
                          background: section.callout.includes("⚠️") || section.callout.includes("violate") ? "#fffbeb" : "#fff7ed",
                          borderLeft: section.callout.includes("⚠️") || section.callout.includes("violate") ? "4px solid #f59e0b" : "4px solid #fe6700",
                          color: "#1e293b",
                          fontSize: "0.92rem",
                          fontWeight: "500",
                          lineHeight: "1.6",
                        }}
                      >
                        {section.callout}
                      </div>
                    )}

                    {/* Direct contact link if specified */}
                    {section.contactEmail && (
                      <div style={{ marginTop: "8px" }}>
                        <a
                          href={`mailto:${section.contactEmail}`}
                          style={{ color: "var(--orange, #fe6700)", fontWeight: "700", textDecoration: "underline" }}
                        >
                          {section.contactEmail}
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ color: "#64748b" }}>Policy details are currently being updated.</p>
              )}

              {/* Footer Note from DB */}
              {currentPolicy.footerNote && (
                <div
                  style={{
                    marginTop: "36px",
                    paddingTop: "24px",
                    borderTop: "1px solid #f1f5f9",
                    fontSize: "0.85rem",
                    color: "#64748b",
                    whiteSpace: "pre-line",
                    lineHeight: "1.6",
                  }}
                >
                  {currentPolicy.footerNote}
                </div>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: "#64748b", textAlign: "center" }}>No policy selected.</p>
        )}
      </div>
    </div>
  );
}
