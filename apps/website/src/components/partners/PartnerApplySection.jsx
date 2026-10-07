import React from "react";
import ZohoPartnerForm from "../forms/ZohoPartnerForm";
import {
  MapPin,
  Layers,
  TrendingUp,
  FileCheck2,
} from "lucide-react";
import "../../pages/PartnerPage.css";

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

export default function PartnerApplySection() {
  return (
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

        {/* Right Column: Become a partner Form (Only Zoho CRM Form) */}
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
  );
}
