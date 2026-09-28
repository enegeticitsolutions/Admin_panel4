import React, { useState } from "react";
import sumitKumarImg from "../assets/sumit-kejriwal-photo.png";
import rajeevThukralImg from "../assets/team/Rajeev.png";
import drSubramanianImg from "../assets/team/Subra.png";
import teamGroupImg from "../assets/team/team.png";
import teamTrainingImg from "../assets/team/team.png";
import "./TeamPage.css";

// Leadership Profiles matching design spec
const LEADERSHIP_TEAM = [
  {
    id: "sumit-kumar",
    name: "Sumit Kumar",
    role: "Founder & CEO",
    roleColorClass: "team-leader-card__role--orange",
    photo: sumitKumarImg,
    linkedin: "https://www.linkedin.com/in/sumit-kumar-a85166a/",
    bio: "Sumit brings over 25 years of experience in healthcare technology, having worked with organizations including Highmark, Accenture, Infosys, etc.. Drawing on this deep understanding of how healthcare systems work and where they fall short for India's ageing population. He founded MaiHoonNa to bring professional, dependable care and companionship into the homes of seniors across India and starting with NCR. Sumit is hands-on across every part of the business, from building the Care Mitra and Saathi Network programs to shaping MaiHoonNa's partner ecosystem, with a singular focus: making sure no senior has to face ageing alone.",
  },
  {
    id: "rajeev-thukral",
    name: "Rajeev Thukral",
    role: "Co-founder & Director",
    roleColorClass: "team-leader-card__role--purple",
    photo: rajeevThukralImg,
    linkedin: "https://www.linkedin.com/in/rajeevthukral/",
    bio: "Rajeev Thukral is Co-Founder & Director MaiHoonNa Elderare, where he brings his experience in building and governing businesses to the company's mission of quality eldercare. He has spent more than 35 years building and steering organizations, starting with two decades in corporate finance and strategy at GE Capital, Genpact, HCL Technologies and RPG Enterprises, and later as Chief Strategy Officer at Cargomen Logistics. An MIT Sloan alumnus, Rajeev holds Independent Director and board roles across healthcare, pharma, logistics and fintech, including with Mankind Group companies, and is an active investor and co-founder across several ventures, advising founders and boards on growth, strategy and governance.",
  },
  {
    id: "dr-subramanian",
    name: "Dr. Narasimhan Subramanian",
    role: "Advisory Board Member",
    roleColorClass: "team-leader-card__role--teal",
    photo: drSubramanianImg,
    linkedin: "https://www.linkedin.com/in/narasimhan-subramanian-63326a73/",
    bio: "Dr. Narasimhan Subramanian is a highly experienced senior Urologist and Robotic Surgeon at Indraprastha Apollo Hospitals, Delhi, with over 34 years of experience specializing in uro-oncology, kidney stones, endourology, and minimally invasive procedures. He is well-regarded for his work in robotic prostatectomies and is a member of esteemed organizations like the Urological Society of India.",
  },
];

// Inside the Team Gallery Slides
const GALLERY_SLIDES = [
  {
    id: 1,
    image: teamGroupImg,
    tag: "FIELD & OPERATIONS",
    title: "We don't do this from a distance.",
    subtitle:
      "Our team sits in the same city as the families we serve. Every protocol, every script, every training module has been tested against real visits in real homes — not theorised in a conference room.",
  },
  {
    id: 2,
    image: teamTrainingImg,
    tag: "CLINICAL EXCELLENCE",
    title: "Rigorous in-person nurse & Mitra training.",
    subtitle:
      "Every Care Mitra undergoes 80+ hours of geriatric empathy drills, clinical vitals assessment, patient transfer techniques, and emergency escalation simulation.",
  },
  {
    id: 3,
    image: teamGroupImg,
    tag: "MORNING HUDDLE",
    title: "Daily dispatch & elder wellness sync.",
    subtitle:
      "Every morning starts with sector-level route reviews, patient priority flags, and medication refill verification across Sectors 53 to 57.",
  },
  {
    id: 4,
    image: teamTrainingImg,
    tag: "CARE ETHICS & EMPATHY",
    title: "Companionship isn't a procedure, it's a bond.",
    subtitle:
      "Teaching patience, active listening, and respecting the independence and dignity of each senior citizen we serve.",
  },
  {
    id: 5,
    image: teamGroupImg,
    tag: "COMMUNITY OUTREACH",
    title: "Building localized trust in Gurugram societies.",
    subtitle:
      "Direct engagement with RWA councils, senior hobby circles, and health camps across DLF Phase 5 and Golf Course Road.",
  },
];

