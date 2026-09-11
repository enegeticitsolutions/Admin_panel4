import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_BASE } from '../services/api';
import saathiBgVideo from '../assets/Sathi-Header-Background-Video.mp4';

const SaathiPage = () => {
  const [content, setContent] = useState(null);
  const [saathis, setSaathis] = useState([]);
  const [liveStats, setLiveStats] = useState({ activeCount: 0, totalHours: 0 });
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    state: '',
    city: '',
    pincode: '',
    area: '',
    whyJoin: '',
    dob: '',
    interests: []
  });

  const [agreementChecked, setAgreementChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [dpdpChecked, setDpdpChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  // Accordion state for How It Works
  const [expandedStep, setExpandedStep] = useState(0);

  const fetchContent = async () => {
    try {
      const res = await fetch(`${API_BASE}/website/content/sathi`);
      const data = await res.json();

      if (data.success) {
        setContent(data.data.content);
        setSaathis(data.data.saathis || []);
        if (data.data.liveStats) {
          setLiveStats(data.data.liveStats);
        }
      }
    } catch (err) {
      console.error("Failed to fetch Saathi content", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  // Pincode auto-fetch effect
  useEffect(() => {
    const fetchLocation = async () => {
      if (formData.pincode && formData.pincode.length === 6) {
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${formData.pincode}`);
          const data = await res.json();
          if (data && data[0] && data[0].Status === 'Success') {
            const postOffices = data[0].PostOffice;
            const state = postOffices[0].State;
            const city = postOffices[0].District;

            setFormData(prev => ({
              ...prev,
              state: state,
              city: city
            }));
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    fetchLocation();
  }, [formData.pincode]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const numericValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    if (name === 'pincode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, pincode: numericValue }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreementChecked) {
      setSubmitMessage({ type: 'error', text: 'You must agree to the background verification to proceed.' });
      return;
    }

    if (!termsChecked) {
      setSubmitMessage({ type: 'error', text: 'You must accept the Terms and Conditions.' });
      return;
    }

    if (!dpdpChecked) {
      setSubmitMessage({ type: 'error', text: 'You must consent to the Privacy Policy and DPDP Act.' });
      return;
    }

    if (formData.phone && formData.phone.length !== 10) {
      setSubmitMessage({ type: 'error', text: 'Please enter a valid 10-digit phone number.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      setSubmitMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    // Calculate age from dob
    let age = null;
    if (formData.dob) {
      const birthDate = new Date(formData.dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const payload = { ...formData, age };

    try {
      const res = await fetch(`${API_BASE}/website/saathi-enrollment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitMessage({ type: 'success', text: "Thank you! Your application has been submitted successfully." });
        setFormData({
          firstName: '', lastName: '', email: '', phone: '', gender: '',
          state: '', city: '', pincode: '', area: '', whyJoin: '', dob: '', interests: []
        });
        setAgreementChecked(false);
        setTermsChecked(false);
        fetchContent();
      } else {
        setSubmitMessage({ type: 'error', text: data.message || "Something went wrong. Please try again." });
      }
    } catch (err) {
      setSubmitMessage({ type: 'error', text: "Network error. Please try again later." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#FE6700] font-[Poppins]">Loading...</div>;
  }

  // Fallback content in case DB is not seeded or fetch fails
  const heroContent = content?.hero || {
    title: "Companionship that doesn't run on the clock.",
    subtitle: "Community volunteers who visit for company, conversation, or assistance",
    stats: [
      { number: "340+", label: "Active Saathis" },
      { number: "8,200+", label: "Hours given" },
      { number: "100%", label: "Background verified" }
    ]
  };

  const stepsContent = content?.steps || [];
  const rewardsContent = content?.rewards || [];

  return (
    <div className="saathi-page">
      {/* ── HERO SECTION (FIGMA EXACT) ── */}
      <section className="saathi-hero">
        {/* Background video */}
        <video
          className="saathi-hero__bg-video"
          src={saathiBgVideo}
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="saathi-hero__inner">
          <div className="saathi-hero__badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Saathi Network · Volunteer Programme</span>
          </div>

          <h1 className="saathi-hero__title">
            Companionship that<br />
            doesn't run<br />
            <span>on the clock.</span>
          </h1>

          <p className="saathi-hero__desc">
            Community volunteers who visit for company, conversation, or a shared walk. Every verified hour earns Saathi credits — and changes a senior's day.
          </p>

          <div className="saathi-hero__actions">
            <button
              onClick={() => document.getElementById('enrollment-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="saathi-btn-primary"
            >
              <span>Volunteer Now</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="saathi-btn-secondary"
            >
              <span>How It Works</span>
            </button>
          </div>

          <div className="saathi-hero__stats">
            <div className="saathi-hero__stat-item">
              <span className="saathi-hero__stat-number">
                {liveStats.activeCount > 0 ? liveStats.activeCount : "340+"}
              </span>
              <span className="saathi-hero__stat-label">Active Saathis</span>
            </div>

            <div className="saathi-hero__stat-item">
              <span className="saathi-hero__stat-number">
                {liveStats.totalHours > 0 ? `${parseFloat(liveStats.totalHours).toFixed(1)}+` : "8,200+"}
              </span>
              <span className="saathi-hero__stat-label">Hours given</span>
            </div>

            <div className="saathi-hero__stat-item">
              <span className="saathi-hero__stat-number">100%</span>
              <span className="saathi-hero__stat-label">Background verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS SECTION (FIGMA EXACT) ── */}
      <section id="how-it-works" className="saathi-how">
        <div className="saathi-how__container">
          {/* Left Sidebar */}
          <div className="saathi-how__sidebar">
            <span className="saathi-how__eyebrow">HOW IT WORKS</span>
            <h2 className="saathi-how__title">
              Volunteers who give time, <span>earn recognition</span>
            </h2>
            <p className="saathi-how__desc">
              We've built a thorough but respectful process to ensure every Saathi is safe, trustworthy, and matched well.
            </p>
            <button
              onClick={() => document.getElementById('enrollment-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="saathi-how__btn"
            >
              <span>Start Your Application</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Right Accordion Steps */}
          <div className="saathi-how__steps">
            {[
              {
                num: "01",
                title: "Apply for Saathi and take an Empathy Assessment",
                description: "Fill in the enrolment form below or register yourself as a Saathi through the Saathi app.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                )
              },
              {
                num: "02",
                title: "Background verification",
                description: "We run a thorough BackGround Verification - Identity check, Address check, and Court check. Fully confidential.",
                note: "💡 Required: Identity and address proof (PAN, Aadhaar, Voter ID or/ and Passport).",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                )
              },
              {
                num: "03",
                title: "Saathi Coordinator approval & onboarding",
                description: "Our Saathi Coordinator reviews your profile, conducts a short video call, and walks you through the Saathi code of conduct.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )
              },
              {
                num: "04",
                title: "Matched by location",
                description: "You're assigned to seniors within a walkable or short-commute radius from your home — no long travel, ever.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                )
              },
              {
                num: "05",
                title: "Every hour tracked & rewarded",
                description: "Geo-fenced check-in and check-out confirms every visit. Hours convert to Saathi Points — redeemable for real rewards.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                  </svg>
                )
              }
            ].map((step, idx) => {
              const isExpanded = expandedStep === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setExpandedStep(idx)}
                  className={`saathi-step-card ${isExpanded ? "saathi-step-card--active" : ""}`}
                >
                  <div className="saathi-step-card__top">
                    <div className="saathi-step-card__icon-box">
                      {step.icon}
                    </div>

                    <div className="saathi-step-card__header">
                      <div className="saathi-step-card__title-row">
                        <span className="saathi-step-card__num">{step.num}</span>
                        <h3 className="saathi-step-card__title">{step.title}</h3>
                      </div>
                      <p className="saathi-step-card__summary">{step.description}</p>
                    </div>

                    <svg className="saathi-step-card__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {isExpanded && step.note && (
                    <div className="saathi-step-card__banner">
                      <span>{step.note}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── REWARDS SECTION (WHY BECOME A SAATHI - FIGMA EXACT) ── */}
      <section className="saathi-rewards">
        <div className="saathi-rewards__inner">
          <span className="saathi-rewards__eyebrow">WHY BECOME A SAATHI</span>
          <h2 className="saathi-rewards__title">
            Give an hour. Change a day. <span>Earn real rewards.</span>
          </h2>

          <div className="saathi-rewards__grid">
            {[
              {
                icon: "🎁",
                title: "Saathi Points",
                desc: "Every verified hour earns points. Redeem for vouchers, groceries, or digital rewards."
              },
              {
                icon: "🏆",
                title: "Recognition tiers",
                desc: "Rise from New → Senior → Top → Legend Saathi. Each tier unlocks new benefits."
              },
              {
                icon: "📜",
                title: "Verified certificate",
                desc: "Receive a MaiHoonNa Volunteer Certificate — valued for college and job applications."
              },
              {
                icon: "🤝",
                title: "Community",
                desc: "Join monthly Saathi meetups, WhatsApp groups, and an annual Saathi Samman event."
              }
            ].map((reward, idx) => (
              <div key={idx} className="saathi-reward-card">
                <div className="saathi-reward-card__icon">{reward.icon}</div>
                <h3 className="saathi-reward-card__title">{reward.title}</h3>
                <p className="saathi-reward-card__desc">{reward.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MEET OUR SAATHIS (OUR COMMUNITY - LIVE BACKEND DATA + FIGMA UI) ── */}
      <section className="saathi-community">
        <div className="saathi-community__inner">
          <span className="saathi-community__eyebrow">OUR COMMUNITY</span>
          <h2 className="saathi-community__title">Meet our Saathis</h2>
          <p className="saathi-community__desc">
            Every Saathi is background-verified, trained, and matched to seniors near them.
          </p>

          <div className="saathi-community__grid">
            {(saathis && saathis.length > 0 ? saathis : [
              {
                name: "Priya Sharma",
                city: "Gurugram",
                state: "Haryana",
                area: "Sector 55",
                totalCreditHours: 128,
                profilePhoto: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80"
              },
              {
                name: "Raj Patel",
                city: "Gurugram",
                state: "Haryana",
                area: "Sector 56",
                totalCreditHours: 96,
                profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80"
              },
              {
                name: "Anita Devi",
                city: "Gurugram",
                state: "Haryana",
                area: "Sector 54",
                totalCreditHours: 214,
                profilePhoto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80"
              },
              {
                name: "Deepak Kumar",
                city: "Gurugram",
                state: "Haryana",
                area: "Sector 57",
                totalCreditHours: 72,
                profilePhoto: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80"
              }
            ]).map((saathi, idx) => {
              const tierPresets = [
                { tier: "Top Saathi", tierBg: "#FE6700", color: "#FE6700" },
                { tier: "Senior Saathi", tierBg: "#7C3AED", color: "#7C3AED" },
                { tier: "Legend Saathi", tierBg: "#059669", color: "#059669" },
                { tier: "New Saathi", tierBg: "#0EA5E9", color: "#0EA5E9" }
              ];
              const defaultPhotos = [
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80"
              ];
              const preset = tierPresets[idx % tierPresets.length];
              const creditHours = Math.round(Number(saathi.totalCreditHours || 0) * 10) / 10;
              const locationText = saathi.area ? saathi.area : [saathi.city, saathi.state].filter(Boolean).join(', ') || "Gurugram";

              // Dynamic tier based on live credit hours
              let tierName = preset.tier;
              let tierBg = preset.tierBg;
              let themeColor = preset.color;

              if (creditHours >= 50) {
                tierName = "Legend Saathi";
                tierBg = "#059669";
                themeColor = "#059669";
              } else if (creditHours >= 20) {
                tierName = "Top Saathi";
                tierBg = "#FE6700";
                themeColor = "#FE6700";
              } else if (creditHours >= 5) {
                tierName = "Senior Saathi";
                tierBg = "#7C3AED";
                themeColor = "#7C3AED";
              } else if (saathi.totalCreditHours !== undefined) {
                tierName = "New Saathi";
                tierBg = "#0EA5E9";
                themeColor = "#0EA5E9";
              }

              const photoSrc = saathi.profilePhoto || defaultPhotos[idx % defaultPhotos.length];

              return (
                <div key={idx} className="saathi-card">
                  <div className="saathi-card__img-wrap">
                    <img src={photoSrc} alt={`Saathi companion ${saathi.name} - Senior Companionship Volunteer`} loading="lazy" className="saathi-card__img" />
                    <div className="saathi-card__img-overlay" />
                    <div className="saathi-card__tier-badge" style={{ background: tierBg }}>
                      {tierName}
                    </div>
                    <div className="saathi-card__shield">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                    </div>
                  </div>

                  <div className="saathi-card__body">
                    <h3 className="saathi-card__name">{saathi.name}</h3>
                    <div className="saathi-card__location">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="truncate">{locationText}</span>
                    </div>

                    <div className="saathi-card__footer">
                      <div className="saathi-card__rating-col">
                        <div className="saathi-card__stars">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i < 4 ? "#FE6700" : "none"} stroke="#FE6700" strokeWidth="1.5">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                        <span className="saathi-card__review-text">Verified</span>
                      </div>

                      <div className="saathi-card__hours-col">
                        <span className="saathi-card__hours-num" style={{ color: themeColor }}>{creditHours}</span>
                        <span className="saathi-card__hours-label">hours given</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="saathi-community__banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Every Saathi is background-verified before their first visit</span>
          </div>
        </div>
      </section>

      {/* ── BECOME A SAATHI CTA BANNER (FIGMA EXACT) ── */}
      <section className="saathi-cta-banner">
        <div className="saathi-cta-banner__inner">
          <span className="saathi-cta-banner__eyebrow">BECOME A SAATHI</span>
          <h2 className="saathi-cta-banner__title">
            Give an hour.<br />Change a day.
          </h2>
          <p className="saathi-cta-banner__desc">
            Every hour you give brings care, comfort, and connection to a senior near you. Your time is worth more than you think.
          </p>
          <button
            onClick={() => document.getElementById('enrollment-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="saathi-cta-banner__btn"
          >
            <span>Volunteer Now</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── SAATHI ENROLLMENT APPLICATION FORM (FIGMA EXACT) ── */}
      <section id="enrollment-form" className="saathi-enrollment">
        <div className="saathi-enrollment__container">

          {/* Left Sidebar Steps */}
          <div className="saathi-enrollment__sidebar">
            <span className="saathi-enrollment__eyebrow">READY TO JOIN?</span>
            <h2 className="saathi-enrollment__title">
              Saathi Enrollment Application
            </h2>
            <p className="saathi-enrollment__desc">
              Your application process takes about 7–8 days. Here's what to expect:
            </p>

            <div className="saathi-enrollment__steps">
              {/* Step 1 */}
              <div className="saathi-enroll-step">
                <div className="saathi-enroll-step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <span className="saathi-enroll-step__badge">STEP 1</span>
                  <h4 className="saathi-enroll-step__title">Share your info</h4>
                  <p className="saathi-enroll-step__subtitle">Fill the form · 05 mins</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="saathi-enroll-step">
                <div className="saathi-enroll-step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <path d="m9 14 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <span className="saathi-enroll-step__badge">STEP 2</span>
                  <h4 className="saathi-enroll-step__title">Take the empathy assessment</h4>
                  <p className="saathi-enroll-step__subtitle">Short online assessment · 15–20 mins</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="saathi-enroll-step">
                <div className="saathi-enroll-step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <div>
                  <span className="saathi-enroll-step__badge">STEP 3</span>
                  <h4 className="saathi-enroll-step__title">Background verification</h4>
                  <p className="saathi-enroll-step__subtitle">5–7 working days</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="saathi-enroll-step">
                <div className="saathi-enroll-step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <span className="saathi-enroll-step__badge">STEP 4</span>
                  <h4 className="saathi-enroll-step__title">You go live</h4>
                  <p className="saathi-enroll-step__subtitle">First assignments begin</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="saathi-enrollment__form-card">
            {submitMessage && (
              <div className={`p-4 rounded-xl mb-6 font-[Poppins] text-sm ${submitMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Row 1: First Name & Last Name */}
              <div className="saathi-form-row">
                <div className="saathi-form-group">
                  <label className="saathi-form-label">First Name *</label>
                  <input
                    required
                    type="text"
                    name="firstName"
                    placeholder="Priya"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Last Name *</label>
                  <input
                    required
                    type="text"
                    name="lastName"
                    placeholder="Sharma"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
              </div>

              {/* Row 2: Email & Phone Number */}
              <div className="saathi-form-row">
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Email *</label>
                  <input
                    required
                    type="email"
                    name="email"
                    pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                    title="Please enter a valid email address"
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Phone Number *</label>
                  <div style={{ display: 'flex', alignItems: 'center' }} className="saathi-form-input">
                    <span style={{ marginRight: '8px', color: '#666' }}>+91</span>
                    <input
                      required
                      type="tel"
                      name="phone"
                      pattern="[0-9]{10}"
                      title="Please enter a valid 10-digit phone number"
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={handleChange}
                      style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'inherit' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Gender & Date of Birth */}
              <div className="saathi-form-row">
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="saathi-form-input"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Date of Birth *</label>
                  <DatePicker
                    selected={formData.dob ? new Date(formData.dob) : null}
                    onChange={(date) => {
                      // Format to YYYY-MM-DD
                      const dateString = date ? new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : '';
                      const event = { target: { name: 'dob', value: dateString } };
                      handleChange(event);
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="saathi-form-input w-full"
                    wrapperClassName="w-full"
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                    maxDate={new Date()}
                    required
                  />
                </div>
              </div>

              {/* Row 4: Pincode & Area */}
              <div className="saathi-form-row">
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    placeholder="e.g. 122011"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
                <div className="saathi-form-group">
                  <label className="saathi-form-label">Area / Sector</label>
                  <input
                    type="text"
                    name="area"
                    placeholder="e.g. Sector 55"
                    value={formData.area}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
              </div>

              {/* Row 5: City & State */}
              <div className="saathi-form-row">
                <div className="saathi-form-group">
                  <label className="saathi-form-label">City *</label>
                  <input
                    required
                    type="text"
                    name="city"
                    placeholder="e.g. Gurugram"
                    value={formData.city}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
                <div className="saathi-form-group">
                  <label className="saathi-form-label">State *</label>
                  <input
                    required
                    type="text"
                    name="state"
                    placeholder="e.g. Haryana"
                    value={formData.state}
                    onChange={handleChange}
                    className="saathi-form-input"
                  />
                </div>
              </div>

              {/* Row 6: Interests */}
              <div className="saathi-form-group" style={{ marginBottom: '16px' }}>
                <label className="saathi-form-label">Areas of Interest</label>
                <div className="saathi-pills-row">
                  {['Cooking', 'Music', 'Traveling', 'Yoga/Exercise', 'Reading', 'Sports', 'Art', 'Technology', 'Gardening', 'Movies'].map(interest => {
                    const isSelected = (formData.interests || []).includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => {
                          const current = formData.interests || [];
                          const updated = current.includes(interest)
                            ? current.filter(i => i !== interest)
                            : [...current, interest];
                          setFormData(prev => ({ ...prev, interests: updated }));
                        }}
                        className={`saathi-pill-btn ${isSelected ? 'saathi-pill-btn--active' : ''}`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 7: Why do you want to be a Saathi? */}
              <div className="saathi-form-group" style={{ marginBottom: '24px' }}>
                <label className="saathi-form-label">Why do you want to be a Saathi? *</label>
                <textarea
                  required
                  name="whyJoin"
                  rows="3"
                  placeholder="Tell us what motivates you to volunteer..."
                  value={formData.whyJoin}
                  onChange={handleChange}
                  className="saathi-form-textarea"
                />
              </div>

              {/* BGV Consent Banner */}
              <div className="saathi-form-banner">
                <input
                  type="checkbox"
                  id="agreement"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#FE6700', cursor: 'pointer' }}
                />
                <label htmlFor="agreement" style={{ cursor: 'pointer', margin: 0 }}>
                  I agree to undergo background verification (Aadhaar-linked identity + police check). I confirm the information above is accurate and I will abide by MaiHoonNa's Saathi code of conduct.
                </label>
              </div>

              {/* Privacy & Terms Consent */}
              <div className="saathi-form-banner" style={{ marginTop: '12px' }}>
                <input
                  type="checkbox"
                  id="termsConsent"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#FE6700', cursor: 'pointer' }}
                />
                <label htmlFor="termsConsent" style={{ cursor: 'pointer', margin: 0 }}>
                  I accept the <a href="/legal#terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange, #fe6700)', textDecoration: 'underline' }}>Terms & Conditions</a>.
                </label>
              </div>

              <div className="saathi-form-banner" style={{ marginTop: '12px' }}>
                <input
                  type="checkbox"
                  id="dpdpConsent"
                  checked={dpdpChecked}
                  onChange={(e) => setDpdpChecked(e.target.checked)}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#FE6700', cursor: 'pointer' }}
                />
                <label htmlFor="dpdpConsent" style={{ cursor: 'pointer', margin: 0 }}>
                  I have read and agree to the <a href="/legal#privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange, #fe6700)', textDecoration: 'underline' }}>Privacy Policy</a> and consent to processing of my personal data under the DPDP Act, 2023.
                </label>
              </div>

              {/* Submit Button */}
              <button
                disabled={isSubmitting || !agreementChecked || !termsChecked || !dpdpChecked}
                type="submit"
                className="saathi-form-submit"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>{isSubmitting ? 'Submitting Application...' : 'Submit Enrollment Application'}</span>
              </button>

              <p className="saathi-form-footer">
                We respond within 24 hours · Your data stays private
              </p>
            </form>
          </div>

        </div>
      </section>

      {/* ── HOW TO ACCESS THE SAATHI NETWORK (SUBSCRIBERS - FIGMA EXACT) ── */}
      <section className="saathi-subscribers">
        <div className="saathi-subscribers__container">
          <div className="saathi-subscribers__header">
            <span className="saathi-subscribers__eyebrow">FOR SUBSCRIBERS</span>
            <h2 className="saathi-subscribers__title">
              How to access the Saathi Network
            </h2>
          </div>

          <div className="saathi-subscribers__grid">
            {/* Card 1 */}
            <div className="saathi-subscriber-card">
              <div className="saathi-subscriber-card__icon">
                <svg width="47" height="47" viewBox="0 0 48 48" fill="none">
                  <path d="M24 6L6 15V33L24 42L42 33V15L24 6Z" fill="#FFE17D" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M6 15L24 24L42 15" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M24 24V42" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M15 10.5L33 19.5" stroke="#FF8087" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="saathi-subscriber-card__title">Included in Plus & Premium</h3>
              <p className="saathi-subscriber-card__desc">
                Saathi Network visits are included in Saathi Plus and Premium plans at no extra cost. Starter members can add on.
              </p>
            </div>

            {/* Card 2 */}
            <div className="saathi-subscriber-card">
              <div className="saathi-subscriber-card__icon">
                <svg width="47" height="47" viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="6" width="32" height="36" rx="4" fill="#DFF6FD" stroke="#000000" strokeWidth="2.5" />
                  <path d="M16 16H32M16 22H26" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M32 26C32 26 40 28 40 34C40 40 32 44 32 44C32 44 24 40 24 34C24 28 32 26 32 26Z" fill="#4FC123" stroke="#000000" strokeWidth="2.5" />
                  <path d="M28 34L31 37L36 31" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="saathi-subscriber-card__title">Privacy by design</h3>
              <p className="saathi-subscriber-card__desc">
                Care Mitras never share your family's personal information. All visits are logged but contact details stay private.
              </p>
            </div>

            {/* Card 3 */}
            <div className="saathi-subscriber-card">
              <div className="saathi-subscriber-card__icon">
                <svg width="47" height="47" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4C14.0589 4 6 12.0589 6 22C6 33.5 24 44 24 44C24 44 42 33.5 42 22C42 12.0589 33.9411 4 24 4Z" fill="#EA526C" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" />
                  <circle cx="24" cy="20" r="7" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
                  <polyline points="24 16 24 20 27 22" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="saathi-subscriber-card__title">All visits tracked</h3>
              <p className="saathi-subscriber-card__desc">
                Geo-fenced check-ins confirm every Saathi arrival and departure. Full visit history visible on Family Connect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SAATHI NETWORK FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <section className="saathi-faq">
        <div className="saathi-faq__container">
          <div className="saathi-faq__header">
            <span className="saathi-faq__eyebrow">FREQUENTLY ASKED QUESTIONS</span>
            <h2 className="saathi-faq__title">Questions about Saathi Network</h2>
            <p className="saathi-faq__desc">
              Have questions about volunteering or senior visits? Reach out to us at:
              <br />
              <a href="mailto:info@maihoonna.com">info@maihoonna.com</a>,{" "}
              <a href="mailto:aastha@maihoonna.com">aastha@maihoonna.com</a>,{" "}
              <a href="mailto:nidhi.hora@maihoonna.com">nidhi.hora@maihoonna.com</a>
            </p>
          </div>

          <div className="saathi-faq__list">
            <details className="saathi-faq__item" open>
              <summary className="saathi-faq__summary">
                <span>Who can become a Saathi volunteer?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Anyone aged 18 and above with empathy, a commitment to senior care, and clean background records can apply. We welcome college students, working professionals, homemakers, and active retirees looking to make a meaningful difference.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>How does the background verification (BGV) process work?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                We perform an Aadhaar-linked identity verification, criminal record background check, and contact two personal/professional references. Approval usually takes 3 to 5 working days before your first senior visit.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>Are Saathi volunteers paid, or how are rewards earned?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Saathis are community volunteers. For every verified hour spent with a senior, you earn Saathi Credit Points. Points can be redeemed for brand vouchers, merchandise, volunteer certificates for resumes, or donated to senior wellness funds.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>How are visit locations and seniors assigned to me?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Saathis are paired with seniors residing in their local area or sector (typically within a 3–5 km radius). Matching considers shared languages, hobbies, and your selected weekly availability schedule.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>How are visits tracked and safety ensured?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Every visit requires a geo-fenced check-in and check-out through the MaiHoonNa mobile app upon arrival and departure at the senior's residence. Family members can view complete visit logs in real time on Family Connect.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>What happens in case of a medical emergency during a visit?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Saathis provide social companionship and assistance, not emergency medical care. If an emergency occurs, tapping the SOS Emergency button in the app instantly alerts the MaiHoonNa 24/7 Command Center, assigned Care Manager, and emergency services.
              </div>
            </details>

            <details className="saathi-faq__item">
              <summary className="saathi-faq__summary">
                <span>How many hours am I expected to volunteer per week?</span>
                <span className="saathi-faq__icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="saathi-faq__answer">
                Volunteering is completely flexible. You choose the days and hours you are available. Most active Saathis contribute 2 to 4 hours per week.
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SaathiPage;
