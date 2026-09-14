import React from "react";

/**
 * NotFoundPage Component - SEO-friendly 404 Error Page
 */
const NotFoundPage = ({ setActivePage }) => {
  return (
    <main className="not-found-page" style={{ padding: "120px 24px 96px", textAlign: "center", minHeight: "65vh", background: "#FAFBFD" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <span
          style={{
            display: "inline-block",
            padding: "6px 16px",
            borderRadius: "50px",
            background: "rgba(254, 103, 0, 0.12)",
            color: "#FE6700",
            fontWeight: "700",
            fontSize: "13px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: "16px"
          }}
        >
          404 Error
        </span>

        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "36px", fontWeight: "800", color: "#111111", margin: "0 0 16px" }}>
          Page Not Found
        </h1>

        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "16px", lineHeight: "26px", color: "#666666", margin: "0 0 32px" }}>
          The page you are looking for might have been removed, renamed, or is temporarily unavailable. Let us guide you back to MaiHoonNa's senior care platform.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "40px" }}>
          <button
            onClick={() => setActivePage("home")}
            style={{
              padding: "12px 24px",
              borderRadius: "50px",
              background: "#FE6700",
              color: "#FFFFFF",
              fontWeight: "700",
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(254, 103, 0, 0.25)"
            }}
          >
            🏠 Return to Homepage
          </button>
          <button
            onClick={() => setActivePage("services")}
            style={{
              padding: "12px 24px",
              borderRadius: "50px",
              background: "#FFFFFF",
              color: "#333333",
              fontWeight: "600",
              fontSize: "14px",
              border: "1.5px solid #E5E5E5",
              cursor: "pointer"
            }}
          >
            Explore Services
          </button>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
