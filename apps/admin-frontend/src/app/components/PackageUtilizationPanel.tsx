import React, { useEffect, useState } from 'react';
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  PackageCheck,
  Calendar,
  CheckCheck,
  Sparkles,
  Plus,
  Award,
  History,
  Activity,
  UserCheck,
  Layers,
  ChevronDown,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import { subscriptionApi } from '../../services/api';
import { toast } from 'sonner';
import { AddonBenefitModal } from './addons/AddonBenefitModal';
import { AdjustBenefitQuotaModal, BenefitBalanceForAdjustment } from './beneficiary/AdjustBenefitQuotaModal';

interface BenefitBalance {
  balanceId?: string;
  benefitId: string;
  benefitName: string;
  unitLabel: string;
  benefitTypeName: string | null;
  description: string | null;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
  usagePercent: number;
  isLowBalance: boolean;
  isExhausted: boolean;
}

interface LogEntry {
  id: string;
  visitId: string | null;
  encounterId: string | null;
  hoursConsumed: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  loggedAt: string;
  careCompanionName: string;
  ccType: string | null;
  visitStatus: string | null;
  actualMinutes: number | null;
}

interface SubscriptionSummary {
  id: string;
  packageId?: string;
  packageName: string;
  packageType: string;
  packageVersion?: string | number | null;
  basePrice?: number | null;
  duration?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: 'active' | 'expired' | 'cancelled';
  isExpired: boolean;
  durationDays: number;
  daysRemaining: number;
  expiredDaysAgo: number;
  cancelledAt?: string | null;
  cancellationNote?: string | null;
  hoursTotal: number;
  hoursUsed: number;
  hoursRemaining: number;
  visitsTotal: number;
  visitsCompleted: number;
  latestPayment?: any | null;
}

interface SubscriptionHistoryItem {
  id: string;
  packageName: string;
  packageType: string;
  duration?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: 'active' | 'expired' | 'cancelled';
  isExpired: boolean;
  hoursTotal: number;
  hoursUsed: number;
  visitsTotal: number;
  visitsCompleted: number;
  createdAt: string;
}

interface QuotaAdjustmentLog {
  id: string;
  balanceId: string;
  benefitName: string;
  unitLabel: string;
  units: number;
  totalBefore: number;
  totalAfter: number;
  availableBefore: number;
  availableAfter: number;
  reason: string;
  performedBy: string;
  performedByRole: string;
  createdAt: string;
}

interface UtilizationData {
  subscription: SubscriptionSummary | null;
  allSubscriptions?: SubscriptionHistoryItem[];
  mostUsedBenefit?: BenefitBalance | null;
  overallStats?: {
    totalAllocatedUnits: number;
    totalUsedUnits: number;
    totalRemainingUnits: number;
    overallUsagePercent: number;
    totalBenefitsCount: number;
    exhaustedCount: number;
    lowBalanceCount: number;
  } | null;
  benefits: BenefitBalance[];
  recentLogs: LogEntry[];
  recentAdjustments?: QuotaAdjustmentLog[];
}

interface Props {
  beneficiaryId: string;
  beneficiaryName?: string;
  subscriberId?: string;
  subscriberName?: string;
  subscriberPhone?: string;
  subscriberEmail?: string;
  defaultPincode?: string;
  /** When provided, renders benefit cards as selectable buttons */
  onBenefitSelect?: (benefitId: string, benefitName: string, unitLabel: string) => void;
  /** Currently selected benefit ID (for highlighted state) */
  selectedBenefitId?: string;
}

