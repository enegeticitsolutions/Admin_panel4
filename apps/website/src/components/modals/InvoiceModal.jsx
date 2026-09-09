import React, { useState, useEffect } from "react";
import { fetchInvoiceHtml } from "../../services/api";

export default function InvoiceModal({ isOpen, onClose, invoiceId, token }) {
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setHtmlContent("");
      setError("");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    fetchInvoiceHtml(token, invoiceId)
      .then((html) => {
        if (isMounted) {
          setHtmlContent(html);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load invoice preview.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, token]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const iframe = document.getElementById("invoice-print-frame");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: "920px",
          height: "90vh",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.25rem" }}>📄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: "#0f172a" }}>
                Official GST Tax Invoice
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                Invoice Ref: {invoiceId}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "10px",
                background: "#fe6700",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: "600",
                border: "none",
                cursor: loading || !!error ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(254, 103, 0, 0.3)",
              }}
            >
              🖨️ Print / Download PDF
            </button>
            <button
              onClick={onClose}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, position: "relative", background: "#f1f5f9" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                background: "rgba(255, 255, 255, 0.9)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid #e2e8f0",
                  borderTopColor: "#fe6700",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>
                Generating statutory invoice preview...
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#ef4444",
                background: "#ffffff",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚠️</div>
              <p style={{ fontWeight: "600", margin: 0 }}>{error}</p>
              <button
                onClick={onClose}
                style={{
                  marginTop: "16px",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "#e2e8f0",
                  border: "none",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          )}

          {htmlContent && !loading && (
            <iframe
              id="invoice-print-frame"
              title="Tax Invoice"
              srcDoc={htmlContent}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "#ffffff",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
