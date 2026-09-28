import React, { useState, useEffect, useMemo, useRef } from "react";
import PackageCard, { getPackageDisplayPrice } from "../components/packages/PackageCard";
import PlanDetailsModal from "../components/modals/PlanDetailsModal";
import planBgVideo from "../assets/Plan-Header-Background-Video.mp4";
import {
  fetchActiveRegions,
  checkLocationServiceability,
  checkPincodeServiceability,
  fetchSubscriptionPackages,
} from "../services/api";

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
  isLoading = false,
  onSelectPackage,
  openForm,
  formData = {},
  handleInputChange = () => { },
  handleSubmit = (e) => e.preventDefault(),
  isSubmitting = false,
  showSuccess = false,
}) {
  const [selectedCycle, setSelectedCycle] = useState("1");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [modalPlan, setModalPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  // Regional & Location states
  const [packages, setPackages] = useState(livePackages);
  const [activeRegions, setActiveRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [pincodeInput, setPincodeInput] = useState("");
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");
  const [isServiceable, setIsServiceable] = useState(null);

  // Custom Dropdown states
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [regionSearchQuery, setRegionSearchQuery] = useState("");
  const regionDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target)) {
        setIsRegionDropdownOpen(false);
      }
    };
    if (isRegionDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRegionDropdownOpen]);

  // Filtered regions for search inside custom dropdown
  const filteredRegions = useMemo(() => {
    if (!regionSearchQuery.trim()) return activeRegions;
    const query = regionSearchQuery.toLowerCase().trim();
    return activeRegions.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.city && r.city.toLowerCase().includes(query))
    );
  }, [activeRegions, regionSearchQuery]);

  const [cardsPerView, setCardsPerView] = useState(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return 1;
      if (window.innerWidth < 1100) return 2;
    }
    return 3;
  });

  // Fetch active regions on mount
  useEffect(() => {
    fetchActiveRegions()
      .then((regions) => {
        if (Array.isArray(regions)) setActiveRegions(regions);
      })
      .catch((err) => {
        console.warn("Could not load active regions:", err);
      });
  }, []);

  // Sync packages with livePackages prop when no custom region is selected
  useEffect(() => {
    if (!selectedRegion && Array.isArray(livePackages)) {
      setPackages(livePackages);
    }
  }, [livePackages, selectedRegion]);

  // Handler: Select Region from dropdown
  const handleRegionSelect = async (regionId) => {
    setIsRegionDropdownOpen(false);
    setRegionSearchQuery("");
    if (!regionId) {
      await handleClearLocation();
      return;
    }
    const region = activeRegions.find((r) => r.id === regionId);
    if (!region) return;

    setSelectedRegion(region);
    setSelectedAddress(`${region.name} (${region.city})`);
    setPincodeInput("");
    setIsCheckingLocation(true);
    setServiceMessage("");
    setIsServiceable(true);

    try {
      const pkgs = await fetchSubscriptionPackages(region.id);
      setPackages(pkgs);
      const regionalCount = pkgs.filter((p) => !p.isGlobal).length;
      const globalCount = pkgs.filter((p) => p.isGlobal).length;
      const allRegional = pkgs.length > 0 && pkgs.every((p) => p.isGlobal === false);
      if (allRegional) {
        setServiceMessage(
          `Showing ${regionalCount} local plan${regionalCount !== 1 ? "s" : ""} exclusively available in ${region.name} (${region.city}).`
        );
      } else {
        setServiceMessage(
          `Serving ${region.name} (${region.city})! Showing ${regionalCount > 0 ? `${regionalCount} exclusive local plan${regionalCount > 1 ? "s" : ""} + ` : ""}${globalCount} Global package${globalCount !== 1 ? "s" : ""}.`
        );
      }
    } catch (err) {
      console.error("Failed to load regional packages:", err);
      setServiceMessage(`Showing packages for ${region.name}.`);
    } finally {
      setIsCheckingLocation(false);
      setCurrentSlide(0);
    }
  };

  // Handler: Check Pincode
  const handleCheckPincode = async (e) => {
    if (e) e.preventDefault();
    const pin = pincodeInput.trim();
    if (!pin || pin.length !== 6) {
      setServiceMessage("Please enter a valid 6-digit pincode.");
      setIsServiceable(false);
      return;
    }

    setIsCheckingLocation(true);
    setServiceMessage("");
    try {
      const result = await checkPincodeServiceability(pin);
      if (result.success && result.data && (result.data.isServiceable || result.data.available)) {
        const region = result.data.region;
        setIsServiceable(true);
        setSelectedAddress(result.data.location || `Pincode ${pin}`);
        if (region && region.id) {
          const matched = activeRegions.find((r) => r.id === region.id) || region;
          setSelectedRegion(matched);
          const pkgs = await fetchSubscriptionPackages(region.id);
          setPackages(pkgs);
          const regionalCount = pkgs.filter((p) => !p.isGlobal).length;
          setServiceMessage(
            result.data.message || `Serving ${result.data.location || pin}! Showing ${regionalCount > 0 ? `${regionalCount} local plan${regionalCount > 1 ? "s" : ""} + ` : ""}all Global packages.`
          );
        } else {
          const pkgs = await fetchSubscriptionPackages();
          setPackages(pkgs);
          setServiceMessage(result.data.message || `Serving ${pin}! Showing available packages.`);
        }
      } else {
        setIsServiceable(false);
        setSelectedRegion(null);
        setSelectedAddress(`Pincode ${pin}`);
        const pkgs = await fetchSubscriptionPackages();
        setPackages(pkgs);
        setServiceMessage(result?.message || "We don't serve this pincode with local packages yet. Showing all Global packages.");
      }
    } catch (err) {
      console.error("Error checking pincode:", err);
      setIsServiceable(false);
      setServiceMessage("Could not verify pincode. Please try again or select your region.");
    } finally {
      setIsCheckingLocation(false);
      setCurrentSlide(0);
    }
  };

  // Handler: Detect GPS Location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setServiceMessage("Geolocation is not supported by your browser. Please select your region.");
      setIsServiceable(false);
      return;
    }

    setIsCheckingLocation(true);
    setServiceMessage("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const result = await checkLocationServiceability({ lat: latitude, lng: longitude });
          if (result.success && result.data && (result.data.isServiceable || result.data.available)) {
            const region = result.data.region;
            setIsServiceable(true);
            setSelectedAddress(result.data.location || "Current Location");
            if (region && region.id) {
              const matched = activeRegions.find((r) => r.id === region.id) || region;
              setSelectedRegion(matched);
              const pkgs = await fetchSubscriptionPackages(region.id);
              setPackages(pkgs);
              const regionalCount = pkgs.filter((p) => !p.isGlobal).length;
              setServiceMessage(
                result.data.message || `Serving ${result.data.location}! Showing ${regionalCount > 0 ? `${regionalCount} local plan${regionalCount > 1 ? "s" : ""} + ` : ""}all Global packages.`
              );
            } else {
              const pkgs = await fetchSubscriptionPackages();
              setPackages(pkgs);
              setServiceMessage(result.data.message || "Service available in your area! Showing packages.");
            }
          } else {
            setIsServiceable(false);
            setSelectedRegion(null);
            setSelectedAddress(result?.data?.location || "Current Location");
            const pkgs = await fetchSubscriptionPackages();
            setPackages(pkgs);
            setServiceMessage("We don't serve your exact area with local packages yet. Showing all Global packages.");
          }
        } catch (err) {
          console.error("Error checking GPS location:", err);
          setServiceMessage("Could not verify serviceability for current location.");
          setIsServiceable(false);
        } finally {
          setIsCheckingLocation(false);
          setCurrentSlide(0);
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);
        setServiceMessage("Location access denied or unavailable. Please choose your city from the list.");
        setIsServiceable(false);
        setIsCheckingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handler: Clear Location Reset
  const handleClearLocation = async () => {
    setSelectedRegion(null);
    setSelectedAddress("");
    setPincodeInput("");
    setServiceMessage("");
    setIsServiceable(null);
    setIsRegionDropdownOpen(false);
    setRegionSearchQuery("");
    setIsCheckingLocation(true);
    try {
      const pkgs = await fetchSubscriptionPackages();
      setPackages(pkgs);
    } catch (err) {
      console.error("Failed to reset packages:", err);
    } finally {
      setIsCheckingLocation(false);
      setCurrentSlide(0);
    }
  };

  // Enrich selected plan with region metadata before passing to buy handler
  const handleSelectPlan = (plan) => {
    const enrichedPlan = {
      ...plan,
      serviceRegionId: selectedRegion?.id || (Array.isArray(plan.regions) && plan.regions[0]?.id) || null,
      selectedRegionName: selectedRegion?.name || (Array.isArray(plan.regions) && plan.regions[0]?.name) || null,
      serviceAddress: selectedAddress || (selectedRegion ? `${selectedRegion.name} (${selectedRegion.city})` : null),
    };
    if (onSelectPackage) {
      onSelectPackage(enrichedPlan);
    }
  };

  // Sort packages from low to high price, prioritizing regional packages when region selected
  const packagesToDisplay = useMemo(() => {
    if (!Array.isArray(packages)) return [];
    return [...packages].sort((a, b) => {
      if (selectedRegion) {
        const aRegional = !a.isGlobal;
        const bRegional = !b.isGlobal;
        if (aRegional && !bRegional) return -1;
        if (!aRegional && bRegional) return 1;
      }
      const priceA = getPackageDisplayPrice(a, selectedCycle);
      const priceB = getPackageDisplayPrice(b, selectedCycle);
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [packages, selectedCycle, selectedRegion]);

  // Detect if ALL loaded packages are regional (isGlobal: false) — no global packages configured
  const isRegionalOnlyMode = useMemo(() => {
    if (!Array.isArray(packages) || packages.length === 0) return false;
    return packages.every((p) => p.isGlobal === false);
  }, [packages]);

  const maxSlide = Math.max(0, packagesToDisplay.length - cardsPerView);

  const activePlanId = useMemo(() => {
    if (selectedPlanId) return selectedPlanId;
    const popular = packagesToDisplay.find((p) => p.isPopular || p.tone === "featured");
    if (popular) return popular.id || popular.name;
    return packagesToDisplay[0]?.id || packagesToDisplay[0]?.name || null;
  }, [selectedPlanId, packagesToDisplay]);

  // ── Dynamic Comparison Table Logic ──
  // 1. Pick 3 packages to compare: prefer packages marked isCompared, or top 3 active
  const comparedPackages = useMemo(() => {
    const pkgs = packagesToDisplay;
    const flagged = pkgs.filter((p) => p.isCompared);
    if (flagged.length > 0) {
      return [...flagged]
        .sort((a, b) => {
          const priceA = getPackageDisplayPrice(a, selectedCycle);
          const priceB = getPackageDisplayPrice(b, selectedCycle);
          return priceA - priceB;
        })
        .slice(0, 3);
    }
    return pkgs.slice(0, 3);
  }, [packagesToDisplay, selectedCycle]);

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

  // Reset slide index when billing cycle changes so user views cards from lowest price
  useEffect(() => {
    setCurrentSlide(0);
  }, [selectedCycle]);

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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>No hidden fees</span>
              </div>
              <div className="plans-hero__badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Hours roll over 30 days</span>
              </div>
              <div className="plans-hero__badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 11 14 15 9" />
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
                    <strong>{used}</strong> / {total} hours used
                  </span>
                </div>
                <div className="hours-bar">
                  <span style={{ width: `${(Number(used) / Number(total)) * 100}%`, background: color }} />
                </div>
                <div className="hours-row__footer">
                  <span className="hours-row__used">{used} hours used</span>
                  <em className="hours-row__remaining" style={{ color }}>{remaining} hours remaining</em>
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
        {/* ── Regional Package & Location Selector Card ── */}
        <div className="plans-location-card">
          <div className="plans-location-card__header">
            <div className="plans-location-card__title-group">
              <div className="plans-location-card__icon-badge">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="plans-location-card__titles">
                <h3 className="plans-location-card__title">
                  {isRegionalOnlyMode ? "Select Your City to View Plans" : "Choose Your Location"}
                </h3>
                <p className="plans-location-card__subtitle">
                  {selectedRegion
                    ? (isRegionalOnlyMode
                        ? `Showing plans available in ${selectedRegion.name} (${selectedRegion.city})`
                        : `Showing local plans for ${selectedRegion.name} (${selectedRegion.city}) & all Global packages`)
                    : (isRegionalOnlyMode
                        ? "We currently serve select cities. Choose your city below to see plans available in your area."
                        : "Select your city or enter pincode to view exclusive local plans and rates")}
                </p>
              </div>
            </div>

            {/* Current Status Pill */}
            <div className="plans-location-card__status">
              {selectedRegion ? (
                <div className="plans-location-pill plans-location-pill--active">
                  <span className="plans-location-pill__dot" />
                  <span className="plans-location-pill__text">
                    Serving {selectedRegion.name} ({selectedRegion.city})
                  </span>
                  <button
                    type="button"
                    className="plans-location-pill__clear-btn"
                    onClick={handleClearLocation}
                    title="Reset to All Regions (Global Plans)"
                    aria-label="Reset location"
                  >
                    ✕
                  </button>
                </div>
              ) : selectedAddress ? (
                <div className="plans-location-pill plans-location-pill--active">
                  <span className="plans-location-pill__dot" />
                  <span className="plans-location-pill__text">{selectedAddress}</span>
                  <button
                    type="button"
                    className="plans-location-pill__clear-btn"
                    onClick={handleClearLocation}
                    title="Reset to All Regions (Global Plans)"
                    aria-label="Reset location"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className={`plans-location-pill ${isRegionalOnlyMode ? "plans-location-pill--regional-required" : "plans-location-pill--global"}`}>
                  <span>{isRegionalOnlyMode ? "📍 Select a City to Continue" : "🌐 All Regions (Global Plans)"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Controls Row */}
          <div className="plans-location-card__actions">
            {/* Custom Region Dropdown */}
            <div className="custom-region-dropdown" ref={regionDropdownRef}>
              <button
                type="button"
                className={`custom-region-dropdown__trigger ${isRegionDropdownOpen ? "custom-region-dropdown__trigger--open" : ""}`}
                onClick={() => setIsRegionDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isRegionDropdownOpen}
              >
                <div className="custom-region-dropdown__trigger-content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="custom-region-dropdown__trigger-label">
                    {selectedRegion
                      ? `${selectedRegion.name} — ${selectedRegion.city}`
                      : (isRegionalOnlyMode ? "Select your city..." : "All Regions (Global Plans)")}
                  </span>
                </div>
                <svg
                  className={`custom-region-dropdown__chevron ${isRegionDropdownOpen ? "custom-region-dropdown__chevron--rotated" : ""}`}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Custom Dropdown Floating Menu */}
              {isRegionDropdownOpen && (
                <div className="custom-region-dropdown__menu" role="listbox">
                  <div className="custom-region-dropdown__search-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      className="custom-region-dropdown__search-input"
                      placeholder="Search region or city..."
                      value={regionSearchQuery}
                      onChange={(e) => setRegionSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {regionSearchQuery && (
                      <button
                        type="button"
                        className="custom-region-dropdown__clear-search"
                        onClick={() => setRegionSearchQuery("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="custom-region-dropdown__list">
                    {/* All Regions (Global Plans) Option */}
                    <button
                      type="button"
                      className={`custom-region-dropdown__item ${!selectedRegion ? "custom-region-dropdown__item--selected" : ""}`}
                      onClick={() => handleRegionSelect("")}
                    >
                      <div className="custom-region-dropdown__item-icon">🌐</div>
                      <div className="custom-region-dropdown__item-info">
                        <span className="custom-region-dropdown__item-name">All Regions (Global Plans)</span>
                        <span className="custom-region-dropdown__item-sub">Showing national standard packages</span>
                      </div>
                      {!selectedRegion && <span className="custom-region-dropdown__check">✓</span>}
                    </button>

                    <div className="custom-region-dropdown__divider" />

                    {filteredRegions.length === 0 ? (
                      <div className="custom-region-dropdown__empty">
                        No matching regions found
                      </div>
                    ) : (
                      filteredRegions.map((r) => {
                        const isSelected = selectedRegion?.id === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={`custom-region-dropdown__item ${isSelected ? "custom-region-dropdown__item--selected" : ""}`}
                            onClick={() => handleRegionSelect(r.id)}
                          >
                            <div className="custom-region-dropdown__item-icon">📍</div>
                            <div className="custom-region-dropdown__item-info">
                              <span className="custom-region-dropdown__item-name">{r.name}</span>
                              <span className="custom-region-dropdown__item-sub">{r.city}</span>
                            </div>
                            {isSelected && <span className="custom-region-dropdown__check">✓</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pincode Input Form */}
            <form className="plans-pincode-form" onSubmit={handleCheckPincode}>
              <div className="plans-pincode-form__input-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="text"
                  maxLength="6"
                  className="plans-pincode-form__input"
                  placeholder="Enter 6-digit Pincode"
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
                  disabled={isCheckingLocation}
                  aria-label="Enter 6-digit pincode"
                />
              </div>
              <button
                type="submit"
                className="plans-pincode-form__submit"
                disabled={isCheckingLocation || pincodeInput.trim().length !== 6}
              >
                {isCheckingLocation ? "..." : "Check"}
              </button>
            </form>

            {/* Detect GPS Button */}
            <button
              type="button"
              className="plans-detect-btn"
              onClick={handleDetectLocation}
              disabled={isCheckingLocation}
              title="Detect current location via browser GPS"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
              <span>{isCheckingLocation ? "Detecting..." : "Detect Location"}</span>
            </button>
          </div>

          {/* Feedback message banner if serviceMessage */}
          {serviceMessage && (
            <div className={`plans-location-status-banner ${isServiceable ? "plans-location-status-banner--success" : "plans-location-status-banner--info"}`}>
              <span className="plans-location-status-banner__icon">{isServiceable ? "✓" : "ℹ"}</span>
              <span className="plans-location-status-banner__text">{serviceMessage}</span>
              {(selectedRegion || selectedAddress) && (
                <button
                  type="button"
                  className="plans-location-status-banner__reset-link"
                  onClick={handleClearLocation}
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading || isCheckingLocation ? (
          <div className="plans-loading-skeleton" aria-label="Loading plans...">
            <div className="plans-skeleton-card" />
            <div className="plans-skeleton-card" />
            <div className="plans-skeleton-card" />
          </div>
        ) : packagesToDisplay.length === 0 ? (
          /* ── Empty State: When no data is available or coming from database ── */
          <div className="plans-empty-state" id="plans-empty-state">
            <div className="plans-empty-state__icon-wrap">
              <div className="plans-empty-state__glow" aria-hidden="true" />
              <div className="plans-empty-state__icon-circle">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            <div className="plans-empty-state__badge">
              <span className="plans-empty-state__badge-dot" />
              <span>Updates in progress</span>
            </div>

            <h2 className="plans-empty-state__title">Custom Plans Arriving Shortly</h2>

            <p className="plans-empty-state__subtext">
              Our standard plans are currently being updated.
            </p>
          </div>
        ) : (
          <>
            {/* ── Regional-Only Marketing Banner (shown when no region is selected) ── */}
            {isRegionalOnlyMode && !selectedRegion && (
              <div className="regional-serving-banner" id="regional-serving-banner">
                <div className="regional-serving-banner__left">
                  <div className="regional-serving-banner__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="regional-serving-banner__text">
                    <span className="regional-serving-banner__headline">
                      Currently serving in:
                    </span>
                    <div className="regional-serving-banner__cities-scroll">
                      {activeRegions.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="regional-serving-banner__city-chip"
                          onClick={() => handleRegionSelect(r.id)}
                          title={`See plans for ${r.name}`}
                        >
                          📍 {r.name}
                          <span className="regional-serving-banner__city-sub">{r.city}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="regional-serving-banner__cta">
                  <span className="regional-serving-banner__cta-text">
                    Select your city for accurate local pricing
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            )}

            <div className="pricing-toolbar">
              <strong>All prices on enquiry · GST applicable</strong>
              <div className="billing-toggle" aria-label="Billing cycle">
                <button
                  className={selectedCycle === "1" ? "active" : ""}
                  onClick={() => setSelectedCycle("1")}
                >
                  1 Month
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
                      isSelected={(plan.id || plan.name) === activePlanId}
                      onCardClick={() => setSelectedPlanId(plan.id || plan.name)}
                      onSelectPackage={handleSelectPlan}
                      onOpenDetails={(p) => setModalPlan(p)}
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
                          if (matchedPb.showUnit === false) {
                            displayVal = "Included";
                          } else if (matchedPb.isUnlimited) {
                            displayVal = "Unlimited";
                          } else if (matchedPb.unitsPeriod === "yearly") {
                            displayVal = `${matchedPb.unitsIncluded}/year`;
                          } else if (matchedPb.unitsPeriod === "one_time") {
                            displayVal = `${matchedPb.unitsIncluded} (Once)`;
                          } else {
                            displayVal = `${matchedPb.unitsIncluded}/month`;
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
          </>
        )}

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

      {/* ── Full Package Details Popup Modal ── */}
      <PlanDetailsModal
        isOpen={!!modalPlan}
        plan={modalPlan}
        selectedCycle={selectedCycle}
        onClose={() => setModalPlan(null)}
        onSelectPackage={handleSelectPlan}
      />

    </main>
  );
}
