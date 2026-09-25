import React, { useMemo } from "react";

export function getPackageDisplayPrice(plan, selectedCycle = "3") {
  if (!plan) return 0;
  const base = Number(plan.basePrice) || 4999;
  const durNum = parseInt(selectedCycle, 10) || 3;

  if (durNum === 3) {
    const disc = plan.discountThreeMonths != null ? Number(plan.discountThreeMonths) : 5;
    return plan.priceThreeMonths != null && plan.priceThreeMonths !== "" && !isNaN(Number(plan.priceThreeMonths))
      ? Number(plan.priceThreeMonths)
      : Math.round(base * 3 * (1 - disc / 100));
  } else if (durNum === 6) {
    const disc = plan.discountSixMonths != null ? Number(plan.discountSixMonths) : 10;
    return plan.priceSixMonths != null && plan.priceSixMonths !== "" && !isNaN(Number(plan.priceSixMonths))
      ? Number(plan.priceSixMonths)
      : Math.round(base * 6 * (1 - disc / 100));
  } else if (durNum === 12) {
    const disc = plan.discountAnnual != null ? Number(plan.discountAnnual) : 20;
    return plan.priceTwelveMonths != null && plan.priceTwelveMonths !== "" && !isNaN(Number(plan.priceTwelveMonths))
      ? Number(plan.priceTwelveMonths)
      : Math.round(base * 12 * (1 - disc / 100));
  }

  return base * durNum;
}

