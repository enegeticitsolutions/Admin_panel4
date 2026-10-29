import React, { useEffect, useState } from "react";
import { X, Check, Info } from "lucide-react";
import { getPackageDisplayPrice, getPackageCycleSavings } from "../packages/PackageCard";
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

export default function PlanDetailsModal({
  isOpen,
  onClose,
  plan,
  selectedCycle = "12",
  onSelectPackage,
  onCycleChange,
}) {
  const [currentCycle, setCurrentCycle] = useState(selectedCycle || "12");

  // Keep in sync with incoming selectedCycle prop when opened or updated
  useEffect(() => {
    if (selectedCycle) {
      setCurrentCycle(selectedCycle);
    }
  }, [selectedCycle, isOpen]);

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

  // Always compute price from currentCycle (1, 3, 6, or 12)
  const durNum = isTrial ? 1 : (parseInt(currentCycle, 10) || 12);
  const displayPrice = getPackageDisplayPrice(plan, String(durNum));

  let durationText = "1 Month Billing";
  if (isTrial) durationText = `${trialDays} Days Trial`;
  else if (durNum === 3) durationText = "3 Months Billing";
  else if (durNum === 6) durationText = "6 Months Billing";
  else if (durNum === 12) durationText = "Annual Billing";

  const monthlyRate = isTrial ? displayPrice : (durNum > 0 ? Math.round(displayPrice / durNum) : displayPrice);
  const basePrice = Number(plan.basePrice) || 4999;
  const fullTermCost = basePrice * durNum;
  const savings = isTrial ? 0 : (durNum > 1 ? Math.max(0, fullTermCost - displayPrice) : 0);

  const discountPercent = durNum === 3
    ? (plan.discountThreeMonths ?? 5)
    : durNum === 6
      ? (plan.discountSixMonths ?? 10)
      : durNum === 12
        ? (plan.discountAnnual ?? 20)
        : 0;

  const cycleOptions = [
    { value: "1", label: "1 Month" },
    { value: "3", label: "3 Months" },
    { value: "6", label: "6 Months" },
    { value: "12", label: "Annual" },
  ];

  const handleCycleChange = (newCycle) => {
    setCurrentCycle(newCycle);
    if (onCycleChange) {
      onCycleChange(newCycle);
    }
  };

  // Build the complete feature checklist categorized into Included, Add-on, and We arrange it
  const featuresList = (() => {
    if (Array.isArray(plan.allFormattedBenefits) && plan.allFormattedBenefits.length > 0) {
      return plan.allFormattedBenefits.map((item) => {
        let text = item.text || "";
        text = text.replace(/(\d+)\s*hours?(\/month|\s*per\s*month)/gi, (m, n, p) => {
          return `${n} ${n === "1" ? "visit hour" : "visit hours"}${p}`;
        });
        return {
          ...item,
          text,
          category: item.category || (item.benefit ? detectDefaultBenefitCategory(item.benefit) : detectDefaultBenefitCategory({ name: text })),
        };
      });
    }

    const list = [];
    if (Array.isArray(plan.packageBenefits) && plan.packageBenefits.length > 0) {
      plan.packageBenefits.forEach((pb, idx) => {
        if (!pb.benefit || !pb.benefit.name || pb.benefit.isActive === false) return;
        const benefitName = pb.benefit.name.trim();
        if (!benefitName || benefitName.toLowerCase() === "included benefit") return;

        let rawLabel = (pb.benefit?.unitLabel || "").replace(/^per\s+/i, "").trim();
        const units = Number(pb.unitsIncluded) || 0;
        if (/^hours?$/i.test(rawLabel)) {
          rawLabel = units === 1 ? "visit hour" : "visit hours";
        }
        const period = pb.unitsPeriod || "monthly";

        let displayText = "";
        if (pb.showUnit === false) {
          displayText = benefitName;
        } else if (pb.isUnlimited) {
          displayText = `24/7 Unlimited ${benefitName}`;
        } else if (period === "yearly") {
          displayText = `${pb.unitsIncluded} ${rawLabel || "uses"}/year • ${benefitName}`;
        } else if (period === "one_time") {
          displayText = `${pb.unitsIncluded} ${rawLabel || "session"} • ${benefitName}`;
        } else {
          displayText = `${pb.unitsIncluded} ${rawLabel || "visit"}/month • ${benefitName}`;
        }

        const cat = pb.category || (pb.benefit ? detectDefaultBenefitCategory(pb.benefit) : 'included');

        list.push({
          id: pb.id || `pb-${idx}`,
          text: displayText,
          rollover: pb.allowRollover,
          category: cat,
          benefit: pb.benefit,
          showUnit: pb.showUnit !== false,
          isUnlimited: !!pb.isUnlimited,
          unitsIncluded: Number(pb.unitsIncluded) || 0,
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
      const enrichedPlan = {
        ...plan,
        selectedDurationMonths: durNum,
        selectedCycle: isTrial ? "1" : String(durNum),
        calculatedPrice: displayPrice,
        cycleLabel: durationText,
        monthlyRate,
        savings,
      };
      onSelectPackage(enrichedPlan, String(durNum));
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

            {/* Interactive Billing Cycle Selector for non-trial plans */}
            {!isTrial && (
              <div className="plan-modal-cycle-container">
                <div className="plan-modal-cycle-chips" role="radiogroup" aria-label="Select billing cycle">
                  {cycleOptions.map((opt) => {
                    const optSavings = getPackageCycleSavings(plan, opt.value);
                    const isSelected = String(currentCycle) === String(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`plan-modal-cycle-chip ${isSelected ? "plan-modal-cycle-chip--active" : ""}`}
                        onClick={() => handleCycleChange(opt.value)}
                      >
                        <span className="plan-modal-cycle-chip-label">{opt.label}</span>
                        {optSavings > 0 ? (
                          <span className="plan-modal-cycle-chip-savings">
                            Save ₹{optSavings.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="plan-modal-cycle-chip-standard">
                            Monthly
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {savings > 0 && (
                  <div className="plan-modal-savings-highlight">
                    <span>🎉 You save <strong>₹{savings.toLocaleString("en-IN")}</strong> with {durNum === 12 ? "Annual" : `${durNum}-Month`} Billing ({discountPercent}% OFF)</span>
                  </div>
                )}
              </div>
            )}

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
            const rawGroupItems = featuresList.filter(
              (item) => (item.category || "included") === catConfig.id
            );
            if (rawGroupItems.length === 0) return null;

            // Sort benefits under category (especially 'included'):
            // Benefits where showUnit is allowed appear on top, ordered by highest units first
            const groupItems = [...rawGroupItems].sort((a, b) => {
              const getShowUnit = (x) => {
                if (x.showUnit !== undefined) return x.showUnit !== false;
                return x.isUnlimited || /^(\d+|unlimited)/i.test(x.text || "");
              };
              const showA = getShowUnit(a);
              const showB = getShowUnit(b);
              if (showA && !showB) return -1;
              if (!showA && showB) return 1;

              if (showA && showB) {
                const unlimA = a.isUnlimited || /unlimited/i.test(a.text || "");
                const unlimB = b.isUnlimited || /unlimited/i.test(b.text || "");
                if (unlimA && !unlimB) return -1;
                if (!unlimA && unlimB) return 1;

                const getUnits = (x) => {
                  if (typeof x.unitsIncluded === "number") return x.unitsIncluded;
                  const m = (x.text || "").match(/^(\d+)/);
                  return m ? parseInt(m[1], 10) : 0;
                };
                const uA = getUnits(a);
                const uB = getUnits(b);
                if (uB !== uA) return uB - uA;
              }
              return 0;
            });

            return (
              <div key={catConfig.id} className="plan-modal-category-group" style={{ marginBottom: "26px" }}>
                {/* Category Header with Pure CSS Hover (i) Info Tooltip */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div className="plan-category-wrapper">
                    <div className="plan-category-trigger">
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
                        <span className="plan-category-info-btn" aria-label={`About ${catConfig.label}`}>
                          <Info size={15} />
                        </span>
                      </h3>
                    </div>

                    {/* Pure CSS Hover Tooltip with invisible bridge & zero layout shift */}
                    <div className="plan-category-tooltip" role="tooltip">
                      <div className="plan-category-tooltip-caret" />
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
            <span>
              {isTrial
                ? `Start ${trialDays}-Day Trial`
                : isRegional
                  ? `Select Local Plan (${durNum === 12 ? "Annual" : `${durNum} Mo`})`
                  : `Get Started with ${planName} (${durNum === 12 ? "Annual" : `${durNum} Mo`})`}
            </span>
            <span className="plan-modal-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
