import React from 'react';
import { Globe, Lock, Package, Sparkles } from 'lucide-react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { RegionSelector } from '../../common/RegionSelector';
import { PackageCardPreview } from '../PackageCardPreview';
import { CategorizedBenefitsList, type CategorizedBenefitItem } from '../CategorizedBenefitsList';
import type { Benefit } from '../../../../types';
import type { BenefitSetting } from './wizardTypes';

interface Step4ReviewPackageProps {
  packageName: string;
  description: string;
  benefitSubtotal: number;
  miscellaneousCost: string;
  discountPercentage: string;
  setDiscountPercentage: (val: string) => void;
  discountThreeMonths: string;
  setDiscountThreeMonths: (val: string) => void;
  discountSixMonths: string;
  setDiscountSixMonths: (val: string) => void;
  discountAnnual: string;
  setDiscountAnnual: (val: string) => void;
  totalCost: string;
  setTotalCost: (val: string) => void;
  priceThreeMonths: string;
  setPriceThreeMonths: (val: string) => void;
  priceSixMonths: string;
  setPriceSixMonths: (val: string) => void;
  priceTwelveMonths: string;
  setPriceTwelveMonths: (val: string) => void;
  isManualPrice: boolean;
  setIsManualPrice: (val: boolean) => void;
  isManualPriceThree: boolean;
  setIsManualPriceThree: (val: boolean) => void;
  isManualPriceSix: boolean;
  setIsManualPriceSix: (val: boolean) => void;
  isManualPriceTwelve: boolean;
  setIsManualPriceTwelve: (val: boolean) => void;
  calculatedPriceOne: number;
  calculatedPriceThree: number;
  calculatedPriceSix: number;
  calculatedPriceTwelve: number;
  isPriceOneOverridden: boolean;
  isPriceThreeOverridden: boolean;
  isPriceSixOverridden: boolean;
  isPriceTwelveOverridden: boolean;
  isGlobal: boolean;
  setIsGlobal: (val: boolean) => void;
  isPopular: boolean;
  setIsPopular: (val: boolean) => void;
  isCompared: boolean;
  setIsCompared: (val: boolean) => void;
  isFreeTrial: boolean;
  trialDurationDays: string;
  selectedRegionIds: string[];
  setSelectedRegionIds: (val: string[]) => void;
  regions: any[];
  selectedBenefits: Set<string>;
  benefits: Benefit[];
  benefitConfigs: Record<string, BenefitSetting>;
  benefitUnits: Record<string, number>;
}

