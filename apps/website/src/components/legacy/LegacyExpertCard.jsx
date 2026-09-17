import React from "react";

/**
 * Strips title prefixes & military/civil service suffixes,
 * then returns the first letters of first and last names in uppercase.
 */
const getInitials = (name = "") => {
  if (!name) return "KR";
  const cleaned = name
    .replace(/\b(Dr\.|Dr|IAS|IPS|IFS|Col\.|Col|Retd\.|Retd|\(Retd\.\)|\(Retd\)|\(IAS\)|\(IPS\)|\(IFS\)|Prof\.|Prof)\b/gi, "")
    .trim();

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * LegacyExpertCard Component
 * Pixel-perfect Figma design implementation.
 */
const LegacyExpertCard = ({
  expert,
  onConsultation,
  buttonText = "Request Connection",
  className = "",
}) => {
  if (!expert) return null;

  // Resilient fallback mapping for backend & database keys
  const {
    id,
    name = "Keshav Ram",
    role = expert.designation || "Corporate Lawyer & Arbitrator",
    location = expert.city || "Noida",
    availability = expert.availabilitySchedule || expert.statusText || "Weekends",
    experience = expert.yearsOfExperience || expert.exp || 40,
    tags = expert.expertiseTags || expert.skills || ["Law", "Arbitration", "Governance"],
    avatarColor = expert.avatarColor || "#0EA5E9",
    profilePhoto = expert.photoUrl || expert.imageUrl || null,
  } = expert;

  const initials = getInitials(name);

  return (
    <div className={`mhn-expert-card ${className}`.trim()} id={id ? `expert-${id}` : undefined}>
      
      {/* ── 1. Top Header Row (Avatar + Name & Role) ── */}
      <div className="mhn-expert-card__header">
        {profilePhoto ? (
          <img
            src={profilePhoto}
            alt={name}
            className="mhn-expert-card__avatar mhn-expert-card__avatar--img"
            loading="lazy"
          />
        ) : (
          <div
            className="mhn-expert-card__avatar"
            style={{ backgroundColor: avatarColor }}
            aria-label={`${name} initials`}
          >
            <span className="mhn-expert-card__avatar-text">{initials}</span>
          </div>
        )}

        <div className="mhn-expert-card__info">
          <h3 className="mhn-expert-card__name" title={name}>
            {name}
          </h3>
          <p className="mhn-expert-card__role" title={role}>
            {role}
          </p>
        </div>
      </div>

      {/* ── 2. Location & Availability Status Row ── */}
      <div className="mhn-expert-card__subrow">
        <div className="mhn-expert-card__location">
          <svg
            className="mhn-expert-card__location-icon"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999999"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{location}</span>
        </div>

        {availability && (
          <div className="mhn-expert-card__availability">
            <span className="mhn-expert-card__status-dot" />
            <span className="mhn-expert-card__status-text">{availability}</span>
          </div>
        )}
      </div>

      {/* ── 3. Category / Domain Tags ── */}
      {Array.isArray(tags) && tags.length > 0 && (
        <div className="mhn-expert-card__tags">
          {tags.map((tag, idx) => (
            <span key={idx} className="mhn-expert-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── 4. Stats Row (Experience) ── */}
      <div className="mhn-expert-card__stats">
        <div className="mhn-expert-card__stat-item">
          <div className="mhn-expert-card__stat-value">{experience}yrs</div>
          <div className="mhn-expert-card__stat-label">experience</div>
        </div>
      </div>

      {/* ── 5. Action Button (Request Connection) ── */}
      <div className="mhn-expert-card__action">
        <button
          type="button"
          className="mhn-expert-card__btn"
          onClick={() => onConsultation && onConsultation(expert)}
          aria-label={`${buttonText} with ${name}`}
        >
          <span>{buttonText}</span>
          <svg
            className="mhn-expert-card__btn-arrow"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

    </div>
  );
};

export default LegacyExpertCard;
