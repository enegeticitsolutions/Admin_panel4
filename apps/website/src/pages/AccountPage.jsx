import React, { useEffect, useState } from "react";
import { fetchSubscriberDashboard, fetchSubscriberInvoices } from "../services/api";
import InvoiceModal from "../components/modals/InvoiceModal";

export default function AccountPage({ user, token, onLogout, onNavigateToPlans, onGoHome }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchSubscriberDashboard(token)
        .then((data) => setDashboard(data))
        .catch((err) => console.error("Failed to load subscriber dashboard:", err))
        .finally(() => setLoading(false));

      setInvoicesLoading(true);
      fetchSubscriberInvoices(token)
        .then((data) => setInvoices(Array.isArray(data) ? data : data?.invoices || []))
        .catch((err) => console.error("Failed to load subscriber invoices:", err))
        .finally(() => setInvoicesLoading(false));
    }
  }, [token]);

  // All active subscriptions (same field the mobile app uses)
  const allSubscriptions = dashboard?.activeSubscriptions || [];
  // Subscriptions not yet linked to a beneficiary
  const unlinkedSubs = allSubscriptions.filter((sub) => !sub.beneficiaryId);
  // Subscriptions assigned to a beneficiary
  const linkedSubs = allSubscriptions.filter((sub) => !!sub.beneficiaryId);

  // Also check old dashboard shape for backward compatibility
  const legacyActiveSub = dashboard?.subscription || dashboard?.activeSubscription;
  const hasAnySub = allSubscriptions.length > 0 || !!legacyActiveSub;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Poppins', sans-serif", paddingTop: "120px", paddingBottom: "60px" }}>
      {/* ── Main Dashboard Body ── */}
      <main className="account-page-main" style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 24px" }}>

        {/* Profile Card */}
        <div className="account-profile-card" style={{
          background: "#ffffff", borderRadius: "20px", padding: "32px",
          border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "16px",
          marginBottom: "32px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              background: "linear-gradient(135deg, #fe6700 0%, #ff8533 100%)",
              color: "#ffffff", fontSize: "1.8rem", fontWeight: "800",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(254,103,0,0.3)",
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : "👤"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.6rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                  {user?.name || "Subscriber"}
                </h1>
                <span style={{
                  padding: "4px 10px", borderRadius: "12px",
                  background: "#ffedd5", color: "#c2410c",
                  fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase",
                }}>
                  {user?.role || "Subscriber"}
                </span>
              </div>
              <p style={{ fontSize: "0.95rem", color: "#64748b", margin: "4px 0 0" }}>
                +91 {user?.phone ? String(user.phone).replace(/\D/g, "").slice(-10) : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button onClick={onNavigateToPlans} style={{
              padding: "12px 24px", borderRadius: "12px",
              background: "#fe6700", color: "#ffffff",
              fontWeight: "700", fontSize: "0.95rem",
              border: "none", cursor: "pointer",
              boxShadow: "0 4px 12px rgba(254,103,0,0.25)",
              transition: "transform 0.15s ease",
            }}>
              Explore &amp; Upgrade Plans
            </button>
            <button onClick={onLogout} style={{
              padding: "12px 18px", borderRadius: "12px",
              background: "#fef2f2", color: "#991b1b",
              border: "1px solid #fecaca", fontWeight: "700",
              fontSize: "0.9rem", cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              Log Out
            </button>
          </div>
        </div>

        {/* ── Subscriptions Section ── */}
        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
            Your Care Plans
          </h2>

          {loading ? (
            <div style={{
              background: "#ffffff", padding: "40px", borderRadius: "16px",
              textAlign: "center", color: "#64748b", border: "1px solid #e2e8f0",
            }}>
              Loading your subscriptions...
            </div>
          ) : hasAnySub ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Render all activeSubscriptions from dashboard/me */}
              {allSubscriptions.map((sub, idx) => {
                const isLinked = !!sub.beneficiaryId;
                const pkgName = sub.package?.name || sub.packageName || sub.packageType || "Care Plan";
                const beneficiaryName = sub.beneficiary?.name || sub.beneficiaryName || null;
                const startDate = sub.startDate ? new Date(sub.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
                const endDate = sub.endDate ? new Date(sub.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

                return (
                  <div key={sub.id || idx} style={{
                    background: "#ffffff", borderRadius: "20px", padding: "24px 28px",
                    border: `1.5px solid ${isLinked ? "#bbf7d0" : "#fed7aa"}`,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flex: 1 }}>
                      {/* Icon */}
                      <div style={{
                        width: "48px", height: "48px", borderRadius: "14px",
                        background: isLinked ? "#dcfce7" : "#fff7ed",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.4rem", flexShrink: 0,
                      }}>
                        {isLinked ? "✅" : "⏳"}
                      </div>

                      <div>
                        {/* Assigned / Unassigned badge */}
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px", borderRadius: "20px",
                          fontSize: "0.72rem", fontWeight: "800",
                          letterSpacing: "0.4px", textTransform: "uppercase",
                          marginBottom: "6px",
                          background: isLinked ? "#dcfce7" : "#fff7ed",
                          color: isLinked ? "#166534" : "#c2410c",
                          border: `1px solid ${isLinked ? "#86efac" : "#fdba74"}`,
                        }}>
                          {isLinked
                            ? `✓ Assigned to ${beneficiaryName || "Beneficiary"}`
                            : "⚠ Unassigned — Enroll a Beneficiary"}
                        </span>

                        <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "#0f172a" }}>
                          {pkgName}
                        </div>

                        {(startDate || endDate) && (
                          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "4px" }}>
                            {startDate && <span>From {startDate}</span>}
                            {startDate && endDate && <span> · </span>}
                            {endDate && <span>Expires {endDate}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action area */}
                    {!isLinked && (
                      <div style={{
                        padding: "10px 20px", borderRadius: "12px",
                        background: "#fff7ed",
                        border: "1.5px dashed #fb923c",
                        fontSize: "0.84rem", color: "#9a3412",
                        fontWeight: "600", textAlign: "center",
                        maxWidth: "240px",
                      }}>
                        📱 Open the <strong>MaiHoonNa App</strong> to enroll your senior beneficiary
                      </div>
                    )}
                    {isLinked && (
                      <div style={{
                        padding: "10px 20px", borderRadius: "12px",
                        background: "#f0fdf4",
                        border: "1.5px solid #86efac",
                        fontSize: "0.84rem", color: "#166534",
                        fontWeight: "600", textAlign: "center",
                      }}>
                        Active ✓<br />
                        <span style={{ fontWeight: "500", fontSize: "0.78rem" }}>Track in MaiHoonNa App</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legacy single subscription (backward compat) */}
              {allSubscriptions.length === 0 && legacyActiveSub && (
                <div style={{
                  background: "#ffffff", borderRadius: "20px", padding: "24px 28px",
                  border: "1.5px solid #bbf7d0",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: "20px", fontSize: "0.72rem",
                      fontWeight: "800", textTransform: "uppercase",
                      background: "#dcfce7", color: "#166534", border: "1px solid #86efac",
                    }}>✓ Active Plan</span>
                  </div>
                  <div style={{ fontWeight: "800", fontSize: "1.1rem", color: "#0f172a" }}>
                    {legacyActiveSub.packageName || legacyActiveSub.package?.name || "Senior Care Plan"}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* No subscriptions at all */
            <div style={{
              background: "#ffffff", padding: "48px 40px", borderRadius: "20px",
              textAlign: "center", border: "1px dashed #cbd5e1",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📋</div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#0f172a", margin: "0 0 6px" }}>
                No Active Subscriptions Found
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem", maxWidth: "440px", margin: "0 auto 20px" }}>
                Subscribe to a Senior Care plan to connect your family with verified Care Mitras.
              </p>
              <button onClick={onNavigateToPlans} style={{
                padding: "12px 24px", borderRadius: "12px",
                background: "#fe6700", color: "#ffffff",
                fontWeight: "700", fontSize: "0.95rem",
                border: "none", cursor: "pointer",
              }}>
                Browse Plans Now
              </button>
            </div>
          )}
        </div>

        {/* ── Billing & Tax Invoices Section ── */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                Billing &amp; Tax Invoices
              </h2>
              {invoices.length > 0 && (
                <span style={{
                  background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                  fontSize: "0.75rem", fontWeight: "700", padding: "2px 8px", borderRadius: "10px"
                }}>
                  {invoices.length} {invoices.length === 1 ? "Bill" : "Bills"}
                </span>
              )}
            </div>
          </div>

          {invoicesLoading ? (
            <div style={{
              background: "#ffffff", padding: "32px", borderRadius: "16px",
              textAlign: "center", color: "#64748b", border: "1px solid #e2e8f0", fontSize: "0.9rem"
            }}>
              Loading your invoices...
            </div>
          ) : invoices.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {invoices.map((inv) => {
                const issuedDate = inv.issuedAt
                  ? new Date(inv.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : "—";
                const isPaid = (inv.status || "").toUpperCase() === "PAID";
                const benName = inv.beneficiary?.name;

                return (
                  <div key={inv.id} style={{
                    background: "#ffffff", borderRadius: "16px", padding: "20px 24px",
                    border: "1px solid #e2e8f0", boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{
                        width: "42px", height: "42px", borderRadius: "12px",
                        background: isPaid ? "#ecfdf5" : "#fffbeb",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", flexShrink: 0,
                      }}>
                        🧾
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "800", fontSize: "1rem", color: "#0f172a" }}>
                            {inv.invoiceNumber}
                          </span>
                          <span style={{
                            fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase",
                            padding: "2px 8px", borderRadius: "8px",
                            background: isPaid ? "#dcfce7" : "#fef3c7",
                            color: isPaid ? "#166534" : "#92400e",
                            border: `1px solid ${isPaid ? "#86efac" : "#fde68a"}`
                          }}>
                            {inv.status || "PAID"}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "3px" }}>
                          {inv.invoiceType || "Subscription"} · {issuedDate}
                          {benName && <span> · 👤 {benName}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#0f172a" }}>
                          ₹{Number(inv.totalAmount || 0).toFixed(2)}
                        </div>
                        {Number(inv.taxAmount) > 0 && (
                          <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                            incl. ₹{Number(inv.taxAmount).toFixed(2)} GST
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedInvoiceId(inv.id);
                          setShowInvoiceModal(true);
                        }}
                        style={{
                          padding: "8px 16px", borderRadius: "10px",
                          background: "#ffffff", border: "1.5px solid #fe6700",
                          color: "#fe6700", fontWeight: "700", fontSize: "0.85rem",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        📄 View Invoice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              background: "#ffffff", padding: "28px", borderRadius: "16px",
              textAlign: "center", color: "#94a3b8", border: "1px dashed #cbd5e1", fontSize: "0.9rem"
            }}>
              No billing records found for this account.
            </div>
          )}
        </div>

        {/* ── Stats row (if available) ── */}
        {dashboard?.topStats && (
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginBottom: "16px" }}>
              Care Activity Overview
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
              {[
                { label: "Active Hours Used", value: `${dashboard.topStats.activeHours?.used ?? 0}h` },
                { label: "Hours Remaining", value: `${dashboard.topStats.activeHours?.remaining ?? 0}h` },
                { label: "Visits This Week", value: dashboard.topStats.visitsThisWeek?.total ?? 0 },
                { label: "Total Care Plans", value: dashboard.topStats.totalCarePlans ?? allSubscriptions.length },
              ].map((stat) => (
                <div key={stat.label} style={{
                  background: "#ffffff", padding: "20px", borderRadius: "16px",
                  border: "1px solid #e2e8f0", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#fe6700" }}>{stat.value}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Statutory GST Invoice Preview & Print Modal */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoiceId(null);
        }}
        invoiceId={selectedInvoiceId}
        token={token}
      />
    </div>
  );
}
