import React from "react";
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

export default function PartnerCategoriesGrid() {
  return (
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
  );
}
