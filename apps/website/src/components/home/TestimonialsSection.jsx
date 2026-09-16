import React, { useState, useEffect } from "react";
import { API_BASE } from "../../services/api";

/**
 * TestimonialsSection Component - Interactive carousel of family testimonials
 */
const TestimonialsSection = () => {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch(`${API_BASE}/website/content/home`);
        const data = await res.json();

        if (data.success && data.data.content?.testimonials) {
          setTestimonials(data.data.content.testimonials);
        }
      } catch (err) {
        console.error("Failed to fetch testimonials", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  useEffect(() => {
    if (isHovered || testimonials.length <= 1) return;
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered, testimonials.length]);

  if (loading || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="testimonial">
      <div className="section-heading section-heading--dark">
        <span>TESTIMONIALS</span>
        <h2>Families Who Trust Us</h2>
      </div>

      <div className="testimonial-card-container">
        <div 
          className="testimonial-card"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left Side: Portrait */}
          <div
            className="testimonial-portrait"
            style={{ backgroundImage: `url(${testimonials[activeTestimonial].image})` }}
          >
            <div className="testimonial-tag">
              <span className="status-dot"></span>
              <span>{testimonials[activeTestimonial].tag}</span>
            </div>
          </div>

          {/* Right Side: Quote Details */}
          <div className="testimonial-content">
            <div className="quote-mark">&ldquo;</div>

            {/* 5 star rating */}
            <div className="stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#FE6700" stroke="#FE6700" strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>

            <blockquote className="quote-body">
              &ldquo;{testimonials[activeTestimonial].quote}&rdquo;
            </blockquote>

            {/* Author Information */}
            <div className="testimonial-author">
              <div
                className="author-avatar"
                style={{ backgroundImage: `url(${testimonials[activeTestimonial].image})` }}
              />
              <div className="author-info">
                <h3>{testimonials[activeTestimonial].name}</h3>
                <p>{testimonials[activeTestimonial].role}</p>
                <span className="location">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#999999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {testimonials[activeTestimonial].location}
                </span>
              </div>
            </div>

            {/* Controls (Arrows and dots) */}
            <div className="testimonial-controls">
              <div className="dots-container">
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    className={`dot ${idx === activeTestimonial ? 'active' : ''}`}
                    onClick={() => setActiveTestimonial(idx)}
                    aria-label={`Go to testimonial ${idx + 1}`}
                  />
                ))}
              </div>
              <div className="arrows-container">
                <button
                  className="arrow-btn"
                  onClick={() => setActiveTestimonial((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1))}
                  aria-label="Previous testimonial"
                >
                  &larr;
                </button>
                <button
                  className="arrow-btn"
                  onClick={() => setActiveTestimonial((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1))}
                  aria-label="Next testimonial"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar Indicator */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${((activeTestimonial + 1) / testimonials.length) * 100}%` }}
          />
        </div>

        {/* Avatar Selector Switcher */}
        <div className="avatar-switcher">
          {testimonials.map((t, idx) => (
            <button
              key={idx}
              className={`switcher-btn ${idx === activeTestimonial ? 'active' : ''}`}
              onClick={() => setActiveTestimonial(idx)}
              style={{ backgroundImage: `url(${t.image})` }}
              aria-label={`Switch to ${t.name}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
