import React, { useEffect, useState } from "react";
import { X, Check, Info } from "lucide-react";
import { getPackageDisplayPrice } from "../packages/PackageCard";
import { BENEFIT_CATEGORIES_CONFIG, detectDefaultBenefitCategory } from "../../constants/benefitCategories";

// Comprehensive care inclusions matching eldercare standards and user reference design
const STANDARD_INCLUSIONS = [
  "24/7 Emergency Coordination",
  "2x Weekly Wellness Check-In Calls",
  "Home Fall Safety Assessment",
  "2 Doctor Teleconsults/Year",
  "Monthly Nurse Home Visit",
  "Senior Community Events (Online)",
  "Proactive Health Monitoring",
  "Family Connect Mobile App Access",
  "Dedicated Care Mitra Oversight",
];

export default function PlanDetailsModal({ isOpen, onClose, plan, selectedCycle = "3", onSelectPackage }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !plan) return null;

  const planName = plan.name || "Care Package";
  const planDesc = plan.description || "Comprehensive in-home care and family connectivity.";

  const isTrial = !!plan.isFreeTrial;
  const isRegional = !plan.isGlobal;
  const trialDays = plan.trialDurationDays || 7;

  // Always compute price from the live selectedCycle prop (1, 3, 6, or 12)
  const durNum = isTrial ? 1 : parseInt(selectedCycle, 10);
  const displayPrice = getPackageDisplayPrice(plan, selectedCycle);

  let durationText = "1 Month Billing";
  if (isTrial) durationText = `${trialDays} Days Trial`;
  else if (durNum === 3) durationText = "3 Months Billing";
  else if (durNum === 6) durationText = "6 Months Billing";
  else if (durNum === 12) durationText = "Annual Billing";

  const monthlyRate = isTrial ? displayPrice : (durNum > 0 ? Math.round(displayPrice / durNum) : displayPrice);
  const basePrice = plan.basePrice || displayPrice;
  const fullTermCost = basePrice * durNum;
  const savings = isTrial ? 0 : (durNum > 1 ? Math.max(0, fullTermCost - displayPrice) : 0);

  // Build the complete feature checklist categorized into Included, Add-on, and We arrange it
  const featuresList = (() => {
    if (Array.isArray(plan.allFormattedBenefits) && plan.allFormattedBenefits.length > 0) {
      return plan.allFormattedBenefits.map((item) => ({
        ...item,
        category: item.category || (item.benefit ? detectDefaultBenefitCategory(item.benefit) : detectDefaultBenefitCategory({ name: item.text })),
      }));
    }

    const list = [];
    if (Array.isArray(plan.packageBenefits) && plan.packageBenefits.length > 0) {
      plan.packageBenefits.forEach((pb, idx) => {
        if (!pb.benefit || !pb.benefit.name || pb.benefit.isActive === false) return;
        const benefitName = pb.benefit.name.trim();
        if (!benefitName || benefitName.toLowerCase() === "included benefit") return;

        const rawLabel = (pb.benefit?.unitLabel || "").replace(/^per\s+/i, "").trim();
        const period = pb.unitsPeriod || "monthly";

        let displayText = "";
        if (pb.showUnit === false) {
          displayText = benefitName;
        } else if (pb.isUnlimited) {
          displayText = `24/7 Unlimited ${benefitName}`;
        } else if (period === "yearly") {
          displayText = `${pb.unitsIncluded} ${rawLabel || "uses"}/year ${benefitName}`;
        } else if (period === "one_time") {
          displayText = `${pb.unitsIncluded} ${rawLabel || "session"} ${benefitName}`;
        } else {
          displayText = `${pb.unitsIncluded} ${rawLabel || "visits"}/month ${benefitName}`;
        }

        const cat = pb.category || (pb.benefit ? detectDefaultBenefitCategory(pb.benefit) : 'included');

        list.push({
          id: pb.id || `pb-${idx}`,
          text: displayText,
          rollover: pb.allowRollover,
          category: cat,
          benefit: pb.benefit,
        });
      });
    } else if (Array.isArray(plan.features) && plan.features.length > 0) {
      plan.features.forEach((feat, idx) => {
        if (!feat || feat.toLowerCase().trim() === "included benefit") return;
        const cat = detectDefaultBenefitCategory({ name: feat });
        list.push({
          id: `feat-${idx}`,
          text: feat,
          rollover: false,
          category: cat,
        });
      });
    }

    return list;
  })();

  const handleSelect = () => {
    onClose();
    if (onSelectPackage) {
      onSelectPackage(plan);
    }
  };

  // Helper to render bold on keywords like (Online)
  const renderFeatureText = (text) => {
    if (text.includes("(Online)")) {
      const parts = text.split("(Online)");
      return (
        <>
          {parts[0]}
          <strong>(Online)</strong>
          {parts[1]}
        </>
      );
    }
    return text;
  };

  return (
    <div
      className="plan-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <div className="plan-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              {isTrial ? (
                <span style={{
                  background: "#7C3AED", color: "#FFF", fontSize: "11px", fontWeight: "800",
                  padding: "4px 10px", borderRadius: "999px", letterSpacing: "0.5px"
                }}>
                  🧪 {trialDays}-DAY TRIAL
                </span>
              ) : isRegional ? (
                <span style={{
                  background: "#FE6700", color: "#FFF", fontSize: "11px", fontWeight: "800",
                  padding: "4px 10px", borderRadius: "999px", letterSpacing: "0.5px"
                }}>
                  📍 LOCAL PLAN {plan.selectedRegionName ? `(${plan.selectedRegionName})` : ""}
                </span>
              ) : null}
            </div>
            <h2 id="plan-modal-title" className="plan-modal-title">
              {planName}
            </h2>
            <div className="plan-modal-price-subtitle">
              <span className="plan-modal-subtitle-price">
                ₹{monthlyRate.toLocaleString("en-IN")}{isTrial ? ` / ${trialDays} days` : "/month"}
              </span>
              <span className="plan-modal-subtitle-dot">·</span>
              <span className="plan-modal-subtitle-cycle">
                {isTrial ? `Fixed one-time price` : `Total ₹${displayPrice.toLocaleString("en-IN")} (${durationText})`}
              </span>
              {savings > 0 && (
                <span className="plan-modal-subtitle-savings">
                  Save ₹{savings.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            {planDesc && <p className="plan-modal-desc">{planDesc}</p>}
          </div>

          <button
            type="button"
            className="plan-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="plan-modal-body">
          {BENEFIT_CATEGORIES_CONFIG.map((catConfig) => {
            const groupItems = featuresList.filter(
              (item) => (item.category || "included") === catConfig.id
            );
            if (groupItems.length === 0) return null;

            return (
              <div key={catConfig.id} className="plan-modal-category-group" style={{ marginBottom: "26px" }}>
                {/* Category Header with Hover (i) Info Tooltip */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div
                    style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                    onMouseEnter={() => setHoveredCategory(catConfig.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "help" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: catConfig.dotBg,
                          display: "inline-block",
                        }}
                      />
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                        {catConfig.label}
                        <span
                          style={{
                            background: hoveredCategory === catConfig.id ? catConfig.badgeBg : "transparent",
                            border: hoveredCategory === catConfig.id ? `1px solid ${catConfig.badgeBorder}` : "none",
                            borderRadius: "50%",
                            padding: "3px",
                            color: hoveredCategory === catConfig.id ? catConfig.badgeText : "#9CA3AF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}
                          aria-label={`About ${catConfig.label}`}
                        >
                          <Info size={16} />
                        </span>
                      </h3>
                    </div>

                    {/* Floating Hover Tooltip: Positioned downwards so it is NEVER cut off by the modal top */}
                    {hoveredCategory === catConfig.id && (
                      <div
                        role="tooltip"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: "0",
                          zIndex: 100,
                          backgroundColor: "#111827",
                          color: "#F9FAFB",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          lineHeight: "1.45",
                          fontWeight: "500",
                          width: "max-content",
                          maxWidth: "320px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25)",
                          border: "1px solid #374151",
                          pointerEvents: "none",
                          whiteSpace: "normal",
                          textAlign: "left",
                        }}
                      >
                        {/* Caret pointing up to the header */}
                        <div
                          style={{
                            position: "absolute",
                            top: "-5px",
                            left: "24px",
                            width: "8px",
                            height: "8px",
                            backgroundColor: "#111827",
                            borderLeft: "1px solid #374151",
                            borderTop: "1px solid #374151",
                            transform: "rotate(45deg)",
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              backgroundColor: catConfig.dotBg,
                              display: "inline-block",
                            }}
                          />
                          <span style={{ fontWeight: "700", color: "#FFFFFF", fontSize: "12px" }}>
                            {catConfig.label}
                          </span>
                        </div>
                        <span style={{ color: "#E5E7EB", fontSize: "12px", display: "block" }}>
                          {catConfig.explanation}
                        </span>
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      backgroundColor: catConfig.badgeBg,
                      color: catConfig.badgeText,
                      border: `1px solid ${catConfig.badgeBorder}`,
                    }}
                  >
                    {groupItems.length} {groupItems.length === 1 ? "benefit" : "benefits"}
                  </span>
                </div>

                <div className="plan-modal-features-divider" style={{ margin: "4px 0 14px 0" }} />

                <ul className="plan-modal-checklist">
                  {groupItems.map((item, idx) => (
                    <li key={item.id || idx} className="plan-modal-checklist-item">
                      <Check
                        size={17}
                        strokeWidth={2.8}
                        className="plan-modal-checklist-check"
                        style={{ color: catConfig.id === "included" ? "#059669" : "#374151" }}
                      />
                      <span className="plan-modal-checklist-text">
                        {renderFeatureText(item.text)}
                        {item.rollover && (
                          <span className="plan-modal-rollover-tag">
                            Rollover Included
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Modal Footer Actions */}
        <div className="plan-modal-footer">
          <button
            type="button"
            className={`plan-modal-btn-primary ${isTrial ? "plan-modal-btn-primary--trial" : ""}`}
            onClick={handleSelect}
            style={isTrial ? { background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow: "0 6px 20px rgba(124, 58, 237, 0.35)" } : {}}
          >
            <span>{isTrial ? `Start ${trialDays}-Day Trial` : isRegional ? `Select Local Plan` : `Get Started with ${planName}`}</span>
            <span className="plan-modal-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
