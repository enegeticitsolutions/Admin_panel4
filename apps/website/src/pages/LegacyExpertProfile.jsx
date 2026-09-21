import React, { useState, useEffect } from "react";
import { fetchLegacyCircleProfileById } from "../services/api";

const LegacyExpertProfile = ({ id, onClose }) => {
  const [expert, setExpert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchLegacyCircleProfileById(id)
      .then((data) => {
        if (isMounted) {
          setExpert(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch legacy circle profile:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleOpenConsultation = () => {
    if (!expert) return;
    const email = expert.email || `${expert.name.toLowerCase().replace(/[^a-z0-9]/g, ".") || "contact"}@maihoonna.com`;
    const subject = encodeURIComponent(`Connection Request: Consultation with ${expert.name}`);
    const body = encodeURIComponent(
      `Hello ${expert.name},\n\nI came across your profile on MaiHoonNa's Legacy Circle and would like to request a connection / consultation regarding your expertise in ${(expert.tags && expert.tags[0]) || expert.domain || "your field"}.\n\nLooking forward to hearing from you.\n\nBest regards,`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="legacy-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="legacy-modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
          <h2>Profile Not Found</h2>
          <p style={{ marginTop: '8px' }}>The profile you are looking for does not exist or has been deactivated.</p>
          <button className="legacy-btn legacy-btn--primary" style={{ marginTop: '20px' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="legacy-modal-overlay" 
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflowY: 'auto' }}
      onClick={(e) => {
        if (e.target.classList.contains('legacy-modal-overlay')) {
          onClose();
        }
      }}
    >
      <div className="legacy-expert-detail-card" style={{ 
        background: 'white', 
        borderRadius: '24px', 
        padding: '32px', 
        maxWidth: '520px', 
        width: '100%',
        boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
        position: 'relative',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: '#F3F4F6', borderRadius: '50%', width: '32px', height: '32px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', zIndex: 10 }}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        
        <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '24px' }}>
            {expert.profilePhoto ? (
              <img
                src={expert.profilePhoto}
                alt={expert.name}
                style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
            ) : (
              <div style={{ 
                width: '96px', 
                height: '96px', 
                borderRadius: '50%', 
                background: expert.avatarColor || '#fe6700',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                {expert.name.charAt(0)}
              </div>
            )}
            
            <div style={{ flex: 1 }}>
              <div className="legacy-badge" style={{ marginBottom: '12px', display: 'inline-flex', background: 'rgba(254, 103, 0, 0.08)', color: '#FE6700', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>VERIFIED EXPERT</span>
              </div>
              
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px', lineHeight: '1.2' }}>{expert.name}</h1>
              <p style={{ fontSize: '15px', color: '#4B5563', marginBottom: '16px', lineHeight: '1.4' }}>{expert.role} {expert.company && `at ${expert.company}`}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#6B7280', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {expert.location}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {expert.experience} Years Experience
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {(expert.tags || []).map((tag, i) => (
              <span key={i} style={{ 
                background: '#F3F4F6', 
                color: '#374151', 
                padding: '6px 14px', 
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500'
              }}>
                {tag}
              </span>
            ))}
          </div>

          {expert.bio && (
            <div style={{ marginBottom: '28px', padding: '20px', background: '#FAFAFA', borderRadius: '16px', border: '1px solid #F3F4F6' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>About</h3>
              <p style={{ color: '#4B5563', lineHeight: '1.6', fontSize: '14px' }}>{expert.bio}</p>
            </div>
          )}

          <button 
            className="legacy-btn legacy-btn--primary" 
            onClick={handleOpenConsultation}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px', borderRadius: '14px', boxShadow: '0 8px 16px rgba(254, 103, 0, 0.2)' }}
          >
            <span>Request Connection</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegacyExpertProfile;