export default function PackageCard({
  plan,
  selectedCycle = "3",
  isSelected = false,
  onCardClick,
  onSelectPackage,
  onOpenDetails,
}) {
  const planName = plan.name || "Care Plan";
  const planDesc = plan.description || "Care Mitra visits & family connectivity";
  const base = Number(plan.basePrice) || 4999;
  const isFeatured = plan.isPopular || plan.tone === "featured";

  // Compute price based on selected billing cycle
  const durNum = parseInt(selectedCycle, 10) || 3;
  const displayPrice = getPackageDisplayPrice(plan, selectedCycle);
  const monthlyPrice = durNum > 0 ? Math.round(displayPrice / durNum) : displayPrice;

  let cycleLabel = "billed monthly";
  if (durNum === 3) {
    cycleLabel = "billed for 3 months";
  } else if (durNum === 6) {
    cycleLabel = "billed for 6 months";
  } else if (durNum === 12) {
    cycleLabel = "billed annually";
  }

  const fullTermCost = base * durNum;
  const savings = durNum > 1 ? Math.max(0, fullTermCost - displayPrice) : 0;

  // Extract all formatted benefits: merges backend benefits with standard inclusions
  const formattedBenefits = useMemo(() => {
    const list = [];

    if (Array.isArray(plan.packageBenefits) && plan.packageBenefits.length > 0) {
      plan.packageBenefits.forEach((pb, idx) => {
        const benefitName = pb.benefit?.name || "Included Benefit";
        const rawLabel = (pb.benefit?.unitLabel || "").replace(/^per\s+/i, "").trim();
        const period = pb.unitsPeriod || "monthly";
        let displayText = "";
        if (pb.showUnit === false) {
          displayText = benefitName;
        } else if (pb.isUnlimited) {
          displayText = `Unlimited • ${benefitName}`;
        } else {
          const base = pb.unitsIncluded ?? 0;
          let periodText = "";
          if (period === "monthly") periodText = "/month";
          else if (period === "yearly") periodText = "/year";
          else if (period === "3_months") periodText = "/quarter";
          else if (period === "6_months") periodText = "/half-year";
          else if (period === "one_time") periodText = " (once)";

          const unitText = rawLabel ? ` ${rawLabel}` : "";
          displayText = `${base}${unitText}${periodText} • ${benefitName}`;
        }

        list.push({
          id: pb.id || `pb-${idx}`,
          text: displayText,
          rollover: pb.allowRollover,
        });
      });
    } else if (Array.isArray(plan.features) && plan.features.length > 0) {
      plan.features.forEach((feat, i) => {
        list.push({
          id: `feat-${i}`,
          text: feat,
          rollover: false,
        });
      });
    }

    return list;
  }, [plan]);

  // The enriched plan object to pass to checkout and details modal
  const planForCheckout = {
    ...plan,
    selectedDurationMonths: durNum,
    selectedCycle: String(durNum),
    calculatedPrice: displayPrice,
    cycleLabel,
    monthlyRate: monthlyPrice,
    savings,
    allFormattedBenefits: formattedBenefits,
  };

  // Display top 5 benefits in card preview, rest visible in popup modal via Read More
  const previewBenefits = formattedBenefits.slice(0, 5);
  const remainingCount = Math.max(0, formattedBenefits.length - 5);

  return (
    <article
      className={`plan-card ${isSelected ? "plan-card--selected selected" : ""} ${isFeatured ? "featured plan-card--featured" : ""}`}
      onClick={() => onCardClick && onCardClick(plan)}
    >
      {/* 1. Standardized Badge Slot - identical 26px height across all cards */}
      <div className="plan-card__badge-slot">
        {isSelected ? (
          <span className="plan-card__badge plan-card__badge--active">
            ✓ Selected Plan
          </span>
        ) : isFeatured ? (
          <span className="plan-card__badge">
            ★ {plan.badgeText || "Most Popular"}
          </span>
        ) : (
          <span className="plan-card__badge-placeholder" />
        )}
      </div>

      {/* 2. Standardized Title */}
      <h2 className="plan-card__title" title={planName}>
        {planName}
      </h2>

      {/* 3. Standardized Description */}
      <p className="plan-card__desc" title={planDesc}>
        {planDesc}
      </p>

      {/* 4. Standardized Pricing Box (175px fixed height) */}
      <div className="plan-hours">
        <div className="plan-hours__primary-price">
          <span className="plan-hours__currency">₹</span>
          <strong className="plan-hours__monthly-rate">
            {monthlyPrice.toLocaleString("en-IN")}
          </strong>
          <span className="plan-hours__period">/month</span>
        </div>

        <div className="plan-hours__total-billed">
          {durNum > 1 ? (
            <>
              <span className="plan-hours__total-label">Total:</span>
              <strong className="plan-hours__total-amount">
                ₹{displayPrice.toLocaleString("en-IN")}
              </strong>
              <span className="plan-hours__cycle-tag">({cycleLabel})</span>
            </>
          ) : (
            <span className="plan-hours__cycle-tag">Billed monthly</span>
          )}
        </div>

        <div className="plan-hours__savings-slot">
          {savings > 0 ? (
            <span className="plan-hours__savings-pill">
              Save ₹{savings.toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="plan-hours__savings-pill plan-hours__savings-pill--standard">
              Standard Plan Rate
            </span>
          )}
        </div>
      </div>

      {/* 5. Standardized Features Preview List (5 items visible) */}
      <ul className="plan-card__features-list">
        {previewBenefits.map((b) => (
          <li key={b.id} className="plan-card__feature-item">
            <span className="plan-card__check">✓</span>
            <span className="plan-card__feature-text" title={b.text}>
              {b.text}
            </span>
            {b.rollover && (
              <span className="plan-card__rollover-tag">Rollover</span>
            )}
          </li>
        ))}
      </ul>

      {/* 6. Read More Link (matching reference design) */}
      <button
        type="button"
        className="plan-card__read-more-link"
        onClick={(e) => {
          e.stopPropagation();
          onCardClick && onCardClick(plan);
          onOpenDetails && onOpenDetails(planForCheckout);
        }}
      >
        Read more
      </button>

      {/* 7. Bottom Fixed Get Started Button */}
      <button
        type="button"
        className="plan-card__cta-btn"
        onClick={(e) => {
          e.stopPropagation();
          onCardClick && onCardClick(plan);
          onSelectPackage && onSelectPackage(planForCheckout);
        }}
      >
        Get Started <span>→</span>
      </button>
    </article>
  );
}
