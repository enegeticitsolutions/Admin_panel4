import React from "react";
import googlePlayImg from "../../assets/googleplay.png";
import appStoreImg from "../../assets/appstore.png";
import { SITE_LINKS } from "../../constants/links";

/**
 * AppCtaSection Component - Mobile app features and app store links
 */
const AppCtaSection = () => {
  return (
    <section className="app-cta">
      <div className="app-cta__container">
        <div className="app-cta__content">
          <div className="app-cta__eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
            <span>Family Connect App</span>
          </div>
          <h2 className="app-cta__title">
            Stay Connected to Your Parent's World —
            <em>From Anywhere</em>
          </h2>
          <p className="app-cta__desc">
            Real-time visit logs, vitals trends, and a Happiness Score that tells you how your parent is actually feeling today — not just informed after something goes wrong.
          </p>

          <ul className="app-cta__list">
            <li>
              <div className="app-cta__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </div>
              <span>Instant WhatsApp alerts on every visit</span>
            </li>
            <li>
              <div className="app-cta__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </div>
              <span>Live Happiness Score updated after each visit</span>
            </li>
            <li>
              <div className="app-cta__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              </div>
              <span>Geo-fenced check-ins — know Mitra arrived</span>
            </li>
            <li>
              <div className="app-cta__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              </div>
              <span>Access from any time zone, anywhere in the world</span>
            </li>
            <li>
              <div className="app-cta__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </div>
              <span>Download care reports as PDFs for doctors</span>
            </li>
          </ul>

          <div className="app-download-cards">
            {/* Card 1: Family Connect App */}
            <div className="app-download-card">
              <div className="app-download-card__badges">
                <a href={SITE_LINKS.appStore.familyConnect.googlePlay} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={googlePlayImg} alt="Get MaiHoonNa Family Connect App on Google Play" loading="lazy" width="135" height="40" />
                </a>
                <a href={SITE_LINKS.appStore.familyConnect.appleAppStore} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={appStoreImg} alt="Download MaiHoonNa Family Connect App on Apple App Store" loading="lazy" width="135" height="40" />
                </a>
              </div>
              <span className="app-download-card__label">Family Connect App</span>
            </div>

            {/* Card 2: Saathi App */}
            <div className="app-download-card">
              <div className="app-download-card__badges">
                <a href={SITE_LINKS.appStore.saathi.googlePlay} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={googlePlayImg} alt="Get MaiHoonNa Saathi App on Google Play" loading="lazy" width="135" height="40" />
                </a>
                <a href={SITE_LINKS.appStore.saathi.appleAppStore} className="store-badge-card" target="_blank" rel="noopener noreferrer">
                  <img src={appStoreImg} alt="Download MaiHoonNa Saathi App on Apple App Store" loading="lazy" width="135" height="40" />
                </a>
              </div>
              <span className="app-download-card__label">Saathi App</span>
            </div>
          </div>
        </div>

        <div className="phone-mock">
          {/* Card 1: Dark Phone Mockup */}
          <div className="phone-mock__dark">
            <div className="phone-mock__score-card">
              <small>Happiness Score</small>
              <strong>82</strong>
              <span>Feeling great today ✨</span>
            </div>
            <div className="phone-mock__info-list">
              <div className="phone-mock__info-row">
                <small>Last visit</small>
                <strong>Today 10:30 AM</strong>
              </div>
              <div className="phone-mock__info-row">
                <small>Mitra</small>
                <strong>Meena S.</strong>
              </div>
              <div className="phone-mock__info-row">
                <small>Duration</small>
                <strong>48 min</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Floating Bright Orange Alert Card */}
          <div className="phone-mock__orange">
            <div className="phone-mock__alert-header">
              <span>Live Visit Alert</span>
            </div>
            <div className="phone-mock__bell-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </div>
            <strong className="phone-mock__alert-title">Meena has arrived</strong>
            <span className="phone-mock__alert-sub">Geo-verified · 10:31 AM</span>
            <div className="phone-mock__vitals-pill">
              <span>BP: 120/80 · SpO2: 98% · Mood: Happy</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppCtaSection;
