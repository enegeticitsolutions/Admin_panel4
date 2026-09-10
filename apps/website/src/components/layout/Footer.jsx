import React from "react";
import logo from "../../assets/logo.svg";
import googlePlayImg from "../../assets/googleplay.png";
import appStoreImg from "../../assets/appstore.png";
import { SITE_LINKS } from "../../constants/links";

/**
 * Footer Component - Site-wide Footer with brand, links, social, and copyright
 */
const Footer = ({ setActivePage }) => {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <a
            onClick={(e) => {
              e.preventDefault();
              setActivePage && setActivePage("home");
            }}
            href="/"
            aria-label="MaiHoonNa home"
          >
            <img src={logo} alt="MaiHoonNa - Senior Care Ecosystem" loading="lazy" width="238" height="42" />
          </a>
          <p>
            India's connected senior care ecosystem. Compassionate Care Mitras, Saathi Network, and real-time family visibility — all in one subscription.
          </p>

          {/* Social Links */}
          <div className="social-row">
            <a href={SITE_LINKS.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </a>
            <a href={SITE_LINKS.social.twitter} aria-label="X (Twitter)" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href={SITE_LINKS.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
            <a href={SITE_LINKS.social.youtube} aria-label="YouTube" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="5" ry="5" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
            </a>
          </div>

          {/* App Store Download Cards */}
          <div className="footer-download-cards">
            {/* Card 1: Family Connect App */}
            <div className="footer-download-card">
              <div className="footer-download-card__badges">
                <a href={SITE_LINKS.appStore.familyConnect.googlePlay} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={googlePlayImg} alt="Get MaiHoonNa Family Connect App on Google Play" loading="lazy" width="115" height="34" />
                </a>
                <a href={SITE_LINKS.appStore.familyConnect.appleAppStore} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={appStoreImg} alt="Download MaiHoonNa Family Connect App on Apple App Store" loading="lazy" width="115" height="34" />
                </a>
              </div>
              <span className="footer-download-card__label">Family Connect App</span>
            </div>

            {/* Card 2: Saathi App */}
            <div className="footer-download-card">
              <div className="footer-download-card__badges">
                <a href={SITE_LINKS.appStore.saathi.googlePlay} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={googlePlayImg} alt="Get MaiHoonNa Saathi App on Google Play" loading="lazy" width="115" height="34" />
                </a>
                <a href={SITE_LINKS.appStore.saathi.appleAppStore} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={appStoreImg} alt="Download MaiHoonNa Saathi App on Apple App Store" loading="lazy" width="115" height="34" />
                </a>
              </div>
              <span className="footer-download-card__label">Saathi App</span>
            </div>
          </div>
        </div>

        {/* Footer Link Columns */}
        <div className="footer-links">
          <div>
            <h3>ABOUT US</h3>
            {SITE_LINKS.about.map((item, idx) => (
              <a
                key={idx}
                href={item.href || "#"}
                onClick={(e) => {
                  if (item.page && setActivePage) {
                    e.preventDefault();
                    setActivePage(item.page);
                  }
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div>
            <h3>SERVICES</h3>
            {SITE_LINKS.services.map((item, idx) => (
              <a
                key={idx}
                href={item.href || "#"}
                onClick={(e) => {
                  if (item.page && setActivePage) {
                    e.preventDefault();
                    setActivePage(item.page);
                  }
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div>
            <h3>TERMS AND POLICIES</h3>
            {SITE_LINKS.policies.map((item, idx) => (
              <a
                key={idx}
                href={item.href}
                onClick={(e) => {
                  if (item.page && setActivePage) {
                    e.preventDefault();
                    setActivePage(item.page);
                  }
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom__left">
          <span>Copyright : &copy; 2026 MaiHoonNa Eldercare Private Limited. All rights reserved.</span>
        </div>
        <div className="footer-bottom__right">
          <span>Made with <span className="heart-icon">❤️</span> for every Indian family</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
