import React, { useState } from "react";
import sumitKumarImg from "../assets/sumit-kejriwal-photo.png";
import aboutHeroVideo from "../assets/about.mp4";

/**
 * AboutPage – "Our Story" / About Us page
 * Matches the Figma "About Us" design spec.
 */
const AboutPage = ({ openForm, setActivePage }) => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleGetInTouch = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    setEmail("");
  };

  return (
    <main className="about-page" aria-label="About MaiHoonNa – Our Story">

      {/* 1. HERO */}
      <section className="about-hero">
        <video
          className="about-hero__bg-video"
          src={aboutHeroVideo}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="about-hero__glow" aria-hidden="true" />
        <div className="about-hero__divider" aria-hidden="true" />
        <div className="about-hero__content">
          <div className="about-hero__text-group">
            <h1 className="about-hero__hindi">मैं हूँ ना.</h1>
            <p className="about-hero__tagline">I'm here for you.</p>
          </div>
          <div className="about-hero__rule" aria-hidden="true" />
          <p className="about-hero__desc">
            That's not just our name. It's a promise - the one every one of us
            wants to make to our parents, and the one we're often too far away,
            too busy, or too unsure how to keep.
          </p>
          <div className="about-hero__ctas">
            <a
              href="#founder"
              className="about-hero__cta about-hero__cta--primary"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("founder")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Read our story
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
            <button className="about-hero__cta about-hero__cta--outline" onClick={openForm}>
              Join the pilot
            </button>
          </div>
        </div>
      </section>

      {/* 2. FOUNDER'S NOTE */}
      <section className="about-founder" id="founder" aria-labelledby="founder-heading">
        <div className="about-founder__inner">
          <div className="about-founder__photo-wrap">
            <div className="about-founder__photo">
              <img
                src={sumitKumarImg}
                alt="Sumit Kumar - Founder & CEO, MaiHoonNa (~3 decades in healthcare)"
                className="about-founder__img"
                loading="eager"
              />
            </div>
            <div className="about-founder__info-card">
              <h3 className="about-founder__info-name">Sumit Kumar</h3>
              <p className="about-founder__info-title">Founder & CEO, MaiHoonNa</p>
              <div className="about-founder__info-exp">
                <span className="about-founder__info-dot"></span>
                ~3 decades in healthcare
              </div>
            </div>
          </div>
          <div className="about-founder__text">
            <div className="about-founder__badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 0 4 0 6-1 8z" />
                <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 0 4 0 6-1 8z" />
              </svg>
              <span>Founder's Note</span>
            </div>
            <h2 id="founder-heading" className="about-founder__heading">
              I built healthcare systems for patients I'd never meet.
            </h2>
            <div className="about-founder__paras">
              <p className="about-founder__para about-founder__para--bold">
                I spent close to three decades building healthcare systems for patients I'd never meet, in countries far from home. Systems that moved care closer to people who needed it. Work I was proud of.
              </p>
              <p className="about-founder__para">
                Then I looked at my own parents - living without me, needing me on the days I couldn't be there - and realised the gap I'd spent my career solving for others existed, untouched, in my own family.
              </p>
              <p className="about-founder__para">
                MaiHoonNa is what I wished existed for them. Not a product I designed from the outside - a promise I couldn't keep any other way.
              </p>
            </div>
            <div className="about-founder__attribution">
              <div className="about-founder__rule-line" aria-hidden="true" />
              <span className="about-founder__sig">- Sumit Kumar, Founder</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THE GAP */}
      <section className="about-gap" aria-labelledby="gap-heading">
        <div className="about-gap__inner">
          <div className="about-gap__header">
            <p className="about-gap__kicker">The gap we kept seeing</p>
            <h2 id="gap-heading" className="about-gap__heading">
              Growing old in India today<br />often means growing lonely.
            </h2>
            <p className="about-gap__sub">
              Children move cities, move countries, build careers and families of
              their own. Parents adjust. They say they're fine. And somewhere in
              that gap - between the love and the distance - care quietly breaks down.
            </p>
          </div>
          <div className="about-gap__cards">
            <div className="about-gap__card">
              <div className="about-gap__card-top">
                <span className="about-gap__emoji" aria-hidden="true">⚠️</span>
                <span className="about-gap__option-label">Option A</span>
              </div>
              <h3 className="about-gap__card-title">Informal help</h3>
              <p className="about-gap__card-body">
                You hire someone and hope for the best. No training standard,
                no background check, no accountability when things go wrong.
                It's the most common choice and the least reliable one.
              </p>
            </div>
            <div className="about-gap__card">
              <div className="about-gap__card-top">
                <span className="about-gap__emoji" aria-hidden="true">🏥</span>
                <span className="about-gap__option-label">Option B</span>
              </div>
              <h3 className="about-gap__card-title">Clinical home-care</h3>
              <p className="about-gap__card-body">
                Built around procedures, not people. A nurse visits when there's
                a medical need. Between visits, the loneliness remains. Your
                parent isn't a patient - they're a person.
              </p>
            </div>
          </div>
          <div className="about-gap__quote-box">
            <p className="about-gap__quote">
              Neither one addresses the whole picture. A parent can be medically looked after and still be quietly, deeply lonely — or have company and no real safety net if something goes wrong. <span className="about-gap__quote-bold">We built MaiHoonNa because we didn't think families should have to choose.</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4. TWO LAYERS */}
      <section className="about-layers" aria-labelledby="layers-heading">
        <div className="about-layers__inner">
          <div className="about-layers__header">
            <p className="about-layers__kicker">What we built</p>
            <h2 id="layers-heading" className="about-layers__title">Two layers. One promise.</h2>
            <p className="about-layers__sub">
              Professional care and genuine human company - not as add-ons, but as the core design.
            </p>
          </div>
          <div className="about-layers__cards">
            <div className="about-layers__card about-layers__card--light">
              <div className="about-layers__icon-wrap about-layers__icon-wrap--orange">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="about-layers__layer-tag">Layer 1</div>
              <h3 className="about-layers__card-title">Care Mitras</h3>
              <p className="about-layers__card-desc">
                Trained, background-verified care professionals - showing up consistently, logging every visit, and escalating when needed.
              </p>
              <p className="about-layers__card-bold">
                This isn't occasional help. It's consistent, accountable, professional care that families can depend on.
              </p>
              <ul className="about-layers__features">
                {["Background-verified workforce", "Every visit logged + vitals tracked", "Prepaid, hour-based subscription", "Graded from companion to clinical nurse"].map((f, i) => (
                  <li key={i} className="about-layers__feature">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="about-layers__card about-layers__card--dark">
              <div className="about-layers__icon-wrap about-layers__icon-wrap--dark-orange">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="about-layers__layer-tag about-layers__layer-tag--white">Layer 2</div>
              <h3 className="about-layers__card-title about-layers__card-title--white">Saathi Network</h3>
              <p className="about-layers__card-desc about-layers__card-desc--white">
                Community volunteers who bring something equally important: connection, conversation, and the warmth of human presence.
              </p>
              <p className="about-layers__card-bold about-layers__card-bold--white">
                The part of care that has nothing to do with medicine - and everything to do with dignity.
              </p>
              <ul className="about-layers__features">
                {["Community volunteers, locally matched", "Companionship between care visits", "Chai, conversation, continuity", "Part of every MaiHoonNa plan"].map((f, i) => (
                  <li key={i} className="about-layers__feature about-layers__feature--white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="about-layers__footer-note">
            Together, these two layers are what मैं हूँ ना is - care that shows up, and presence that stays.
          </p>
        </div>
      </section>

      {/* 5. VISION & MISSION */}
      <section className="about-vision" aria-labelledby="vision-heading">
        <div className="about-vision__inner">
          <p className="about-vision__kicker">What drives us</p>
          <h2 id="vision-heading" className="about-vision__title">Vision &amp; Mission</h2>
        </div>
        <div className="about-vm-cards__inner">
          <div className="about-vm-cards__card">
            <div className="about-vm-cards__half">
              <div className="about-vm-badge about-vm-badge--vision">Vision</div>
              <h3 className="about-vm-cards__h3">A world where no elder lives without dignity, presence, or care</h3>
              <p className="about-vm-cards__p">
                We envision an India where geography is no longer a barrier to quality elder care - where every parent, regardless of their city, has access to trained professionals and a community that shows up for them.
              </p>
            </div>
            <div className="about-vm-cards__half about-vm-cards__half--border">
              <div className="about-vm-badge about-vm-badge--mission">Mission</div>
              <h3 className="about-vm-cards__h3">To make "मैं हूँ ना" a lived reality for every Indian family</h3>
              <p className="about-vm-cards__p">
                By combining verified professional care with community connection, we give families the peace of mind that someone trustworthy is always there - consistent, accountable, and genuinely present.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHERE WE ARE TODAY */}
      <section className="about-pilot" aria-labelledby="pilot-heading">
        <div className="about-pilot__inner">
          <div className="about-pilot__text">
            <div className="about-pilot__live-badge">
              <span className="about-pilot__dot" />
              PILOT LIVE NOW
            </div>
            <h2 id="pilot-heading" className="about-pilot__title">Where we are today</h2>
            <p className="about-pilot__desc">
              We're currently piloting in Gurugram - Sectors 53 to 57. Every Care Mitra, every process, every technology touchpoint is being stress-tested with real families before we scale.
            </p>
            <p className="about-pilot__bold">
              Every process, every training module, every line of code is being battle-tested so that when we expand, we expand right.
            </p>
            <div className="about-pilot__tags">
              <div className="about-pilot__tag">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>Gurugram Sectors 53 to 57</span>
              </div>
              <div className="about-pilot__tag">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                <span>Expanding 2026</span>
              </div>
            </div>
          </div>
          <div className="about-pilot__map-card">
            <p className="about-pilot__map-title">Coverage - Gurugram NCR</p>
            <div className="about-pilot__sectors">
              {[{ name: "Sector 53", pct: 82 }, { name: "Sector 54", pct: 90 }, { name: "Sector 55", pct: 75 }, { name: "Sector 56", pct: 65 }, { name: "Sector 57", pct: 45 }].map((s) => (
                <div key={s.name} className="about-pilot__sector-row">
                  <span className="about-pilot__dot-orange" />
                  <div className="about-pilot__bar-wrap">
                    <div className="about-pilot__bar-fill" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="about-pilot__sector-name">{s.name}</span>
                  <span className="about-pilot__dot-green" />
                </div>
              ))}
            </div>
            <div className="about-pilot__roadmap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FE6700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>Delhi, Noida, Mumbai - on the roadmap for Dec 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. OUR VALUES */}
      <section className="about-values" aria-labelledby="values-heading">
        <div className="about-values__inner">
          <div className="about-values__header">
            <p className="about-values__kicker">What we stand for</p>
            <h2 id="values-heading" className="about-values__title">Our values</h2>
          </div>
          <div className="about-values__grid">
            {[
              { bg: "#FFF1E8", stroke: "#FE6700", title: "Accountability", desc: "Every visit logged. Every Care Mitra verified. No vague promises - just a clear record of what happened and when.", path: <polyline points="20 6 9 17 4 12" /> },
              { bg: "#FEF2F2", stroke: "#EF4444", title: "Presence, not just care", desc: "Emotional connection is not a nice-to-have. It's the thing that makes the difference between a service and a relationship.", path: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /> },
              { bg: "#F0F9FF", stroke: "#0EA5E9", title: "Built for India", desc: "Designed around how Indian families actually live - the joint family dynamics, the distance, the guilt, and the love.", path: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
              { bg: "#F5F3FF", stroke: "#7C3AED", title: "Small, then right", desc: "We'll do 100 families well before we rush to 10,000. Scale without quality isn't growth - it's a broken promise.", path: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /> },
            ].map((v, i) => (
              <div key={i} className="about-values__card">
                <div className="about-values__icon" style={{ background: v.bg }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={v.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{v.path}</svg>
                </div>
                <h3 className="about-values__card-title">{v.title}</h3>
                <p className="about-values__card-desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. CTA */}
      <section className="about-cta" aria-labelledby="about-cta-heading">
        <div className="about-cta__card">
          <div className="about-cta__glow" aria-hidden="true" />
          <div className="about-cta__content">
            <span className="about-cta__emoji" aria-hidden="true">🙏</span>
            <h2 id="about-cta-heading" className="about-cta__heading">
              If your parents are in our pilot area<br />
              or you'd simply like to know when -<br />
              <em>we'd love to hear from you.</em>
            </h2>
            <p className="about-cta__sub">
              No sales call. No commitment. Just a conversation about what your family needs.
            </p>
            {submitted ? (
              <div className="about-cta__success">✅ Thank you! We'll be in touch soon.</div>
            ) : (
              <form className="about-cta__form" onSubmit={handleGetInTouch}>
                <input type="email" id="about-email" className="about-cta__input" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Your email address" />
                <button type="submit" className="about-cta__btn">
                  Get in touch
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              </form>
            )}
            <p className="about-cta__phone">Or call us directly · <a href="tel:+918527070049">+91 85270 70049</a></p>
          </div>
        </div>
      </section>

    </main>
  );
};

export default AboutPage;
