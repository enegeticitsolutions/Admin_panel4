import React, { useState } from "react";
import healthcareIcon from "../../assets/healthcare1.png";
import homePageCutOut from "../../assets/homePageCutOut.png";
import homeBgVideo from "../../assets/Home-Header-Background-Video.mp4";

/**
 * HeroSection Component
 */
const HeroSection = ({ openForm }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleJoinWaitlist = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    openForm(email);
  };
  return (
    <section className="hero" id="home">
      {/* Background video */}
      <video
        className="hero__bg-video"
        src={homeBgVideo}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="hero__inner">
        <div className="hero__copy">
          <div className="eyebrow">
            <img src={healthcareIcon} alt="MaiHoonNa - Connected Senior Care Ecosystem" loading="eager" fetchpriority="high" width="20" height="20" />
            India's first connected senior care ecosystem
          </div>
          <h1>
            <span>Growing older, without giving up on living.</span>
            Real conversations. Real activities. Real dignity, delivered with heart
          </h1>
          <p>
            Compassionate Care Mitras (nurses and care givers), a volunteer Saathi Network, real-time loved one visibility, and a community ecosystem
          </p>

          <div className="hero-form" aria-label="Join the waitlist" style={{ position: 'relative' }}>
            <input
              type="email"
              name="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinWaitlist();
              }}
            />
            <button onClick={handleJoinWaitlist}>Join Waitlist</button>
            {error && <div style={{ position: 'absolute', bottom: '-24px', left: '10px', color: '#ff4444', fontSize: '13px', fontWeight: '500' }}>{error}</div>}
          </div>

          <p className="hero-location">Launching in Gurugram Sectors 53 to 57</p>

        </div>
      </div>
      
      <div className="hero-cutout-wrapper">
        <img 
          src={homePageCutOut} 
          alt="MaiHoonNa Care Mitras assisting elder seniors in Gurugram with home companionship and healthcare" 
          className="hero-cutout"
          width="540"
          height="480"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        />
      </div>
    </section>
  );
};

export default HeroSection;
