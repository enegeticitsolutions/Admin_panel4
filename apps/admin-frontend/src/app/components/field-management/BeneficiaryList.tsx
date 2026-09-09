/**
 * BeneficiaryList
 * Searchable list of beneficiaries assigned to a Field Manager's zone.
 * Core feature: inline visit scheduling — select a CC from the FM's team, set date/time,
 * click a benefit card on the right panel, and save.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Users, Calendar, Clock,
  Loader2, AlertCircle, X, ChevronRight, Phone, MapPin, Sparkles, ChevronDown, RefreshCw
} from 'lucide-react';
import { visitApi, beneficiaryApi } from '../../../services/api';
import { toast } from 'sonner';
import { LoadingState, EmptyState, Avatar, SectionHeader } from './SharedComponents';
import { PackageUtilizationPanel } from '../PackageUtilizationPanel';
import type { CCMember } from './TeamPanel';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface BeneficiaryItem {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  city?: string;
  pincode?: string;
  primaryCcId?: string | null;
  primaryCcUserId?: string | null;
  primaryCcName?: string | null;
  secondaryCcId?: string | null;
  secondaryCcUserId?: string | null;
  secondaryCcName?: string | null;
  activePackage?: string | null;
  subscriberName?: string | null;
  hasUnreadRequests?: boolean;
  hasActivePackage?: boolean;
  isPackageExpired?: boolean;
  packageEndDate?: string | null;
  lastPackageName?: string | null;
}

interface Props {
  beneficiaries: BeneficiaryItem[];
  team: CCMember[];
  loading: boolean;
  submittingId: string | null;
  onScheduleVisit: (beneficiaryId: string, ccId: string, scheduledTime: string, durationMinutes: number, benefitId?: string) => Promise<void>;
  onRefresh?: () => void;
}

export default function BeneficiaryList({
  beneficiaries,
  team,
  loading,
  submittingId,
  onScheduleVisit,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'expired' | 'all'>('active');

  const [scheduleState, setScheduleState] = useState<Record<string, {
    ccId: string;
    date: string;
    time: string;
    duration: number;
    benefitId: string;
    benefitLabel: string;
    benefitUnit: string;
  }>>({});

  const [ccSlotAvailability, setCcSlotAvailability] = useState<Record<string, {
    checking: boolean;
    availabilities: Record<string, { isAvailable: boolean; reason: string | null }>;
  }>>({});

  const [serviceRequests, setServiceRequests] = useState<Record<string, any[]>>({});
  const [loadingRequests, setLoadingRequests] = useState<Record<string, boolean>>({});
  const [unreadOverrides, setUnreadOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUnreadOverrides({});
  }, [beneficiaries]);

  // Available CCs (for dropdown)
  const availableCCs = team;

  // Counts for tabs
  const activeCount = useMemo(
    () => beneficiaries.filter(b => (b.hasActivePackage !== undefined ? b.hasActivePackage : Boolean(b.activePackage))).length,
    [beneficiaries]
  );
  const expiredCount = useMemo(
    () => beneficiaries.filter(b => !(b.hasActivePackage !== undefined ? b.hasActivePackage : Boolean(b.activePackage))).length,
    [beneficiaries]
  );

  // Filtered & searched list
  const filtered = useMemo(() => {
    return beneficiaries.filter(b => {
      const hasActive = b.hasActivePackage !== undefined ? b.hasActivePackage : Boolean(b.activePackage);
      if (statusFilter === 'active' && !hasActive) return false;
      if (statusFilter === 'expired' && hasActive) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.activePackage?.toLowerCase().includes(q) ||
        b.lastPackageName?.toLowerCase().includes(q)
      );
    });
  }, [beneficiaries, search, statusFilter]);

  const checkAllCcAvailability = async (benId: string, state: any) => {
    if (!state.date || !state.time || !state.duration) return;

    setCcSlotAvailability(prev => ({
      ...prev,
      [benId]: {
        checking: true,
        availabilities: prev[benId]?.availabilities || {}
      }
    }));

    try {
      const scheduledTime = new Date(`${state.date}T${state.time}`).toISOString();
      const duration = state.duration;

      const results = await Promise.all(
        team.map(async (cc) => {
          try {
            const res = await visitApi.checkAvailability(cc.id, scheduledTime, duration);
            return { ccId: cc.id, isAvailable: res.isAvailable, reason: res.reason };
          } catch (e) {
            return { ccId: cc.id, isAvailable: cc.isAvailable, reason: 'Failed to check availability' };
          }
        })
      );

      const mapping: Record<string, { isAvailable: boolean; reason: string | null }> = {};
      results.forEach(r => {
        mapping[r.ccId] = { isAvailable: r.isAvailable, reason: r.reason };
      });

      setCcSlotAvailability(prev => ({
        ...prev,
        [benId]: {
          checking: false,
          availabilities: mapping
        }
      }));
    } catch (e) {
      console.error('All CC availability check failed', e);
      setCcSlotAvailability(prev => ({
        ...prev,
        [benId]: {
          checking: false,
          availabilities: prev[benId]?.availabilities || {}
        }
      }));
    }
  };

  const loadServiceRequestsForBeneficiary = async (benId: string) => {
    setLoadingRequests(prev => ({ ...prev, [benId]: true }));
    try {
      const data = await beneficiaryApi.getServiceRequests(benId);
      setServiceRequests(prev => ({ ...prev, [benId]: data }));
      setUnreadOverrides(prev => ({ ...prev, [benId]: data.some(r => !r.isRead) }));
    } catch (e) {
      console.error('Failed to load service requests', e);
    } finally {
      setLoadingRequests(prev => ({ ...prev, [benId]: false }));
    }
  };

  const handleMarkRequestRead = async (benId: string, requestId: string) => {
    try {
      await beneficiaryApi.markServiceRequestRead(requestId);
      toast.success('Service request marked as read.');
      const updatedList = (serviceRequests[benId] || []).map(r => 
        r.id === requestId ? { ...r, isRead: true } : r
      );
      setServiceRequests(prev => ({
        ...prev,
        [benId]: updatedList
      }));
      const hasAnyUnread = updatedList.some(r => !r.isRead);
      if (!hasAnyUnread) {
        setUnreadOverrides(prev => ({
          ...prev,
          [benId]: false
        }));
      }
    } catch (e: any) {
      toast.error('Failed to mark service request as read: ' + e.message);
    }
  };

  const handleToggleExpand = (benId: string) => {
    const isExpanded = expandedId === benId;
    if (isExpanded) {
      setExpandedId(null);
    } else {
      setExpandedId(benId);
      // Initialize schedule state if not exists
      let currentState = scheduleState[benId];
      if (!currentState) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = getLocalDateString(tomorrow);
        currentState = { ccId: '', date: dateStr, time: '10:00', duration: 60, benefitId: '', benefitLabel: '', benefitUnit: '' };
        setScheduleState(prev => ({
          ...prev,
          [benId]: currentState
        }));
      }
      checkAllCcAvailability(benId, currentState);
      loadServiceRequestsForBeneficiary(benId);
    }
  };

  const handleSchedule = async (beneficiaryId: string) => {
    const state = scheduleState[beneficiaryId];
    if (!state || !state.ccId || !state.date || !state.time) return;

    if (!state.benefitId) {
      toast.error('Please select a benefit type before scheduling a visit.');
      return;
    }

    const scheduledTimeObj = new Date(`${state.date}T${state.time}`);
    if (isNaN(scheduledTimeObj.getTime())) return;
    if (scheduledTimeObj.getTime() < Date.now() - 60000) {
      toast.error('Visit time cannot be in the past.');
      return;
    }

    // Construct ISO string for scheduledTime
    const scheduledTime = scheduledTimeObj.toISOString();

    await onScheduleVisit(
      beneficiaryId,
      state.ccId,
      scheduledTime,
      state.duration,
      state.benefitId || undefined,
    );

    // Clear selection on success
    setScheduleState(prev => {
      const next = { ...prev };
      delete next[beneficiaryId];
      return next;
    });
    setExpandedId(null);
  };

  const updateSchedule = (benId: string, key: string, value: any) => {
    setScheduleState(prev => {
      const newState = { ...prev, [benId]: { ...prev[benId], [key]: value } };
      if (key === 'date' || key === 'time' || key === 'duration') {
        checkAllCcAvailability(benId, newState[benId]);
      }
      checkConflict(benId, newState[benId]);
      return newState;
    });
  };

  /** Called when admin clicks a benefit card in the utilization panel */
  const handleBenefitSelect = (benId: string, benefitId: string, benefitName: string, unitLabel: string) => {
    setScheduleState(prev => {
      const current = prev[benId] || { ccId: '', date: '', time: '', duration: 60, benefitId: '', benefitLabel: '', benefitUnit: '' };
      // Toggle off if same benefit clicked again
      if (current.benefitId === benefitId) {
        return { ...prev, [benId]: { ...current, benefitId: '', benefitLabel: '', benefitUnit: '' } };
      }
      return { ...prev, [benId]: { ...current, benefitId, benefitLabel: benefitName, benefitUnit: unitLabel } };
    });
  };

  const [conflicts, setConflicts] = useState<Record<string, string | null>>({});

  const checkConflict = async (benId: string, state: any) => {
    if (!state.ccId || state.ccId === 'THIRD_PARTY' || !state.date || !state.time || !state.duration) {
      setConflicts(prev => ({ ...prev, [benId]: null }));
      return;
    }
    try {
      const scheduledTime = new Date(`${state.date}T${state.time}`).toISOString();
      const res = await visitApi.checkAvailability(state.ccId, scheduledTime, state.duration);
      setConflicts(prev => ({ ...prev, [benId]: res.isAvailable ? null : res.reason }));
    } catch (e) {
      console.error('Availability check failed', e);
    }
  };

  // ── Custom CC Dropdown component ───────────────────────────────────────────
  function CCTypeFlag({ ccType }: { ccType?: string }) {
    if (ccType === '3rd_party') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-purple-100 text-purple-700 border border-purple-200">
          🏢 External
        </span>
      );
    }
    const isNurse = ccType?.toLowerCase() === 'nurse';
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
          isNurse
            ? 'bg-purple-100 text-purple-700'
            : 'bg-teal-100 text-teal-700'
        }`}
      >
        {isNurse ? '🏥 Nurse' : '🤝 Care Asst'}
      </span>
    );
  }

  function CCDropdown({
    value, onChange, options, ben, availabilities, checking
  }: {
    value: string;
    onChange: (id: string) => void;
    options: typeof availableCCs;
    ben: BeneficiaryItem;
    availabilities?: Record<string, { isAvailable: boolean; reason: string | null }>;
    checking?: boolean;
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const THIRD_PARTY_OPTION = {
      id: 'THIRD_PARTY',
      name: '🏢 3rd Party / External Service',
      ccType: '3rd_party',
      isAvailable: true,
      primaryBeneficiariesCount: 0,
    };

    const selected = value === 'THIRD_PARTY' ? THIRD_PARTY_OPTION : options.find(cc => cc.id === value);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    const getAvailabilityStatus = (cc: { id: string; isAvailable?: boolean }) => {
      if (cc.id === 'THIRD_PARTY') {
        return { isAvailable: true, label: 'External', reason: null };
      }
      if (!cc.isAvailable) {
        return { isAvailable: false, label: 'Offline', reason: 'Care Companion is marked as unavailable' };
      }
      if (availabilities && availabilities[cc.id]) {
        const slot = availabilities[cc.id];
        if (!slot.isAvailable) {
          return { isAvailable: false, label: 'Conflict', reason: slot.reason || 'Time conflict' };
        }
      }
      return { isAvailable: true, label: 'Available', reason: null };
    };

    const sortedOptions = useMemo(() => {
      return [...options].sort((a, b) => {
        const aIsPrimary = a.id === ben.primaryCcId;
        const bIsPrimary = b.id === ben.primaryCcId;
        const aIsSecondary = a.id === ben.secondaryCcId;
        const bIsSecondary = b.id === ben.secondaryCcId;

        // Primary first
        if (aIsPrimary && !bIsPrimary) return -1;
        if (bIsPrimary && !aIsPrimary) return 1;

        // Secondary second
        if (aIsSecondary && !bIsSecondary) return -1;
        if (bIsSecondary && !aIsSecondary) return 1;

        // Slot availability (available/online CCs first)
        const aStatus = getAvailabilityStatus(a);
        const bStatus = getAvailabilityStatus(b);

        if (aStatus.isAvailable && !bStatus.isAvailable) return -1;
        if (!aStatus.isAvailable && bStatus.isAvailable) return 1;

        return 0;
      });
    }, [options, ben.primaryCcId, ben.secondaryCcId, availabilities]);

    const displayOptions = useMemo(() => [THIRD_PARTY_OPTION, ...sortedOptions], [sortedOptions]);

    function RelationshipFlag({ ccId }: { ccId: string }) {
      const isPrimary = ccId === ben.primaryCcId;
      const isSecondary = ccId === ben.secondaryCcId;

      if (isPrimary) {
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-orange-100 text-[#FF7A00] border border-orange-200">
            ★ Primary CC
          </span>
        );
      }
      if (isSecondary) {
        return (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-blue-100 text-blue-700 border border-blue-200">
            ☆ Secondary CC
          </span>
        );
      }
      return null;
    }

    const selectedStatus = selected ? getAvailabilityStatus(selected) : null;

    return (
      <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full px-3 py-2.5 rounded-xl border text-sm text-left transition-colors flex items-center justify-between gap-2 ${
            open
              ? 'border-[#FF7A00] bg-[#FFFAF7]'
              : 'border-[#E7DED6] bg-white hover:border-[#FF7A00]/50'
          }`}
        >
          {selected ? (
            <span className="flex items-center gap-2 flex-wrap">
              {/* Availability dot */}
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  selectedStatus && selectedStatus.isAvailable ? 'bg-green-400' : 'bg-gray-300'
                }`}
              />
              <span className="font-black text-gray-800">{selected.name}</span>
              <CCTypeFlag ccType={selected.ccType} />
              <RelationshipFlag ccId={selected.id} />
              {selectedStatus && !selectedStatus.isAvailable && (
                <span className="text-[9px] text-gray-400 font-bold">({selectedStatus.label})</span>
              )}
            </span>
          ) : (
            <span className="font-bold text-gray-400">
              {checking ? 'Checking availability...' : '— Select Care Companion —'}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown list */}
        {open && (
          <div className="absolute z-30 top-full mt-1.5 left-0 right-0 bg-white border border-[#E7DED6] rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {displayOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 font-bold">No CCs in this team</div>
            ) : (
              displayOptions.map(cc => {
                const status = getAvailabilityStatus(cc);
                const isSelected = cc.id === value;
                return (
                  <button
                    key={cc.id}
                    type="button"
                    disabled={!status.isAvailable}
                    onClick={() => { onChange(cc.id); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#FFF5EE] border-l-2 border-[#FF7A00]'
                        : status.isAvailable
                          ? 'hover:bg-[#FFF9F5]'
                          : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      {/* Availability dot */}
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          status.isAvailable ? 'bg-green-400' : 'bg-gray-300'
                        }`}
                      />
                      <span className="font-black text-gray-800 text-sm truncate">{cc.name}</span>
                      <CCTypeFlag ccType={cc.ccType} />
                      <RelationshipFlag ccId={cc.id} />
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {((cc as any).primaryBeneficiariesCount || 0) > 0 && (
                        <span className="text-[9px] font-black text-gray-400">
                          {(cc as any).primaryBeneficiariesCount}P
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          status.isAvailable
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                        title={status.reason || undefined}
                      >
                        {status.isAvailable ? 'Available' : status.label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7DED6] rounded-2xl overflow-hidden">
      <SectionHeader
        title="Beneficiaries"
        subtitle={
          loading
            ? 'Loading...'
            : `${beneficiaries.length} total`
        }
        icon={<Users size={18} />}
        action={
          onRefresh && (
            <button
              onClick={e => { e.stopPropagation(); onRefresh(); }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-gray-400 hover:text-[#FF7A00] border border-[#E7DED6] rounded-xl hover:border-[#FF7A00] transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={loading ? 'animate-spin text-[#FF7A00]' : ''}
              />
              Refresh
            </button>
          )
        }
      />

      {/* Search Bar & Operational Filter Tabs */}
      <div className="p-4 border-b border-[#F4EAE3] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search by name, phone, city, or package..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E7DED6] text-sm bg-[#FFFAF7] focus:outline-none focus:border-[#FF7A00] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Operational Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#FFFAF7] p-1 rounded-xl border border-[#E7DED6] self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-[#FF7A00] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>Active Package</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              statusFilter === 'active' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              statusFilter === 'expired'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>Awaiting Renewal</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              statusFilter === 'expired' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
            }`}>
              {expiredCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-gray-800 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            All ({beneficiaries.length})
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingState message="Loading beneficiaries..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search
              ? `No beneficiaries matching "${search}"`
              : statusFilter === 'active'
                ? 'No beneficiaries with an active care package found.'
                : statusFilter === 'expired'
                  ? 'No expired or renewal-pending beneficiaries found.'
                  : 'No beneficiaries found for this field manager.'
          }
          icon={<Users className="w-12 h-12" />}
        />
      ) : (
        <div className="divide-y divide-[#F4EAE3]">
          {filtered.map(ben => {
            const isExpanded = expandedId === ben.id;
            const isSubmitting = submittingId === ben.id;
            const state = scheduleState[ben.id] || { ccId: '', date: '', time: '', duration: 60, benefitId: '', benefitLabel: '', benefitUnit: '' };
            const isHourBased = state.benefitUnit?.toLowerCase().includes('hour');
            const isPastDateTime = (() => {
              if (!state.date || !state.time) return false;
              const selected = new Date(`${state.date}T${state.time}`);
              if (isNaN(selected.getTime())) return false;
              return selected.getTime() < Date.now() - 60000;
            })();

            const hasActive = ben.hasActivePackage !== undefined ? ben.hasActivePackage : Boolean(ben.activePackage);

            return (
              <div key={ben.id} className="transition-colors">
                {/* Row */}
                <div
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#FFF5EE]/40 transition-colors ${
                    isExpanded ? 'bg-[#FFF5EE]/60' : ''
                  }`}
                  onClick={() => handleToggleExpand(ben.id)}
                >
                  {/* Avatar */}
                  <Avatar name={ben.name} size="md" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-800 truncate flex items-center gap-1.5">
                        {ben.name}
                        {(unreadOverrides[ben.id] !== undefined ? unreadOverrides[ben.id] : ben.hasUnreadRequests) && (
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" title="Has pending service request" />
                        )}
                      </p>
                      {ben.age && (
                        <span className="text-[10px] text-gray-400 font-bold">{ben.age}y</span>
                      )}
                      {hasActive && ben.activePackage ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          {ben.activePackage}
                        </span>
                      ) : ben.lastPackageName ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Expired: {ben.lastPackageName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                          No Package
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {ben.phone && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                          <Phone size={9} />{ben.phone}
                        </span>
                      )}
                      {ben.city && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                          <MapPin size={9} />{ben.city}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <ChevronRight
                      size={16}
                      className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded: Schedule Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-4 bg-[#FFF5EE]/30 border-t border-[#F4EAE3]">
                    {!hasActive && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium mb-4 flex items-start gap-2.5">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-amber-900">No Active Care Package</p>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            This beneficiary currently has no active subscription or their package has expired. Visit scheduling is paused until package renewal. Their assigned Field Manager and Care Companion team remain permanently preserved.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Left: Schedule Form */}
                      <div className="flex-1 max-w-lg">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Calendar size={12} /> Schedule a Visit
                        </p>

                        <div className="space-y-3">
                          {/* Care Companion Select — custom dropdown with type flags */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Care Companion</label>
                            <CCDropdown
                              value={state.ccId}
                              onChange={id => updateSchedule(ben.id, 'ccId', id)}
                              options={availableCCs}
                              ben={ben}
                              availabilities={ccSlotAvailability[ben.id]?.availabilities}
                              checking={ccSlotAvailability[ben.id]?.checking}
                            />
                          </div>

                          <div className="flex gap-3">
                            {/* Date Input */}
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                              <input
                                type="date"
                                value={state.date}
                                onChange={e => updateSchedule(ben.id, 'date', e.target.value)}
                                onClick={e => e.stopPropagation()}
                                min={getLocalDateString()}
                                className="w-full px-3 py-2.5 rounded-xl border border-[#E7DED6] bg-white text-sm font-bold text-gray-700 focus:outline-none focus:border-[#FF7A00] transition-colors"
                              />
                            </div>

                            {/* Time Input */}
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                              <input
                                type="time"
                                value={state.time}
                                onChange={e => updateSchedule(ben.id, 'time', e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold transition-colors focus:outline-none ${
                                  conflicts[ben.id]
                                    ? 'bg-gray-50 text-gray-400 border-gray-200'
                                    : 'bg-white text-gray-700 border-[#E7DED6] focus:border-[#FF7A00]'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Selected Benefit Display */}
                          {state.benefitId ? (
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#FFF5EE] border-2 border-[#FF7A00]">
                              <div className="flex items-center gap-2">
                                <Sparkles size={13} className="text-[#FF7A00]" />
                                <div>
                                  <p className="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest leading-none">
                                    Benefit Selected
                                  </p>
                                  <p className="text-xs font-black text-gray-800 mt-0.5">
                                    {state.benefitLabel}
                                    {isHourBased && (
                                      <span className="ml-1.5 text-[9px] text-purple-500 font-black">⏱ billed at checkout</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); updateSchedule(ben.id, 'benefitId', ''); updateSchedule(ben.id, 'benefitLabel', ''); updateSchedule(ben.id, 'benefitUnit', ''); }}
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                              <Sparkles size={12} className="text-gray-300" />
                              <p className="text-[10px] font-bold text-gray-400">
                                No benefit selected — tap a benefit card on the right →
                              </p>
                            </div>
                          )}

                          <div className="flex gap-3 items-start pt-2">
                            {/* Duration Select */}
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock size={10} /> Duration
                              </label>
                              <select
                                value={state.duration}
                                onChange={e => updateSchedule(ben.id, 'duration', parseInt(e.target.value, 10))}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-3 py-2.5 rounded-xl border border-[#E7DED6] bg-white text-sm font-bold text-gray-700 focus:outline-none focus:border-[#FF7A00] transition-colors"
                              >
                                <option value={30}>30 mins</option>
                                <option value={60}>1 hour</option>
                                <option value={90}>1.5 hours</option>
                                <option value={120}>2 hours</option>
                              </select>
                            </div>

                            {/* Submit Button */}
                            <div className="flex-1">
                              <label className="block h-4 mb-1"></label>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleSchedule(ben.id);
                                }}
                                disabled={!hasActive || !state.ccId || !state.date || !state.time || !state.benefitId || isPastDateTime || isSubmitting || !!conflicts[ben.id]}
                                className="w-full px-5 py-2.5 bg-[#FF7A00] text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-[#E66E00] transition-all disabled:opacity-40 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-orange-200 h-[42px]"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    Scheduling...
                                  </>
                                ) : !hasActive ? (
                                  <>
                                    <AlertCircle size={13} />
                                    Awaiting Renewal
                                  </>
                                ) : (
                                  <>
                                    <Calendar size={13} />
                                    Schedule Visit
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Past Date/Time Warning */}
                          {isPastDateTime && (
                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                              <p className="text-[11px] font-bold text-red-600 leading-tight">
                                Visit time cannot be in the past. Please select a current or future date/time.
                              </p>
                            </div>
                          )}

                          {/* Missing Benefit Type Warning */}
                          {state.ccId && state.date && state.time && !isPastDateTime && !state.benefitId && (
                            <div className="mt-3 p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                              <AlertCircle size={14} className="text-orange-500 mt-0.5 shrink-0" />
                              <p className="text-[11px] font-bold text-orange-600 leading-tight">
                                Please select a benefit type from the utilization panel on the right.
                              </p>
                            </div>
                          )}

                          {/* Conflict Warning */}
                          {conflicts[ben.id] && (
                            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                              <p className="text-[11px] font-bold text-red-600 leading-tight">
                                {conflicts[ben.id]}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Service Requests Section */}
                        <div className="mt-6 pt-6 border-t border-dashed border-[#F4EAE3]">
                          <p className="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-[#FF7A00]" /> Requested Services
                          </p>
                          
                          {loadingRequests[ben.id] ? (
                            <div className="flex items-center gap-2 py-3 text-xs text-gray-400 font-bold">
                              <Loader2 size={13} className="animate-spin text-[#FF7A00]" /> Loading requests...
                            </div>
                          ) : (serviceRequests[ben.id] || []).length > 0 ? (
                            <div className="space-y-3">
                              {(serviceRequests[ben.id] || []).map((req: any) => {
                                const dateStr = new Date(req.preferredDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                });
                                return (
                                  <div key={req.id} className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between gap-3 ${
                                    req.isRead 
                                      ? 'bg-[#FCFAF9] border-[#E8DFD8] opacity-60' 
                                      : 'bg-white border-[#E7DED6]'
                                  }`}>
                                    <div className="flex justify-between items-start gap-3">
                                      <div>
                                        <p className="text-xs font-black text-gray-800">
                                          {req.benefit?.name || 'Requested Service'}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-1">
                                          Preferred: {dateStr} ({req.preferredTiming})
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                          <p className="text-[10px] text-gray-500 font-medium">
                                            {req.requestedByRole === 'subscriber' && (
                                              <>Requested by Subscriber <span className="font-bold text-gray-700">({req.requestedByUser?.name || req.subscriber?.name || 'Subscriber'})</span></>
                                            )}
                                            {req.requestedByRole === 'beneficiary' && (
                                              <>Requested by Beneficiary itself</>
                                            )}
                                            {req.requestedByRole === 'care_companion' && (
                                              <>Requested by Care Companion <span className="font-bold text-gray-700">({req.requestedByUser?.name || 'Care Companion'})</span></>
                                            )}
                                            {!req.requestedByRole && (
                                              req.subscriberId 
                                                ? <>Requested by Subscriber <span className="font-bold text-gray-700">({req.subscriber?.name || 'Subscriber'})</span></>
                                                : <>Requested by Beneficiary itself</>
                                            )}
                                          </p>
                                          {req.requestedByRole === 'care_companion' && (
                                            (() => {
                                              const userId = req.requestedByUserId;
                                              const isPrimary = userId && ben.primaryCcUserId && userId === ben.primaryCcUserId;
                                              const isSecondary = userId && ben.secondaryCcUserId && userId === ben.secondaryCcUserId;
                                              if (isPrimary) {
                                                return (
                                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-green-100 text-green-700 border border-green-200">
                                                    Primary CC
                                                  </span>
                                                );
                                              }
                                              if (isSecondary) {
                                                return (
                                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                                    Secondary CC
                                                  </span>
                                                );
                                              }
                                              return null;
                                            })()
                                          )}
                                        </div>
                                      </div>
                                      {req.isRead ? (
                                        <span className="shrink-0 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-green-600 bg-green-50 border border-green-100 rounded-lg">
                                          Read
                                        </span>
                                      ) : (
                                        <button
                                          onClick={e => {
                                            e.stopPropagation();
                                            handleMarkRequestRead(ben.id, req.id);
                                          }}
                                          className="shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF7A00] bg-orange-50 border border-orange-100 hover:bg-orange-100 rounded-lg transition-colors"
                                        >
                                          Mark Read
                                        </button>
                                      )}
                                    </div>
                                    {req.additionalNote && (
                                      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">Additional Note:</p>
                                        <p className="text-[11px] font-bold text-gray-600 mt-1 leading-normal">
                                          "{req.additionalNote}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] font-bold text-gray-400 italic">
                              No active service requests for this beneficiary.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Package Utilization — benefits are clickable to select */}
                      <div className="flex-1 lg:border-l lg:border-[#F4EAE3] lg:pl-8">
                        <PackageUtilizationPanel
                          beneficiaryId={ben.id}
                          beneficiaryName={ben.name}
                          onBenefitSelect={(benefitId, benefitName, unitLabel) =>
                            handleBenefitSelect(ben.id, benefitId, benefitName, unitLabel)
                          }
                          selectedBenefitId={state.benefitId || undefined}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-[#F4EAE3] bg-gray-50/50">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Showing {filtered.length} of {beneficiaries.length} beneficiaries
          </p>
        </div>
      )}
    </div>
  );
}
