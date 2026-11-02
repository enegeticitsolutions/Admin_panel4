import React, { useState, useEffect, useRef, useMemo } from "react";
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

function cleanUnitLabel(qty, rawUnitLabel) {
  if (!rawUnitLabel) return qty === 1 ? "Unit" : "Units";
  const clean = String(rawUnitLabel).replace(/^per\s+/i, "").trim().toLowerCase();
  if (clean === "hour" || clean === "hours") return qty === 1 ? "Hour" : "Hours";
  if (clean === "visit" || clean === "visits") return qty === 1 ? "Visit" : "Visits";
  if (clean === "session" || clean === "sessions") return qty === 1 ? "Session" : "Sessions";
  if (clean === "test" || clean === "tests") return qty === 1 ? "Test" : "Tests";
  if (clean === "day" || clean === "days") return qty === 1 ? "Day" : "Days";
  if (clean === "month" || clean === "months") return qty === 1 ? "Month" : "Months";
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  return qty > 1 && !cap.endsWith("s") ? `${cap}s` : cap;
}

function formatUnitDisplay(units, rawUnitLabel) {
  if (!units) return "";
  const type = cleanUnitLabel(units, rawUnitLabel);
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
  const isTrial = !!pkg.isFreeTrial;
  const isRegional = !pkg.isGlobal;
  const trialDays = pkg.trialDurationDays || 7;

  const initialDuration = isTrial
    ? "1"
    : ["1", "3", "6", "12"].includes(String(selectedPackage?.selectedCycle || selectedPackage?.selectedDurationMonths))
      ? String(selectedPackage?.selectedCycle || selectedPackage?.selectedDurationMonths)
      : "1";
  const [duration, setDuration] = useState(initialDuration);
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

  // Calculates savings in Rupees and discount percentage for each duration option
  const getCycleSavings = (durKey, fallbackDisc) => {
    const durNum = parseInt(durKey, 10);
    if (durNum <= 1) return { savingsRs: 0, discPct: 0 };
    const rawBase = baseMonthlyPrice * durNum;
    let explicitPrice = null;
    if (durNum === 3 && pkg.priceThreeMonths) explicitPrice = Number(pkg.priceThreeMonths);
    if (durNum === 6 && pkg.priceSixMonths) explicitPrice = Number(pkg.priceSixMonths);
    if (durNum === 12 && pkg.priceTwelveMonths) explicitPrice = Number(pkg.priceTwelveMonths);

    if (explicitPrice !== null) {
      const savingsRs = Math.max(0, rawBase - explicitPrice);
      const discPct = rawBase > 0 ? Math.round((savingsRs / rawBase) * 100) : 0;
      return { savingsRs, discPct };
    }
    const savingsRs = Math.round(rawBase * ((fallbackDisc || 0) / 100));
    return { savingsRs, discPct: fallbackDisc || 0 };
  };

  const calcDurationPricing = () => {
    if (isTrial) {
      return { total: baseMonthlyPrice, discountPct: 0, durationMonths: 1, savingsRs: 0, rawTotal: baseMonthlyPrice };
    }
    const durNum = parseInt(duration, 10);
    let rawTotal = baseMonthlyPrice * durNum;
    let discPct = 0;
    let explicitPrice = null;

    if (durNum === 3) {
      discPct = pkg.discountThreeMonths ?? 5;
      if (pkg.priceThreeMonths) explicitPrice = Number(pkg.priceThreeMonths);
    } else if (durNum === 6) {
      discPct = pkg.discountSixMonths ?? 10;
      if (pkg.priceSixMonths) explicitPrice = Number(pkg.priceSixMonths);
    } else if (durNum === 12) {
      discPct = pkg.discountAnnual ?? 20;
      if (pkg.priceTwelveMonths) explicitPrice = Number(pkg.priceTwelveMonths);
    }

    const calculatedTotal = explicitPrice !== null ? explicitPrice : Math.round(rawTotal * (1 - discPct / 100));
    const savingsRs = Math.max(0, rawTotal - calculatedTotal);
    if (explicitPrice !== null && rawTotal > 0) {
      discPct = Math.round((savingsRs / rawTotal) * 100);
    }
    return { total: calculatedTotal, discountPct: discPct, durationMonths: durNum, rawTotal, savingsRs };
  };

  const pricing = calcDurationPricing();

  // Normalized package benefits with rollover & monthly allocation clarity
  const effectiveBenefits = useMemo(() => {
    if (serverPricing?.benefitsBreakdown && serverPricing.benefitsBreakdown.length > 0) {
      return serverPricing.benefitsBreakdown.map((b) => {
        const period = b.unitsPeriod || "monthly";
        const durNum = pricing.durationMonths || 1;
        const baseUnits = b.unitsIncluded || (durNum > 1 && period === "monthly" ? Math.max(1, Math.round(b.units / durNum)) : b.units) || 1;
        return {
          ...b,
          unitsIncluded: baseUnits,
          unitsPeriod: period,
          allowRollover: Boolean(b.allowRollover),
          maxRolloverUnits: b.maxRolloverUnits != null ? Number(b.maxRolloverUnits) : null,
          isUnlimited: Boolean(b.isUnlimited),
          showUnit: b.showUnit !== false,
        };
      });
    }

    const rawList = pkg.packageBenefits || pkg.benefits || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      const durNum = parseInt(duration, 10) || 1;
      return rawList
        .filter((pb) => pb.benefit && pb.benefit.isActive !== false)
        .map((pb) => {
          const b = pb.benefit || pb;
          const baseUnits = pb.unitsIncluded ?? pb.monthlyUnits ?? 1;
          const period = pb.unitsPeriod || "monthly";
          const isUnlimited = Boolean(pb.isUnlimited);
          const allowRollover = Boolean(pb.allowRollover);
          const maxRolloverUnits = pb.maxRolloverUnits != null ? Number(pb.maxRolloverUnits) : null;
          let count = baseUnits * durNum;
          if (isUnlimited) count = 0;
          else if (period === "one_time" || pb.allocationBasis === "per_subscription_term") count = baseUnits;
          else if (period === "yearly") count = Math.max(1, Math.round(durNum / 12)) * baseUnits;

          return {
            benefitId: b.id || pb.id,
            name: b.name || pb.name || "Benefit",
            units: count,
            unitsIncluded: baseUnits,
            unitsPeriod: period,
            allocationBasis: pb.allocationBasis || "per_billing_cycle",
            allowRollover,
            maxRolloverUnits,
            isUnlimited,
            showUnit: pb.showUnit !== false,
            category: pb.category || "included",
            unitLabel: b.unitLabel || pb.unit || "units",
            unitType: cleanUnitLabel(count || baseUnits, b.unitLabel || pb.unit),
          };
        });
    }

    return [];
  }, [serverPricing, pkg, duration, pricing.durationMonths]);

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
      description: isTrial ? `${pkg.name} — ${trialDays}-Day Trial` : `${pkg.name} — ${pricing.durationMonths} Month${pricing.durationMonths > 1 ? "s" : ""}`,
      image: window.location.origin + "/logo.svg",
      prefill: {
        name: user?.name || "",
        contact: user?.phone ? String(user.phone).replace(/\D/g, "").slice(-10) : "",
        email: user?.email || "",
      },
      theme: { color: isTrial ? "#7c3aed" : "#fe6700" },
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
                <h2 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a", marginBottom: "8px" }}>
                  {isTrial ? "Trial Package Duration" : "Select Duration"}
                </h2>
                <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 20px" }}>
                  {isTrial
                    ? `Experience comprehensive care for ${trialDays} days with ${pkg.name}.`
                    : `Choose your billing commitment for ${pkg.name}.`}
                </p>

                {isTrial ? (
                  <div style={{
                    background: "linear-gradient(135deg, #fdf4ff 0%, #faf5ff 100%)",
                    border: "2px solid #a855f7",
                    borderRadius: "16px",
                    padding: "24px 20px",
                    boxShadow: "0 4px 14px rgba(168, 85, 247, 0.12)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "1.15rem", fontWeight: "800", color: "#6b21a8" }}>
                        🧪 {trialDays}-Day Full Care Trial
                      </span>
                      <span style={{
                        background: "#7e22ce", color: "#ffffff", fontSize: "0.75rem",
                        fontWeight: "800", padding: "4px 10px", borderRadius: "999px"
                      }}>
                        Trial Period
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "#7e22ce", lineHeight: "1.5" }}>
                      Full senior care benefits, dedicated Care Mitra visits, and 24/7 care coordination for {trialDays} days. No recurring commitment.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                    {[
                      { key: "1", label: "1 Month", disc: 0 },
                      { key: "3", label: "3 Months", disc: pkg.discountThreeMonths ?? 5 },
                      { key: "6", label: "6 Months", disc: pkg.discountSixMonths ?? 10 },
                      { key: "12", label: "1 Year", disc: pkg.discountAnnual ?? 20 },
                    ].map((item) => {
                      const isSelected = duration === item.key;
                      const { savingsRs, discPct } = getCycleSavings(item.key, item.disc);
                      return (
                        <button 
                          key={item.key} 
                          type="button" 
                          onClick={() => !isPaymentBusy && setDuration(item.key)}
                          disabled={isPaymentBusy}
                          style={{
                            padding: "18px 16px", borderRadius: "16px",
                            border: isSelected ? "2.5px solid #fe6700" : "1.5px solid #e2e8f0",
                            background: isSelected ? "#fff8f3" : "#ffffff",
                            textAlign: "left", 
                            cursor: isPaymentBusy ? "not-allowed" : "pointer",
                            opacity: isPaymentBusy ? 0.7 : 1,
                            display: "flex", flexDirection: "column", justifyContent: "space-between",
                            transition: "all 0.15s ease",
                            boxShadow: isSelected ? "0 4px 12px rgba(254,103,0,0.12)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "6px" }}>
                            <span style={{ fontSize: "1.05rem", fontWeight: "800", color: isSelected ? "#c2410c" : "#0f172a" }}>
                              {item.label}
                            </span>
                            {isSelected && (
                              <span style={{ fontSize: "0.68rem", fontWeight: "800", color: "#fe6700", background: "#ffedd5", padding: "2px 8px", borderRadius: "999px" }}>
                                Active
                              </span>
                            )}
                          </div>
                          {savingsRs > 0 ? (
                            <div>
                              <div style={{ fontSize: "0.92rem", color: "#16a34a", fontWeight: "800" }}>
                                Save ₹{savingsRs.toLocaleString("en-IN")}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#059669", fontWeight: "600", marginTop: "1px" }}>
                                {discPct}% Extra Savings
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: "500", marginTop: "4px" }}>
                              Standard Monthly Plan
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div style={{ marginTop: "28px", padding: "16px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.9rem", marginBottom: "4px" }}>📱 Beneficiary Setup &amp; Activation</div>
                  <p style={{ fontSize: "0.84rem", color: "#64748b", margin: 0, lineHeight: "1.5" }}>
                    Senior beneficiary details (name, age, address, emergency doctor) are linked inside the <strong>MaiHoonNa Mobile App</strong> after purchase. <strong>Your care plan and its start date are officially activated in the system when attached to your beneficiary.</strong>
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

                {isRegional && (
                  <div style={{
                    background: "#fff7ed",
                    border: "1px solid #fdba74",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    marginBottom: "14px",
                    fontSize: "0.84rem",
                    color: "#c2410c",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <span>📍</span>
                    <span>Local Regional Plan: <strong>{pkg.selectedRegionName || pkg.regions?.[0]?.name || "Local Zone"}</strong></span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.95rem" }}>
                  <span style={{ color: "#64748b" }}>{pkg.name}</span>
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>
                    ₹{baseMonthlyPrice.toLocaleString("en-IN")}{isTrial ? ` / ${trialDays} days` : "/month"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px", fontSize: "0.9rem" }}>
                  <span style={{ color: "#64748b" }}>Duration</span>
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>
                    {isTrial ? `${trialDays} Days Trial` : `${pricing.durationMonths} Month${pricing.durationMonths > 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* ── Included Benefits List with Rollover & Monthly Quota Clarity ── */}
                {effectiveBenefits.length > 0 && (
                  <div style={{
                    margin: "16px 0",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                  }}>
                    <div style={{
                      padding: "12px 16px",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Included Package Benefits
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: "700", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "3px 9px", borderRadius: "999px" }}>
                        {effectiveBenefits.length} Services Included
                      </span>
                    </div>

                    <div>
                      {effectiveBenefits.map((b, idx) => {
                        const uLabel = cleanUnitLabel(b.unitsIncluded || b.units, b.unitLabel || b.unitType);
                        const totalULabel = cleanUnitLabel(b.units, b.unitLabel || b.unitType);
                        const isMonthly = b.unitsPeriod === "monthly" || !b.unitsPeriod;

                        return (
                          <div
                            key={b.benefitId || idx}
                            style={{
                              padding: "12px 16px",
                              borderBottom: idx < effectiveBenefits.length - 1 ? "1px solid #f1f5f9" : "none",
                              background: idx % 2 === 0 ? "#ffffff" : "#fafcff",
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  background: "#dcfce7",
                                  color: "#166534",
                                  fontSize: "0.72rem",
                                  fontWeight: "900",
                                  flexShrink: 0,
                                }}>✓</span>
                                <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {b.name}
                                </span>
                              </div>

                              {/* Units / Quota Badge */}
                              <div style={{ flexShrink: 0 }}>
                                {b.isUnlimited ? (
                                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#6b21a8", background: "#f3e8ff", border: "1px solid #e9d5ff", padding: "3px 8px", borderRadius: "6px" }}>
                                    24/7 Unlimited
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.76rem", fontWeight: "700", color: "#1e293b", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 9px", borderRadius: "6px" }}>
                                    {isMonthly ? (
                                      pricing.durationMonths > 1 ? (
                                        <>
                                          <span>{b.unitsIncluded} {uLabel}/mo</span>
                                          <span style={{ color: "#64748b", fontWeight: "500", marginLeft: "4px" }}>
                                            ({b.units} total)
                                          </span>
                                        </>
                                      ) : (
                                        <span>{b.unitsIncluded || b.units} {uLabel}/month</span>
                                      )
                                    ) : b.unitsPeriod === "yearly" ? (
                                      <span>{b.units} {totalULabel}/year</span>
                                    ) : b.unitsPeriod === "one_time" ? (
                                      <span>{b.unitsIncluded || b.units} {uLabel} (One-Time)</span>
                                    ) : (
                                      <span>{b.units} {totalULabel}</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Rollover status badge row */}
                            {!b.isUnlimited && b.unitsPeriod !== "one_time" && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "26px" }}>
                                {b.allowRollover ? (
                                  <span style={{
                                    fontSize: "0.7rem",
                                    fontWeight: "700",
                                    color: "#047857",
                                    background: "#ecfdf5",
                                    border: "1px solid #a7f3d0",
                                    padding: "2px 8px",
                                    borderRadius: "5px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}>
                                    <span>🔄</span>
                                    <span>
                                      Rollover Included
                                      {b.maxRolloverUnits ? ` (max ${b.maxRolloverUnits} ${cleanUnitLabel(b.maxRolloverUnits, b.unitLabel)})` : ""}
                                    </span>
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: "0.7rem",
                                    fontWeight: "600",
                                    color: "#64748b",
                                    background: "#f8fafc",
                                    border: "1px solid #e2e8f0",
                                    padding: "2px 8px",
                                    borderRadius: "5px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}>
                                    <span>⏳</span>
                                    <span>Monthly Quota (Expires monthly)</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Transparency explanatory footer */}
                    <div style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: "0.75rem",
                      color: "#64748b",
                      lineHeight: "1.45",
                      display: "flex",
                      gap: "6px",
                      alignItems: "flex-start",
                    }}>
                      <span style={{ fontSize: "0.85rem", marginTop: "-1px" }}>💡</span>
                      <span>
                        <strong>Benefit Allocation:</strong> Quotas are distributed per monthly cycle ({pricing.durationMonths} month{pricing.durationMonths > 1 ? "s" : ""}). Services marked <em>Rollover Included</em> roll over unspent units into the next month; standard <em>Monthly Quota</em> services reset each billing cycle.
                      </span>
                    </div>

                    {/* Overall Package Summary (Base, Addons, Coupon, GST) */}
                    <div style={{
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      padding: "12px 14px",
                      fontSize: "0.84rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: "5px" }}>
                        <span>Package Price ({pricing.durationMonths} Month{pricing.durationMonths > 1 ? "s" : ""})</span>
                        <span style={{ fontWeight: "700", color: "#0f172a" }}>
                          ₹{(serverPricing?.packageBasePrice || pricing.total)?.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {(serverPricing?.durationDiscount > 0 || pricing.savingsRs > 0) && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: "600", marginBottom: "5px" }}>
                          <span>Tenure Savings ({serverPricing?.durationDiscountPct || pricing.discountPct}% off)</span>
                          <span>- ₹{(serverPricing?.durationDiscount || pricing.savingsRs)?.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      {serverPricing?.addonsTotalPrice > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: "5px" }}>
                          <span>Add-on Benefits</span>
                          <span style={{ fontWeight: "600", color: "#0f172a" }}>
                            + ₹{serverPricing.addonsTotalPrice?.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      {serverPricing?.couponDiscount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: "600", marginBottom: "5px" }}>
                          <span>Coupon Discount</span>
                          <span>- ₹{serverPricing.couponDiscount?.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      {(serverPricing?.addonsTotalPrice > 0 || serverPricing?.couponDiscount > 0) && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#334155", fontWeight: "700", marginBottom: "5px", paddingTop: "5px", borderTop: "1px dashed #cbd5e1" }}>
                          <span>Net Taxable Base</span>
                          <span>₹{(serverPricing?.netTaxableAmount ?? (pricing.total + (serverPricing?.addonsTotalPrice || 0) - (serverPricing?.couponDiscount || 0)))?.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      {serverPricing?.totalTaxAmount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", marginBottom: "2px", paddingTop: (serverPricing?.addonsTotalPrice > 0 || serverPricing?.couponDiscount > 0) ? "2px" : "5px", borderTop: (serverPricing?.addonsTotalPrice > 0 || serverPricing?.couponDiscount > 0) ? "none" : "1px dashed #cbd5e1" }}>
                          <span>Statutory GST ({serverPricing.gstRate || 18}%)</span>
                          <span style={{ fontWeight: "600", color: "#334155" }}>
                            + ₹{serverPricing.totalTaxAmount?.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
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
                    <div style={{ fontSize: "0.82rem", color: "#16a34a", textAlign: "right", marginTop: "4px", fontWeight: "700" }}>
                      🎉 You save ₹{(serverPricing?.durationDiscount || pricing.savingsRs).toLocaleString("en-IN")} ({pricing.discountPct}% OFF) on this plan
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

