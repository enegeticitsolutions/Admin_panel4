import React, { useState, useMemo } from "react";
import LegacyExpertCard from "../components/legacy/LegacyExpertCard";

// Mock Senior Expert Profiles with rich details matching the design
const EXPERTS_DATA = [
  {
    id: "exp-1",
    name: "Arun Kumar",
    avatarColor: "#fe6700",
    role: "Ex-Chief Financial Officer",
    company: "BHEL & L&T Heavy Eng.",
    location: "Gurugram",
    experience: 34,
    domain: "Chartered Accountancy / Auditing",
    verified: true,
    rating: 4.9,
    reviews: 42,
    sessions: "150+ hrs",
    tags: ["Corporate Finance", "Taxation & M&A", "Governance"],
    bio: "Over three decades orchestrating large-scale corporate financial restructuring, institutional capital raising, and compliance for public and private enterprises.",
  },
  {
    id: "exp-2",
    name: "Deepak Sharma",
    avatarColor: "#8b5cf6",
    role: "Senior Legal Counsel & Advocate",
    company: "Supreme Court & High Court Bar",
    location: "Delhi NCR",
    experience: 31,
    domain: "Corporate Law",
    verified: true,
    rating: 5.0,
    reviews: 58,
    sessions: "210+ hrs",
    tags: ["Corporate Law", "Contract Negotiation", "Dispute Resolution"],
    bio: "Specialized in regulatory navigation, commercial arbitration, corporate compliance, and joint venture drafting for domestic and overseas businesses.",
  },
  {
    id: "exp-3",
    name: "Meenakshi Sundaram",
    avatarColor: "#06b6d4",
    role: "Ex-VP Engineering & Cloud",
    company: "Infosys & Wipro Digital",
    location: "Bengaluru / Remote",
    experience: 28,
    domain: "Information Technology / Software",
    verified: true,
    rating: 4.9,
    reviews: 64,
    sessions: "190+ hrs",
    tags: ["Cloud Migration", "Scalable Systems", "Tech Due Diligence"],
    bio: "Pioneered distributed systems architecture and enterprise modernization for Fortune 500 banks and high-growth technology scale-ups.",
  },
  {
    id: "exp-4",
    name: "Dr. Rajesh Mathur, IAS (Retd.)",
    avatarColor: "#10b981",
    role: "Former Principal Secretary",
    company: "Ministry of Urban Development",
    location: "Delhi NCR",
    experience: 36,
    domain: "Civil Services (IAS/IPS/IFS etc.)",
    verified: true,
    rating: 5.0,
    reviews: 35,
    sessions: "120+ hrs",
    tags: ["Public Policy", "Civic Infrastructure", "Govt Approvals"],
    bio: "Navigated 35+ years of government policy formulation, large-scale infrastructure clearance, public-private partnerships (PPP), and civic governance.",
  },
  {
    id: "exp-5",
    name: "Sunita Rao",
    avatarColor: "#f59e0b",
    role: "Ex-Director HR & Transformation",
    company: "Larsen & Toubro",
    location: "Mumbai / Remote",
    experience: 27,
    domain: "Human Resources",
    verified: true,
    rating: 4.8,
    reviews: 39,
    sessions: "140+ hrs",
    tags: ["Executive Coaching", "Org Culture", "Conflict Mgmt"],
    bio: "Guided top-tier leadership succession, cross-border talent integration, and high-performance workplace transformation across 15,000+ employee organizations.",
  },
  {
    id: "exp-6",
    name: "Col. Ravindra Singh (Retd.)",
    avatarColor: "#ef4444",
    role: "Ex-Director Logistics & Ops",
    company: "Indian Armed Forces & Supply Chain",
    location: "Gurugram",
    experience: 33,
    domain: "Defence Services (Army/Navy/Air Force)",
    verified: true,
    rating: 4.9,
    reviews: 47,
    sessions: "165+ hrs",
    tags: ["Supply Chain", "Crisis Logistics", "Risk Mitigation"],
    bio: "Commanded mission-critical military logistics corridors and later consulted top FMCG supply chains in rapid fulfillment and risk planning.",
  },
  {
    id: "exp-7",
    name: "Vandana Sengupta",
    avatarColor: "#ec4899",
    role: "Former Head of Product & UX",
    company: "Times Internet & NDTV",
    location: "Gurugram / Remote",
    experience: 24,
    domain: "Information Technology / Software",
    verified: true,
    rating: 4.9,
    reviews: 51,
    sessions: "130+ hrs",
    tags: ["Product Strategy", "Consumer Retention", "Design Systems"],
    bio: "Built digital media platforms reaching 50M+ monthly active users, mentoring product managers and founders on user delight and metric-driven roadmaps.",
  },
  {
    id: "exp-8",
    name: "Pradeep Deshmukh",
    avatarColor: "#14b8a6",
    role: "Ex-Managing Director",
    company: "Precision Engineering Ltd.",
    location: "Pune / Remote",
    experience: 35,
    domain: "Operations & Supply Chain",
    verified: true,
    rating: 5.0,
    reviews: 29,
    sessions: "115+ hrs",
    tags: ["Plant Operations", "Six Sigma", "Export Scaling"],
    bio: "Turned around 4 manufacturing plants, scaled international exports to Europe and Japan, and implemented lean zero-defect quality systems.",
  }
];

