import React, { useEffect, useState } from "react";
import { fetchSubscriberDashboard } from "../../services/api";

export default function UserAccountModal({ isOpen, onClose, user, token, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      setLoading(true);
      fetchSubscriberDashboard(token)
        .then((data) => setDashboard(data))
        .catch((err) => console.error("Failed to load dashboard:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const activeSubscription = dashboard?.subscription || dashboard?.activeSubscription;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1000 }}>
      <div className="modal-card" style={{ maxWidth: "480px", padding: "28px" }}>
        <button onClick={onClose} className="modal-close" aria-label="Close user profile">
          ✕
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "var(--orange, #fe6700)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              fontWeight: "700",
            }}
          >
            {(user?.name || "U")[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", margin: 0, color: "#111827" }}>
              {user?.name || "Subscriber Account"}
            </h2>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "2px" }}>
              +91 {user?.phone?.replace(/\D/g, "").slice(-10)}
            </div>
          </div>
        </div>

        {/* Dashboard Status */}
        <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: "700", textTransform: "uppercase", color: "#6b7280", marginBottom: "8px" }}>
            Active Subscription
          </div>

          {loading ? (
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Loading account status...</div>
          ) : activeSubscription ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1rem", fontWeight: "700", color: "#111827" }}>
                  {activeSubscription.package?.name || activeSubscription.packageName || "Care Plan"}
                </span>
                <span style={{ padding: "4px 10px", borderRadius: "12px", background: "#dcfce7", color: "#15803d", fontSize: "0.75rem", fontWeight: "700" }}>
                  {activeSubscription.status?.toUpperCase() || "ACTIVE"}
                </span>
              </div>
              {activeSubscription.beneficiaryId && activeSubscription.expiresAt ? (
                <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "4px" }}>
                  Valid until: {new Date(activeSubscription.expiresAt).toLocaleDateString("en-IN")}
                </div>
              ) : !activeSubscription.beneficiaryId ? (
                <div style={{ fontSize: "0.8rem", color: "#c2410c", marginTop: "4px", fontWeight: "600" }}>
                  ⏳ Validity activates once assigned to a beneficiary
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
              No active subscription found. Explore our plans to start Care Mitra visits.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#991b1b",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
            }}
          >
            Log Out
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: "#374151",
              color: "#ffffff",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
