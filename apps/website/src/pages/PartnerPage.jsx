import React, { useState } from "react";
import ambulanceImg from "../assets/partners/ambulance.jpg";
import pharmacyImg from "../assets/partners/pharmacy.jpg";
import diagnosticsImg from "../assets/partners/diagnostics.jpg";
import physioImg from "../assets/partners/physio.jpg";
import hospitalImg from "../assets/partners/hospital.jpg";
import consultationImg from "../assets/partners/consultation.jpg";
import drRajeshImg from "../assets/partners/dr-rajesh-sharma.jpg";
import shapesBgVideo from "../assets/partners/0_Shapes_Loopable_1920x1080.mp4";
import shapesBgImg from "../assets/partners/0_Shapes_Loopable_1920x1080.png";
import ZohoPartnerForm from "../components/forms/ZohoPartnerForm";
import PartnerService from "../services/PartnerService";
import {
  Truck,
  Pill,
  FlaskConical,
  Stethoscope,
  Building2,
  Video,
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  MapPin,
  Layers,
  TrendingUp,
  FileCheck2,
  FileText,
  UserCheck,
  BadgeCheck,
  Zap,
} from "lucide-react";
import "./PartnerPage.css";

const HERO_PILLS = [
  {
    title: "Ambulance & Emergency",
    icon: Truck,
    iconColor: "#EF4444",
    bg: "#FEF2F2",
    border: "rgba(239, 68, 68, 0.2)",
  },
  {
    title: "Pharmacy Partners",
    icon: Pill,
    iconColor: "#7C3AED",
    bg: "#F5F3FF",
    border: "rgba(124, 58, 237, 0.2)",
  },
  {
    title: "Diagnostic Labs",
    icon: FlaskConical,
    iconColor: "#0EA5E9",
    bg: "#F0F9FF",
    border: "rgba(14, 165, 233, 0.2)",
  },
  {
    title: "Care Providers",
    icon: Stethoscope,
    iconColor: "#FE6700",
    bg: "#FFF7ED",
    border: "rgba(254, 103, 0, 0.2)",
  },
  {
    title: "Hospitals & Clinics",
    icon: Building2,
    iconColor: "#10B981",
    bg: "#ECFDF5",
    border: "rgba(16, 185, 129, 0.2)",
  },
  {
    title: "Tele-medicine",
    icon: Video,
    iconColor: "#F59E0B",
    bg: "#FFFBEB",
    border: "rgba(245, 158, 11, 0.2)",
  },
  {
    title: "Corporate & B2B",
    icon: Briefcase,
    iconColor: "#6366F1",
    bg: "#EEF2FF",
    border: "rgba(99, 102, 241, 0.2)",
  },
  {
    title: "RWA & Housing Societies",
    icon: Users,
    iconColor: "#14B8A6",
    bg: "#F0FDFA",
    border: "rgba(20, 184, 166, 0.2)",
  },
];

const CATEGORIES_8 = [
  {
    icon: Truck,
    iconColor: "#EF4444",
    bg: "#FEF2F2",
    title: "Ambulance & Emergency",
    desc: "Rapid-response partner network for medical emergencies.",
  },
  {
    icon: Pill,
    iconColor: "#7C3AED",
    bg: "#F5F3FF",
    title: "Pharmacy Partners",
    desc: "Medicine ordering, home delivery, and prescription management.",
  },
  {
    icon: FlaskConical,
    iconColor: "#0EA5E9",
    bg: "#F0F9FF",
    title: "Diagnostic Labs",
    desc: "Home-sample collection and lab appointment scheduling.",
  },
  {
    icon: Stethoscope,
    iconColor: "#FE6700",
    bg: "#FFF7ED",
    title: "Care Providers",
    desc: "Physiotherapists, ENT specialists, general physicians, and more.",
  },
  {
    icon: Building2,
    iconColor: "#10B981",
    bg: "#ECFDF5",
    title: "Hospitals & Clinics",
    desc: "Preferred hospital tie-ups for planned visits and referrals.",
  },
  {
    icon: Video,
    iconColor: "#F59E0B",
    bg: "#FFFBEB",
    title: "Tele-medicine",
    desc: "Virtual consultation scheduling managed by Care Mitras.",
  },
  {
    icon: Briefcase,
    iconColor: "#6366F1",
    bg: "#EEF2FF",
    title: "Corporate & B2B",
    desc: "Employee benefit programmes for organisations with elder care needs.",
  },
  {
    icon: Users,
    iconColor: "#14B8A6",
    bg: "#F0FDFA",
    title: "RWA & Housing Societies",
    desc: "Nodal care centres embedded within condominium societies.",
  },
];