const DOMAINS = [
  "All",
  "General Management / Leadership",
  "Sales & Marketing",
  "Human Resources",
  "Operations & Supply Chain",
  "Strategy & Consulting",
  "Entrepreneurship / Business Ownership",
  "Banking",
  "Chartered Accountancy / Auditing",
  "Investment & Wealth Management",
  "Insurance",
  "Taxation",
  "Information Technology / Software",
  "Civil Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Telecommunications",
  "Civil Services (IAS/IPS/IFS etc.)",
  "Defence Services (Army/Navy/Air Force)",
  "Public Sector Undertakings (PSU)",
  "Judiciary & Legal Services",
  "Police Services",
  "Medicine (Doctor/Physician)",
  "Nursing",
  "Pharmacy",
  "Public Health / Hospital Administration",
  "Dentistry",
  "Corporate Law",
  "Litigation",
  "Legal Consulting",
  "School Teaching",
  "College/University Professor (Academia)",
  "Educational Administration",
  "Research & Development",
  "Journalism / Media",
  "Publishing / Writing",
  "Fine Arts / Performing Arts",
  "Design / Architecture",
  "Agriculture / Agri-Science",
  "NGO / Social Work",
  "Government Policy / Public Administration",
  "Homemaker with Professional Background",
  "Other (please specify)",
];

const POPULAR_DOMAINS = [
  "All",
  "General Management / Leadership",
  "Corporate Law",
  "Chartered Accountancy / Auditing",
  "Information Technology / Software",
  "Civil Services (IAS/IPS/IFS etc.)",
  "Operations & Supply Chain",
  "Strategy & Consulting",
  "Banking",
  "Medicine (Doctor/Physician)",
  "Defence Services (Army/Navy/Air Force)",
];