const TeamPage = () => {
  // Gallery Carousel State
  const [activeSlide, setActiveSlide] = useState(0);

  const handlePrevSlide = () => {
    setActiveSlide((prev) => (prev === 0 ? GALLERY_SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setActiveSlide((prev) => (prev === GALLERY_SLIDES.length - 1 ? 0 : prev + 1));
  };

  const currentSlide = GALLERY_SLIDES[activeSlide];

  return (
    <main className="team-page" aria-label="MaiHoonNa Team – The People Behind the Promise">
      {/* ── 1. HERO SECTION ── */}
      <section className="team-hero">
        <div className="team-hero__glow" aria-hidden="true" />
        <div className="team-hero__container">
          <div className="team-hero__badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>OUR TEAM</span>
          </div>

          <h1 className="team-hero__title">
            People who show up,
            <span className="team-hero__title-highlight">so your parents aren't alone.</span>
          </h1>

          <p className="team-hero__desc">
            Every person on this team chose to be here — because they believe senior care in India deserves better than what currently exists. Come meet them.
          </p>
        </div>
      </section>

      {/* ── 2. LEADERSHIP SECTION ── */}
      <section className="team-leadership" aria-labelledby="leadership-heading">
        <div className="team-leadership__container">
          <span className="team-section-kicker">LEADERSHIP</span>
          <h2 id="leadership-heading" className="team-leadership__heading">
            The people behind the promise
          </h2>

          <div className="team-leadership__list">
            {LEADERSHIP_TEAM.map((leader) => (
              <article key={leader.id} className="team-leader-card">
                <div className="team-leader-card__photo-col">
                  <img
                    src={leader.photo}
                    alt={`${leader.name} - ${leader.role}`}
                    className="team-leader-card__photo"
                    loading="lazy"
                  />
                </div>

                <div className="team-leader-card__content-col">
                  <div className="team-leader-card__header">
                    <h3 className="team-leader-card__name">{leader.name}</h3>
                    <p className={`team-leader-card__role ${leader.roleColorClass}`}>{leader.role}</p>
                  </div>

                  <p className="team-leader-card__bio">{leader.bio}</p>

                  <div className="team-leader-card__footer">
                    <a
                      href={leader.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="team-leader-card__linkedin-btn"
                      aria-label={`${leader.name} on LinkedIn`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.66 1.66 0 1 0 0 3.32 1.66 1.66 0 0 0 0-3.32Z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. "INSIDE THE TEAM" CAROUSEL ── */}
      <section className="team-gallery" aria-labelledby="gallery-heading">
        <div className="team-gallery__container">
          <span className="team-gallery__kicker">LIFE AT MAIHOONNA</span>
          <h2 id="gallery-heading" className="team-gallery__heading">
            Inside the team
          </h2>

          {/* Main Display Frame */}
          <div className="team-gallery__main-frame">
            <div className="team-gallery__img-wrap">
              <img
                src={currentSlide.image}
                alt={currentSlide.title}
                className="team-gallery__main-img"
              />

              <div className="team-gallery__counter-badge">
                {activeSlide + 1} / {GALLERY_SLIDES.length}
              </div>

              {/* Arrows */}
              <button
                className="team-gallery__nav-arrow team-gallery__nav-arrow--prev"
                onClick={handlePrevSlide}
                aria-label="Previous team moment"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <button
                className="team-gallery__nav-arrow team-gallery__nav-arrow--next"
                onClick={handleNextSlide}
                aria-label="Next team moment"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Caption Card Below Image */}
            <div className="team-gallery__caption-card">
              <span className="team-gallery__overlay-tag">{currentSlide.tag}</span>
              <h3 className="team-gallery__overlay-title">{currentSlide.title}</h3>
              <p className="team-gallery__overlay-sub">{currentSlide.subtitle}</p>
            </div>

            {/* Centered Dots */}
            <div className="team-gallery__dots" role="tablist">
              {GALLERY_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  className={`team-gallery__dot ${idx === activeSlide ? "team-gallery__dot--active" : ""}`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Interactive Thumbnails */}
          <div className="team-gallery__thumbs">
            {GALLERY_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                className={`team-gallery__thumb-item ${idx === activeSlide ? "team-gallery__thumb-item--active" : ""}`}
                onClick={() => setActiveSlide(idx)}
                aria-label={`View slide ${idx + 1}`}
              >
                <img src={slide.image} alt={slide.title} />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. "ARE YOU EMPATHETIC ENOUGH" CAREERS SECTION ── */}
      <section className="team-careers" aria-labelledby="careers-heading">
        <div className="team-careers__box">
          <div className="team-careers__glow" aria-hidden="true" />

          {/* Left Column */}
          <div className="team-careers__left">
            <div className="team-careers__pill">
              <span>WE'RE HIRING</span>
            </div>

            <h2 id="careers-heading" className="team-careers__title">
              Are you empathetic enough to <span className="team-careers__title-orange">work here?</span>
            </h2>

            <p className="team-careers__desc">
              We're assembling India's most empathetic team. If you belong to people who value human connection over
              quick metrics and want to build something that actually matters to families — we'd love to hear from you.
            </p>

            <h4 className="team-careers__traits-heading">What we look for in our team:</h4>
            <ul className="team-careers__traits-list">
              <li className="team-careers__trait-item">
                <span className="team-careers__trait-dot" />
                <span>High empathy and active listening skills</span>
              </li>
              <li className="team-careers__trait-item">
                <span className="team-careers__trait-dot" />
                <span>Field-first mindset — no ivory towers</span>
              </li>
              <li className="team-careers__trait-item">
                <span className="team-careers__trait-dot" />
                <span>Obsession with elder safety and dignity</span>
              </li>
              <li className="team-careers__trait-item">
                <span className="team-careers__trait-dot" />
                <span>Respect for continuous learning</span>
              </li>
            </ul>

            <div className="team-careers__action">
              <a href="mailto:careers@maihoonna.com" className="team-careers__cta-btn">
                <span>Write to us at careers@maihoonna.com</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default TeamPage;