/** SVG Circular progress ring */
function CircleRing({
  percent,
  size = 80,
  strokeWidth = 7,
  color,
  label,
  value,
  unit,
  isExhausted,
  isLow,
  isSelected,
  isSelectable,
  onClick,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  value: string;
  unit: string;
  isExhausted: boolean;
  isLow: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const ringColor = isExhausted ? '#EF4444' : isLow ? '#F59E0B' : isSelected ? '#FF7A00' : color;

  return (
    <div
      className={`flex flex-col items-center gap-2 transition-transform ${
        isSelectable && !isExhausted ? 'cursor-pointer hover:scale-105' : ''
      } ${isSelected ? 'scale-105' : ''}`}
      onClick={!isExhausted && isSelectable ? onClick : undefined}
      title={isSelectable && !isExhausted ? `Click to select ${label}` : undefined}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Selected glow ring */}
        {isSelected && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: 'transparent',
              boxShadow: '0 0 0 3px rgba(255,122,0,0.4)',
              borderRadius: '50%',
            }}
          />
        )}
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
          {/* Progress */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isSelected ? (
            <CheckCheck size={16} className="text-[#FF7A00]" />
          ) : (
            <>
              <span className="text-xs font-black text-gray-800 leading-tight">{value}</span>
              <span className="text-[8px] font-bold text-gray-400 uppercase leading-tight">{unit}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider leading-tight max-w-[85px] text-center truncate" title={label}>
          {label}
        </p>
        {isSelected && (
          <span className="text-[8px] font-black text-[#FF7A00] uppercase tracking-widest">Selected</span>
        )}
        {!isSelected && isExhausted && (
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Exhausted</span>
        )}
        {!isSelected && !isExhausted && isLow && (
          <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Low</span>
        )}
        {!isSelected && !isExhausted && !isLow && (
          <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">{percent}%</span>
        )}
      </div>
    </div>
  );
}

const COLORS = ['#FF7A00', '#7C3AED', '#059669', '#2563EB', '#DB2777', '#D97706', '#0284C7', '#10B981'];