const FAQ_ITEMS = [
  {
    question: "What is Legacy Circle?",
    answer:
      "Legacy Circle is MaiHoonNa's advisory and knowledge-sharing network that connects accomplished senior professionals, retired civil servants, and veteran corporate leaders with startups, businesses, and institutions seeking seasoned wisdom and strategic counsel.",
  },
  {
    question: "How are consultations conducted?",
    answer:
      "Consultations can be held virtually via high-definition video calls or in-person (for Gurugram & Delhi NCR locations). You can request one-off strategic discovery calls, recurring advisory board sessions, or project-based milestone reviews.",
  },
  {
    question: "Who can join as a Senior Expert / Advisor?",
    answer:
      "We welcome retired or semi-retired senior professionals with 20+ years of domain experience across corporate management, civil services, legal counsel, healthcare, finance, defense, technology, or academia looking to meaningfully share their expertise on flexible terms.",
  },
  {
    question: "Can adult children register their retired parents?",
    answer:
      "Yes! Many families register their parents on Legacy Circle to help them stay intellectually engaged, socially connected, and valued for their lifelong achievements. Our team handles onboarding and profile creation with personalized care.",
  },
  {
    question: "How are advisors vetted and credentials verified?",
    answer:
      "Every advisor undergoes thorough background verification, career history review, identity validation, and an initial alignment interview with our leadership team before their profile is activated on the platform.",
  },
  {
    question: "What are the advisory fees or pricing structure?",
    answer:
      "Advisors set their consultation preferences — many offer initial discovery calls complimentary, with structured hourly or monthly retainer arrangements for ongoing advisory. MaiHoonNa provides transparent escrow and scheduling support.",
  },
];