const ADVANTAGES = [
  {
    icon: MapPin,
    iconColor: "#FE6700",
    bg: "#FFF7ED",
    title: "Verified, location-based referrals",
    desc: "Partner referrals are geo-matched to beneficiaries in your service area — zero cold outreach, only warm intent.",
  },
  {
    icon: Layers,
    iconColor: "#7C3AED",
    bg: "#FAF5FF",
    title: "Platform-coordinated orders",
    desc: "Service requests come through the platform — structured, pre-verified, with full family context already attached.",
  },
  {
    icon: TrendingUp,
    iconColor: "#10B981",
    bg: "#F0FDF4",
    title: "Growing subscriber base",
    desc: "Access to a loyal, subscription-based senior care community across NCR. Real patients, real frequency.",
  },
  {
    icon: FileCheck2,
    iconColor: "#0EA5E9",
    bg: "#EFF6FF",
    title: "Transparent commission structure",
    desc: "Clear, contract-based partnership terms. GST-compliant billing. No hidden deductions or ambiguity.",
  },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Submit application",
    desc: "Fill out the partner form with your details and service area.",
    icon: FileText,
  },
  {
    step: "02",
    title: "Verification call",
    desc: "Our partner team verifies your services and coverage.",
    icon: UserCheck,
  },
  {
    step: "03",
    title: "Contract & onboarding",
    desc: "Sign the partnership agreement. GST-compliant, clear terms.",
    icon: BadgeCheck,
  },
  {
    step: "04",
    title: "Go live",
    desc: "Start receiving geo-matched referrals from Care Mitras.",
    icon: Zap,
  },
];

const SHOWCASE_PARTNERS = [
  {
    img: ambulanceImg,
    category: "Emergency Response",
    badgeClass: "partner-showcase-category-pill--red",
    name: "FastAid Response",
    location: "Gurugram-wide",
    desc: "24/7 emergency dispatch for medical crises. Average response time under 12 minutes across Sectors 50–58.",
  },
  {
    img: pharmacyImg,
    category: "Pharmacy Partner",
    badgeClass: "partner-showcase-category-pill--purple",
    name: "MedBridge Pharmacy",
    location: "Sector 56, Gurugram",
    desc: "Home delivery of prescriptions, OTC medicines, and medical supplies. Prescription management and refill reminders included.",
  },
  {
    img: diagnosticsImg,
    category: "Diagnostic Lab",
    badgeClass: "partner-showcase-category-pill--blue",
    name: "LabQuick Diagnostics",
    location: "Sector 54–57, Gurugram",
    desc: "Home blood and urine sample collection, with digital reports shared directly to Family Connect within 24 hours.",
  },
  {
    img: physioImg,
    category: "Care Provider",
    badgeClass: "partner-showcase-category-pill--green",
    name: "ActivLife Physio & Wellness",
    location: "Sector 55, Gurugram",
    desc: "Physiotherapy, mobility training, and post-hospitalisation rehabilitation — at home, scheduled through Care Mitras.",
  },
  {
    img: hospitalImg,
    category: "Hospital & Clinic",
    badgeClass: "partner-showcase-category-pill--orange",
    name: "Horizons Senior Clinic",
    location: "Sector 53, Gurugram",
    desc: "Preferred outpatient facility for planned visits and specialist referrals. Priority slots reserved for MaiHoonNa beneficiaries.",
  },
  {
    img: consultationImg,
    category: "Tele-medicine",
    badgeClass: "partner-showcase-category-pill--teal",
    name: "TeleHeal",
    location: "Pan-NCR · Remote",
    desc: "On-demand virtual consultations with GPs and specialists, scheduled and managed by Care Mitras within the app.",
  },
];