export function PackageUtilizationPanel({
  beneficiaryId,
  beneficiaryName,
  subscriberId,
  subscriberName,
  subscriberPhone,
  subscriberEmail,
  defaultPincode,
  onBenefitSelect,
  selectedBenefitId,
}: Props) {
  const [data, setData] = useState<UtilizationData | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedBalanceForAdjust, setSelectedBalanceForAdjust] = useState<BenefitBalanceForAdjustment | null>(null);

  const load = async (subId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await subscriptionApi.getBeneficiaryUtilization(beneficiaryId, subId || selectedSubId || undefined);
      setData(result as unknown as UtilizationData);
      if (result?.subscription?.id && !selectedSubId) {
        setSelectedSubId(result.subscription.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load utilization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (beneficiaryId) load();
  }, [beneficiaryId]);

  const handleSelectSubscription = (subId: string) => {
    setSelectedSubId(subId);
    load(subId);
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-[32px] p-12 border border-[#E7DED6] flex items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#FF7A00]" size={24} />
        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading package & utilization data...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white rounded-[32px] p-10 border border-[#E7DED6] text-center">
        <AlertTriangle className="text-amber-400 mx-auto mb-3" size={32} />
        <p className="text-sm font-bold text-gray-600">{error}</p>
        <button
          onClick={() => load()}
          className="mt-4 text-[#FF7A00] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto cursor-pointer"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (!data || !data.subscription) {
    return (
      <div className="bg-white rounded-[32px] p-12 border border-dashed border-[#E7DED6] flex flex-col items-center justify-center gap-4 text-center">
        <PackageCheck size={40} className="text-gray-300" />
        <div>
          <h3 className="font-black text-gray-700 text-sm uppercase tracking-widest">No Subscription On Record</h3>
          <p className="text-xs text-gray-400 mt-1">
            This beneficiary has not yet been enrolled in any care package.
          </p>
        </div>
      </div>
    );
  }

  const { subscription, allSubscriptions = [], mostUsedBenefit, overallStats, benefits, recentLogs } = data;
  const visibleLogs = showAllLogs ? recentLogs : recentLogs.slice(0, 8);
  const hasWarnings = benefits.some((b) => b.isLowBalance || b.isExhausted);
  const isSelectable = !!onBenefitSelect;

  const isExpired = subscription.status === 'expired' || subscription.isExpired;
  const isCancelled = subscription.status === 'cancelled';
  const isActive = subscription.status === 'active' && !isExpired && !isCancelled;

  return (
    <div className="space-y-6">
      {/* ── Package History Switcher (if multiple subscriptions exist) ── */}
      {allSubscriptions.length > 1 && (
        <div className="bg-white rounded-[24px] p-4 border border-[#E7DED6] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <History size={15} className="text-[#FF7A00]" />
              <span className="text-[11px] font-black text-gray-800 uppercase tracking-widest">
                Package History ({allSubscriptions.length} Subscriptions)
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-400">Click to view utilization for any package</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {allSubscriptions.map((sub, idx) => {
              const isCurrent = sub.id === subscription.id;
              const subIsExpired = sub.status === 'expired' || sub.isExpired;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubscription(sub.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 border cursor-pointer ${
                    isCurrent
                      ? 'bg-orange-50 border-[#FF7A00] text-gray-900 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className={isCurrent ? 'text-[#FF7A00]' : 'text-gray-400'}>
                    #{allSubscriptions.length - idx}
                  </span>
                  <span>{sub.packageName}</span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                      sub.status === 'active' && !subIsExpired
                        ? 'bg-emerald-100 text-emerald-800'
                        : sub.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sub.status === 'active' && !subIsExpired ? 'Active' : sub.status === 'cancelled' ? 'Cancelled' : 'Expired'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Package Header Card ── */}
      {/* ── 1. Package Header Card ── */}
      <div className="bg-white rounded-[28px] p-6 border border-[#E7DED6] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <PackageCheck size={22} className="text-[#FF7A00]" />
              <h3 className="text-xl font-black text-gray-900">{subscription.packageName}</h3>

              {/* Status Badge */}
              {isActive && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Active Subscription
                </span>
              )}
              {isExpired && (
                <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-700" /> Expired Package
                </span>
              )}
              {isCancelled && (
                <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-rose-600" /> Cancelled
                </span>
              )}
            </div>

            {/* Active Date Range & Validity */}
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600 flex-wrap">
              <span className="flex items-center gap-1 text-gray-400">
                <Calendar size={13} />
                Active from:
              </span>
              <span className="font-black text-gray-800">
                {new Date(subscription.startDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-black text-gray-800">
                {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-gray-300">·</span>
              <span className="bg-gray-100 text-gray-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg">
                {subscription.durationDays} Days Duration
              </span>

              {isExpired && subscription.expiredDaysAgo > 0 && (
                <span className="text-amber-700 text-[11px] font-bold">
                  (Expired {subscription.expiredDaysAgo} days ago)
                </span>
              )}
              {isActive && subscription.daysRemaining > 0 && (
                <span className="text-emerald-700 text-[11px] font-bold">
                  ({subscription.daysRemaining} days remaining)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddonModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-[#FF7A00] hover:from-orange-600 hover:to-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" /> Add Add-on Benefit
            </button>
            <button
              onClick={() => load(subscription.id)}
              className="p-2.5 rounded-2xl bg-gray-50 hover:bg-orange-50 text-gray-400 hover:text-[#FF7A00] transition-colors border border-gray-100 cursor-pointer"
              title="Refresh utilization"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Expired info banner */}
        {isExpired && (
          <div className="flex items-center gap-3 p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl mt-5 text-xs text-amber-900">
            <Clock size={16} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-black">Historical Package Record: </span>
              This subscription was active from{' '}
              <span className="font-bold">
                {new Date(subscription.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>{' '}
              to{' '}
              <span className="font-bold">
                {new Date(subscription.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              . All historical benefit utilization, clinical actions, and encounter logs are preserved below.
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Key Metrics Row (4 Standalone Cards in 2x2 Grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
        {/* Card 1: Top Used Benefit */}
        <div className="bg-white rounded-[24px] p-5 border border-[#E7DED6] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF7A00] shrink-0">
                <Award size={16} />
              </div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider truncate">
                Top Used Benefit
              </span>
            </div>
            {mostUsedBenefit && mostUsedBenefit.usedUnits > 0 && (
              <span className="text-[10px] font-black text-[#FF7A00] bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full shrink-0">
                {mostUsedBenefit.usagePercent}% Used
              </span>
            )}
          </div>

          <div>
            <p className="text-base font-black text-gray-900 truncate" title={mostUsedBenefit?.benefitName || 'N/A'}>
              {mostUsedBenefit?.benefitName || 'None'}
            </p>
            {mostUsedBenefit && mostUsedBenefit.usedUnits > 0 ? (
              <p className="text-xs font-bold text-gray-500 mt-1">
                <strong className="text-sm font-black text-[#FF7A00]">{mostUsedBenefit.usedUnits}</strong> of {mostUsedBenefit.totalUnits} {mostUsedBenefit.unitLabel} consumed
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">No benefits consumed yet</p>
            )}
          </div>
        </div>

        {/* Card 2: Quota Utilization */}
        <div className="bg-white rounded-[24px] p-5 border border-[#E7DED6] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Activity size={16} />
              </div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider truncate">
                Quota Utilization
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full shrink-0">
              {benefits.length} Benefits
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-black text-gray-900">{overallStats?.overallUsagePercent ?? 0}%</span>
              <span className="text-xs font-bold text-gray-500">
                {overallStats?.totalUsedUnits ?? 0} / {overallStats?.totalAllocatedUnits ?? 0} Units
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-[#FF7A00] h-2 rounded-full transition-all"
                style={{ width: `${Math.min(overallStats?.overallUsagePercent ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Care Companion Hours */}
        <div className="bg-white rounded-[24px] p-5 border border-[#E7DED6] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <Clock size={16} />
              </div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider truncate">
                Companion Hours
              </span>
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full shrink-0">
              {subscription.hoursRemaining}h left
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-black text-gray-900">
                {subscription.hoursUsed} <span className="text-xs font-bold text-gray-400">/ {subscription.hoursTotal} hrs</span>
              </span>
              <span className="text-xs font-bold text-purple-700">
                {subscription.hoursTotal > 0 ? Math.round((subscription.hoursUsed / subscription.hoursTotal) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(subscription.hoursTotal > 0 ? (subscription.hoursUsed / subscription.hoursTotal) * 100 : 0, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Delivered Visits */}
        <div className="bg-white rounded-[24px] p-5 border border-[#E7DED6] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <UserCheck size={16} />
              </div>
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider truncate">
                Delivered Visits
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
              Verified
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900">{subscription.visitsCompleted}</span>
              <span className="text-xs font-bold text-gray-500">
                {subscription.visitsTotal > 0 ? `/ ${subscription.visitsTotal} Visits Total` : 'Visits Completed'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Care encounters logged & synced</p>
          </div>
        </div>
      </div>

      {/* ── 3. Benefit Balances & Quota Overview Card ── */}
      <div className="bg-white rounded-[28px] p-6 border border-[#E7DED6] shadow-sm">

        {/* Selectable hint banner */}
        {isSelectable && benefits.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FFF5EE] border border-[#FFE4D3] rounded-2xl mb-4">
            <div className="w-4 h-4 rounded-full bg-[#FF7A00] flex items-center justify-center flex-shrink-0">
              <CheckCheck size={9} className="text-white" />
            </div>
            <p className="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest">
              {selectedBenefitId
                ? `✓ Benefit selected — visit will deduct from it`
                : 'Tap a benefit below to select it for this visit'}
            </p>
          </div>
        )}

        {/* Warning Banner */}
        {hasWarnings && !isExpired && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-2xl mb-4">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs font-bold text-amber-700">
              {benefits.filter((b) => b.isExhausted).length > 0
                ? `${benefits.filter((b) => b.isExhausted).length} benefit(s) exhausted — renewal or top-up needed`
                : `${benefits.filter((b) => b.isLowBalance).length} benefit(s) running low (< 20% remaining)`}
            </p>
          </div>
        )}

        {/* ── Benefit Rings (Visual Overview) ── */}
        {benefits.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-8 py-5 border-y border-gray-100 my-4">
            {benefits.map((b, i) => (
              <CircleRing
                key={b.benefitId}
                percent={b.usagePercent}
                size={86}
                strokeWidth={7}
                color={COLORS[i % COLORS.length]}
                label={b.benefitName || 'Benefit'}
                value={`${b.usedUnits}`}
                unit={`/ ${b.totalUnits} ${b.unitLabel}`}
                isExhausted={b.isExhausted}
                isLow={b.isLowBalance}
                isSelected={selectedBenefitId === b.benefitId}
                isSelectable={isSelectable}
                onClick={() => onBenefitSelect?.(b.benefitId, b.benefitName, b.unitLabel)}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400 text-center italic">No benefit balances configured for this subscription.</p>
            <button
              onClick={async () => {
                if (!subscription?.id) return;
                setInitializing(true);
                try {
                  const result = await subscriptionApi.initializeBalances(subscription.id);
                  if (result.created > 0) {
                    toast.success(`✅ Initialized ${result.created} benefit balance(s)!`);
                    load(subscription.id);
                  } else {
                    toast.info(result.message || 'No new balances to create.');
                  }
                } catch (err: any) {
                  toast.error(err.message || 'Failed to initialize balances');
                } finally {
                  setInitializing(false);
                }
              }}
              disabled={initializing}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF7A00] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#e06d00] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {initializing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {initializing ? 'Initializing...' : 'Initialize Benefit Balances'}
            </button>
          </div>
        )}

        {/* ── Detailed Benefit Cards Grid ── */}
        {benefits.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Layers size={13} className="text-[#FF7A00]" />
                Benefit Quota & Usage Breakdown ({benefits.length} Benefits)
              </h4>
              <span className="text-[10px] font-bold text-gray-400">
                {benefits.filter((b) => b.usedUnits > 0).length} of {benefits.length} benefits utilized
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {benefits.map((b, i) => {
                const accent = COLORS[i % COLORS.length];
                const isSelected = selectedBenefitId === b.benefitId;
                const isHourBased = b.unitLabel?.toLowerCase().includes('hour');
                const canSelect = isSelectable && !b.isExhausted;
                const isTopUsed = mostUsedBenefit && mostUsedBenefit.benefitId === b.benefitId && b.usedUnits > 0;

                return (
                  <div
                    key={b.benefitId}
                    onClick={canSelect ? () => onBenefitSelect?.(b.benefitId, b.benefitName, b.unitLabel) : undefined}
                    className={`p-4 rounded-2xl border transition-all ${
                      canSelect ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'bg-[#FFF5EE] border-[#FF7A00] shadow-md shadow-orange-100'
                        : b.isExhausted
                        ? 'bg-red-50/50 border-red-100'
                        : b.isLowBalance
                        ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                        : isTopUsed
                        ? 'bg-orange-50/30 border-orange-200'
                        : canSelect
                        ? 'bg-[#FDFBF9] border-gray-100 hover:border-[#FF7A00] hover:bg-[#FFF9F5]'
                        : 'bg-[#FDFBF9] border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {isTopUsed && (
                            <span title="Most used benefit in this package">
                              <Award size={13} className="text-[#FF7A00] shrink-0" />
                            </span>
                          )}
                          <p className={`text-xs font-black truncate max-w-[160px] ${isSelected ? 'text-[#FF7A00]' : 'text-gray-800'}`}>
                            {b.benefitName}
                          </p>
                        </div>
                        {b.benefitTypeName && (
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5">
                            {b.benefitTypeName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {b.isExhausted ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-red-600 uppercase bg-red-100/80 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> Exhausted
                          </span>
                        ) : b.isLowBalance ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-amber-700 uppercase bg-amber-100/80 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> Low
                          </span>
                        ) : b.usedUnits > 0 ? (
                          <span className="text-[9px] font-black text-emerald-700 uppercase bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            {b.usagePercent}% Used
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                            Unused
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(b.usagePercent, 100)}%`,
                          backgroundColor: isSelected ? '#FF7A00' : b.isExhausted ? '#EF4444' : b.isLowBalance ? '#F59E0B' : accent,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-black text-gray-700">
                        <strong className="text-gray-900">{b.usedUnits}</strong> of {b.totalUnits} {b.unitLabel} used
                      </span>
                      <span className="font-bold text-gray-400">
                        {b.remainingUnits} left
                      </span>
                    </div>

                    {/* Adjust Quota Action Button */}
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">
                        Quota: <strong className="text-gray-700">{b.totalUnits} {b.unitLabel}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBalanceForAdjust({
                            balanceId: b.balanceId,
                            benefitId: b.benefitId,
                            benefitName: b.benefitName,
                            unitLabel: b.unitLabel,
                            totalUnits: b.totalUnits,
                            usedUnits: b.usedUnits,
                            remainingUnits: b.remainingUnits,
                            packageName: subscription.packageName,
                          });
                          setIsAdjustModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-orange-50 hover:bg-[#FF7A00] text-[#FF7A00] hover:text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 border border-orange-200 hover:border-[#FF7A00] shadow-2xs cursor-pointer"
                        title={`Adjust Quota for ${b.benefitName}`}
                      >
                        <SlidersHorizontal size={11} />
                        <span>Adjust Quota</span>
                      </button>
                    </div>

                    {/* Selected indicator line at bottom */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-[#FFE4D3]">
                        <p className="text-[9px] font-black text-[#FF7A00] uppercase tracking-widest text-center">
                          ✓ Selected for this visit
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Quota Adjustment Audit Trail ── */}
      {data?.recentAdjustments && data.recentAdjustments.length > 0 && (
        <div className="bg-white rounded-[28px] p-6 border border-[#E7DED6] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[#FF7A00]" />
              Benefit Quota Adjustment Audit Trail
            </h4>
            <span className="text-[10px] font-bold text-[#FF7A00] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">
              {data.recentAdjustments.length} logged adjustment{data.recentAdjustments.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2.5">
            {data.recentAdjustments.map((adj) => (
              <div
                key={adj.id}
                className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:border-[#E7DED6] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      adj.units > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {adj.units > 0 ? `+${adj.units}` : adj.units}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">
                      <span className="text-gray-900 font-black">{adj.benefitName}</span>: quota adjusted by{' '}
                      <span className={adj.units > 0 ? 'text-emerald-600 font-black' : 'text-red-600 font-black'}>
                        {adj.units > 0 ? `+${adj.units}` : adj.units} {adj.unitLabel}
                      </span>{' '}
                      ({adj.totalBefore} → {adj.totalAfter})
                    </p>
                    <p className="text-gray-500 text-[11px] mt-0.5 italic">
                      &ldquo;{adj.reason}&rdquo;
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Updated by <strong className="text-gray-700">{adj.performedBy}</strong> ({adj.performedByRole.replace('_', ' ')})
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-2xs">
                    {new Date(adj.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity Log ── */}
      {recentLogs.length > 0 && (
        <div className="bg-white rounded-[28px] p-6 border border-[#E7DED6] shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} className="text-[#FF7A00]" />
              Package Consumption & Visit Logs
            </h4>
            <span className="text-[10px] font-bold text-gray-400">{recentLogs.length} entries</span>
          </div>
          <div className="space-y-2">
            {visibleLogs.map((log) => {
              const isHours = (log.hoursConsumed ?? 0) > 0;
              const billMinutes = log.actualMinutes ? Math.max(60, log.actualMinutes) : null;
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FAFAFA] border border-gray-50 hover:border-[#E7DED6] transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={14} className="text-[#FF7A00]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {log.description || log.encounterId || 'Benefit deduction'}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {log.careCompanionName}
                        {log.ccType && <span className="ml-1 opacity-60">· {log.ccType.replace('_', ' ')}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-gray-800">
                      {isHours ? `${billMinutes || (log.hoursConsumed * 60)}m billed` : `−1 unit`}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {new Date(log.loggedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {recentLogs.length > 8 && (
            <button
              onClick={() => setShowAllLogs((v) => !v)}
              className="w-full mt-4 py-3 rounded-2xl bg-[#F4EAE3] text-gray-600 font-black text-[10px] uppercase tracking-widest hover:bg-[#E7DED6] transition-colors cursor-pointer"
            >
              {showAllLogs ? 'Show Less' : `View All ${recentLogs.length} Entries`}
            </button>
          )}
        </div>
      )}

      {recentLogs.length === 0 && (
        <div className="bg-white rounded-[28px] p-8 border border-dashed border-[#E7DED6] text-center">
          <TrendingUp size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No consumption logged yet</p>
          <p className="text-xs text-gray-400 mt-1">Activity will appear here once visits or consultations are completed.</p>
        </div>
      )}

      {/* Add-on Benefit Modal */}
      <AddonBenefitModal
        isOpen={isAddonModalOpen}
        onClose={() => setIsAddonModalOpen(false)}
        subscriptionId={subscription.id}
        beneficiaryId={beneficiaryId}
        beneficiaryName={beneficiaryName}
        subscriberId={subscriberId}
        subscriberName={subscriberName}
        subscriberPhone={subscriberPhone}
        subscriberEmail={subscriberEmail}
        defaultPincode={defaultPincode}
        onSuccess={() => load(subscription.id)}
      />

      {/* Quota Adjustment Modal */}
      <AdjustBenefitQuotaModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        balance={selectedBalanceForAdjust}
        onSuccess={() => load(subscription.id)}
      />
    </div>
  );
}

export default PackageUtilizationPanel;
