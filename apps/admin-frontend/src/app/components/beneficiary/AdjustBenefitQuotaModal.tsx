import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
  History,
  FileText
} from 'lucide-react';
import { subscriptionApi } from '../../../services/api';
import { toast } from 'sonner';

export interface BenefitBalanceForAdjustment {
  balanceId?: string;
  benefitId: string;
  benefitName: string;
  unitLabel: string;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
  packageName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balance: BenefitBalanceForAdjustment | null;
}

const PRESET_REASONS = [
  'Goodwill gesture / Complimentary allocation',
  'Service escalation compensation',
  'Custom package agreement / Top-up',
  'Administrative quota correction',
  'Special holiday / Promotion perk',
];

export function AdjustBenefitQuotaModal({
  isOpen,
  onClose,
  onSuccess,
  balance,
}: Props) {
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [units, setUnits] = useState<string>('5');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMode('add');
      setUnits('5');
      setReason('');
    }
  }, [isOpen, balance]);

  if (!isOpen || !balance) return null;

  const numericUnits = parseInt(units, 10) || 0;
  const delta = mode === 'add' ? numericUnits : -numericUnits;
  const newTotal = balance.totalUnits + delta;
  const newRemaining = balance.remainingUnits + delta;

  const isBelowUsed = newTotal < balance.usedUnits;
  const isBelowZero = newRemaining < 0;
  const isInvalid = numericUnits <= 0 || isBelowUsed || isBelowZero || !reason.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balance.balanceId) {
      toast.error('Missing balance identifier. Please refresh the page and try again.');
      return;
    }
    if (numericUnits <= 0) {
      toast.error('Please enter a valid number of units to adjust.');
      return;
    }
    if (!reason.trim()) {
      toast.error('A reason is mandatory for business audit purposes.');
      return;
    }
    if (isBelowUsed) {
      toast.error(`Cannot reduce quota below the ${balance.usedUnits} units already used.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await subscriptionApi.adjustBenefitBalance(balance.balanceId, {
        deltaUnits: delta,
        reason: reason.trim(),
      });
      toast.success(res.message || 'Benefit quota adjusted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust benefit quota.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#E7DED6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-orange-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF5EE] border border-[#FFE4D3] text-[#FF7A00] flex items-center justify-center shrink-0 shadow-xs">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">
                Adjust Benefit Quota
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {balance.benefitName} · <span className="font-bold text-gray-700 uppercase">{balance.unitLabel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Current Quota Status */}
          <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 text-center">
            <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Quota</p>
              <p className="text-lg font-black text-gray-800 mt-0.5">{balance.totalUnits}</p>
            </div>
            <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Consumed</p>
              <p className="text-lg font-black text-amber-600 mt-0.5">{balance.usedUnits}</p>
            </div>
            <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Available</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{balance.remainingUnits}</p>
            </div>
          </div>

          {/* Action Selector: Increase (+) vs Decrease (-) */}
          <div>
            <label className="block text-[11px] font-black text-gray-600 uppercase tracking-wider mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`py-2.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  mode === 'add'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs ring-1 ring-emerald-400/30'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Plus size={14} className="stroke-[3]" /> Add / Grant (+ units)
              </button>
              <button
                type="button"
                onClick={() => setMode('subtract')}
                className={`py-2.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  mode === 'subtract'
                    ? 'bg-red-50 border-red-500 text-red-700 shadow-xs ring-1 ring-red-400/30'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Minus size={14} className="stroke-[3]" /> Deduct / Reduce (- units)
              </button>
            </div>
          </div>

          {/* Amount / Count Input + Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                Number of {balance.unitLabel} to {mode === 'add' ? 'Add' : 'Deduct'}
              </label>
              <span className="text-[10px] font-bold text-gray-400">Whole number</span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="Enter units (e.g. 5)"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] text-lg font-black text-gray-900 bg-white shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase">
                {balance.unitLabel}
              </span>
            </div>

            {/* Quick selection chips */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Presets:</span>
              {[1, 2, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setUnits(String(num))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    units === String(num)
                      ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                      : 'bg-gray-50 hover:bg-orange-50 text-gray-700 border-gray-200'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview / Impact Card */}
          <div
            className={`p-3.5 rounded-2xl border text-xs transition-all ${
              isBelowUsed || isBelowZero
                ? 'bg-red-50/80 border-red-200 text-red-900'
                : 'bg-[#FFF9F5] border-[#FFE4D3] text-gray-800'
            }`}
          >
            <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] mb-1 text-gray-500">
              <History size={12} className={isBelowUsed ? 'text-red-500' : 'text-[#FF7A00]'} />
              Projected Quota After Adjustment
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span>
                Total Quota:{' '}
                <strong className="text-gray-900 font-black">
                  {balance.totalUnits} → {newTotal}
                </strong>{' '}
                <span className={`font-bold ${mode === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                  ({mode === 'add' ? `+${numericUnits}` : `-${numericUnits}`})
                </span>
              </span>
              <span>
                Available:{' '}
                <strong className={isBelowZero ? 'text-red-600 font-black' : 'text-emerald-700 font-black'}>
                  {balance.remainingUnits} → {newRemaining}
                </strong>
              </span>
            </div>

            {isBelowUsed && (
              <div className="flex items-center gap-1.5 text-red-600 font-bold mt-2 pt-2 border-t border-red-200">
                <AlertCircle size={13} className="shrink-0" />
                <span>Cannot reduce total quota below the {balance.usedUnits} units already consumed!</span>
              </div>
            )}
          </div>

          {/* Mandatory Reason for Audit Log */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={12} className="text-[#FF7A00]" />
                Reason for Adjustment <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-gray-400">Required for Audit Log</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all text-left cursor-pointer ${
                    reason === preset
                      ? 'bg-orange-100 border-[#FF7A00] text-[#FF7A00]'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Customer requested 5 extra emergency buttons due to extended travel..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] text-xs text-gray-800 placeholder-gray-400 shadow-2xs resize-none"
            />
          </div>

          {/* Audit Notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-[10px] text-blue-800">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>
              This update is logged in the immutable audit trail with your admin username, timestamp, and reason.
            </span>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInvalid || submitting}
              className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e06d00] text-white text-xs font-black uppercase tracking-wider shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Confirm & Log Adjustment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
