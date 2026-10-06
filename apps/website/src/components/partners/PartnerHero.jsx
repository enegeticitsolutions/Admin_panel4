import React from "react";
import shapesBgVideo from "../../assets/partners/0_Shapes_Loopable_1920x1080.mp4";
import shapesBgImg from "../../assets/partners/0_Shapes_Loopable_1920x1080.png";
import {
  Truck,
  Pill,
  FlaskConical,
  Stethoscope,
  Building2,
  Video,
  Briefcase,
  Users,
} from "lucide-react";
import "../../pages/PartnerPage.css";

const HERO_PILLS = [
  {
    title: "Ambulance & Emergency",
    icon: Truck,
    iconColor: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    title: "Pharmacy Partners",
    icon: Pill,
    iconColor: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    title: "Diagnostic Labs",
    icon: FlaskConical,
    iconColor: "#0EA5E9",
    bg: "#F0F9FF",
  },
  {
    title: "Care Providers",
    icon: Stethoscope,
    iconColor: "#FE6700",
    bg: "#FFF7ED",
  },
  {
    title: "Hospitals & Clinics",
    icon: Building2,
    iconColor: "#10B981",
    bg: "#ECFDF5",
  },
  {
    title: "Tele-medicine",
    icon: Video,
    iconColor: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    title: "Corporate & B2B",
    icon: Briefcase,
    iconColor: "#6366F1",
    bg: "#EEF2FF",
  },
  {
    title: "RWA & Housing Societies",
    icon: Users,
    iconColor: "#14B8A6",
    bg: "#F0FDFA",
  },
];

export default function PartnerHero({ onApplyClick, onTypesClick }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="partner-hero">
      <video
        className="partner-hero__bg-video"
        src={shapesBgVideo}
        poster={shapesBgImg}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="partner-hero__bg-overlay" />

      <div className="partner-hero__container">
        <div className="partner-hero__left">
          <div className="partner-hero__badge">
            <span className="partner-hero__badge-icon">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FE6700"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-3-3" />
                <path d="m3 11 3-3a1 1 0 0 1 1.4 0l4.3 4.3a1 1 0 0 1 0 1.4l-2 2" />
                <path d="M18 12a3 3 0 0 0-3-3l-2.5 2.5" />
                <path d="m6 12 3 3" />
              </svg>
            </span>
            <span className="partner-hero__badge-text">PARTNERS & SUPPLIERS</span>
          </div>

          <h1 className="partner-hero__title">
            Become part<br />
            of the<br />
            <span className="partner-hero__highlight">
              MaiHoonNa<br />
              ecosystem.
            </span>
          </h1>

          <p className="partner-hero__subtitle">
            We partner with healthcare providers, pharmacies, labs, ambulance services,
            and specialist care providers across NCR — to build seamless care around
            every senior we serve.
          </p>

          <div className="partner-hero__actions">
            <button
              type="button"
              className="partner-btn-primary"
              onClick={onApplyClick || (() => scrollTo("partner-apply"))}
            >
              <span>Apply as a Partner</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              type="button"
              className="partner-btn-secondary"
              onClick={onTypesClick || (() => scrollTo("who-we-work-with"))}
            >
              See Partner Types
            </button>
          </div>
        </div>

        <div className="partner-hero__right">
          <div className="partner-hero__pills-grid">
            {HERO_PILLS.map((pill, idx) => {
              const IconComponent = pill.icon;
              return (
                <div key={idx} className="partner-pill-card">
                  <div
                    className="partner-pill-card__icon-box"
                    style={{ backgroundColor: pill.bg }}
                  >
                    <IconComponent
                      width={20}
                      height={20}
                      style={{ color: pill.iconColor }}
                    />
                  </div>
                  <span className="partner-pill-card__title">{pill.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
