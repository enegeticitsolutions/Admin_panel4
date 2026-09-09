import React, { useState, useEffect, useRef } from "react";
import { validateCouponCode, createRazorpayOrder, purchaseSubscription, fetchCheckoutPreview } from "../services/api";
import InvoiceModal from "../components/modals/InvoiceModal";
import logo from "../assets/logo.svg";

const fallbackPackage = {
  id: "gold",
  type: "GOLD",
  name: "Senior Care Plan",
  basePrice: 4999,
  price: 4999,
  discountThreeMonths: 5,
  discountSixMonths: 10,
  discountAnnual: 20,
};

function formatUnitDisplay(units, rawUnitLabel) {
  if (!units) return "";
  if (!rawUnitLabel) return `Units: ${units}`;
  const clean = String(rawUnitLabel).replace(/^per\s+/i, "").trim().toLowerCase();
  let type = clean;
  if (clean === "hour") type = units === 1 ? "Hour" : "Hours";
  else if (clean === "visit") type = units === 1 ? "Visit" : "Visits";
  else if (clean === "session") type = units === 1 ? "Session" : "Sessions";
  else if (clean === "test") type = units === 1 ? "Test" : "Tests";
  else if (clean === "day") type = units === 1 ? "Day" : "Days";
  else if (clean === "month") type = units === 1 ? "Month" : "Months";
  else {
    const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
    type = units > 1 && !cap.endsWith("s") ? `${cap}s` : cap;
  }
  return `Units: ${units} ${type}`;
}

// Dynamically load the Razorpay checkout.js script
function useRazorpayScript() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.Razorpay) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError("Failed to load Razorpay. Please check your internet connection.");
    document.body.appendChild(script);

    return () => {
      // Don't remove — leave cached for subsequent uses
    };
  }, []);

  return { loaded, error };
}

