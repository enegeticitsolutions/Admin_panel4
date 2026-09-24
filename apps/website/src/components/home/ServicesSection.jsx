import React, { useState } from "react";

const services = [
  {
    emoji: "🤝",
    title: "Care Mitra Visits",
    text: "Trained, verified companions who visit on schedule and log everything in real time – vitals, mood, medication, and daily tasks.",
    link: "services",
  },
  {
    emoji: "🌸",
    title: "Saathi Network",
    text: "Community volunteers for companionship between Care Mitra visits. No senior should feel alone between scheduled visits.",
    link: "saathi",
  },
  {
    emoji: "🏆",
    title: "Legacy Circles",
    text: "A platform for seniors to share decades of expertise and rediscover purpose. Their wisdom deserves an audience.",
    link: "legacy",
  },
  {
    emoji: "🎨",
    title: "Hobby Circles",
    text: "Peer connections built around shared interests – chess, gardening, music, cooking. Joy comes from belonging.",
    link: "services",
  },
];

const visitFeatures = [
  "Real-time visit logs",
  "WhatsApp alerts",
  "Vitals trends dashboard",
  "Live Happiness Score",
  "Any time zone access",
];

const homeCareCards = [
  {
    id: "vitals",
    title: "Vitals Monitoring",
    badge: "Every visit",
    isOrangeBadge: true,
    subtitle: "Medical-grade logging",
    description:
      "BP, O2, temperature, weight — logged with date, time, and location after every single visit. Trends visible on your Family Connect dashboard.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    id: "meds",
    title: "Medication Adherence",
    badge: "Automated",
    isOrangeBadge: false,
    subtitle: "Zero missed doses",
    description:
      "Prescription-linked schedules and smart reminders ensure your parent takes the right doses on time, with instant anomaly alerts.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: "mood",
    title: "Mood & Happiness Logging",
    badge: "Real-time alerts",
    isOrangeBadge: false,
    subtitle: "Feel the difference",
    description:
      "Interactive mood assessments after every visit. Positive indicators help monitor long-term emotional well-being and happiness.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "clinic",
    title: "Clinic Accompaniment",
    badge: "On request",
    isOrangeBadge: false,
    subtitle: "Never go alone",
    description:
      "Care Mitra accompanies your parent to doctor appointments, manages transport, records instructions, and shares structured summaries.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const widgetBanners = [
  {
    bgColor1: "#FE6700",
    bgColor2: "rgba(254, 103, 0, 0.8)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.16" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
    title: "Vitals Monitoring",
    subtitle: "Medical-grade logging",
    metrics: [
      { label: "BP", value: "120/80", sub: "Normal" },
      { label: "SPO2", value: "98%", sub: "Excellent" },
      { label: "TEMP", value: "98.4°F", sub: "Normal" }
    ]
  },
  {
    bgColor1: "#8B5CF6",
    bgColor2: "rgba(139, 92, 246, 0.8)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.16" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Medication Adherence",
    subtitle: "Zero missed doses",
    metrics: [
      { label: "TODAY", value: "3/3", sub: "Taken" },
      { label: "THIS WEEK", value: "21/21", sub: "Perfect" },
      { label: "STREAK", value: "14 days", sub: "Running" }
    ]
  },
  {
    bgColor1: "#2EAA7B",
    bgColor2: "rgba(46, 170, 123, 0.8)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.16" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    title: "Mood & Happiness Logging",
    subtitle: "Feel the difference",
    metrics: [
      { label: "SCORE", value: "82", sub: "Feeling great" },
      { label: "TREND", value: "↑ +5", sub: "This week" },
      { label: "ALERTS", value: "0", sub: "All clear" }
    ]
  },
  {
    bgColor1: "#29A9E9",
    bgColor2: "rgba(41, 169, 233, 0.8)",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.16" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Clinic Accompaniment",
    subtitle: "Never go alone",
    metrics: [
      { label: "LAST VISIT", value: "12 Jun", sub: "Cardiology" },
      { label: "SUMMARY", value: "Shared", sub: "Via app" },
      { label: "NEXT", value: "8 Jul", sub: "Follow-up" }
    ]
  }
];

/**
 * ServicesSection Component - Home Page Ecosystem & Care Mitra Home Visits (IMAGE 1 reference & Figma exact)
 */
const ServicesSection = ({ openForm }) => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const activeBanner = widgetBanners[activeCardIndex];

  return (
    <>
      {/* Ecosystem & NRI Section */}
      <section className="visits" id="services">
        <div className="section-heading">
          <span>OUR ECOSYSTEM</span>
          <h2>More than visits</h2>
          <p>A full ecosystem designed to help seniors live with dignity, connection, and joy - not just receive care.</p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <span className="service-card__emoji">{service.emoji}</span>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
              <button onClick={() => window.location.hash = `#${service.link}`}>Learn more →</button>
            </article>
          ))}
        </div>

        <div className="nri-banner">
          <div>
            <div className="nri-eyebrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Managing care from abroad?
            </div>
            <h2>
              Built for NRI Families Who Want to Stay <em>Genuinely Involved</em>
            </h2>
            <p>
              Real-time visit logs, WhatsApp alerts, vitals trends, and a Happiness Score that tells you how your parent is actually feeling today — not just informed after something goes wrong.
            </p>
            <button onClick={openForm}>Join as NRI Family &rarr;</button>
          </div>
          <ul className="nri-list" style={{ listStyle: "none", padding: 0 }}>
            {visitFeatures.map((feature) => (
              <li key={feature}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 11 12 14 17 9" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── HOME CARE MITRA HOME VISITS (IMAGE 1 / FIGMA EXACT) ── */}
      <section className="hm-cm">
        <div className="hm-cm__container">
          <div className="hm-cm__header">
            <div className="hm-cm__header-left">
              <span className="hm-cm__eyebrow">SERVICES</span>
              <h2 className="hm-cm__title">
                Care Mitra
                <br />
                <span>Home Visits</span>
              </h2>
            </div>
            <div className="hm-cm__header-right">
              <p>
                Your parent's Care Mitra visits on a schedule you set. Every visit is
                geo-fenced, encounter-tracked, and logged — so you always know what happened, not just that someone showed up.
              </p>
            </div>
          </div>

          <div className="hm-cm__grid">
            {/* Left Selectable Cards */}
            <div className="hm-cm__cards">
              {homeCareCards.map((card, idx) => {
                const isActive = activeCardIndex === idx;
                return (
                  <div
                    key={card.id}
                    className={`hm-cm__card ${isActive ? "hm-cm__card--active" : ""}`}
                    onClick={() => setActiveCardIndex(idx)}
                    onMouseEnter={() => setActiveCardIndex(idx)}
                  >
                    <div className="hm-cm__icon-box">{card.icon}</div>

                    <div className="hm-cm__card-content">
                      <div className="hm-cm__card-top-row">
                        <span className="hm-cm__card-title">{card.title}</span>
                        {card.badge && (
                          <span className={`hm-cm__tag ${card.isOrangeBadge || isActive ? "hm-cm__tag--orange" : ""}`}>
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <div className="hm-cm__card-subtitle">{card.subtitle}</div>
                      {isActive && <div className="hm-cm__card-desc">{card.description}</div>}
                    </div>

                    <div className="hm-cm__dot-wrap">
                      <div className="hm-cm__dot" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Dashboard Widget */}
            <div className="hm-cm__widget">
              {/* Dynamic Banner */}
              <div
                className="hm-cm__vitals-banner"
                style={{ background: `linear-gradient(135deg, ${activeBanner.bgColor1} 0%, ${activeBanner.bgColor2} 100%)` }}
              >
                <div className="hm-cm__vitals-banner-header">
                  <div className="hm-cm__vitals-icon-box">
                    {activeBanner.icon}
                  </div>
                  <div className="hm-cm__vitals-banner-title">
                    <h3>{activeBanner.title}</h3>
                    <span>{activeBanner.subtitle}</span>
                  </div>
                </div>

                <div className="hm-cm__vitals-grid">
                  {activeBanner.metrics.map((metric, idx) => (
                    <div className="hm-cm__vital-pill" key={idx}>
                      <label>{metric.label}</label>
                      <strong>{metric.value}</strong>
                      <small>{metric.sub}</small>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Visit Log */}
              <div className="hm-cm__log-card">
                <div className="hm-cm__log-top">
                  <span>RECENT VISIT LOG</span>
                  <div className="hm-cm__auto-synced">
                    <span className="hm-cm__auto-synced-dot" />
                    <span className="hm-cm__auto-synced-text">Auto-synced</span>
                  </div>
                </div>

                <div className="hm-cm__log-list">
                  <div className="hm-cm__log-item">
                    <div className="hm-cm__avatar">M</div>
                    <div className="hm-cm__log-info">
                      <strong>Today, 10:30 AM</strong>
                      <span>Meena S. · 52 min</span>
                    </div>
                    <span className="hm-cm__badge-completed">Completed</span>
                  </div>

                  <div className="hm-cm__log-item">
                    <div className="hm-cm__avatar">M</div>
                    <div className="hm-cm__log-info">
                      <strong>Yesterday, 9:45 AM</strong>
                      <span>Meena S. · 48 min</span>
                    </div>
                    <span className="hm-cm__badge-completed">Completed</span>
                  </div>

                  <div className="hm-cm__log-item">
                    <div className="hm-cm__avatar">M</div>
                    <div className="hm-cm__log-info">
                      <strong>Mon, 10:10 AM</strong>
                      <span>Meena S. · 55 min</span>
                    </div>
                    <span className="hm-cm__badge-completed">Completed</span>
                  </div>
                </div>

                {/* Geo-fenced Banner Pill */}
                <div className="hm-cm__geo-wrap">
                  <div className="hm-cm__geo-banner">
                    <div className="hm-cm__geo-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="hm-cm__geo-text">
                      <strong>Geo-fenced &amp; verified</strong>
                      <span>Every visit confirmed within 50m of home address</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ServicesSection;
