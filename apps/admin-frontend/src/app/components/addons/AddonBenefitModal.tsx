import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Plus,
  Minus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { benefitApi, zoneApi, regionApi, subscriptionApi, paymentApi } from '../../../services/api';
import { PaymentMethodSelector } from '../payment/PaymentMethodSelector';
import { LocationRegionSearch } from '../common/LocationRegionSearch';

export interface AddonBenefitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  subscriberId?: string;
  subscriberName?: string;
  subscriberPhone?: string;
  subscriberEmail?: string;
  defaultLocationId?: string;
  defaultPincode?: string;
  onSuccess?: (result: any) => void;
  // If used in wizard step without immediate DB allocation
  standaloneSelectMode?: boolean;
  onSelectAddonForWizard?: (addonData: {
    benefit: any;
    units: number;
    totalAmount: number;
    paymentDetails?: any;
  }) => void;
}

export const AddonBenefitModal: React.FC<AddonBenefitModalProps> = ({
  isOpen,
  onClose,
  subscriptionId,
  beneficiaryId,
  beneficiaryName,
  subscriberId,
  subscriberName = 'Subscriber',
  subscriberPhone = '',
  subscriberEmail = '',
  defaultLocationId = 'all',
  defaultPincode,
  onSuccess,
  standaloneSelectMode = false,
  onSelectAddonForWizard,
}) => {
  // Step 1: Addon selection, Step 2: Payment & confirmation
  const [modalStep, setModalStep] = useState<'select' | 'payment'>('select');

  // Loading States
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [zones, setZones] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [allAddons, setAllAddons] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(defaultLocationId);

  // Multi-select: Map<benefitId, quantityMultiplier>
  const [selectedBenefits, setSelectedBenefits] = useState<Map<string, number>>(new Map());

  // Payment states (for PaymentMethodSelector)
  const [paymentMode, setPaymentMode] = useState<'offline' | 'online_link'>('offline');
  const [offlineMethod, setOfflineMethod] = useState<string>('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentLinkDetails, setPaymentLinkDetails] = useState<any>(null);
  const [generatingLink, setGeneratingLink] = useState<boolean>(false);

  // Load Regions, Zones, and Addon Benefits on mount / open
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [zonesData, regionsData, benefitsData] = await Promise.all([
          zoneApi.getAll().catch(() => []),
          regionApi.getAll().catch(() => []),
          benefitApi.getAll({ activeOnly: true }).catch(() => []),
        ]);

        setZones(zonesData || []);
        setRegions(regionsData || []);

        // Filter only benefits marked as add-ons
        const addons = (benefitsData || []).filter((b: any) => b.isAddon);
        setAllAddons(addons);
      } catch (err: any) {
        console.error('Failed to load add-on modal data', err);
        toast.error('Failed to load add-on benefits');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setModalStep('select');
      setSelectedBenefits(new Map());
      setPaymentMode('offline');
      setOfflineMethod('Cash');
      setAmountPaid('');
      setTransactionId('');
      setPaymentNote('');
      setPaymentLinkDetails(null);
      setSelectedLocation(defaultLocationId);
    }
  }, [isOpen, defaultLocationId]);

  // Filter add-ons by location/region
  const filteredAddons = useMemo(() => {
    if (selectedLocation === 'all') {
      return allAddons;
    }

    // Check matching zone to find corresponding regionId
    const matchingZone = zones.find((z) => z.id === selectedLocation);
    const targetRegionId = matchingZone?.regionId || selectedLocation;

    return allAddons.filter((b) => {
      if (b.isGlobal) return true;
      const regionIds = b.regionIds || (b.regions || []).map((r: any) => r.id);
      if (!regionIds || regionIds.length === 0) return false;
      return (
        regionIds.includes(selectedLocation) ||
        regionIds.includes(targetRegionId)
      );
    });
  }, [allAddons, selectedLocation, zones]);

  // Helper: get pricing for a single addon + multiplier
  const getAddonPricing = (addon: any, multiplier: number) => {
    const baseUnits = addon.addonIncludedUnits || addon.defaultUnits || 1;
    const totalUnits = baseUnits * multiplier;
    const unitPrice =
      addon.addonPrice !== null && addon.addonPrice !== undefined
        ? addon.addonPrice
        : (addon.unitCost || 0) * baseUnits;
    const discountPrice = addon.addonDiscountPrice || 0;
    const finalUnitPrice = discountPrice > 0 && discountPrice < unitPrice ? discountPrice : unitPrice;
    
    let gstAmount = 0;
    if (!addon.isGstExempt && addon.gstRate !== 0) {
      const rate = addon.gstRate ?? 18;
      gstAmount = finalUnitPrice * (rate / 100);
    }
    
    const priceWithGst = finalUnitPrice + gstAmount;
    
    // We can round to 2 decimal places to avoid floating point issues
    const totalAmount = Number((priceWithGst * multiplier).toFixed(2));
    
    return { baseUnits, totalUnits, unitPrice, discountPrice, finalUnitPrice, gstAmount, priceWithGst, totalAmount };
  };

  // Aggregate total pricing across all selected benefits
  const totalPricing = useMemo(() => {
    let totalAmount = 0;
    selectedBenefits.forEach((multiplier, benefitId) => {
      const addon = allAddons.find((b) => b.id === benefitId);
      if (addon) {
        totalAmount += getAddonPricing(addon, multiplier).totalAmount;
      }
    });
    return { totalAmount: Number(totalAmount.toFixed(2)) };
  }, [selectedBenefits, allAddons]);

  // Keep amountPaid in sync with total amount
  useEffect(() => {
    if (totalPricing.totalAmount > 0) {
      setAmountPaid(String(totalPricing.totalAmount));
    } else {
      setAmountPaid('');
    }
  }, [totalPricing.totalAmount]);

  // Toggle a benefit selection
  const toggleBenefit = (addonId: string) => {
    setSelectedBenefits((prev) => {
      const next = new Map(prev);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        next.set(addonId, 1);
      }
      return next;
    });
  };

  // Update multiplier for a specific benefit
  const updateMultiplier = (addonId: string, delta: number) => {
    setSelectedBenefits((prev) => {
      const next = new Map(prev);
      const current = next.get(addonId) ?? 1;
      const updated = Math.max(1, current + delta);
      next.set(addonId, updated);
      return next;
    });
  };

  const selectedCount = selectedBenefits.size;

  const handleProceedToPayment = () => {
    if (selectedCount === 0) {
      toast.error('Please select at least one add-on benefit to continue');
      return;
    }
    if (standaloneSelectMode && onSelectAddonForWizard) {
      selectedBenefits.forEach((multiplier, benefitId) => {
        const addon = allAddons.find((b) => b.id === benefitId);
        if (addon) {
          const p = getAddonPricing(addon, multiplier);
          onSelectAddonForWizard({
            benefit: addon,
            units: p.totalUnits,
            totalAmount: p.totalAmount,
          });
        }
      });
      onClose();
      return;
    }
    setModalStep('payment');
  };

  const handleCompleteAllocation = async (completedPaymentDetails?: any) => {
    if (selectedCount === 0) return;
    const targetSubId = subscriptionId || beneficiaryId;

    if (!targetSubId) {
      toast.error('No active subscription found to attach add-on');
      return;
    }

    setSubmitting(true);
    try {
      // Allocate each selected benefit sequentially
      const results: any[] = [];
      for (const [benefitId, multiplier] of selectedBenefits.entries()) {
        const addon = allAddons.find((b) => b.id === benefitId);
        if (!addon) continue;
        const p = getAddonPricing(addon, multiplier);

        const payload = {
          benefitId: addon.id,
          units: p.totalUnits,
          amountPaid: p.totalAmount,
          paymentMethod: completedPaymentDetails?.paymentMethod || (paymentMode === 'online_link' ? 'Razorpay Online' : offlineMethod),
          transactionId: completedPaymentDetails?.orderId || transactionId || undefined,
          paymentNote: paymentNote || `Add-on: ${addon.name} (${p.totalUnits} ${addon.unitLabel || 'units'})`,
        };

        const result = await subscriptionApi.allocateAddon(targetSubId, payload);
        results.push(result);
      }

      const names = [...selectedBenefits.keys()]
        .map((id) => allAddons.find((b) => b.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      toast.success(`🎉 ${selectedCount} add-on${selectedCount > 1 ? 's' : ''} (${names}) added successfully!`);

      if (onSuccess) {
        onSuccess(results);
      }
      onClose();
    } catch (err: any) {
      console.error('Addon allocation error:', err);
      toast.error(err.message || 'Failed to allocate add-on benefit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-none shadow-2xl">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-orange-500 via-[#FF7A00] to-amber-500 p-6 text-white rounded-t-3xl relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                Add-on Benefits &amp; Services
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs mt-0.5">
                {beneficiaryName ? `Assign extra care visits & services for ${beneficiaryName}` : 'Select and allocate regional or global add-ons'}
              </DialogDescription>
            </div>
          </div>

          {/* Stepper indicator if in payment step */}
          <div className="flex gap-2 mt-4">
            <div className={`h-1.5 flex-1 rounded-full ${modalStep === 'select' ? 'bg-white' : 'bg-white/40'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${modalStep === 'payment' ? 'bg-white' : 'bg-white/40'}`} />
          </div>
        </div>

        <div className="p-6 space-y-6">
          {modalStep === 'select' ? (
            <>
              {/* ── Reusable Modular Location / Google Search & Region Detector ── */}
              <LocationRegionSearch
                selectedLocationId={selectedLocation}
                regions={regions}
                zones={zones}
                defaultPincode={defaultPincode}
                onLocationChange={(locId) => setSelectedLocation(locId)}
                headerBadge={
                  <span className="text-[10px] bg-orange-100/80 text-[#FF7A00] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                    {filteredAddons.length} Add-ons available
                  </span>
                }
              />

              {/* ── Add-on Benefits List ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                    Available Add-on Benefits
                  </Label>
                  {selectedCount > 0 && (
                    <span className="text-[11px] bg-orange-100 text-[#FF7A00] font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
                      {selectedCount} selected
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
                    <span className="text-xs font-medium">Loading Add-on benefits...</span>
                  </div>
                ) : filteredAddons.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-600">No Add-on benefits configured for this location</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try selecting "All Locations" or configure add-on benefits in Master Admin &gt; Add-ons Management.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-[360px] overflow-y-auto pr-1">
                    {filteredAddons.map((addon) => {
                      const isSelected = selectedBenefits.has(addon.id);
                      const multiplier = selectedBenefits.get(addon.id) ?? 1;
                      const baseUnits = addon.addonIncludedUnits || addon.defaultUnits || 1;
                      const price =
                        addon.addonPrice !== null && addon.addonPrice !== undefined
                          ? addon.addonPrice
                          : (addon.unitCost || 0) * baseUnits;
                      const hasDiscount = addon.addonDiscountPrice && addon.addonDiscountPrice > 0 && addon.addonDiscountPrice < price;
                      const p = getAddonPricing(addon, multiplier);

                      return (
                        <div
                          key={addon.id}
                          className={`rounded-2xl border-2 transition-all overflow-hidden ${
                            isSelected
                              ? 'border-[#FF7A00] bg-orange-50/30 shadow-sm'
                              : 'border-gray-200 hover:border-orange-200 bg-white'
                          }`}
                        >
                          {/* Card Main Row */}
                          <div
                            className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                            onClick={() => toggleBenefit(addon.id)}
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected ? 'bg-[#FF7A00] text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <Activity className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-gray-800 text-sm">{addon.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[8px] uppercase px-1.5 h-4 border-none font-bold ${
                                      addon.isGlobal
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-[#FFE6D5] text-[#FF7A00]'
                                    }`}
                                  >
                                    {addon.isGlobal ? 'Global' : 'Region Based'}
                                  </Badge>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                    addon.isGstExempt || addon.gstRate === 0
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {addon.isGstExempt || addon.gstRate === 0 ? '0% GST (Exempt)' : `${addon.gstRate ?? 18}% GST`}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {addon.description || `${baseUnits} ${addon.unitLabel || 'Units'} included`}
                                </p>
                                <span className="inline-block text-[11px] font-semibold text-gray-500 mt-1">
                                  Package Base: {baseUnits} {addon.unitLabel || 'visits/units'}
                                </span>
                              </div>
                            </div>

                            <div className="text-right flex flex-col items-end flex-shrink-0">
                              {hasDiscount && (
                                <span className="text-[10px] line-through text-muted-foreground">
                                  ₹{price}
                                </span>
                              )}
                              <span className="text-base font-black text-gray-900">
                                ₹{hasDiscount ? addon.addonDiscountPrice : price}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {addon.isGstExempt || addon.gstRate === 0 ? 'GST Exempt' : `+ ${addon.gstRate ?? 18}% GST`}
                              </span>
                            </div>

                            <div className="flex-shrink-0 pl-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                                  isSelected
                                    ? 'bg-[#FF7A00] border-[#FF7A00] text-white shadow-sm'
                                    : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            </div>
                          </div>

                          {/* ── Per-Card Inline Quantity Multiplier (when selected) ── */}
                          {isSelected && (
                            <div
                              className="mx-4 mb-4 bg-white/90 border border-orange-200/80 rounded-xl p-3 flex items-center justify-between shadow-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div>
                                <Label className="text-[11px] font-bold text-gray-700 block">Quantity / Multiplier</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Total: <strong className="text-gray-900 font-bold">{p.totalUnits} {addon.unitLabel || 'units'}</strong>
                                  {' · '}
                                  <strong className="text-[#FF7A00] font-black">₹{p.totalAmount}</strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-inner">
                                <button
                                  type="button"
                                  disabled={multiplier <= 1}
                                  onClick={() => updateMultiplier(addon.id, -1)}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-200/60 shadow-xs"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-black text-sm px-2 text-gray-800 min-w-[28px] text-center">
                                  {multiplier}x
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateMultiplier(addon.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-orange-100 hover:bg-orange-200 text-[#FF7A00] flex items-center justify-center font-bold transition-colors shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Footer Total & Next ── */}
              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block">Total Amount</span>
                  <span className="text-2xl font-black text-gray-900">
                    ₹{totalPricing.totalAmount}
                  </span>
                  {selectedCount > 0 && (
                    <span className="text-[11px] font-semibold text-[#FF7A00] block mt-0.5">
                      {selectedCount} benefit{selectedCount > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleProceedToPayment}
                    disabled={selectedCount === 0}
                    className="bg-[#FF7A00] hover:bg-orange-600 text-white font-bold rounded-xl px-6"
                  >
                    Proceed to Payment →
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── Payment Step ── */}
              <div className="space-y-4">
                {/* Summary Cards for all selected benefits */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {[...selectedBenefits.entries()].map(([benefitId, multiplier]) => {
                    const addon = allAddons.find((b) => b.id === benefitId);
                    if (!addon) return null;
                    const p = getAddonPricing(addon, multiplier);
                    return (
                      <div
                        key={benefitId}
                        className="bg-orange-50/60 border border-orange-200 rounded-2xl p-3.5 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[9px] font-black uppercase text-[#FF7A00] tracking-widest block">
                            Selected Add-on
                          </span>
                          <p className="font-bold text-gray-900 text-sm">{addon.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.totalUnits} {addon.unitLabel || 'units'} · Quantity {multiplier}x
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Amount</span>
                          <span className="text-base font-black text-[#FF7A00]">₹{p.totalAmount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedCount > 1 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700">Grand Total ({selectedCount} add-ons)</span>
                    <span className="text-lg font-black text-gray-900">₹{totalPricing.totalAmount}</span>
                  </div>
                )}

                {/* Unified PaymentMethodSelector Component */}
                <PaymentMethodSelector
                  amount={totalPricing.totalAmount}
                  subscriberName={subscriberName}
                  subscriberPhone={subscriberPhone}
                  subscriberEmail={subscriberEmail}
                  packageName={`Add-on${selectedCount > 1 ? 's' : ''}: ${[...selectedBenefits.keys()].map((id) => allAddons.find((b) => b.id === id)?.name).filter(Boolean).join(', ')}`}
                  paymentMode={paymentMode}
                  onPaymentModeChange={setPaymentMode}
                  offlineMethod={offlineMethod}
                  onOfflineMethodChange={setOfflineMethod}
                  amountPaid={amountPaid}
                  onAmountPaidChange={setAmountPaid}
                  transactionId={transactionId}
                  onTransactionIdChange={setTransactionId}
                  paymentNote={paymentNote}
                  onPaymentNoteChange={setPaymentNote}
                  paymentLinkDetails={paymentLinkDetails}
                  generatingLink={generatingLink}
                  onPaymentCompleted={(completedDetails) => {
                    handleCompleteAllocation(completedDetails);
                  }}
                  onGenerateLink={async (channels) => {
                    setGeneratingLink(true);
                    try {
                      const addonItems = [...selectedBenefits.entries()].map(([benefitId, multiplier]) => {
                        const addon = allAddons.find((b) => b.id === benefitId);
                        const pricing = addon ? getAddonPricing(addon, multiplier) : null;
                        const units = pricing?.totalUnits || (multiplier * (addon?.addonIncludedUnits || 1));
                        return {
                          benefitId,
                          name: addon?.name || 'Add-on Benefit',
                          units,
                          amount: pricing?.totalAmount || 0,
                          unitPrice: pricing?.unitPrice || (addon?.addonPrice || 0),
                        };
                      });

                      const firstItem = addonItems[0];
                      const res = await paymentApi.generateLink({
                        subscriberId: subscriberId || '',
                        beneficiaryId: beneficiaryId || '',
                        subscriptionId: subscriptionId || '',
                        packageType: 'addon',
                        packageName: `Add-on: ${addonItems.map((i) => i.name).join(', ')}`,
                        amount: parseFloat(amountPaid) || totalPricing.totalAmount,
                        subscriberPhone,
                        subscriberEmail,
                        subscriberName,
                        duration: 'one_time',
                        benefitId: firstItem?.benefitId,
                        units: firstItem?.units,
                        addonItems: JSON.stringify(addonItems),
                      });
                      const data = res?.data || res;
                      if (data && (data.shortUrl || data.orderId)) {
                        setPaymentLinkDetails(data);
                        toast.success('Add-on payment link generated successfully! 🔗');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to generate payment link');
                    } finally {
                      setGeneratingLink(false);
                    }
                  }}
                />

                {/* Footer Buttons */}
                <div className="border-t pt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setModalStep('select')}
                    className="rounded-xl"
                  >
                    ← Back to Add-ons
                  </Button>
                  {paymentMode === 'offline' && (
                    <Button
                      onClick={() => handleCompleteAllocation()}
                      disabled={submitting || !amountPaid}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl px-6"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Allocating...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm &amp; Credit Units
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
