import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, User, UserCheck, AlertCircle, RefreshCw, Trash2, Edit3, ChevronDown, X, Clock, Loader2, MapPin, ShieldCheck, ShieldAlert, AlertTriangle, Eye, Lock } from 'lucide-react';
import { visitApi, fieldManagerApi } from '../../../services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import VisitDetailsModal from './VisitDetailsModal';

interface ScheduledVisitsPanelProps {
  /** Optional: pre-select a FM by their userId when rendered inside an FM-scoped view */
  defaultFmUserId?: string | null;
  /** If true, hide the FM selector (e.g. FieldManagerView already has context) */
  hideFmSelector?: boolean;
}

interface FMOption {
  id: string;       // FM profile ID
  userId: string;   // User ID used for filtering
  name: string;
}

interface CCOption {
  id: string;
  name: string;
}

// ── In-app confirmation modal ───────────────────────────────────────────────
interface ConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
}

export default function ScheduledVisitsPanel({ defaultFmUserId, hideFmSelector }: ScheduledVisitsPanelProps) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [viewingVisitId, setViewingVisitId] = useState<string | null>(null);

  // ── Confirmation modal ─────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false, title: '', message: '', confirmLabel: 'Confirm', confirmColor: 'bg-[#1D4ED8]', onConfirm: () => {}
  });
  const openConfirm = (opts: Omit<ConfirmModalState, 'open'>) => setConfirmModal({ open: true, ...opts });
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, open: false }));

  // ── Complete Visit form modal ──────────────────────────────────────────────
  const [completeForm, setCompleteForm] = useState<{ open: boolean; visitId: string; durationMinutes: number; unitLabel: string; hoursConsumed: string; note: string; submitting: boolean }>({
    open: false, visitId: '', durationMinutes: 60, unitLabel: 'hour', hoursConsumed: '1', note: '', submitting: false
  });
  const openCompleteForm = (visit: any) => setCompleteForm({
    open: true,
    visitId: visit.id,
    durationMinutes: visit.durationMinutes || 60,
    unitLabel: visit.benefit?.unitLabel || 'unit',
    hoursConsumed: visit.durationMinutes ? String(visit.durationMinutes / 60) : '1',
    note: '',
    submitting: false,
  });
  const closeCompleteForm = () => setCompleteForm(prev => ({ ...prev, open: false }));
  const submitCompleteForm = async () => {
    setCompleteForm(prev => ({ ...prev, submitting: true }));
    try {
      await visitApi.updateStatus(completeForm.visitId, 'completed', completeForm.note, parseFloat(completeForm.hoursConsumed) || 1);
      toast.success('Visit marked as COMPLETED and benefit units deducted successfully');
      closeCompleteForm();
      fetchVisits();
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark visit as completed');
      setCompleteForm(prev => ({ ...prev, submitting: false }));
    }
  };

  // ── Filter state ────────────────────────────────────────────────────────────
  const [fieldManagers, setFieldManagers] = useState<FMOption[]>([]);
  const [fmLoading, setFmLoading] = useState(false);
  const [selectedFmUserId, setSelectedFmUserId] = useState<string>(defaultFmUserId || '');

  const [ccOptions, setCcOptions] = useState<CCOption[]>([]);
  const [ccLoading, setCcLoading] = useState(false);
  const [selectedCcId, setSelectedCcId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [visitCodeFilter, setVisitCodeFilter] = useState<string>(''); // human-readable code filter
  const [showChangeRequestedOnly, setShowChangeRequestedOnly] = useState<boolean>(false);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editingVisit, setEditingVisit] = useState<any | null>(null);
  const [editTime, setEditTime] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(60);
  const [editCcId, setEditCcId] = useState<string>('');
  const [editCcOptions, setEditCcOptions] = useState<CCOption[]>([]);
  const [editCcLoading, setEditCcLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [editCcAvailabilities, setEditCcAvailabilities] = useState<Record<string, { isAvailable: boolean; reason: string | null }>>({});
  const [editCcChecking, setEditCcChecking] = useState<boolean>(false);

  const checkEditCcAvailabilities = async (time: string, duration: number, options: CCOption[]) => {
    if (!time || !duration || options.length === 0) return;
    setEditCcChecking(true);
    try {
      const scheduledTime = new Date(time).toISOString();
      const results = await Promise.all(
        options.map(async (cc) => {
          try {
            // Exclude current editing visit so we don't conflict with ourselves
            const res = await visitApi.checkAvailability(cc.id, scheduledTime, duration);
            return { ccId: cc.id, isAvailable: res.isAvailable, reason: res.reason };
          } catch (e) {
            return { ccId: cc.id, isAvailable: true, reason: null };
          }
        })
      );

      const mapping: Record<string, { isAvailable: boolean; reason: string | null }> = {};
      results.forEach(r => {
        mapping[r.ccId] = { isAvailable: r.isAvailable, reason: r.reason };
      });
      setEditCcAvailabilities(mapping);
    } catch (err) {
      console.error('Failed to check edit CC availabilities', err);
    } finally {
      setEditCcChecking(false);
    }
  };

  useEffect(() => {
    if (editingVisit) {
      checkEditCcAvailabilities(editTime, editDuration, editCcOptions);
    } else {
      setEditCcAvailabilities({});
    }
  }, [editTime, editDuration, editCcOptions, editingVisit]);

  const sortedEditCcOptions = React.useMemo(() => {
    if (!editingVisit) return editCcOptions;
    return [...editCcOptions].sort((a, b) => {
      const aIsPrimary = a.id === editingVisit.beneficiary?.primaryCcId;
      const bIsPrimary = b.id === editingVisit.beneficiary?.primaryCcId;
      const aIsSecondary = a.id === editingVisit.beneficiary?.secondaryCcId;
      const bIsSecondary = b.id === editingVisit.beneficiary?.secondaryCcId;

      // Primary first
      if (aIsPrimary && !bIsPrimary) return -1;
      if (bIsPrimary && !aIsPrimary) return 1;

      // Secondary second
      if (aIsSecondary && !bIsSecondary) return -1;
      if (bIsSecondary && !aIsSecondary) return 1;

      // Available first
      const aAvail = editCcAvailabilities[a.id]?.isAvailable !== false;
      const bAvail = editCcAvailabilities[b.id]?.isAvailable !== false;
      if (aAvail && !bAvail) return -1;
      if (!aAvail && bAvail) return 1;

      return 0;
    });
  }, [editCcOptions, editingVisit, editCcAvailabilities]);

  // ── Load all field managers for the dropdown ─────────────────────────────────
  useEffect(() => {
    if (hideFmSelector) return;
    setFmLoading(true);
    fieldManagerApi.getAll()
      .then((raw: any[]) => {
        setFieldManagers(raw.map((fm: any) => ({ id: fm.id, userId: fm.userId, name: fm.name })));
      })
      .catch(() => toast.error('Failed to load field managers'))
      .finally(() => setFmLoading(false));
  }, [hideFmSelector]);

  // ── When FM changes: load their team CCs ────────────────────────────────────
  useEffect(() => {
    if (!selectedFmUserId) {
      setCcOptions([]);
      setSelectedCcId('');
      return;
    }
    // Find the FM profile ID from userId (needed for getMyTeam)
    const fm = fieldManagers.find(f => f.userId === selectedFmUserId);
    if (!fm && !hideFmSelector) return;

    setCcLoading(true);
    setSelectedCcId('');
    const fmProfileId = fm?.id;
    fieldManagerApi.getMyTeam(fmProfileId)
      .then((team: any[]) => {
        setCcOptions(team.map((cc: any) => ({ id: cc.id, name: cc.name })));
      })
      .catch(() => toast.error('Failed to load team CCs'))
      .finally(() => setCcLoading(false));
  }, [selectedFmUserId, fieldManagers, hideFmSelector]);

  // ── Fetch visits based on filters ───────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedFmUserId) params.fmUserId = selectedFmUserId;
      if (selectedCcId) params.careCompanionId = selectedCcId;
      if (selectedDate) params.date = selectedDate;
      if (visitCodeFilter.trim()) params.visitCode = visitCodeFilter.trim().toUpperCase();
      if (showChangeRequestedOnly) params.hasChangeRequest = true;
      const response = await visitApi.getAll(params);
      setVisits(Array.isArray(response) ? response : []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch scheduled visits');
    } finally {
      setLoading(false);
    }
  }, [selectedFmUserId, selectedCcId, selectedDate, visitCodeFilter, showChangeRequestedOnly]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // ── Cancel a visit ──────────────────────────────────────────────────────────
  const handleCancel = (visitId: string) => {
    openConfirm({
      title: 'Cancel Visit',
      message: 'Are you sure you want to cancel this visit? This action cannot be undone.',
      confirmLabel: 'Yes, Cancel Visit',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        closeConfirm();
        setCancellingId(visitId);
        try {
          await visitApi.cancel(visitId);
          toast.success('Visit cancelled successfully');
          setVisits(prev => prev.filter(v => v.id !== visitId));
        } catch (e: any) {
          toast.error(e.message || 'Failed to cancel visit');
        } finally {
          setCancellingId(null);
        }
      }
    });
  };

  // ── Update visit status (completed / missed / cancelled) ─────────────────────
  const handleUpdateStatus = (visitId: string, status: 'completed' | 'missed' | 'cancelled', visit?: any) => {
    // For COMPLETED, open the detailed form instead of confirm popup
    if (status === 'completed' && visit) {
      openCompleteForm(visit);
      return;
    }
    const configs = {
      missed: {
        title: '✕ Mark as Missed',
        message: 'Are you sure you want to mark this visit as MISSED? No package units will be deducted.',
        confirmLabel: 'Yes, Mark Missed',
        confirmColor: 'bg-rose-600 hover:bg-rose-700',
      },
      cancelled: {
        title: 'Cancel Visit',
        message: 'Are you sure you want to cancel this visit?',
        confirmLabel: 'Yes, Cancel',
        confirmColor: 'bg-red-600 hover:bg-red-700',
      },
    };
    const cfg = (configs as any)[status];
    if (!cfg) return;
    openConfirm({
      ...cfg,
      onConfirm: async () => {
        closeConfirm();
        try {
          await visitApi.updateStatus(visitId, status);
          toast.success(`Visit marked as ${status.toUpperCase()} successfully`);
          fetchVisits();
        } catch (e: any) {
          toast.error(e.message || `Failed to update visit status to ${status}`);
        }
      }
    });
  };

  // ── Open Edit modal ─────────────────────────────────────────────────────────
  const handleOpenEdit = async (visit: any) => {
    setEditingVisit(visit);
    
    // Format date correctly for datetime-local input (YYYY-MM-DDTHH:MM)
    const d = new Date(visit.scheduledTime);
    const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    
    setEditTime(localISOTime);
    setEditDuration(visit.durationMinutes || 60);
    setEditCcId(visit.careCompanionId);
    
    // Fetch care companions for this specific visit's field manager team
    setEditCcLoading(true);
    setEditCcOptions([]);
    try {
      const fmProfileId = visit.careCompanion?.team?.fieldManager?.id;
      if (fmProfileId) {
        const team = await fieldManagerApi.getMyTeam(fmProfileId);
        setEditCcOptions(team.map((cc: any) => ({ id: cc.id, name: cc.name })));
      } else {
        // Fallback: use general options or existing ones
        setEditCcOptions(ccOptions);
      }
    } catch (err) {
      toast.error('Failed to load care companion options for editing');
    } finally {
      setEditCcLoading(false);
    }
  };

  // ── Save Edit Changes ───────────────────────────────────────────────────────
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit) return;
    if (!editCcId || !editTime || !editDuration) {
      toast.error('Please fill in all required fields');
      return;
    }

    setEditSaving(true);
    
    if (new Date(editTime).getTime() < Date.now() - 60000) {
      toast.error('Cannot reschedule to a past date/time');
      setEditSaving(false);
      return;
    }

    try {
      await visitApi.update(editingVisit.id, {
        careCompanionId: editCcId,
        scheduledTime: new Date(editTime).toISOString(),
        durationMinutes: editDuration,
      });
      toast.success('Visit rescheduled successfully');
      setEditingVisit(null);
      fetchVisits(); // refresh lists
    } catch (err: any) {
      toast.error(err.message || 'Failed to reschedule visit');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[24px] shadow-sm border border-[#E7DED6] overflow-hidden flex flex-col mt-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="p-6 border-b border-[#E7DED6] bg-[#FAF8F5]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8F0FF] rounded-xl flex items-center justify-center">
              <CalendarClock size={20} className="text-[#1D4ED8]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-800">Scheduled Visits</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Upcoming Appointments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-gray-400 mr-1">
              {visits.length} Visit{visits.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={fetchVisits}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-gray-400 hover:text-[#1D4ED8] bg-white border border-[#E7DED6] hover:border-[#1D4ED8] rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter Row ─────────────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {/* Field Manager filter */}
          {!hideFmSelector && (
            <div className="flex-1 relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                Filter by Field Manager
              </label>
              <div className="relative">
                <select
                  value={selectedFmUserId}
                  onChange={e => { setSelectedFmUserId(e.target.value); setSelectedCcId(''); }}
                  disabled={fmLoading}
                  className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-[#E7DED6] bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value="">— All Field Managers —</option>
                  {fieldManagers.map(fm => (
                    <option key={fm.id} value={fm.userId}>{fm.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Care Companion filter */}
          <div className="flex-1 relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Filter by Care Companion
            </label>
            <div className="relative">
              <select
                value={selectedCcId}
                onChange={e => setSelectedCcId(e.target.value)}
                disabled={ccLoading || (!selectedFmUserId && !hideFmSelector)}
                className="w-full appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-[#E7DED6] bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {(!selectedFmUserId && !hideFmSelector) ? '— Select FM first —' : '— All Care Companions —'}
                </option>
                {ccOptions.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Visit Code search filter */}
          <div className="flex-1 relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Search by Visit Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={visitCodeFilter}
                onChange={e => setVisitCodeFilter(e.target.value.toUpperCase())}
                placeholder="e.g. VK7XM4RP"
                maxLength={9}
                className={`w-full pl-4 pr-8 py-2.5 rounded-xl border font-mono font-bold text-sm tracking-wider transition-colors focus:outline-none ${
                  visitCodeFilter
                    ? 'border-[#FF7A00] bg-[#FFF5EE] text-[#FF7A00]'
                    : 'border-[#E7DED6] bg-white text-gray-700 focus:border-[#FF7A00]'
                }`}
              />
              {visitCodeFilter && (
                <button
                  onClick={() => setVisitCodeFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date filter */}
          <div className="flex-[1.5] relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
              <span className="flex items-center gap-1.5"><CalendarClock size={12} className="text-[#1D4ED8]" /> Filter by Date</span>
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate('')}
                  className="text-[#FF7A00] hover:text-[#E06B00] text-[9px] font-black uppercase tracking-tighter"
                >
                  Clear filter
                </button>
              )}
            </label>
            <div className="flex flex-col gap-2">
              <div className="relative group">
                <input
                  type="date"
                  value={selectedDate === 'next_7' ? '' : selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all cursor-pointer text-sm font-semibold focus:outline-none ${
                    selectedDate && selectedDate !== 'next_7'
                      ? 'border-[#1D4ED8] bg-[#E8F0FF]/30 text-[#1D4ED8]'
                      : 'border-[#E7DED6] bg-white text-gray-700 focus:border-[#1D4ED8]'
                  }`}
                />
                <Clock size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                  selectedDate && selectedDate !== 'next_7' ? 'text-[#1D4ED8]' : 'text-gray-400'
                }`} />
              </div>
              
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'Today', value: format(new Date(), 'yyyy-MM-dd') },
                  { label: 'Tomorrow', value: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd') },
                  { label: 'Next 7 Days', value: 'next_7' },
                ].map((pill) => (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => setSelectedDate(pill.value)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight transition-all border shadow-sm ${
                      selectedDate === pill.value
                        ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] scale-105'
                        : 'bg-white text-gray-400 border-[#E7DED6] hover:border-gray-300 hover:text-gray-600'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Change Request Filter Toggle ─────────────────────────────────────────────────────────── */}
        <div className="mt-4 pt-3 border-t border-[#E7DED6]">
          <label className="flex items-center gap-2 cursor-pointer w-max group">
            <input 
              type="checkbox"
              checked={showChangeRequestedOnly}
              onChange={(e) => setShowChangeRequestedOnly(e.target.checked)}
              className="w-4 h-4 text-[#FF7A00] rounded border-gray-300 focus:ring-[#FF7A00]"
            />
            <span className={`text-xs font-bold transition-colors ${showChangeRequestedOnly ? 'text-[#FF7A00]' : 'text-gray-600 group-hover:text-gray-800'}`}>
              Show visits with change requests only
            </span>
          </label>
        </div>
      </div>

      {/* ── Visit Cards ────────────────────────────────────────────────────── */}
      <div className="p-6">
        {loading && visits.length === 0 ? (
          <div className="flex justify-center items-center py-10">
            <RefreshCw size={24} className="animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm font-bold text-gray-600">{error}</p>
            <button onClick={fetchVisits} className="mt-3 text-sm text-[#1D4ED8] font-bold">Try Again</button>
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-[#E7DED6] rounded-[16px]">
            <CalendarClock size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-bold text-gray-600">No visits found.</p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedFmUserId || hideFmSelector ? 'Try changing your filters or schedule a visit from the Beneficiaries tab.' : 'Select a Field Manager to see their scheduled visits.'}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {visits.map((visit) => {
              const visitDate = new Date(visit.scheduledTime);
              return (
                <div key={visit.id} className="border border-[#E7DED6] rounded-[16px] p-4 bg-white hover:border-[#1D4ED8] transition-colors shadow-sm hover:shadow-md flex flex-col justify-between">
                  <div>
                    {/* Date + Duration */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-[#E8F0FF] text-[#1D4ED8] px-3 py-1.5 rounded-lg">
                        <p className="text-[10px] font-black uppercase tracking-widest">{format(visitDate, 'MMM d, yyyy')}</p>
                        <p className="text-sm font-bold mt-0.5">{format(visitDate, 'h:mm a')}</p>
                      </div>
                      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500">
                        {visit.durationMinutes || '—'} Min
                      </span>
                    </div>

                    {/* Assigned Benefit Badge */}
                    {visit.benefit && (
                      <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#FFF5EE] border border-[#FFE0C7] flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs">🎯</span>
                          <span className="text-xs font-bold text-gray-800 truncate" title={visit.benefit.name}>
                            {visit.benefit.name}
                          </span>
                        </div>
                        {visit.status === 'scheduled' ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 shrink-0 flex items-center gap-0.5">
                            <Lock size={9} /> Locked
                          </span>
                        ) : visit.status === 'completed' ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                            Deducted
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Beneficiary + CC */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FFEAE8] flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-[#FF4B4B]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Beneficiary</p>
                          <p className="text-sm font-bold text-gray-800 truncate">{visit.beneficiary?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F0FF] flex items-center justify-center flex-shrink-0">
                          <UserCheck size={14} className="text-[#1D4ED8]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Care Companion</p>
                          {visit.is3rdParty || !visit.careCompanion ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              🏢 3rd Party Service
                            </span>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-gray-800 truncate">{visit.careCompanion.name}</p>
                              {visit.careCompanion.team?.fieldManager && (
                                <p className="text-[9px] text-gray-400 font-bold">FM: {visit.careCompanion.team.fieldManager.name}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons — only for 3rd-party visits */}
                  {visit.status === 'scheduled' && (visit.is3rdParty || !visit.careCompanion) && (
                    <div className="mt-3 pt-3 border-t border-[#F4EAE3] flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => handleUpdateStatus(visit.id, 'completed', visit)}
                        className="flex-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <ShieldCheck size={12} /> Complete
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(visit.id, 'missed')}
                        className="flex-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <ShieldAlert size={12} /> Missed
                      </button>
                    </div>
                  )}

                  {/* Footer: status + actions */}
                  <div className="mt-3 pt-3 border-t border-[#E7DED6] flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                      visit.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                      visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                      visit.status === 'cancelled' ? 'bg-red-100 text-red-400' :
                      visit.status === 'missed' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {visit.status}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Visit Code Badge */}
                      <span
                        title={`Visit Code: ${visit.visitCode || 'N/A'}`}
                        className="font-mono text-[11px] font-black tracking-widest px-2 py-1 rounded-lg bg-[#FFF5EE] text-[#FF7A00] border border-[#FFE0C7] select-all cursor-text"
                      >
                        {visit.visitCode || `#${visit.encounterId?.substring(0, 8)}`}
                      </span>
                      
                      {/* View Details button */}
                      <button
                        onClick={() => setViewingVisitId(visit.id)}
                        title="View Details"
                        className="p-1.5 rounded-lg bg-[#E8F0FF] text-[#1D4ED8] hover:bg-[#D1E0FF] transition-colors"
                      >
                        <Eye size={12} />
                      </button>

                      {/* Edit & Cancel — only for 3rd-party visits (CC visits managed in CC app) */}
                      {visit.status === 'scheduled' && (visit.is3rdParty || !visit.careCompanion) && (
                        <>
                          {/* Edit button */}
                          <button
                            onClick={() => handleOpenEdit(visit)}
                            title="Edit Visit"
                            className="p-1.5 rounded-lg bg-[#FFEAD8] text-[#FF7A00] hover:bg-[#FFD3B4] transition-colors"
                          >
                            <Edit3 size={12} />
                          </button>
                          
                          {/* Cancel button */}
                          <button
                            onClick={() => handleCancel(visit.id)}
                            disabled={cancellingId === visit.id}
                            title="Cancel Visit"
                            className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {cancellingId === visit.id
                              ? <RefreshCw size={12} className="animate-spin" />
                              : <Trash2 size={12} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Geo-fencing flag — shown for in_progress and completed visits */}
                  {(visit.status === 'in_progress' || visit.status === 'completed') && (() => {
                    const isGeoVerified = visit.isGeoVerified === true;
                    const isManual = !!(visit.manualCheckInReason);
                    const distMeters = visit.geoDistanceMeters;
                    const hasBeneficiaryGps = !!(visit.beneficiary?.latitude);

                    if (isGeoVerified) {
                      return (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                          <ShieldCheck size={13} className="text-green-600 flex-shrink-0" />
                          <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                            Location Verified {distMeters != null ? `· ${distMeters}m` : ''}
                          </span>
                        </div>
                      );
                    } else if (isManual) {
                      return (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200" title={visit.manualCheckInReason}>
                          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest truncate">
                            Manual Check-in — {visit.manualCheckInReason}
                          </span>
                        </div>
                      );
                    } else if (!hasBeneficiaryGps) {
                      return (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No Beneficiary GPS</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                          <ShieldAlert size={13} className="text-red-500 flex-shrink-0" />
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                            Out of Range {distMeters != null ? `· ${distMeters}m` : ''}
                          </span>
                        </div>
                      );
                    }
                  })()}

                  {/* Change Request Banner */}
                  {visit.changeRequestedAt && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-[#FFF5EE] border border-[#FF7A00]/20 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[#FF7A00]">
                        <AlertCircle size={13} className="flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                          Change Requested
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-xs font-bold text-gray-800">
                          Prefers: {visit.changePreferredDate} {visit.changePreferredTime}
                        </p>
                        {visit.changeReason && (
                          <p className="text-[10px] font-semibold text-gray-500 line-clamp-1 italic">
                            "{visit.changeReason}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editingVisit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#E7DED6] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E7DED6] bg-[#FAF8F5] flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-800">Reschedule Visit</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                  {editingVisit.visitCode
                    ? <span className="font-mono text-[#FF7A00]">{editingVisit.visitCode}</span>
                    : `Encounter ${editingVisit.encounterId}`
                  }
                </p>
              </div>
              <button
                onClick={() => setEditingVisit(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
              {/* Beneficiary read-only display */}
              <div className="bg-[#FFF5EE] border border-[#FFE4D3] rounded-2xl p-4 flex items-center gap-3">
                <User size={18} className="text-[#FF7A00]" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Beneficiary</p>
                  <p className="text-sm font-black text-gray-800">{editingVisit.beneficiary?.name || 'Unknown'}</p>
                </div>
              </div>

              {editingVisit.changeRequestedAt && (
                <div className="bg-[#FFF5EE] border border-[#FF7A00]/20 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[#FF7A00]">
                    <AlertCircle size={14} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Change Requested</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-bold">Preferred:</span> {editingVisit.changePreferredDate} {editingVisit.changePreferredTime}
                  </div>
                  {editingVisit.changeReason && (
                    <div className="text-sm text-gray-700 italic">
                      "{editingVisit.changeReason}"
                    </div>
                  )}
                </div>
              )}


              {/* Date & Time Input */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7DED6] bg-[#FFFAF7] text-sm font-semibold text-gray-700 focus:outline-none focus:border-[#FF7A00] transition-colors"
                />
              </div>

              {/* Duration selection */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Duration (Minutes)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEditDuration(mins)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        editDuration === mins
                          ? 'border-[#FF7A00] bg-[#FFF5EE] text-[#FF7A00]'
                          : 'border-[#E7DED6] bg-[#FFFAF7] text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Care Companion selection */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                  Assigned Care Companion
                </label>
                <div className="relative">
                  {editCcLoading ? (
                    <div className="flex items-center gap-2 py-3 px-4 border-2 border-[#E7DED6] rounded-xl text-gray-400 bg-gray-50">
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF7A00]" />
                      <span className="text-xs">Loading team companion pool...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        required
                        value={editCcId}
                        onChange={e => setEditCcId(e.target.value)}
                        className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border-2 border-[#E7DED6] bg-[#FFFAF7] text-sm font-bold text-gray-700 focus:outline-none focus:border-[#FF7A00] transition-colors cursor-pointer"
                      >
                        <option value="" disabled>— Select Care Companion —</option>
                        {sortedEditCcOptions.map(cc => {
                          const isPrimary = cc.id === editingVisit?.beneficiary?.primaryCcId;
                          const isSecondary = cc.id === editingVisit?.beneficiary?.secondaryCcId;
                          const relationshipLabel = isPrimary ? ' ★ Primary' : isSecondary ? ' ☆ Secondary' : '';

                          const avail = editCcAvailabilities[cc.id];
                          const statusLabel = editCcChecking ? ' (Checking...)' : avail && !avail.isAvailable ? ` (Conflict: ${avail.reason || 'Not Available'})` : '';

                          return (
                            <option 
                              key={cc.id} 
                              value={cc.id}
                              disabled={avail && !avail.isAvailable}
                            >
                              {cc.name}{relationshipLabel}{statusLabel}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-[#E7DED6]">
                <button
                  type="button"
                  onClick={() => setEditingVisit(null)}
                  disabled={editSaving}
                  className="flex-1 py-3 border-2 border-[#E7DED6] bg-white text-sm font-bold text-gray-600 rounded-xl hover:border-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-3 bg-[#FF7A00] text-white text-sm font-bold rounded-xl hover:bg-[#E06B00] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Details Modal ────────────────────────────────────────────── */}
      {viewingVisitId && (
        <VisitDetailsModal
          visitId={viewingVisitId}
          onClose={() => setViewingVisitId(null)}
        />
      )}

      {/* ── In-App Confirmation Modal ─────────────────────────────────────── */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeConfirm}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-[#E7DED6] animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button onClick={closeConfirm} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={16} />
            </button>

            {/* Icon */}
            <div className="flex flex-col items-center text-center gap-3 pt-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 ${
                confirmModal.confirmColor.includes('emerald') ? 'bg-emerald-50' :
                confirmModal.confirmColor.includes('rose') ? 'bg-rose-50' : 'bg-red-50'
              }`}>
                {confirmModal.confirmColor.includes('emerald')
                  ? <ShieldCheck size={22} className="text-emerald-600" />
                  : confirmModal.confirmColor.includes('rose')
                    ? <ShieldAlert size={22} className="text-rose-600" />
                    : <AlertTriangle size={22} className="text-red-600" />
                }
              </div>
              <h3 className="text-base font-black text-gray-800">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{confirmModal.message}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeConfirm}
                className="flex-1 py-2.5 rounded-xl border border-[#E7DED6] text-sm font-black text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-colors ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {completeForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeCompleteForm}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[#E7DED6]"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={closeCompleteForm} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ShieldCheck size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-800">Complete Visit</h3>
                <p className="text-xs text-gray-400 font-medium">Fill in the completion details before confirming</p>
              </div>
            </div>

            {/* Info banner */}
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-bold flex items-start gap-2">
              <ShieldCheck size={13} className="mt-0.5 flex-shrink-0" />
              <span>Marking this visit as <strong>COMPLETED</strong> will deduct the specified units from the beneficiary's package balance.</span>
            </div>

            {/* Hours / Units consumed */}
            <div className="mb-4">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                {completeForm.unitLabel === 'hour' ? 'Hours Consumed' : `Units Consumed (${completeForm.unitLabel})`}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  max={24}
                  value={completeForm.hoursConsumed}
                  onChange={e => setCompleteForm(prev => ({ ...prev, hoursConsumed: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-[#E7DED6] text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                />
                <span className="text-xs text-gray-400 font-bold capitalize">{completeForm.unitLabel}(s)</span>
              </div>
              <p className="mt-1 text-[10px] text-gray-400 font-medium">Scheduled duration: {completeForm.durationMinutes} min ({(completeForm.durationMinutes / 60).toFixed(2)} hrs)</p>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Completion Note (optional)</label>
              <textarea
                rows={3}
                placeholder="Add any notes about how the visit went..."
                value={completeForm.note}
                onChange={e => setCompleteForm(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E7DED6] text-sm font-medium placeholder-gray-300 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={closeCompleteForm}
                className="flex-1 py-2.5 rounded-xl border border-[#E7DED6] text-sm font-black text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitCompleteForm}
                disabled={completeForm.submitting || !completeForm.hoursConsumed || parseFloat(completeForm.hoursConsumed) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {completeForm.submitting ? (
                  <><Loader2 size={13} className="animate-spin" /> Saving...</>
                ) : (
                  <><ShieldCheck size={13} /> Confirm Complete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
