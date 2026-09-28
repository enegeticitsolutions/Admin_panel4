import React, { useState, useMemo, useEffect, useRef } from "react";
import { customList } from "country-codes-list";
import { Globe, Search, X, CheckCircle2, ChevronDown } from "lucide-react";
import "./CountryPickerModal.css";

// Helper to retrieve countries list once
let cachedCountries = null;
export function getCountriesList() {
  if (cachedCountries) return cachedCountries;
  try {
    const list = customList("countryCode", "{countryNameEn}|{countryCallingCode}|{flag}");
    cachedCountries = Object.keys(list)
      .map((iso) => {
        const [name, callingCode, flag] = list[iso].split("|");
        return {
          code: iso,
          name: name || iso,
          callingCode: callingCode || "",
          flag: flag || "🌐",
        };
      })
      .filter((c) => c.callingCode) // only include valid calling codes
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error("Failed to load country list:", e);
    cachedCountries = [
      { code: "IN", name: "India", callingCode: "91", flag: "🇮🇳" },
      { code: "US", name: "United States", callingCode: "1", flag: "🇺🇸" },
      { code: "GB", name: "United Kingdom", callingCode: "44", flag: "🇬🇧" },
      { code: "AE", name: "United Arab Emirates", callingCode: "971", flag: "🇦🇪" },
      { code: "CA", name: "Canada", callingCode: "1", flag: "🇨🇦" },
      { code: "AU", name: "Australia", callingCode: "61", flag: "🇦🇺" },
      { code: "SG", name: "Singapore", callingCode: "65", flag: "🇸🇬" },
    ];
  }
  return cachedCountries;
}

/**
 * CountryCodeButton - Trigger button for opening country picker
 */
export function CountryCodeButton({
  countryCode = "91",
  onClick,
  disabled = false,
  className = "",
  style = {},
  showFlag = true,
}) {
  const countries = useMemo(() => getCountriesList(), []);
  
  // Find matching country flag (prefer exact code match like IN for 91, US for 1, etc.)
  const country = useMemo(() => {
    const clean = String(countryCode).replace("+", "").trim();
    if (clean === "91") return countries.find((c) => c.code === "IN") || { flag: "🇮🇳" };
    if (clean === "1") return countries.find((c) => c.code === "US") || { flag: "🇺🇸" };
    if (clean === "44") return countries.find((c) => c.code === "GB") || { flag: "🇬🇧" };
    return countries.find((c) => c.callingCode === clean) || { flag: "" };
  }, [countryCode, countries]);

  return (
    <button
      type="button"
      className={`country-code-trigger-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={`Select country code. Current: +${countryCode}`}
    >
      {showFlag && country?.flag && (
        <span className="country-code-flag" aria-hidden="true">
          {country.flag}
        </span>
      )}
      <span className="country-code-text">+{countryCode}</span>
      <ChevronDown size={14} className="country-code-chevron" />
    </button>
  );
}

/**
 * CountryPickerModal - Modal/bottom sheet for picking country calling code
 */
export function CountryPickerModal({
  visible = false,
  onClose,
  onSelect,
  selectedCode = "91",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const countries = useMemo(() => getCountriesList(), []);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.toLowerCase().trim().replace(/^\+/, "");
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.callingCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery, countries]);

  // Handle body scroll locking & keyboard events
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus search input with small delay for animation
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  // Clean selected code for comparison
  const cleanSelected = String(selectedCode).replace("+", "").trim();

  if (!visible) return null;

  return (
    <div
      className="country-picker-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Select Country Code"
    >
      <div className="country-picker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Mobile handle indicator */}
        <div className="country-picker-handle" />

        {/* Modal Header */}
        <div className="country-picker-header">
          <div className="country-picker-header-left">
            <div className="country-picker-globe-icon">
              <Globe size={20} />
            </div>
            <h3 className="country-picker-title">Select Country Code</h3>
          </div>
          <button
            type="button"
            className="country-picker-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="country-picker-search-wrap">
          <Search size={18} color="#9CA3AF" style={{ flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            className="country-picker-search-input"
            placeholder="Search country or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          {searchQuery && (
            <button
              type="button"
              className="country-picker-clear-btn"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="country-picker-divider" />

        {/* Country List */}
        <div className="country-picker-list" ref={listRef}>
          {filteredCountries.length === 0 ? (
            <div className="country-picker-empty">
              No country found matching "{searchQuery}"
            </div>
          ) : (
            filteredCountries.map((item) => {
              const isSelected = item.callingCode === cleanSelected;
              return (
                <div
                  key={`${item.code}-${item.callingCode}`}
                  className={`country-picker-item ${isSelected ? "country-picker-item--selected" : ""}`}
                  onClick={() => {
                    onSelect?.(item.callingCode, item);
                    onClose?.();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(item.callingCode, item);
                      onClose?.();
                    }
                  }}
                >
                  <div className="country-picker-item-left">
                    <span className="country-picker-flag">{item.flag}</span>
                    <span
                      className={`country-picker-name ${isSelected ? "country-picker-name--selected" : ""}`}
                    >
                      {item.name}
                    </span>
                  </div>
                  <div className="country-picker-item-right">
                    <span
                      className={`country-picker-code ${isSelected ? "country-picker-code--selected" : ""}`}
                    >
                      +{item.callingCode}
                    </span>
                    {isSelected && (
                      <CheckCircle2 size={18} className="country-picker-check" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CountryPickerModal;