const LegacyPage = ({ openForm, setActivePage }) => {
  // Directory Filters State
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");

  // Modal / Booking State
  const [activeModal, setActiveModal] = useState(null); // 'consultation' | 'join'
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    organization: "",
    domainInterest: "General Management / Leadership",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Filtered Experts
  const filteredExperts = useMemo(() => {
    return EXPERTS_DATA.filter((expert) => {
      // Domain filter
      if (selectedDomain !== "All" && expert.domain !== selectedDomain) {
        return false;
      }
      // Location filter
      if (selectedLocation !== "All") {
        if (selectedLocation === "Gurugram" && !expert.location.toLowerCase().includes("gurugram")) return false;
        if (selectedLocation === "Delhi NCR" && !expert.location.toLowerCase().includes("delhi")) return false;
        if (selectedLocation === "Remote" && !expert.location.toLowerCase().includes("remote")) return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = expert.name.toLowerCase().includes(q);
        const matchesRole = expert.role.toLowerCase().includes(q);
        const matchesCompany = expert.company.toLowerCase().includes(q);
        const matchesTags = expert.tags.some((t) => t.toLowerCase().includes(q));
        const matchesBio = expert.bio.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesCompany && !matchesTags && !matchesBio) {
          return false;
        }
      }
      return true;
    });
  }, [selectedDomain, searchQuery, selectedLocation]);

  const handleOpenConsultation = (expert) => {
    setSelectedExpert(expert);
    setActiveModal("consultation");
    setFormSubmitted(false);
  };

  const handleOpenJoinModal = () => {
    setSelectedExpert(null);
    setActiveModal("join");
    setFormSubmitted(false);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedExpert(null);
    setFormSubmitted(false);
    setFormData({
      name: "",
      email: "",
      phone: "",
      message: "",
      organization: "",
      domainInterest: "General Management / Leadership",
    });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  return (
    <main className="legacy-page" aria-label="Legacy Circle – Senior Expertise Network">

      {/* ── 1. HERO SECTION (Figma Spec) ── */}
      <section className="legacy-hero">
        <div className="legacy-hero__glow-orange" aria-hidden="true" />
        <div className="legacy-hero__glow-purple" aria-hidden="true" />

        <div className="legacy-hero__container">

          {/* Left Hero Content */}
          <div className="legacy-hero__left">
            <div className="legacy-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15l-4 6 4-2 4 2-4-6z" />
                <circle cx="12" cy="8" r="6" />
              </svg>
              <span className="legacy-badge__text">LEGACY CIRCLES</span>
            </div>

            <h1 className="legacy-hero__title">
              A lifetime of expertise, <br />
              <span className="legacy-hero__title-highlight">still in demand.</span>
            </h1>

            <p className="legacy-hero__desc">
              Legacy Circles is MaiHoonNa's professional consulting directory for seniors - turning retirement into continued relevance, purpose, and income.
            </p>

            <div className="legacy-hero__actions">
              <a
                href="#directory"
                className="legacy-btn legacy-btn--primary"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("directory")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>Browse Experts</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
              <button
                className="legacy-btn legacy-btn--outline"
                onClick={handleOpenJoinModal}
              >
                List your Profile
              </button>
            </div>
          </div>

          {/* Right Floating Profile Cards Preview (Figma Spec) */}
          <div className="legacy-hero__right" aria-hidden="true">
            <div className="legacy-floating-cards">

              {/* Float Card 1: Arvind Kapoor */}
              <div className="legacy-float-card legacy-float-card--1">
                <div className="legacy-float-card__avatar" style={{ background: "#FE6700" }}>AK</div>
                <div className="legacy-float-card__info">
                  <div className="legacy-float-card__name">Arvind Kapoor</div>
                  <div className="legacy-float-card__role">CFO · Finance</div>
                </div>
                <div className="legacy-float-card__dot" />
              </div>

              {/* Float Card 2: Dr. Meena Rajan */}
              <div className="legacy-float-card legacy-float-card--2">
                <div className="legacy-float-card__avatar" style={{ background: "#7C3AED" }}>MR</div>
                <div className="legacy-float-card__info">
                  <div className="legacy-float-card__name">Dr. Meena Rajan</div>
                  <div className="legacy-float-card__role">Physician · Healthcare</div>
                </div>
                <div className="legacy-float-card__dot" />
              </div>

              {/* Center Orange Badge: 120+ verified experts */}
              <div className="legacy-float-badge-orange">
                <div className="legacy-float-badge-orange__title">120+ verified experts</div>
                <div className="legacy-float-badge-orange__sub">across 15+ domains · Gurugram pilot</div>
              </div>

              {/* Float Card 3: Y. Krishnamurthy */}
              <div className="legacy-float-card legacy-float-card--3">
                <div className="legacy-float-card__avatar" style={{ background: "#14B8A6" }}>YK</div>
                <div className="legacy-float-card__info">
                  <div className="legacy-float-card__name">Y. Krishnamurthy</div>
                  <div className="legacy-float-card__role">CTO · Technology</div>
                </div>
                <div className="legacy-float-card__dot" />
              </div>

              {/* Float Card 4: Padma Shah */}
              <div className="legacy-float-card legacy-float-card--4">
                <div className="legacy-float-card__avatar" style={{ background: "#10B981" }}>PS</div>
                <div className="legacy-float-card__info">
                  <div className="legacy-float-card__name">Padma Shah</div>
                  <div className="legacy-float-card__role">HR Director</div>
                </div>
                <div className="legacy-float-card__dot" />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 2. RETIREMENT SHOULDN'T MEAN IRRELEVANCE (VALUE & OFFERINGS) ── */}
      <section className="legacy-value">
        <div className="legacy-value__container">

          <div className="legacy-value__grid">

            {/* Left Column: Problem & 3 Core Steps (Figma Spec) */}
            <div className="legacy-value__left">
              <h2 className="legacy-value__heading">
                Retirement shouldn't mean irrelevance.
              </h2>
              <p className="legacy-value__subtext">
                A retired CFO still knows how to build financial systems. A former schoolteacher still knows how to teach a struggling student. Legacy Circles connects this expertise with people and organisations that need it.
              </p>

              <div className="legacy-value__points">

                <div className="legacy-point-item">
                  <div className="legacy-point-item__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className="legacy-point-item__content">
                    <div className="legacy-point-item__header">
                      <span className="legacy-point-item__num">01</span>
                      <h3 className="legacy-point-item__title">Create a Legacy Profile</h3>
                    </div>
                    <p className="legacy-point-item__desc">
                      Tell us your domain, years of experience, availability, and how you like to engage — consulting, mentoring, speaking, or advisory.
                    </p>
                  </div>
                </div>

                <div className="legacy-point-item">
                  <div className="legacy-point-item__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <div className="legacy-point-item__content">
                    <div className="legacy-point-item__header">
                      <span className="legacy-point-item__num">02</span>
                      <h3 className="legacy-point-item__title">Get discovered</h3>
                    </div>
                    <p className="legacy-point-item__desc">
                      Organisations, startups, NGOs, and individuals find you through our verified search directory — filtered by domain, city, and availability.
                    </p>
                  </div>
                </div>

                <div className="legacy-point-item">
                  <div className="legacy-point-item__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m11 17 2 2a1 1 0 0 0 1.42 0l6.58-6.59a1 1 0 0 0 0-1.41l-2.58-2.59a1 1 0 0 0-1.42 0L13 12" />
                      <path d="m13 12-3.5-3.5a1 1 0 0 0-1.42 0L5.5 11.08a1 1 0 0 0 0 1.42L9 16" />
                      <path d="M18 11V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
                    </svg>
                  </div>
                  <div className="legacy-point-item__content">
                    <div className="legacy-point-item__header">
                      <span className="legacy-point-item__num">03</span>
                      <h3 className="legacy-point-item__title">Engage on your terms</h3>
                    </div>
                    <p className="legacy-point-item__desc">
                      Choose consulting, mentoring, advisory, or community talks. Set your hours, rates, and preferred meeting format. You stay in control.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Who searches Legacy Circles Box (Figma Spec) */}
            <div className="legacy-value__right">
              <div className="legacy-offer-box">
                <div className="legacy-offer-box__header">
                  <div className="legacy-offer-box__icon-badge">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="legacy-offer-box__title">Who searches Legacy Circles?</h3>
                </div>

                <div className="legacy-offer-list">

                  <div className="legacy-offer-card">
                    <div className="legacy-offer-card__icon" style={{ background: "rgba(254, 103, 0, 0.082)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      </svg>
                    </div>
                    <div className="legacy-offer-card__text">
                      <h4>Startups</h4>
                      <p>Seeking domain expertise and experienced advisors without full-time hiring costs.</p>
                    </div>
                  </div>

                  <div className="legacy-offer-card">
                    <div className="legacy-offer-card__icon" style={{ background: "rgba(124, 58, 237, 0.082)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
                        <path d="M9 22v-4h6v4" />
                        <path d="M8 6h.01" />
                        <path d="M16 6h.01" />
                        <path d="M12 6h.01" />
                        <path d="M12 10h.01" />
                        <path d="M12 14h.01" />
                        <path d="M16 10h.01" />
                        <path d="M16 14h.01" />
                        <path d="M8 10h.01" />
                        <path d="M8 14h.01" />
                      </svg>
                    </div>
                    <div className="legacy-offer-card__text">
                      <h4>Offices & Government Bodies</h4>
                      <p>Policy counselling, compliance advisory, and domain specialist consulting.</p>
                    </div>
                  </div>

                  <div className="legacy-offer-card">
                    <div className="legacy-offer-card__icon" style={{ background: "rgba(14, 165, 233, 0.082)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </div>
                    <div className="legacy-offer-card__text">
                      <h4>Academic Institutions</h4>
                      <p>Guest faculty, curriculum consultants, and real-world practitioner mentors.</p>
                    </div>
                  </div>

                  <div className="legacy-offer-card">
                    <div className="legacy-offer-card__icon" style={{ background: "rgba(16, 185, 129, 0.082)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                    </div>
                    <div className="legacy-offer-card__text">
                      <h4>Individuals</h4>
                      <p>Career guidance, entrepreneurship mentoring, and personal advisory — one-on-one.</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>

          {/* Sleek Dark Metric Stat Cards (Figma Spec) */}
          <div className="legacy-stats-bar">
            <div className="legacy-stat-card">
              <div className="legacy-stat-card__val">120+</div>
              <div className="legacy-stat-card__label">Verified experts</div>
            </div>
            <div className="legacy-stat-card">
              <div className="legacy-stat-card__val">15+</div>
              <div className="legacy-stat-card__label">Domains covered</div>
            </div>
            <div className="legacy-stat-card">
              <div className="legacy-stat-card__val">Free</div>
              <div className="legacy-stat-card__label">Included in all plans</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. EXPERT DIRECTORY SECTION ("Discover expertise near you") ── */}
      <section className="legacy-directory" id="directory">
        <div className="legacy-directory__container">

          <div className="legacy-directory__header">
            <span className="legacy-directory__eyebrow">EXPERTISE DIRECTORY</span>
            <h2 className="legacy-directory__title">Discover expertise near you</h2>
            <p className="legacy-directory__subtitle">
              Search by industry, domain, location, or browse curated profiles of senior advisors.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="legacy-filter-bar">

            <div className="legacy-search-input-wrap">
              <span className="legacy-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name, past role, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="legacy-search-input"
              />
              {searchQuery && (
                <button
                  className="legacy-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="legacy-filter-selects">
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="legacy-select"
                aria-label="Filter by Domain"
              >
                <option value="All">All Domains</option>
                {DOMAINS.filter((d) => d !== "All").map((dom) => (
                  <option key={dom} value={dom}>{dom}</option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="legacy-select"
                aria-label="Filter by Location"
              >
                <option value="All">All Locations</option>
                <option value="Gurugram">Gurugram</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Remote">Remote / Online</option>
              </select>

              <button
                className="legacy-btn-search"
                onClick={() => {
                  // Already filtered dynamically via useMemo
                }}
              >
                Search
              </button>
            </div>

          </div>

          {/* Expert Cards Grid */}
          <div className="legacy-cards-grid">
            {filteredExperts.length > 0 ? (
              filteredExperts.map((expert) => (
                <LegacyExpertCard
                  key={expert.id}
                  expert={expert}
                  onConsultation={handleOpenConsultation}
                />
              ))
            ) : (
              <div className="legacy-empty-state">
                <p className="legacy-empty-state__title">No experts match your current filters.</p>
                <p className="legacy-empty-state__desc">Try adjusting your keyword search or category filter.</p>
                <button
                  className="legacy-btn legacy-btn--primary"
                  onClick={() => {
                    setSelectedDomain("All");
                    setSearchQuery("");
                    setSelectedLocation("All");
                  }}
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>

          {/* Bottom Directory Button */}
          <div className="legacy-directory__bottom-cta">
            <button
              className="legacy-btn-dark-pill"
              onClick={handleOpenJoinModal}
            >
              Open an Expert Profile ↗
            </button>
          </div>

        </div>
      </section>

      {/* ── 4. CTA BANNER CARD FOR SENIOR PROFESSIONALS (Figma Spec) ── */}
      <section className="legacy-cta-section">
        <div className="legacy-cta-container">
          <div className="legacy-cta-card">
            <div className="legacy-cta-card__glow-orange" aria-hidden="true" />
            <div className="legacy-cta-card__glow-purple" aria-hidden="true" />

            <div className="legacy-cta-card__left">
              <div className="legacy-cta-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15l-4 6 4-2 4 2-4-6z" />
                  <circle cx="12" cy="8" r="6" />
                </svg>
                <span>JOIN LEGACY CIRCLES</span>
              </div>

              <h2 className="legacy-cta-heading">
                Is your parent ready <br />
                to be asked again?
              </h2>

              <p className="legacy-cta-desc">
                Legacy Circles is included in all MaiHoonNa plans — no extra charge. Senior professionals can create a profile and start receiving connection requests from organisations that value their experience.
              </p>

              <div className="legacy-cta-guarantees">
                <div className="legacy-guarantee-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>Completely free for seniors</span>
                </div>

                <div className="legacy-guarantee-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>Verified connections only</span>
                </div>

                <div className="legacy-guarantee-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>You set the engagement terms</span>
                </div>
              </div>
            </div>

            <div className="legacy-cta-card__right">
              <div className="legacy-cta-btns">
                <button
                  className="legacy-btn-white"
                  onClick={handleOpenJoinModal}
                >
                  Start here
                </button>
                <button
                  className="legacy-btn-glass"
                  onClick={handleOpenJoinModal}
                >
                  List your organisation
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <section className="legacy-faq" id="faq-section">
        <div className="legacy-faq__container">

          <div className="legacy-faq__header">
            <span className="legacy-faq__eyebrow">FREQUENTLY ASKED QUESTIONS</span>
            <h2 className="legacy-faq__title">Common Questions About Legacy Circle</h2>
            <p className="legacy-faq__subtitle">
              Have questions about booking consultations, onboarding senior advisors, or joining the network?
              Write to us at <a href="mailto:info@maihoonna.com">info@maihoonna.com</a>
            </p>
          </div>

          <div className="legacy-faq__list">
            {FAQ_ITEMS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`legacy-faq-item ${isOpen ? "open" : ""}`}
                >
                  <button
                    className="legacy-faq-question"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="legacy-faq-icon">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="legacy-faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── 6. INTERACTIVE CONSULTATION & EXPERT ONBOARDING MODAL ── */}
      {activeModal && (
        <div className="legacy-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="legacy-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="legacy-modal-close"
              onClick={handleCloseModal}
              aria-label="Close modal"
            >
              ✕
            </button>

            {formSubmitted ? (
              <div className="legacy-modal-success">
                <div className="legacy-success-icon">✓</div>
                <h3>Request Received!</h3>
                <p>
                  Thank you for connecting. Our senior advisory coordination team will review your
                  request and reach out within 24 hours.
                </p>
                <button
                  className="legacy-btn legacy-btn--primary"
                  onClick={handleCloseModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <div className="legacy-modal-header">
                  <span className="legacy-modal-tag">
                    {activeModal === "consultation" ? "CONSULTATION REQUEST" : "EXPERT ONBOARDING"}
                  </span>
                  <h3 className="legacy-modal-title">
                    {activeModal === "consultation"
                      ? selectedExpert
                        ? `Connect with ${selectedExpert.name}`
                        : "Request Senior Advisory"
                      : "Join India's Senior Advisory Network"}
                  </h3>
                  <p className="legacy-modal-sub">
                    {activeModal === "consultation"
                      ? "Share your advisory goals and our team will facilitate an initial discovery conversation."
                      : "Tell us about your career background or register on behalf of a retired family member."}
                  </p>
                </div>

                <form className="legacy-modal-form" onSubmit={handleFormSubmit}>
                  <div className="legacy-form-row">
                    <div className="legacy-form-field">
                      <label>Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Chandra"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="legacy-form-field">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="you@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="legacy-form-row">
                    <div className="legacy-form-field">
                      <label>Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="legacy-form-field">
                      <label>{activeModal === "consultation" ? "Company / Venture Name" : "Past Organization / Role"}</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Tech / Ex-Director"
                        value={formData.organization}
                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="legacy-form-field">
                    <label>Domain of Interest *</label>
                    <select
                      value={formData.domainInterest}
                      onChange={(e) => setFormData({ ...formData, domainInterest: e.target.value })}
                    >
                      {DOMAINS.filter((d) => d !== "All").map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="legacy-form-field">
                    <label>
                      {activeModal === "consultation"
                        ? "Briefly describe the guidance or challenge you need help with"
                        : "Tell us about your key areas of expertise and years in the industry"}
                    </label>
                    <textarea
                      rows="3"
                      placeholder={
                        activeModal === "consultation"
                          ? "e.g. Looking for guidance on scaling corporate compliance and taxation..."
                          : "e.g. 30+ years in manufacturing plant operations, interested in part-time advisory..."
                      }
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <div className="legacy-modal-actions">
                    <button type="button" className="legacy-btn-cancel" onClick={handleCloseModal}>
                      Cancel
                    </button>
                    <button type="submit" className="legacy-btn legacy-btn--primary">
                      {activeModal === "consultation" ? "Submit Consultation Request" : "Submit Expert Application"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
};

export default LegacyPage;