export default function PartnerPage() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="partner-page">
      {/* ─────────────────────────────────────────────────────────────────────────────
         1. HERO SECTION (Figma Exact Spec - Node 3635:6450)
         ───────────────────────────────────────────────────────────────────────────── */}
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
          {/* Left Column: Heading & CTAs */}
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
                onClick={() => scrollTo("partner-apply")}
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
                onClick={() => scrollTo("who-we-work-with")}
              >
                See Partner Types
              </button>
            </div>
          </div>

          {/* Right Column: 8 Rounded Floating Pill Cards (Figma Spec) */}
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

      {/* ─────────────────────────────────────────────────────────────────────────────
         2. STATS / METRICS STRIP (Figma Node 3635:6572)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-stats-section">
        <div className="partner-stats-bar">
          <div className="partner-stat-item">
            <div className="partner-stat-value partner-stat-value--orange">50+</div>
            <div className="partner-stat-label">Active partners</div>
          </div>
          <div className="partner-stat-item">
            <div className="partner-stat-value partner-stat-value--orange">8</div>
            <div className="partner-stat-label">Partner categories</div>
          </div>
          <div className="partner-stat-item">
            <div className="partner-stat-value partner-stat-value--orange">NCR-wide</div>
            <div className="partner-stat-label">Coverage area</div>
          </div>
          <div className="partner-stat-item">
            <div className="partner-stat-value partner-stat-value--orange">GST-ready</div>
            <div className="partner-stat-label">Billing & contracts</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
         3. "WHO WE WORK WITH" GRID (Figma Node 3645:8774)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-categories-section" id="who-we-work-with">
        <div className="partner-section-header">
          <span className="partner-eyebrow">PARTNER CATEGORIES</span>
          <h2 className="partner-section-title">Who we work with</h2>
          <p className="partner-section-subhead">
            From emergency response to everyday wellness — we coordinate across the
            full spectrum of senior care.
          </p>
        </div>

        <div className="partner-categories-grid">
          {CATEGORIES_8.map((cat, idx) => {
            const IconComponent = cat.icon;
            return (
              <div key={idx} className="partner-category-card">
                <div
                  className="partner-category-icon-wrapper"
                  style={{ backgroundColor: cat.bg }}
                >
                  <IconComponent
                    width={22}
                    height={22}
                    style={{ color: cat.iconColor }}
                  />
                </div>
                <h3>{cat.title}</h3>
                <p>{cat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
         4. PARTNER ADVANTAGE & APPLICATION FORM (TWO COLUMNS - Figma Node 3635:6742)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-advantage-section" id="partner-advantage">
        <div className="partner-advantage-container">
          
          {/* Left Column: Advantages & Testimonial Quote */}
          <div className="partner-advantage-left">
            <div>
              <span className="partner-eyebrow">WHY PARTNER WITH US</span>
              <h2 className="partner-section-title">The MaiHoonNa partner advantage</h2>
            </div>

            <div className="partner-advantage-cards">
              {ADVANTAGES.map((adv, idx) => {
                const IconComponent = adv.icon;
                return (
                  <div key={idx} className="partner-adv-card">
                    <div
                      className="partner-adv-icon"
                      style={{ backgroundColor: adv.bg }}
                    >
                      <IconComponent
                        width={20}
                        height={20}
                        style={{ color: adv.iconColor }}
                      />
                    </div>
                    <div className="partner-adv-content">
                      <h4>{adv.title}</h4>
                      <p>{adv.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Testimonial Quote Card matching Figma design */}
            <div className="partner-testimonial-card">
              <p className="partner-testimonial-quote">
                “Partnering with MaiHoonNa has been one of the most organised B2C channels we&apos;ve had. Orders come in verified, with context. No follow-up needed.”
              </p>
              <div className="partner-testimonial-author">
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    backgroundColor: "#FE6700",
                    color: "#FFFFFF",
                    fontWeight: "800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "15px",
                    flexShrink: 0,
                  }}
                >
                  RK
                </div>
                <div>
                  <h5 className="partner-testimonial-name">Rakesh Kumar</h5>
                  <p className="partner-testimonial-role">Owner, Sector 56 MedCare Pharmacy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Become a partner Form (Embedded Zoho CRM Form) */}
          <div className="partner-form-card" id="partner-apply">
            <span className="partner-form-badge">APPLY</span>
            <h3>Become a partner</h3>
            <p className="partner-form-subtitle">
              Fill out the form below to join our ecosystem of care providers.
            </p>
            <ZohoPartnerForm />
            <p className="partner-form-notice" style={{ marginTop: "16px" }}>
              ⚡ Our team typically reviews and responds within 24–48 business hours.
            </p>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
         5. "FROM APPLICATION TO ACTIVE PARTNER IN 5 DAYS" (Figma Node 3635:6913)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-process-section">
        <div className="partner-section-header">
          <span className="partner-eyebrow">HOW IT WORKS</span>
          <h2 className="partner-section-title">
            From application to active partner in 5 days
          </h2>
        </div>

        <div className="partner-process-timeline-wrap">
          <div className="partner-process-line" />
          <div className="partner-process-grid">
            {PROCESS_STEPS.map((step, idx) => {
              const IconComponent = step.icon;
              return (
                <div key={idx} className="partner-process-step">
                  <div className="partner-step-circle">
                    <IconComponent width={26} height={26} strokeWidth={2} />
                  </div>
                  <div className="partner-step-number">{step.step}</div>
                  <h4 className="partner-step-title">{step.title}</h4>
                  <p className="partner-step-desc">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
         6. "TRUSTED PARTNERS IN GURUGRAM" (Figma Node 4462:286)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-network-section">
        <div className="partner-network-container">
          <div className="partner-section-header">
            <span className="partner-eyebrow">ACTIVE PARTNERS</span>
            <h2 className="partner-section-title">Trusted partners in Gurugram</h2>
            <p className="partner-section-subhead">
              These are some of the partners already active in our pilot. Vetted, geo-matched,
              and coordinated through the MaiHoonNa platform.
            </p>
          </div>

          <div className="partner-network-grid">
            {SHOWCASE_PARTNERS.map((partner, idx) => (
              <div key={idx} className="partner-showcase-card">
                <div className="partner-showcase-img-wrap">
                  <img
                    src={partner.img}
                    alt={partner.name}
                    className="partner-showcase-img"
                    loading="lazy"
                  />
                  <span className={`partner-showcase-category-pill ${partner.badgeClass}`}>
                    {partner.category}
                  </span>
                </div>
                <div className="partner-showcase-body">
                  <h3 className="partner-showcase-title">{partner.name}</h3>
                  <div className="partner-showcase-location">📍 {partner.location}</div>
                  <p className="partner-showcase-desc">{partner.desc}</p>
                  <div className="partner-showcase-footer">
                    <span className="partner-verified-badge">
                      <Shield className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                      Active partner
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
         7. BOTTOM CTA BANNER (Figma Node 4462:286)
         ───────────────────────────────────────────────────────────────────────────── */}
      <section className="partner-bottom-cta-section">
        <div className="partner-bottom-cta-banner">
          <h3 className="partner-bottom-cta-title">
            Want your organisation listed here?
          </h3>
          <button
            type="button"
            className="partner-btn-primary"
            onClick={() => scrollTo("partner-apply")}
          >
            Apply as a Partner &rarr;
          </button>
        </div>
      </section>
    </div>
  );
}
