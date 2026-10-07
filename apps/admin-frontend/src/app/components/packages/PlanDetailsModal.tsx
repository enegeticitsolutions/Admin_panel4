import React, { useEffect } from "react";
import { X, Check } from "lucide-react";
import { getPackageDisplayPrice } from "./PackageCard";

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

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any;
  selectedCycle?: string;
  onSelectPackage?: (plan: any) => void;
}

export default function PlanDetailsModal({
  isOpen,
  onClose,
  plan,
  selectedCycle = "3",
  onSelectPackage,
}: PlanDetailsModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Build the complete feature checklist
  const featuresList = (() => {
    if (Array.isArray(plan.allFormattedBenefits) && plan.allFormattedBenefits.length > 0) {
      return plan.allFormattedBenefits;
    }

    const list: any[] = [];
    if (Array.isArray(plan.packageBenefits) && plan.packageBenefits.length > 0) {
      plan.packageBenefits.forEach((pb: any, idx: number) => {
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

        list.push({
          id: pb.id || `pb-${idx}`,
          text: displayText,
          rollover: pb.allowRollover,
        });
      });
    } else if (Array.isArray(plan.features) && plan.features.length > 0) {
      plan.features.forEach((feat: string, idx: number) => {
        if (!feat || feat.toLowerCase().trim() === "included benefit") return;
        list.push({
          id: `feat-${idx}`,
          text: feat,
          rollover: false,
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
  const renderFeatureText = (text: string) => {
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
                  🏷️ {trialDays}-DAY TRIAL
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
          {/* Features Included Section (matching reference design) */}
          <div className="plan-modal-features-section">
            <h3 className="plan-modal-features-heading">Features included</h3>
            <div className="plan-modal-features-divider" />

            <ul className="plan-modal-checklist">
              {featuresList.map((item, idx) => (
                <li key={item.id || idx} className="plan-modal-checklist-item">
                  <Check
                    size={18}
                    strokeWidth={2.8}
                    className="plan-modal-checklist-check"
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