export function Step4ReviewPackage({
  packageName,
  description,
  benefitSubtotal,
  miscellaneousCost,
  discountPercentage,
  setDiscountPercentage,
  discountThreeMonths,
  setDiscountThreeMonths,
  discountSixMonths,
  setDiscountSixMonths,
  discountAnnual,
  setDiscountAnnual,
  totalCost,
  setTotalCost,
  priceThreeMonths,
  setPriceThreeMonths,
  priceSixMonths,
  setPriceSixMonths,
  priceTwelveMonths,
  setPriceTwelveMonths,
  isManualPrice,
  setIsManualPrice,
  isManualPriceThree,
  setIsManualPriceThree,
  isManualPriceSix,
  setIsManualPriceSix,
  isManualPriceTwelve,
  setIsManualPriceTwelve,
  calculatedPriceOne,
  calculatedPriceThree,
  calculatedPriceSix,
  calculatedPriceTwelve,
  isPriceOneOverridden,
  isPriceThreeOverridden,
  isPriceSixOverridden,
  isPriceTwelveOverridden,
  isGlobal,
  setIsGlobal,
  isPopular,
  setIsPopular,
  isCompared,
  setIsCompared,
  isFreeTrial,
  trialDurationDays,
  selectedRegionIds,
  setSelectedRegionIds,
  regions,
  selectedBenefits,
  benefits,
  benefitConfigs,
  benefitUnits,
}: Step4ReviewPackageProps) {
  // Format items for CategorizedBenefitsList
  const reviewItems: CategorizedBenefitItem[] = Array.from(selectedBenefits).map((bId) => {
    const benefit = benefits.find((b) => b.id === bId);
    const cfg = benefitConfigs[bId] || {
      quantity: benefitUnits[bId] || 1,
      frequency: 'monthly',
      allocationBasis: 'per_billing_cycle',
      minSubscriptionMonths: 1,
      allowRollover: false,
      maxRolloverUnits: 0,
      isUnlimited: false,
      category: 'included',
      showUnit: true,
    };

    return {
      id: bId,
      name: benefit?.name || 'Benefit',
      category: cfg.category || 'included',
      code: benefit?.code,
      description: benefit?.description,
      quantity: cfg.quantity,
      unitLabel: benefit?.unitLabel,
      frequency: cfg.frequency,
      allowRollover: cfg.allowRollover,
      maxRolloverUnits: cfg.maxRolloverUnits,
      isUnlimited: cfg.isUnlimited,
      showUnit: cfg.showUnit,
      isChargeable: benefit?.isChargeable,
      unitCost: benefit?.unitCost,
      gstRate: benefit?.gstRate,
      isGstExempt: benefit?.isGstExempt,
      taxCategory: benefit?.taxCategory,
      allocationBasis: cfg.allocationBasis,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold mb-1">Review Package</h2>
          <p className="text-sm text-muted-foreground">Review plan tiers, pricing, and live website preview</p>
        </div>
        <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">
          <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">Live Website Preview</p>
          <p className="text-xs text-orange-700">Scroll down to see exactly how this card looks on the website!</p>
        </div>
      </div>

      {/* Visibility, Scope, and Badges */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="space-y-3 p-4 bg-orange-50/60 border border-orange-200 rounded-xl">
          <Label className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-orange-600" />
            Package Visibility &amp; Scope
          </Label>
          <p className="text-xs text-gray-600">
            Choose whether this package appears publicly on the website or stays private for admin-only enrollment.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsGlobal(true);
                setSelectedRegionIds([]);
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                isGlobal
                  ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900 mb-1">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                Global
              </div>
              <p className="text-[11px] text-gray-600 leading-tight">
                Visible to all visitors across all regions on website &amp; app.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsGlobal(false);
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                !isGlobal && selectedRegionIds.length > 0
                  ? 'bg-purple-50/90 border-purple-500 shadow-sm ring-1 ring-purple-500'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900 mb-1">
                <Package className="w-3.5 h-3.5 text-purple-600" />
                Regional
              </div>
              <p className="text-[11px] text-gray-600 leading-tight">
                Visible only to users in specific targeted regions.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsGlobal(false);
                setSelectedRegionIds([]);
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                !isGlobal && selectedRegionIds.length === 0
                  ? 'bg-amber-50/90 border-amber-500 shadow-sm ring-1 ring-amber-500'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 mb-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Private
              </div>
              <p className="text-[11px] text-gray-600 leading-tight">
                Hidden from website. Offline/admin manual assignment only.
              </p>
            </button>
          </div>

          {!isGlobal && selectedRegionIds.length === 0 && (
            <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-950 text-xs flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Private Package Configured:</span>
                This package is set to <strong>Private</strong>. It will NOT appear on the public website (maihoonna.in/plans) by default. It can be enrolled manually by administrators.
              </div>
            </div>
          )}

          {!isGlobal && (
            <div className="pt-2">
              <RegionSelector
                isGlobal={false}
                setIsGlobal={(val) => {
                  if (val) {
                    setIsGlobal(true);
                    setSelectedRegionIds([]);
                  }
                }}
                selectedRegionIds={selectedRegionIds}
                setSelectedRegionIds={setSelectedRegionIds}
                regions={regions}
                title="Target Regions (Select 1 or more for Regional, or leave empty for Private)"
                description="Select the specific regions where this plan is offered."
              />
            </div>
          )}
        </div>

        {/* Most Popular & Comparison Flags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <Checkbox
              id="isPopular"
              checked={isPopular}
              onCheckedChange={(val) => setIsPopular(!!val)}
            />
            <div className="space-y-0.5 leading-none">
              <Label htmlFor="isPopular" className="font-semibold text-orange-900 cursor-pointer text-sm">
                Mark as "Most Popular"
              </Label>
              <p className="text-xs text-orange-700">
                Highlighted with badge on mobile app &amp; website.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <Checkbox
              id="isCompared"
              checked={isCompared}
              onCheckedChange={(val) => setIsCompared(!!val)}
            />
            <div className="space-y-0.5 leading-none">
              <Label htmlFor="isCompared" className="font-semibold text-orange-900 cursor-pointer text-sm">
                Include in Comparison Table
              </Label>
              <p className="text-xs text-orange-700">
                Featured side-by-side in Comparison Table on website.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Matrix */}
      <div className="p-5 bg-white border border-orange-200 rounded-xl shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{packageName || 'Untitled Package'}</h3>
            <p className="text-xs text-gray-500">{description || 'No overview provided'}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500">Original Benefit Cost:</span>
            <span className="ml-1.5 font-bold text-gray-800">₹{benefitSubtotal}</span>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-xs text-gray-500">Misc:</span>
            <span className="ml-1.5 font-bold text-gray-800">₹{miscellaneousCost}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-orange-950 flex items-center gap-2">
              <span>Duration Pricing &amp; Discount Overrides</span>
              <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-semibold">
                Saved to DB
              </span>
            </h4>
            <span className="text-xs text-gray-500 italic">Adjust discounts (%) or type custom final prices (₹)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1 Month Option */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-gray-800">1 Month (Default)</span>
                <span className="text-[10px] text-gray-500">Base</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-600">Discount (%)</Label>
                <Input
                  type="number"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                  className="h-8 text-xs bg-white"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-bold text-gray-700">Final Price (₹)</Label>
                  {isPriceOneOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPrice(false);
                        setTotalCost(String(calculatedPriceOne));
                      }}
                      className="text-[10px] text-orange-600 underline font-semibold cursor-pointer hover:text-orange-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={totalCost}
                  onChange={(e) => {
                    setTotalCost(e.target.value);
                    setIsManualPrice(true);
                  }}
                  className={`h-9 font-bold text-sm ${
                    isPriceOneOverridden ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-white text-primary'
                  }`}
                />
              </div>
              <div className="text-[10px] text-gray-500 pt-1 border-t flex justify-between">
                <span>Monthly Rate:</span>
                <span className="font-bold text-gray-800">₹{totalCost}/mo</span>
              </div>
            </div>

            {/* 3 Months Option */}
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-orange-950">3 Months</span>
                <span className="text-[10px] text-orange-700 font-semibold">Quarterly</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-600">Discount (%)</Label>
                <Input
                  type="number"
                  value={discountThreeMonths}
                  onChange={(e) => setDiscountThreeMonths(e.target.value)}
                  className="h-8 text-xs bg-white"
                  placeholder="5"
                />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-bold text-gray-700">Final Price (₹)</Label>
                  {isPriceThreeOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPriceThree(false);
                        setPriceThreeMonths(String(calculatedPriceThree));
                      }}
                      className="text-[10px] text-orange-600 underline font-semibold cursor-pointer hover:text-orange-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={priceThreeMonths}
                  onChange={(e) => {
                    setPriceThreeMonths(e.target.value);
                    setIsManualPriceThree(true);
                  }}
                  className={`h-9 font-bold text-sm ${
                    isPriceThreeOverridden
                      ? 'bg-orange-100 text-orange-800 border-orange-400'
                      : 'bg-white text-orange-950'
                  }`}
                />
              </div>
              <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                <span>
                  Monthly Eq: <strong>₹{Math.round((parseFloat(priceThreeMonths) || calculatedPriceThree) / 3)}/mo</strong>
                </span>
              </div>
            </div>

            {/* 6 Months Option */}
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-orange-950">6 Months</span>
                <span className="text-[10px] text-orange-700 font-semibold">Half-Yearly</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-600">Discount (%)</Label>
                <Input
                  type="number"
                  value={discountSixMonths}
                  onChange={(e) => setDiscountSixMonths(e.target.value)}
                  className="h-8 text-xs bg-white"
                  placeholder="10"
                />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-bold text-gray-700">Final Price (₹)</Label>
                  {isPriceSixOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPriceSix(false);
                        setPriceSixMonths(String(calculatedPriceSix));
                      }}
                      className="text-[10px] text-orange-600 underline font-semibold cursor-pointer hover:text-orange-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={priceSixMonths}
                  onChange={(e) => {
                    setPriceSixMonths(e.target.value);
                    setIsManualPriceSix(true);
                  }}
                  className={`h-9 font-bold text-sm ${
                    isPriceSixOverridden
                      ? 'bg-orange-100 text-orange-800 border-orange-400'
                      : 'bg-white text-orange-950'
                  }`}
                />
              </div>
              <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                <span>
                  Monthly Eq: <strong>₹{Math.round((parseFloat(priceSixMonths) || calculatedPriceSix) / 6)}/mo</strong>
                </span>
              </div>
            </div>

            {/* 12 Months Option */}
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-orange-950">12 Months (Annual)</span>
                <span className="text-[10px] text-orange-700 font-semibold">Yearly</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-gray-600">Discount (%)</Label>
                <Input
                  type="number"
                  value={discountAnnual}
                  onChange={(e) => setDiscountAnnual(e.target.value)}
                  className="h-8 text-xs bg-white"
                  placeholder="20"
                />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-bold text-gray-700">Final Price (₹)</Label>
                  {isPriceTwelveOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualPriceTwelve(false);
                        setPriceTwelveMonths(String(calculatedPriceTwelve));
                      }}
                      className="text-[10px] text-orange-600 underline font-semibold cursor-pointer hover:text-orange-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  value={priceTwelveMonths}
                  onChange={(e) => {
                    setPriceTwelveMonths(e.target.value);
                    setIsManualPriceTwelve(true);
                  }}
                  className={`h-9 font-bold text-sm ${
                    isPriceTwelveOverridden
                      ? 'bg-orange-100 text-orange-800 border-orange-400'
                      : 'bg-white text-orange-950'
                  }`}
                />
              </div>
              <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                <span>
                  Monthly Eq: <strong>₹{Math.round((parseFloat(priceTwelveMonths) || calculatedPriceTwelve) / 12)}/mo</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categorized Benefits Sections with Info Buttons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-bold text-gray-900">
            Categorized Benefits &amp; Allowances:
          </h4>
          <span className="text-xs text-muted-foreground">
            Grouped into Included, Add-on · Member rate, and Facilitated Partner Services
          </span>
        </div>

        <CategorizedBenefitsList items={reviewItems} variant="review" />
      </div>

      {/* Live Website Card & Modal Preview */}
      <PackageCardPreview
        packageName={packageName}
        description={description}
        finalBasePrice={isManualPrice ? parseFloat(totalCost) || 0 : calculatedPriceOne}
        isFreeTrial={isFreeTrial}
        trialDurationDays={trialDurationDays}
        isGlobal={isGlobal}
        isPopular={isPopular}
        packageBenefits={Array.from(selectedBenefits).map((benefitId) => {
          const benefit = benefits.find((b) => b.id === benefitId);
          const cfg = benefitConfigs[benefitId];
          return {
            category: cfg?.category || 'included',
            benefit: {
              name: benefit?.name || '',
              unitLabel: benefit?.unitLabel || '',
              description: benefit?.description || '',
              code: benefit?.code || '',
            },
            showUnit: cfg?.showUnit !== undefined ? cfg.showUnit : true,
            isUnlimited: cfg?.isUnlimited || false,
            unitsIncluded: cfg?.quantity || 0,
            unitsPeriod: cfg?.frequency || 'monthly',
            allowRollover: cfg?.allowRollover || false,
          };
        })}
      />
    </div>
  );
}
