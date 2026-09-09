import React, { useState } from "react";
import logo from "../../assets/logo.svg";
import headerBgVideo from "../../assets/Header Video.mp4";

/**
 * Header Component - Site Navigation and User Actions Bar
 */
const Header = ({ activePage, setActivePage, user, openForm }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="topbar" role="banner">
      {/* Background video */}
      <video
        className="topbar__bg-video"
        src={headerBgVideo}
        autoPlay
        muted
        loop
        playsInline
      />
      <a
        href="/"
        aria-label="MaiHoonNa home"
        className="topbar__brand"
        onClick={(e) => {
          e.preventDefault();
          handleNavClick("home");
        }}
      >
        <img src={logo} alt="MaiHoonNa - Senior Care Companion in Gurugram & Delhi NCR" width="238" height="42" loading="eager" fetchpriority="high" />
      </a>

      <nav className="topbar__nav" aria-label="Main navigation">
        <a
          href="/"
          className={activePage === "home" ? "active" : ""}
          onClick={(e) => {
            e.preventDefault();
            handleNavClick("home");
          }}
        >
          Home
        </a>
        <a
          href="/services"
          className={activePage === "services" ? "active" : ""}
          onClick={(e) => {
            e.preventDefault();
            handleNavClick("services");
          }}
        >
          Our Services
        </a>
        <a
          href="/saathi"
          className={activePage === "saathi" ? "active" : ""}
          onClick={(e) => {
            e.preventDefault();
            handleNavClick("saathi");
          }}
        >
          Saathi Network
        </a>
      </nav>

      <div className="topbar__actions">
        <a
          href="/plans"
          className={`view-plan-button ${activePage === "plans" ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            handleNavClick("plans");
          }}
        >
          View Plans
        </a>



        {user ? (
          <button
            className="user-account-btn"
            onClick={() => handleNavClick("account")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "20px",
              background: "var(--orange-soft, #fff0e7)",
              color: "var(--orange, #fe6700)",
              fontWeight: "700",
              fontSize: "13px",
              border: "1px solid rgba(254, 103, 0, 0.2)",
              cursor: "pointer",
            }}
          >
            👤 {user.name || "My Account"}
          </button>
        ) : (
          <button
            className="pill-button pill-button--light"
            onClick={() => handleNavClick("auth")}
          >
            Sign Up
          </button>
        )}

        {/* Mobile Hamburger Menu Button */}
        <button
          className="topbar__hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="topbar__mobile-menu">
          <a
            href="/"
            className={activePage === "home" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("home");
            }}
          >
            🏠 Home
          </a>
          <a
            href="/services"
            className={activePage === "services" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("services");
            }}
          >
            ✨ Our Services
          </a>
          <a
            href="/saathi"
            className={activePage === "saathi" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("saathi");
            }}
          >
            🤝 Saathi Network
          </a>
          <a
            href="/plans"
            className={activePage === "plans" ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("plans");
            }}
          >
            📋 View Plans
          </a>

        </div>
      )}
    </header>
  );
};

export default Header;
