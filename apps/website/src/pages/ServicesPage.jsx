import React from "react";
import piccImg from "../assets/picc.png";
import CareMitraServicesSection from "../components/services/CareMitraServicesSection";
import FaqSection from "../components/home/FaqSection";

/**
 * ServicesPage Component - Detailed Services & Ecosystem Page
 * Uses independent CareMitraServicesSection (IMAGE 2 reference design)
 */
const ServicesPage = ({ setActivePage, openForm }) => {
  return (
    <main className="services-page">
      {/* ── Services Hero ── */}
      <section className="services-hero">
        <div className="services-hero__inner">
          <div className="services-hero__copy">
            <div className="services-hero__eyebrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span>Our Services</span>
            </div>
            <h1>
              Everything your <br />
              loved one needs, <br />
              <em>delivered at their <br />
                door.</em>
            </h1>
            <p>
              A full ecosystem of in-home care, health monitoring, community connection, and family transparency — all in one subscription.
            </p>
            <div className="services-hero__actions">
              <button className="services-btn-explore" onClick={() => document.getElementById('beyond-visits')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Services
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
              {/* <button className="services-btn-plans" onClick={() => setActivePage("plans")}>
                View Plans
              </button> */}
            </div>
          </div>
          <div className="services-hero__features">
            {[
              {
                title: "Vitals Monitoring",
                desc: "Every visit · Date, time, location logged",
                color: "#10B981",
                bg: "rgba(16, 185, 129, 0.133)",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                )
              },
              {
                title: "Medication Adherence",
                desc: "Zero missed doses · Auto-tracked",
                color: "#0EA5E9",
                bg: "rgba(14, 165, 233, 0.133)",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                )
              },
              {
                title: "100% Background Verified Mitras",
                desc: "Police + Aadhaar + reference verified",
                color: "#FE6700",
                bg: "rgba(254, 103, 0, 0.133)",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                )
              },
              {
                title: "Family Connect App",
                desc: "Real-time visibility from any time zone",
                color: "#7C3AED",
                bg: "rgba(124, 58, 237, 0.133)",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                )
              },
              {
                title: "24/7 Emergency Response",
                desc: "One tap alerts entire care chain",
                color: "#EF4444",
                bg: "rgba(239, 68, 68, 0.133)",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                )
              }
            ].map((item, idx) => (
              <div className="services-hero__feature-card" key={idx}>
                <div className="feature-card__icon-box" style={{ background: item.bg }}>
                  {item.icon}
                </div>
                <div className="feature-card__text">
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Independent Services Care Mitra Section (IMAGE 2) */}
      <CareMitraServicesSection />

      {/* ── Full Ecosystem ── */}
      <section id="beyond-visits" className="svc-ecosystem">
        <div className="svc-visits__header-main">
          <span className="svc-visits__eyebrow-top">BEYOND VISITS</span>
          <h2>The full MaiHoonNa ecosystem</h2>
          <p>
            Care visits are just the beginning. Every service below is
            coordinated through your single Care Mitra relationship.
          </p>
        </div>

        <div className="svc-eco-grid-container">
          {/* Row 1: Flagship + Emergency */}
          <div className="svc-eco-top-row">
            {/* Family Connect Card */}
            <div className="svc-eco-card-flagship">
              <div className="svc-eco-card-flagship__left">
                <span className="flagship-icon">📱</span>
                <span className="flagship-badge">FLAGSHIP FEATURE</span>
                <h3>Family Connect App</h3>
                <p>
                  Real-time visit logs, vitals trends, medication adherence, and a
                  Happiness Score — built for families managing care remotely from
                  any time zone.
                </p>
                <div className="flagship-tags">
                  <span>Real-time</span>
                  <span>Vitals Trends</span>
                  <span>Happiness Score</span>
                  <span>NRI-ready</span>
                </div>
              </div>
              <div className="svc-eco-card-flagship__right">
                <div className="flagship-widget">
                  <div className="widget-score-box">
                    <span>Happiness Score</span>
                    <strong>82</strong>
                  </div>
                  <div className="widget-row">
                    <span>BP</span>
                    <strong>120/80</strong>
                  </div>
                  <div className="widget-row">
                    <span>SpO2</span>
                    <strong>98%</strong>
                  </div>
                  <div className="widget-row">
                    <span>Mood</span>
                    <strong>😊 Happy</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Card */}
            <div className="svc-eco-card-emergency">
              <span className="emergency-icon">🚨</span>
              <h3>Emergency Response</h3>
              <p>
                A single emergency button triggers immediate alerts to your Care
                Mitra, Field Manager, Operations team, and family.
              </p>
              <div className="emergency-tags">
                <span>One tap</span>
                <span>24/7</span>
                <span>Full chain alert</span>
              </div>
            </div>
          </div>

          {/* Row 2: Saathi + Hobby + Health + Celebrations */}
          <div className="svc-eco-bottom-grid">
            {/* Saathi Network */}
            <div className="svc-eco-small-card">
              <span className="small-card-icon">🤝</span>
              <h3>Saathi Network</h3>
              <p>
                Community volunteers who visit between scheduled Care Mitra
                appointments. Every interaction is tracked.
              </p>
              <div className="small-card-tags small-card-tags--green">
                <span>Companionship</span>
                <span>Tracked</span>
                <span>Community</span>
              </div>
            </div>

            {/* Hobby Circles */}
            {/* <div className="svc-eco-small-card">
              <span className="small-card-icon">🎨</span>
              <h3>Hobby Circles</h3>
              <p>
                Peer connections built around shared interests with nearby neighbors.
                Privacy protected by design.
              </p>
              <div className="small-card-tags small-card-tags--purple">
                <span>Social</span>
                <span>Interests</span>
                <span>Privacy-first</span>
              </div>
            </div> */}

            {/* Healthcare Partner Network */}
            <div className="svc-eco-small-card">
              <span className="small-card-icon">🏥</span>
              <h3>Healthcare Partner Network</h3>
              <p>
                Pharmacy orders, lab appointments, physio, tele-consultations, and
                ambulance — all coordinated through your Care Mitra.
              </p>
              <div className="small-card-tags small-card-tags--blue">
                <span>Pharmacy</span>
                <span>Labs</span>
                <span>Tele-consult</span>
              </div>
            </div>

            {/* Celebrations & Milestones */}
            <div className="svc-eco-small-card">
              <span className="small-card-icon">🎂</span>
              <h3>Celebrations & Milestones</h3>
              <p>
                Birthdays and anniversaries flagged to your Care Mitra so the small
                moments that matter don't get missed.
              </p>
              <div className="small-card-tags small-card-tags--orange">
                <span>Birthdays</span>
                <span>Anniversaries</span>
                <span>Moments</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="svc-cta">
        <div className="svc-cta__inner">
          <span className="svc-cta__eyebrow">GET STARTED</span>
          <h2>Ready to bring care home?</h2>
          <p>
            Join the waitlist for Gurugram Sectors 53 to 57. Limited early access. We'll match your first Care Mitra within 24 hours of onboarding.
          </p>
          <div className="svc-cta__actions">
            {/* <button className="svc-cta-btn-plans" onClick={() => setActivePage("plans")}>View Plans</button> */}
            <button className="svc-cta-btn-callback" onClick={openForm}>Request a Callback</button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FaqSection />
    </main>
  );
};

export default ServicesPage;
