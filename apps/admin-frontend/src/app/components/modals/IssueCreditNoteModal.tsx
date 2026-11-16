import React, { useState, useEffect } from 'react';
import { X, Loader2, RotateCcw, AlertCircle, CheckCircle2, CreditCard, Building2 } from 'lucide-react';
import { creditNotesApi } from '../../../services/api';
import { toast } from 'sonner';

interface IssueCreditNoteModalProps {
  isOpen: boolean;
  invoiceId: string | null;
  onClose: () => void;
  onSuccess: (creditNote: any) => void;
}

export const IssueCreditNoteModal: React.FC<IssueCreditNoteModalProps> = ({
  isOpen,
  invoiceId,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refundDetails, setRefundDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState<string>('');
  const [refundMode, setRefundMode] = useState<'GATEWAY_ONLINE' | 'MANUAL_BANK'>('GATEWAY_ONLINE');
  const [manualReference, setManualReference] = useState('');
  const [reason, setReason] = useState('Customer requested cancellation');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelSubscription, setCancelSubscription] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setRefundDetails(null);
      setError(null);
      setAmount('');
      setManualReference('');
      setNotes('');
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const details = await creditNotesApi.getRefundDetails(invoiceId);
        setRefundDetails(details);
        setAmount(String(details.remainingRefundable || ''));
        setRefundMode(details.isOnlineGateway ? 'GATEWAY_ONLINE' : 'MANUAL_BANK');
        setCancelSubscription(details.remainingRefundable >= (details.totalAmount - 0.05));
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice refund details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, invoiceId]);

  if (!isOpen || !invoiceId) return null;

  const totalPaid = Number(refundDetails?.totalAmount || 0);
  const alreadyCredited = Number(refundDetails?.alreadyCredited || 0);
  const remainingRefundable = Number(refundDetails?.remainingRefundable || 0);
  const currentAmountNum = parseFloat(amount) || 0;

  const handleFullRefundClick = () => {
    setAmount(String(remainingRefundable));
    setCancelSubscription(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || currentAmountNum <= 0) {
      toast.error('Please enter a valid refund amount greater than 0');
      return;
    }

    if (currentAmountNum > remainingRefundable + 0.01) {
      toast.error(`Refund amount cannot exceed remaining refundable balance of ₹${remainingRefundable}`);
      return;
    }

    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      toast.error('Please specify a statutory reason for the Credit Note');
      return;
    }

    setSubmitting(true);
    try {
      const creditNote = await creditNotesApi.issueCreditNote(invoiceId, {
        amount: currentAmountNum,
        refundMode,
        manualReference: refundMode === 'MANUAL_BANK' ? manualReference.trim() : undefined,
        reason: finalReason,
        notes: notes.trim() || undefined,
        cancelSubscription,
      });

      toast.success(`Credit Note ${creditNote.creditNoteNumber} issued successfully!`);
      onSuccess(creditNote);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue Credit Note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Issue Credit Note & Refund</h3>
              <p className="text-xs text-gray-500 font-medium">
                Against Invoice: <span className="font-mono font-bold text-gray-700">{refundDetails?.invoiceNumber || invoiceId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 className="animate-spin text-red-500" size={28} />
              <p className="text-xs font-semibold uppercase tracking-wider">Loading Invoice Details...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          ) : remainingRefundable <= 0 ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl flex flex-col items-center text-center gap-2">
              <CheckCircle2 size={32} className="text-amber-600" />
              <h4 className="font-bold text-gray-800 text-base">Fully Refunded</h4>
              <p className="text-xs text-gray-600 max-w-sm">
                This invoice has already been fully refunded. Total credited: <strong>₹{alreadyCredited.toFixed(2)}</strong>. No remaining balance to refund.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Financial Balance Summary Card */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice Total</p>
                  <p className="text-sm font-black text-gray-800 mt-0.5 font-mono">₹{totalPaid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Already Credited</p>
                  <p className="text-sm font-black text-amber-600 mt-0.5 font-mono">₹{alreadyCredited.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Max Refundable</p>
                  <p className="text-sm font-black text-emerald-600 mt-0.5 font-mono">₹{remainingRefundable.toFixed(2)}</p>
                </div>
              </div>

              {/* Amount to Refund */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">
                    Refund Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleFullRefundClick}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md transition-colors"
                  >
                    Full Refund (₹{remainingRefundable.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={remainingRefundable}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-300 font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                  />
                </div>
              </div>

              {/* Refund Mode Selection */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">
                  Settlement Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      refundMode === 'GATEWAY_ONLINE'
                        ? 'border-red-500 bg-red-50/40 text-red-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    } ${!refundDetails?.isOnlineGateway ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="refundMode"
                      value="GATEWAY_ONLINE"
                      checked={refundMode === 'GATEWAY_ONLINE'}
                      onChange={() => setRefundMode('GATEWAY_ONLINE')}
                      disabled={!refundDetails?.isOnlineGateway}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-red-600" />
                        <span className="text-xs font-bold">Razorpay Online</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        {refundDetails?.isOnlineGateway ? 'Auto-refund to customer card/UPI' : 'No online gateway payment found'}
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      refundMode === 'MANUAL_BANK'
                        ? 'border-red-500 bg-red-50/40 text-red-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="refundMode"
                      value="MANUAL_BANK"
                      checked={refundMode === 'MANUAL_BANK'}
                      onChange={() => setRefundMode('MANUAL_BANK')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} className="text-gray-700" />
                        <span className="text-xs font-bold">Manual Transfer</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">NEFT / RTGS / UPI / Cash with UTR</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bank UTR field if Manual */}
              {refundMode === 'MANUAL_BANK' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Bank UTR / Transaction Reference Number
                  </label>
                  <input
                    type="text"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    placeholder="e.g. UTR123456789 or IMPS reference"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 font-mono text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              )}

              {/* Statutory Reason */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Statutory Reason for Credit Note <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                >
                  <option value="Customer requested cancellation">Customer requested cancellation</option>
                  <option value="Dissatisfied with care services">Dissatisfied with care services</option>
                  <option value="Duplicate payment / Excess amount paid">Duplicate payment / Excess amount paid</option>
                  <option value="Medical condition / Relocation exception">Medical condition / Relocation exception</option>
                  <option value="Other">Other (Custom reason)</option>
                </select>

                {reason === 'Other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter custom reason for Credit Note"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-gray-900 mt-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                )}
              </div>

              {/* Internal Notes */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal justification or notes"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              {/* Cancel Subscription Checkbox */}
              {refundDetails?.subscription && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cancelSubscription}
                      onChange={(e) => setCancelSubscription(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        Cancel Active Subscription
                      </span>
                      <p className="text-[11px] text-gray-500">
                        Deactivates the subscription and clears unutilized care hours.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || currentAmountNum <= 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Issue Credit Note (₹{currentAmountNum.toFixed(2)})</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

