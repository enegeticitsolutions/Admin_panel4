import React, { useState, useEffect, useMemo } from "react";
import PackageCard from "../components/packages/PackageCard";
import planBgVideo from "../assets/Plan-Header-Background-Video.mp4";



const defaultFaqs = [
  "Who is a Care Mitra?",
  "How is MaiHoonNa different from hiring a caregiver directly?",
  "What happens if I am not happy with my Care Mitra?",
  "How does the Happiness Score work?",
  "Can I manage care from abroad as an NRI?",
  "Is MaiHoonNa available outside Gurugram?",
  "What does the Saathi Network do?",
  "Can I change or cancel my plan?",
];

export default function PlansPage({
  livePackages = [],
  onSelectPackage,
  openForm,
  formData = {},
  handleInputChange = () => {},
  handleSubmit = (e) => e.preventDefault(),
  isSubmitting = false,
  showSuccess = false,
}) {
  const [selectedCycle, setSelectedCycle] = useState("1");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cardsPerView, setCardsPerView] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return 1;
      if (window.innerWidth < 1100) return 2;
    }
    return 3;
  });

  const packagesToDisplay = livePackages;
  const maxSlide = Math.max(0, packagesToDisplay.length - cardsPerView);

  // ── Dynamic Comparison Table Logic ──
  // 1. Pick 3 packages to compare: prefer packages marked isCompared, or top 3 active
  const comparedPackages = useMemo(() => {
    const pkgs = packagesToDisplay;
    const flagged = pkgs.filter((p) => p.isCompared);
    if (flagged.length > 0) {
      return flagged.slice(0, 3);
    }
    return pkgs.slice(0, 3);
  }, [packagesToDisplay]);

  // 2. Extract all unique Benefits from live packages (or all packages)
  const comparisonBenefits = useMemo(() => {
    const benefitMap = new Map();

    comparedPackages.forEach((pkg) => {
      if (Array.isArray(pkg.packageBenefits)) {
        pkg.packageBenefits.forEach((pb) => {
          if (pb.benefit && pb.benefit.id && !benefitMap.has(pb.benefit.id)) {
            benefitMap.set(pb.benefit.id, {
              id: pb.benefit.id,
              name: pb.benefit.name,
              unitLabel: pb.benefit.unitLabel,
              displayOrder: pb.benefit.displayOrder ?? 0,
            });
          }
        });
      }
    });

    if (benefitMap.size > 0) {
      return Array.from(benefitMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );
    }

    return null;
  }, [comparedPackages]);

  // Update cardsPerView on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCardsPerView(1);
      } else if (window.innerWidth < 1100) {
        setCardsPerView(2);
      } else {
        setCardsPerView(3);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clamp currentSlide if maxSlide changes
  useEffect(() => {
    if (currentSlide > maxSlide) {
      setCurrentSlide(maxSlide);
    }
  }, [maxSlide, currentSlide]);

  // Auto slide from right to left every 2.5 seconds (pauses on hover)
  useEffect(() => {
    if (isPaused || maxSlide <= 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev >= maxSlide ? 0 : prev + 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [isPaused, maxSlide]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : maxSlide));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < maxSlide ? prev + 1 : 0));
  };

  return (
    <main className="plans-page">
      {/* ── Plans Hero ── */}
      <section className="plans-hero">
        {/* Background video */}
        <video
          className="plans-hero__bg-video"
          src={planBgVideo}
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="plans-hero__inner">
          <div className="plans-hero__copy">
            <span>Plans</span>
            <h1>
              Built around hours,
              <em>not fine print.</em>
            </h1>
            <p>
              Prepaid hours of in-home care. You always know exactly what you've used and what's left - no surprises.
            </p>
            <div className="plans-hero__badges">
              <div className="plans-hero__badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <polyline points="9 12 11 14 15 10"/>
                </svg>
                <span>No hidden fees</span>
              </div>
              <div className="plans-hero__badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Hours roll over 30 days</span>
              </div>
              <div className="plans-hero__badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="9 12 11 14 15 9"/>
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          <div className="hours-card" aria-label="Your hours always visible">
            <h2>YOUR HOURS — ALWAYS VISIBLE</h2>
            {[
              ["Saathi Starter", "7", "10", "3", "#10B981"],
              ["Saathi Plus", "18", "25", "7", "#FE6700"],
              ["Saathi Premium", "31", "50", "19", "#7C3AED"],
            ].map(([name, used, total, remaining, color]) => (
              <div className="hours-row" key={name}>
                <div className="hours-row__header">
                  <strong className="hours-row__name">{name}</strong>
                  <span className="hours-row__ratio">
                    <strong>{used}</strong> / {total} hrs used
                  </span>
                </div>
                <div className="hours-bar">
                  <span style={{ width: `${(Number(used) / Number(total)) * 100}%`, background: color }} />
                </div>
                <div className="hours-row__footer">
                  <span className="hours-row__used">{used} hrs used</span>
                  <em className="hours-row__remaining" style={{ color }}>{remaining} hrs remaining</em>
                </div>
              </div>
            ))}
            <div className="rollover-note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Unused hours roll over for <strong>30 days</strong> automatically</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section className="pricing-section" id="plans">
        <div className="pricing-toolbar">
          <strong>All prices on enquiry · GST applicable</strong>
          <div className="billing-toggle" aria-label="Billing cycle">
            <button
              className={selectedCycle === "1" ? "active" : ""}
              onClick={() => setSelectedCycle("1")}
            >
              Monthly
            </button>
            <button
              className={selectedCycle === "3" ? "active" : ""}
              onClick={() => setSelectedCycle("3")}
            >
              3 Months <span>Save 5%</span>
            </button>
            <button
              className={selectedCycle === "6" ? "active" : ""}
              onClick={() => setSelectedCycle("6")}
            >
              6 Months <span>Save 10%</span>
            </button>
            <button
              className={selectedCycle === "12" ? "active" : ""}
              onClick={() => setSelectedCycle("12")}
            >
              Annual <span>Save 20%</span>
            </button>
          </div>
        </div>

        {/* ── Card-wise Carousel Slider ── */}
        <div
          className="plan-slider-wrapper"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {maxSlide > 0 && (
            <>
              <button
                type="button"
                className="plan-slider-arrow plan-slider-arrow--prev"
                onClick={handlePrevSlide}
                aria-label="Previous plans"
              >
                ‹
              </button>
              <button
                type="button"
                className="plan-slider-arrow plan-slider-arrow--next"
                onClick={handleNextSlide}
                aria-label="Next plans"
              >
                ›
              </button>
            </>
          )}

          <div
            className="plan-slider-track"
            style={{
              transform: `translateX(calc(-${currentSlide} * (100% + 22px) / ${cardsPerView}))`,
            }}
          >
            {packagesToDisplay.map((plan) => (
              <div
                className="plan-slider-item"
                key={plan.id || plan.name}
                style={{
                  width: `calc((100% - ${(cardsPerView - 1) * 22}px) / ${cardsPerView})`,
                }}
              >
                <PackageCard
                  plan={plan}
                  selectedCycle={selectedCycle}
                  onSelectPackage={onSelectPackage}
                />
              </div>
            ))}
          </div>

          {/* Pagination Dot Indicators */}
          {maxSlide > 0 && (
            <div className="plan-slider-dots" aria-label="Package slider pagination">
              {Array.from({ length: maxSlide + 1 }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`plan-slider-dot ${currentSlide === idx ? "active" : ""}`}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <p className="pricing-note">
          No hidden caps - No surprise renewals - Plans available monthly, quarterly, and annually - Pricing on enquiry
        </p>

        {/* ── Dynamic Feature Comparison Table ── */}
        <div className="comparison">
          <div className="comparison__heading">
            <h2>Full feature comparison</h2>
            <p>Everything side by side, so you can choose with clarity.</p>
          </div>
          <div className="comparison-table" role="table" aria-label="Full feature comparison">
            <div className="comparison-row comparison-row--head" role="row">
              <span>Feature</span>
              {comparedPackages.map((pkg) => (
                <strong key={pkg.id || pkg.name}>{pkg.name}</strong>
              ))}
            </div>

            {comparisonBenefits && comparisonBenefits.length > 0 ? (
              comparisonBenefits.map((benefit) => (
                <div className="comparison-row" role="row" key={benefit.id}>
                  <span>{benefit.name}</span>
                  {comparedPackages.map((pkg) => {
                    const matchedPb = Array.isArray(pkg.packageBenefits)
                      ? pkg.packageBenefits.find(
                          (pb) =>
                            pb.benefitId === benefit.id ||
                            pb.benefit?.id === benefit.id
                        )
                      : null;
                    const isIncluded = !!matchedPb;
                    let displayVal = "-";
                    if (isIncluded) {
                      if (matchedPb.isUnlimited) {
                        displayVal = "Unlimited";
                      } else if (matchedPb.unitsPeriod === "yearly") {
                        displayVal = `${matchedPb.unitsIncluded}/yr`;
                      } else if (matchedPb.unitsPeriod === "one_time") {
                        displayVal = `${matchedPb.unitsIncluded} (Once)`;
                      } else {
                        displayVal = `${matchedPb.unitsIncluded}/mo`;
                      }
                    }

                    return (
                      <strong
                        className={isIncluded ? "included" : "not-included"}
                        key={`${benefit.id}-${pkg.id || pkg.name}`}
                        style={isIncluded ? { fontSize: "0.85rem", fontWeight: 700 } : {}}
                      >
                        {displayVal}
                      </strong>
                    );
                  })}
                </div>
              ))
            ) : (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                No active package benefits available for comparison.
              </div>
            )}
          </div>
        </div>

        {/* ── Bespoke Banner ── */}
        <div className="bespoke-banner">
          <div>
            <span>Bespoke Plans</span>
            <h2>Bespoke Palliative Plans</h2>
            <p>
              For families navigating advanced illness. Custom-built hours, specialist Care Mitra matching, and coordinated multi-disciplinary support - designed together with your family.
            </p>
            <ul>
              <li>Custom hours &amp; schedule</li>
              <li>Specialist Mitra matching</li>
              <li>Palliative care coordination</li>
              <li>Family counselling support</li>
            </ul>
          </div>
          <button onClick={openForm}>Contact Us</button>
        </div>
      </section>

      {/* ── Quote Callback Form ── */}
      <section className="quote-section">
        <form className="quote-card" onSubmit={handleSubmit}>
          <h2>Get a personalised quote</h2>
          <p>Tell us which plan interests you and we'll call back within 2 hours with pricing and availability for your area.</p>
          
          <div className="quote-grid">
            <label>
              <span>Your name</span>
              <input
                name="name"
                placeholder="Rahul Gupta"
                value={formData.name || ""}
                onChange={handleInputChange}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                name="phone"
                placeholder="+91 98765 43210"
                value={formData.phone || ""}
                onChange={handleInputChange}
              />
            </label>
          </div>

          <div className="plan-pills-group">
            <span className="plan-pills-label">Interested plan</span>
            <div className="plan-pills" aria-label="Interested plan">
              {["Saathi Starter", "Saathi Plus", "Saathi Premium", "Bespoke"].map((plan) => {
                const isSelected = (formData.interestedPlan || "Saathi Starter") === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    className={`plan-pill ${isSelected ? "plan-pill--active" : ""}`}
                    onClick={() => handleInputChange({ target: { name: "interestedPlan", value: plan } })}
                  >
                    {plan}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="quote-field-full">
            <span>Your area</span>
            <input
              name="pinCode"
              placeholder="e.g. Gurugram Sector 55"
              value={formData.pinCode || ""}
              onChange={handleInputChange}
            />
          </label>

          <button type="submit" disabled={isSubmitting || showSuccess}>
            {isSubmitting ? "Requesting..." : "Request a Callback"}
          </button>
        </form>
      </section>

      {/* ── FAQ Section ── */}
      <section className="faq plans-faq">
        <div className="section-heading">
          <span>FAQ</span>
          <h2>Questions we hear often</h2>
          <p>
            Can't find what you're looking for? Write to us at{" "}
            <a href="mailto:info@maihoonna.com">info@maihoonna.com</a>
          </p>
        </div>

        <div className="faq-list">
          {defaultFaqs.map((question) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>Our team will help you understand the right care flow, plan, and support model for your family.</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