export default function CheckoutPage({ selectedPackage, token, user, onSuccess, onGoBack }) {
  const { loaded: razorpayLoaded, error: razorpayError } = useRazorpayScript();
  const pkg = selectedPackage || fallbackPackage;

  const [duration, setDuration] = useState(String(selectedPackage?.selectedCycle || "1"));
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Authoritative server-side benefit pricing & GST breakdown
  const [serverPricing, setServerPricing] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  // Payment execution state: 'idle' | 'creating_order' | 'gateway_open' | 'verifying'
  const [paymentStage, setPaymentStage] = useState("idle");
  const isPaymentBusy = paymentStage !== "idle";
  const paymentLockRef = useRef(false);

  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const baseMonthlyPrice = pkg.basePrice || pkg.price || 4999;

  const calcDurationPricing = () => {
    const durNum = parseInt(duration, 10);
    let rawTotal = baseMonthlyPrice * durNum;
    let discPct = 0;

    if (durNum === 3) {
      discPct = pkg.discountThreeMonths ?? 5;
      if (pkg.priceThreeMonths) return { total: pkg.priceThreeMonths, discountPct: discPct, durationMonths: 3 };
    } else if (durNum === 6) {
      discPct = pkg.discountSixMonths ?? 10;
      if (pkg.priceSixMonths) return { total: pkg.priceSixMonths, discountPct: discPct, durationMonths: 6 };
    } else if (durNum === 12) {
      discPct = pkg.discountAnnual ?? 20;
      if (pkg.priceTwelveMonths) return { total: pkg.priceTwelveMonths, discountPct: discPct, durationMonths: 12 };
    }

    const calculatedTotal = Math.round(rawTotal * (1 - discPct / 100));
    return { total: calculatedTotal, discountPct: discPct, durationMonths: durNum };
  };

  const pricing = calcDurationPricing();

  // Authoritative server-side fetch on duration or coupon change
  useEffect(() => {
    let isMounted = true;
    setLoadingPricing(true);
    fetchCheckoutPreview(token, {
      packageId: pkg.id || pkg.type,
      durationMonths: parseInt(duration, 10) || 1,
      couponCode: appliedCoupon ? couponCode.trim() : undefined,
    })
      .then((res) => {
        if (isMounted) {
          setServerPricing(res);
        }
      })
      .catch((err) => {
        console.error("Failed to load server checkout pricing preview:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingPricing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pkg.id, pkg.type, duration, appliedCoupon, token]);

  // Final Total from authoritative server or local fallback
  const finalTotal = serverPricing ? serverPricing.total : (appliedCoupon?.finalAmount ?? pricing.total);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (isPaymentBusy) return;
    setCouponError("");
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const result = await validateCouponCode(token, couponCode.trim(), pkg.id || pkg.type, pricing.total);
      setAppliedCoupon(result); // { couponId, discountApplied, finalAmount }
    } catch (err) {
      setCouponError(err.message || "Invalid coupon code.");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const unlockPayment = () => {
    paymentLockRef.current = false;
    setPaymentStage("idle");
  };

  const handlePay = async () => {
    // Prevent double clicking / concurrent executions
    if (paymentLockRef.current || isPaymentBusy) {
      return;
    }

    setPurchaseError("");

    if (!razorpayLoaded || !window.Razorpay) {
      setPurchaseError("Razorpay payment gateway is still loading. Please wait a moment and try again.");
      return;
    }

    // Lock payment execution
    paymentLockRef.current = true;
    setPaymentStage("creating_order");

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_live_TZ3KKOCt6TIiSt";

    // Step 1: Create a real Razorpay order from backend
    let orderData = null;
    try {
      orderData = await createRazorpayOrder(
        token,
        pkg.id || pkg.type,
        appliedCoupon ? couponCode.trim() : undefined,
        pricing.durationMonths
      );
    } catch (err) {
      console.warn("[Razorpay] Backend order creation failed — proceeding without order_id:", err.message);
    }

    // Step 2: Open official Razorpay Checkout popup
    setPaymentStage("gateway_open");

    const options = {
      key: orderData?.key_id || razorpayKey,
      amount: orderData ? orderData.amount : Math.round(finalTotal * 100),
      currency: orderData ? orderData.currency : "INR",
      name: "MaiHoonNa Care Technologies",
      description: `${pkg.name} — ${pricing.durationMonths} Month${pricing.durationMonths > 1 ? "s" : ""}`,
      image: window.location.origin + "/logo.svg",
      prefill: {
        name: user?.name || "",
        contact: user?.phone ? String(user.phone).replace(/\D/g, "").slice(-10) : "",
        email: user?.email || "",
      },
      theme: { color: "#fe6700" },
      handler: async function (response) {
        // Payment was successful in Razorpay modal
        setPaymentStage("verifying");
        try {
          const res = await purchaseSubscription(token, {
            packageId: pkg.id || pkg.type,
            durationMonths: pricing.durationMonths,
            couponCode: appliedCoupon ? couponCode.trim() : undefined,
            beneficiaryData: null,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
          setPurchaseSuccess(res);
          unlockPayment();
          if (onSuccess) onSuccess(res);
        } catch (err) {
          setPurchaseError(err.message || "Payment succeeded but subscription activation failed. Please contact support.");
          unlockPayment();
        }
      },
      modal: {
        ondismiss: () => {
          unlockPayment();
        },
      },
    };

    if (orderData?.order_id) {
      options.order_id = orderData.order_id;
    }

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setPurchaseError(
          response.error?.description || "Payment failed. Please try a different payment method."
        );
        unlockPayment();
      });
      rzp.open();
    } catch (err) {
      setPurchaseError("Unable to open payment gateway. Please try again.");
      unlockPayment();
    }
  };

  /* ──────────────────────────── RENDER ──────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <header className="checkout-page-header" style={{
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "16px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <button 
          onClick={onGoBack} 
          disabled={isPaymentBusy}
          style={{ 
            background: "none", 
            border: "none", 
            fontSize: "0.95rem", 
            fontWeight: "700", 
            color: isPaymentBusy ? "#94a3b8" : "#0f172a", 
            cursor: isPaymentBusy ? "not-allowed" : "pointer" 
          }}
        >
          ← Back to Plans
        </button>
        <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#0f172a" }}>Subscription Checkout</div>
        <div style={{ width: "80px" }} />
      </header>

      <main className="checkout-page-main" style={{ maxWidth: "900px", margin: "40px auto", padding: "0 24px" }}>

        {/* SUCCESS SCREEN */}
        {purchaseSuccess ? (
          <div style={{
            background: "#ffffff", borderRadius: "24px", padding: "48px",
            textAlign: "center", border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)", maxWidth: "580px", margin: "40px auto",
          }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              background: "#dcfce7", color: "#166534", fontSize: "2.2rem", fontWeight: "800",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
            }}>✓</div>
            <h1 style={{ fontSize: "2rem", fontWeight: "800", color: "#0f172a", margin: "0 0 12px" }}>
              Subscription Confirmed!
            </h1>
            <p style={{ color: "#475569", fontSize: "1.05rem", lineHeight: "1.6", marginBottom: "28px" }}>
              Thank you, <strong>{user?.name || "Subscriber"}</strong>! Your <strong>{pkg.name}</strong> ({pricing.durationMonths} Month{pricing.durationMonths > 1 ? "s" : ""}) subscription is now active.
            </p>
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px",
              padding: "24px", textAlign: "left", marginBottom: "32px",
            }}>
              <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "1rem", marginBottom: "10px" }}>Next Step: Enroll Senior in App</div>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#334155", lineHeight: "1.7", fontSize: "0.95rem" }}>
                <li>Log in to the <strong>MaiHoonNa Mobile App</strong> using your phone number.</li>
                <li>Complete Step 2 inside the App — add your senior's details (Name, Age, Address, Doctor).</li>
                <li>Start scheduling Care Mitra visits and track health vitals in real time!</li>
              </ul>
            </div>

            {/* GST Tax Invoice Card */}
            {(purchaseSuccess?.invoiceNumber || purchaseSuccess?.invoiceId) && (
              <div style={{
                background: "#f0fdf4",
                border: "1px dashed #22c55e",
                borderRadius: "16px",
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "24px",
                textAlign: "left",
              }}>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "#166534", display: "block", fontWeight: "600" }}>
                    GST Tax Invoice Ready
                  </span>
                  <strong style={{ fontSize: "1rem", color: "#14532d" }}>
                    {purchaseSuccess.invoiceNumber || purchaseSuccess.invoiceId}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  style={{
                    background: "#166534",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    fontSize: "0.88rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 6px rgba(22, 101, 52, 0.2)",
                  }}
                >
                  📄 View Invoice
                </button>
              </div>
            )}

            <button onClick={onGoBack} style={{
              width: "100%", padding: "16px", borderRadius: "14px",
              background: "#fe6700", color: "#ffffff", fontWeight: "700",
              fontSize: "1.05rem", border: "none", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(254,103,0,0.35)",
            }}>Go to Account Dashboard</button>
          </div>
        ) : (
          /* CHECKOUT FORM */
          <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: "32px" }}>

            {/* Left: Duration selector */}
            <div>
              <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #e2e8f0" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>Select Duration</h2>
                <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 20px" }}>
                  Choose your billing commitment for <strong>{pkg.name}</strong>.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                  {[
                    { key: "1", label: "1 Month", disc: 0 },
                    { key: "3", label: "3 Months", disc: pkg.discountThreeMonths ?? 5 },
                    { key: "6", label: "6 Months", disc: pkg.discountSixMonths ?? 10 },
                    { key: "12", label: "1 Year", disc: pkg.discountAnnual ?? 20 },
                  ].map((item) => (
                    <button 
                      key={item.key} 
                      type="button" 
                      onClick={() => !isPaymentBusy && setDuration(item.key)}
                      disabled={isPaymentBusy}
                      style={{
                        padding: "20px 14px", borderRadius: "16px",
                        border: duration === item.key ? "2.5px solid #fe6700" : "1.5px solid #e2e8f0",
                        background: duration === item.key ? "#fff8f3" : "#ffffff",
                        textAlign: "left", 
                        cursor: isPaymentBusy ? "not-allowed" : "pointer",
                        opacity: isPaymentBusy ? 0.7 : 1,
                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#0f172a" }}>{item.label}</div>
                      {item.disc > 0
                        ? <div style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: "700", marginTop: "6px" }}>Save {item.disc}% Extra</div>
                        : <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "6px" }}>Standard Plan</div>
                      }
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: "28px", padding: "16px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.9rem", marginBottom: "4px" }}>📱 About Beneficiary Setup</div>
                  <p style={{ fontSize: "0.84rem", color: "#64748b", margin: 0, lineHeight: "1.5" }}>
                    Senior beneficiary details (name, age, address, doctor contacts) are enrolled inside the <strong>MaiHoonNa Mobile App</strong> after purchase — this keeps data accurate and private.
                  </p>
                </div>

                {razorpayError && (
                  <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fef2f2", color: "#991b1b", borderRadius: "10px", fontSize: "0.85rem" }}>
                    ⚠️ {razorpayError}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Order summary + Pay button */}
            <div>
              <div style={{
                background: "#ffffff", borderRadius: "20px", padding: "32px",
                border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                position: "sticky", top: "24px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#0f172a", margin: 0 }}>Order Summary</h3>
                  {loadingPricing && (
                    <span style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: "600" }}>Calculating taxes…</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.95rem" }}>
                  <span style={{ color: "#64748b" }}>{pkg.name}</span>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>₹{baseMonthlyPrice.toLocaleString("en-IN")}/mo</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "0.9rem" }}>
                  <span style={{ color: "#64748b" }}>Duration</span>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>{pricing.durationMonths} Month{pricing.durationMonths > 1 ? "s" : ""}</span>
                </div>

                {/* ── Benefit-by-Benefit Price & GST Breakdown (Excel Spreadsheet Model) ── */}
                {serverPricing?.benefitsBreakdown && serverPricing.benefitsBreakdown.length > 0 && (
                  <div style={{
                    margin: "16px 0",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#ffffff"
                  }}>
                    <div style={{
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: "0.72rem",
                      fontWeight: "800",
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      Included Benefits &amp; Taxes
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px", fontWeight: "600" }}>Benefit Name</th>
                          <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: "600" }}>Price</th>
                          <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: "600" }}>GST %</th>
                          <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: "600" }}>GST ₹</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>Final Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serverPricing.benefitsBreakdown.map((b, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 10px", color: "#0f172a", fontWeight: "600" }}>
                              {b.name}
                              {b.units > 0 && (
                                <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginTop: "2px", fontWeight: "500" }}>
                                  {b.unitDisplay || formatUnitDisplay(b.units, b.unitType || b.unitLabel)}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", color: "#475569" }}>
                              ₹{b.price?.toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "center" }}>
                              <span style={{
                                padding: "2px 5px",
                                borderRadius: "4px",
                                fontSize: "0.68rem",
                                fontWeight: "700",
                                background: b.isGstExempt ? "#ecfdf5" : "#eff6ff",
                                color: b.isGstExempt ? "#059669" : "#1d4ed8",
                                border: b.isGstExempt ? "1px solid #a7f3d0" : "1px solid #bfdbfe",
                              }}>
                                {b.isGstExempt ? "0%" : `${b.gstRate}%`}
                              </span>
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", color: "#1e3a8a" }}>
                              ₹{b.gstAmount?.toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "700", color: "#0f172a" }}>
                              ₹{b.finalPrice?.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                        <tr>
                          <td colSpan={4} style={{ padding: "8px 10px", color: "#475569", fontWeight: "600" }}>
                            Package Gross Price (Sum of Final Prices):
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "800", color: "#0f172a" }}>
                            ₹{serverPricing.packageGrossPrice?.toLocaleString("en-IN")}
                          </td>
                        </tr>
                        {serverPricing.durationDiscount > 0 && (
                          <tr style={{ color: "#16a34a" }}>
                            <td colSpan={4} style={{ padding: "6px 10px", fontWeight: "600" }}>
                              Tenure Discount ({serverPricing.durationDiscountPct}% off for {serverPricing.durationMonths} mo):
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>
                              - ₹{serverPricing.durationDiscount?.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        )}
                        {serverPricing.couponDiscount > 0 && (
                          <tr style={{ color: "#16a34a" }}>
                            <td colSpan={4} style={{ padding: "6px 10px", fontWeight: "600" }}>
                              Coupon Discount:
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>
                              - ₹{serverPricing.couponDiscount?.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Coupon */}
                <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: "8px", margin: "16px 0" }}>
                  <input
                    type="text"
                    placeholder="Coupon code"
                    value={couponCode}
                    disabled={isPaymentBusy}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    style={{ 
                      flex: 1, 
                      padding: "10px 12px", 
                      borderRadius: "8px", 
                      border: "1.5px solid #cbd5e1", 
                      fontSize: "0.88rem", 
                      outline: "none",
                      background: isPaymentBusy ? "#f1f5f9" : "#ffffff",
                      cursor: isPaymentBusy ? "not-allowed" : "text"
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={couponLoading || !couponCode.trim() || isPaymentBusy} 
                    style={{
                      padding: "10px 16px", borderRadius: "8px",
                      background: "#0f172a", color: "#fff", fontWeight: "700", border: "none",
                      cursor: couponLoading || !couponCode.trim() || isPaymentBusy ? "not-allowed" : "pointer",
                      opacity: couponLoading || !couponCode.trim() || isPaymentBusy ? 0.5 : 1,
                    }}
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </form>
                {appliedCoupon && (
                  <div style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: "700", marginBottom: "12px" }}>
                    ✓ Coupon applied! You save ₹{(pricing.total - finalTotal).toLocaleString("en-IN")}
                  </div>
                )}
                {couponError && <div style={{ fontSize: "0.82rem", color: "#dc2626", marginBottom: "12px" }}>{couponError}</div>}

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontSize: "1rem", fontWeight: "800", color: "#0f172a", display: "block" }}>Total Payable</span>
                      <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "600" }}>(Inclusive of All Taxes &amp; GST)</span>
                    </div>
                    <span style={{ fontSize: "2rem", fontWeight: "800", color: "#fe6700" }}>
                      ₹{finalTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {pricing.discountPct > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "#16a34a", textAlign: "right", marginTop: "2px" }}>
                      You save {pricing.discountPct}% on this plan
                    </div>
                  )}
                </div>

                {purchaseError && (
                  <div style={{
                    padding: "10px 14px", background: "#fef2f2", color: "#991b1b",
                    fontSize: "0.85rem", borderRadius: "8px", marginTop: "14px", fontWeight: "500",
                  }}>
                    {purchaseError}
                  </div>
                )}

                <button
                  type="button"
                  id="razorpay-pay-btn"
                  onClick={handlePay}
                  disabled={isPaymentBusy || !razorpayLoaded}
                  style={{
                    width: "100%", padding: "16px", borderRadius: "12px",
                    background: isPaymentBusy || !razorpayLoaded ? "#94a3b8" : "#fe6700", 
                    color: "#ffffff",
                    fontWeight: "800", fontSize: "1.05rem",
                    border: "none", marginTop: "20px",
                    cursor: isPaymentBusy || !razorpayLoaded ? "not-allowed" : "pointer",
                    boxShadow: isPaymentBusy || !razorpayLoaded ? "none" : "0 4px 14px rgba(254,103,0,0.35)",
                    opacity: isPaymentBusy || !razorpayLoaded ? 0.75 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {paymentStage === "creating_order"
                    ? "⏳ Securing Order…"
                    : paymentStage === "gateway_open"
                    ? "🔒 Awaiting Payment in Popup…"
                    : paymentStage === "verifying"
                    ? "⏳ Verifying Payment & Activating…"
                    : !razorpayLoaded
                    ? "Loading Payment Gateway…"
                    : `💳  Pay ₹${finalTotal.toLocaleString("en-IN")} securely`}
                </button>

                <div style={{ textAlign: "center", marginTop: "12px", fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <span>🔒</span>
                  <span>256-bit SSL · Secured by Razorpay · UPI, Cards, NetBanking accepted</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Statutory GST Invoice Preview & Print Modal */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoiceId={purchaseSuccess?.invoiceId || purchaseSuccess?.invoiceNumber}
        token={token || purchaseSuccess?.token}
      />
    </div>
  );
}

