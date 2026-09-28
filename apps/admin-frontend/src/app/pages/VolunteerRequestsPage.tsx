import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataCard } from '../components/common/DataCard';
import { volunteerApi } from '../../services/api';
import type { Volunteer } from '../../types';
import { FileText, Check, Ban, X, MapPin, ExternalLink, Clock, Search, Sparkles } from 'lucide-react';

function getVolunteerLocation(v: Volunteer) {
  const specificArea = [v.flatPlot, v.streetArea, v.landmark].filter(Boolean).join(', ');
  const cityState = [v.city, v.state].filter(Boolean).join(', ');
  const pincode = v.pincode ? `PIN: ${v.pincode}` : '';

  const line1 = specificArea || v.address || '';
  const line2 = [cityState, pincode].filter(Boolean).join(' - ');

  const searchParts = [v.flatPlot, v.streetArea, v.landmark, v.address, v.city, v.state, v.pincode].filter(Boolean);
  const fullSearch = searchParts.join(', ');

  let mapUrl = '';
  if (v.latitude != null && v.longitude != null) {
    mapUrl = `https://www.google.com/maps?q=${v.latitude},${v.longitude}`;
  } else if (fullSearch) {
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSearch)}`;
  }

  const hasLocation = Boolean(line1 || line2 || mapUrl);
  return {
    line1,
    line2,
    mapUrl,
    hasLocation,
    hasCoords: Boolean(v.latitude != null && v.longitude != null),
  };
}

export default function VolunteerRequestsPage() {
  const [requests, setRequests] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection modal
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await volunteerApi.getAll('pending');
      setRequests(pending);
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteer applications.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((v) => {
      const name = (v.name || '').toLowerCase();
      const phone = (v.phone || '').toLowerCase();
      const email = (v.email || '').toLowerCase();
      const city = (v.city || '').toLowerCase();
      const state = (v.state || '').toLowerCase();
      const area = (v.streetArea || '').toLowerCase();
      const pincode = (v.pincode || '').toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        area.includes(q) ||
        pincode.includes(q)
      );
    });
  }, [requests, searchQuery]);

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to verify and approve this volunteer profile?')) return;
    try {
      await volunteerApi.verify(id);
      alert('Volunteer verified successfully.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to verify volunteer.');
    }
  };

  const handleOpenReject = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedVolunteer || !rejectionReason.trim()) return;
    try {
      await volunteerApi.reject(selectedVolunteer.id, rejectionReason);
      alert('Application rejected successfully.');
      setShowRejectModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject application.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saathi Volunteer Applications"
        description="Review pending volunteer onboarding requests, verify applicant location, check interests, and approve accounts."
      />

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, email, area, city, pincode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-medium self-center">
          Showing <span className="font-bold text-foreground">{filteredRequests.length}</span> of {requests.length} applications
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8">
          <p className="text-muted-foreground text-sm">Loading applications...</p>
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((v) => {
            const loc = getVolunteerLocation(v);
            return (
              <DataCard key={v.id} title={v.name} description={v.phone}>
                <div className="space-y-4">
                  {v.email && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <span className="font-medium text-foreground">{v.email}</span>
                    </div>
                  )}

                  {v.age && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Age / Gender:</span>{' '}
                      <span className="font-medium text-foreground">{v.age} yrs / {v.gender || 'Not specified'}</span>
                    </div>
                  )}

                  {/* Location where the volunteer filled the form */}
                  <div className="p-3 bg-secondary/80 border border-border/70 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        Application Location
                      </p>
                      {loc.mapUrl && (
                        <a
                          href={loc.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary hover:text-primary/80 font-bold inline-flex items-center gap-1 hover:underline transition-colors shrink-0"
                          title="Open in Google Maps"
                        >
                          <span>View Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {loc.hasLocation ? (
                      <div className="space-y-0.5">
                        {loc.line1 && (
                          <p className="text-xs font-semibold text-foreground">
                            {loc.line1}
                          </p>
                        )}
                        {loc.line2 && (
                          <p className="text-xs text-muted-foreground font-medium">
                            {loc.line2}
                          </p>
                        )}
                        {loc.hasCoords && (
                          <p className="text-[10px] text-emerald-600 font-mono font-medium pt-0.5 flex items-center gap-1">
                            <span>📍 GPS: {v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No location details provided in form
                      </p>
                    )}
                  </div>

                  {v.createdAt && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span>Applied: {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}

                  {v.previousExperience && (
                    <div className="p-3 bg-secondary rounded-lg space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Past Volunteer Experience
                      </p>
                      <p className="text-xs line-clamp-3 text-muted-foreground">{v.previousExperience}</p>
                    </div>
                  )}

                  {v.whyJoin && (
                    <div className="p-3 bg-secondary rounded-lg space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Why they want to join</p>
                      <p className="text-xs line-clamp-3 text-muted-foreground">{v.whyJoin}</p>
                    </div>
                  )}

                  {v.interests && v.interests.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {v.interests.map((interest) => (
                          <span key={interest} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-border">
                    <button
                      onClick={() => handleOpenReject(v)}
                      className="flex-1 text-xs py-2 bg-destructive/10 text-destructive hover:bg-destructive/15 font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(v.id)}
                      className="flex-1 text-xs py-2 bg-[#DFF4E6] text-success-foreground hover:bg-[#D4EEDC] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Verify
                    </button>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-white border border-border rounded-xl space-y-2">
          <p className="font-bold text-muted-foreground">
            {searchQuery ? 'No matching applications found' : 'All caught up!'}
          </p>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? `No pending applications match "${searchQuery}".` : 'No pending volunteer applications found.'}
          </p>
        </div>
      )}

      {/* Modal: Rejection Reason Dialog */}
      {showRejectModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-bold text-lg">Reject Onboarding Request</h3>
              <button onClick={() => setShowRejectModal(false)} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Please enter a reason for rejecting the application of <strong>{selectedVolunteer.name}</strong>:
              </p>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason (e.g. Invalid phone verification, insufficient companion parameters...)"
                className="w-full p-3 border border-border rounded-lg text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 bg-destructive text-destructive-foreground disabled:opacity-50 rounded-lg text-sm font-semibold"
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
