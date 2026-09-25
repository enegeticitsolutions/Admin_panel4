import React, { useEffect } from "react";
import { X, Check } from "lucide-react";

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

export default function PlanDetailsModal({ isOpen, onClose, plan, onSelectPackage }) {
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
  const displayPrice = plan.calculatedPrice ?? plan.basePrice ?? 4999;
  const durNum = plan.selectedDurationMonths || 3;

  let durationText = "3 Months Billing";
  if (durNum === 6) durationText = "6 Months Billing";
  else if (durNum === 12) durationText = "Annual Billing";
  else if (durNum === 1) durationText = "Monthly Billing";

  const monthlyRate = Math.round(displayPrice / durNum);
  const basePrice = plan.basePrice || displayPrice;
  const fullTermCost = basePrice * durNum;
  const savings = durNum > 1 ? Math.max(0, fullTermCost - displayPrice) : 0;

  // Build the complete feature checklist
  const featuresList = (() => {
    if (Array.isArray(plan.allFormattedBenefits) && plan.allFormattedBenefits.length > 0) {
      return plan.allFormattedBenefits;
    }

    const list = [];
    if (Array.isArray(plan.packageBenefits) && plan.packageBenefits.length > 0) {
      plan.packageBenefits.forEach((pb, idx) => {
        const benefitName = pb.benefit?.name || "Included Benefit";
        const rawLabel = (pb.benefit?.unitLabel || "").replace(/^per\s+/i, "").trim();
        const period = pb.unitsPeriod || "monthly";

        let displayText = "";
        if (pb.isUnlimited) {
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
      plan.features.forEach((feat, idx) => {
        list.push({
          id: `feat-${idx}`,
          text: feat,
          rollover: false,
        });
      });
    }

    // Append standard inclusions that aren't already represented
    STANDARD_INCLUSIONS.forEach((itemText, idx) => {
      const exists = list.some((existing) =>
        existing.text.toLowerCase().includes(itemText.toLowerCase().slice(0, 8))
      );
      if (!exists) {
        list.push({
          id: `std-${idx}`,
          text: itemText,
          rollover: false,
        });
      }
    });

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
            <h2 id="plan-modal-title" className="plan-modal-title">
              {planName}
            </h2>
            <div className="plan-modal-price-subtitle">
              <span className="plan-modal-subtitle-price">
                ₹{displayPrice.toLocaleString("en-IN")}
              </span>
              <span className="plan-modal-subtitle-dot">·</span>
              <span className="plan-modal-subtitle-cycle">{durationText}</span>
              <span className="plan-modal-subtitle-rate">
                (₹{monthlyRate.toLocaleString("en-IN")}/month)
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
            className="plan-modal-btn-primary"
            onClick={handleSelect}
          >
            <span>Get Started with {planName}</span>
            <span className="plan-modal-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
