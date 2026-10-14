import React from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';

interface Step1DefinePackageProps {
  packageName: string;
  setPackageName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  discountPercentage: string;
  setDiscountPercentage: (val: string) => void;
  miscellaneousCost: string;
  setMiscellaneousCost: (val: string) => void;
  discountThreeMonths: string;
  setDiscountThreeMonths: (val: string) => void;
  discountSixMonths: string;
  setDiscountSixMonths: (val: string) => void;
  discountAnnual: string;
  setDiscountAnnual: (val: string) => void;
  mrp: string;
  totalCost: string;
  setTotalCost: (val: string) => void;
  isManualPrice: boolean;
  setIsManualPrice: (val: boolean) => void;
  benefitSubtotal: number;
  calculatedPriceOne: number;
  activeFrom: string;
  setActiveFrom: (val: string) => void;
  activeTo: string;
  setActiveTo: (val: string) => void;
  isFreeTrial: boolean;
  setIsFreeTrial: (val: boolean) => void;
  trialDurationDays: string;
  setTrialDurationDays: (val: string) => void;
}

export function Step1DefinePackage({
  packageName,
  setPackageName,
  description,
  setDescription,
  discountPercentage,
  setDiscountPercentage,
  miscellaneousCost,
  setMiscellaneousCost,
  discountThreeMonths,
  setDiscountThreeMonths,
  discountSixMonths,
  setDiscountSixMonths,
  discountAnnual,
  setDiscountAnnual,
  mrp,
  totalCost,
  setTotalCost,
  isManualPrice,
  setIsManualPrice,
  benefitSubtotal,
  calculatedPriceOne,
  activeFrom,
  setActiveFrom,
  activeTo,
  setActiveTo,
  isFreeTrial,
  setIsFreeTrial,
  trialDurationDays,
  setTrialDurationDays,
}: Step1DefinePackageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Define Package</h2>
        <p className="text-sm text-muted-foreground">Enter basic package information, duration pricing, and dates</p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="packageName">Package Name</Label>
          <Input
            id="packageName"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="e.g., Essential Care Package"
            className="bg-input-background"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="description">Package Overview (Bio)</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the plan benefits and target audience..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Discount & Misc */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="discount">Benefits Discount (%)</Label>
            <Input
              id="discount"
              type="number"
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
              placeholder="e.g., 20"
              className="bg-input-background"
            />
            <p className="text-[10px] text-muted-foreground">Applies to ₹{benefitSubtotal} (Benefit Total)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="misc">Miscellaneous Cost (₹)</Label>
            <Input
              id="misc"
              type="number"
              value={miscellaneousCost}
              onChange={(e) => setMiscellaneousCost(e.target.value)}
              placeholder="e.g., 500"
              className="bg-input-background"
            />
            <p className="text-[10px] text-muted-foreground">Non-discountable extra platform / admin costs</p>
          </div>
        </div>

        {/* Trial Package Toggle */}
        <div
          className={`p-4 border rounded-lg space-y-3 transition-colors ${
            isFreeTrial ? 'border-purple-300 bg-purple-50/60' : 'border-dashed border-gray-300 bg-gray-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                id="isFreeTrial"
                checked={isFreeTrial}
                onCheckedChange={(val) => setIsFreeTrial(!!val)}
              />
              <div>
                <Label htmlFor="isFreeTrial" className="font-bold text-purple-900 cursor-pointer text-sm">
                  🧪 Trial Package
                </Label>
                <p className="text-xs text-purple-700 mt-0.5">
                  Fixed-day access (e.g. 7-day trial). Duration pricing matrix is hidden for trial packages.
                </p>
              </div>
            </div>
            {isFreeTrial && (
              <div className="flex items-center gap-2">
                <Label htmlFor="trialDays" className="text-xs font-semibold text-purple-900 whitespace-nowrap">
                  Duration (days):
                </Label>
                <Input
                  id="trialDays"
                  type="number"
                  min="1"
                  max="365"
                  value={trialDurationDays}
                  onChange={(e) => setTrialDurationDays(e.target.value)}
                  className="w-20 h-9 text-sm bg-white border-purple-300 text-purple-900 font-bold"
                  placeholder="7"
                />
                <span className="text-xs text-purple-700 font-semibold">days</span>
              </div>
            )}
          </div>
        </div>

        {/* Duration Discounts Matrix */}
        <div
          className={`p-4 border border-orange-200 rounded-lg bg-orange-50/40 space-y-3 transition-all ${
            isFreeTrial ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <div className="flex justify-between items-center">
            <Label className="text-sm font-semibold text-orange-950">
              Duration Discounts &amp; Pricing (3, 6, 12 Months)
            </Label>
            <span className="text-[11px] text-orange-700 font-medium">
              {isFreeTrial ? 'Disabled for trial packages' : 'Saved to DB & accessible across apps'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="disc3" className="text-xs">
                3 Months Discount (%)
              </Label>
              <Input
                id="disc3"
                type="number"
                value={discountThreeMonths}
                onChange={(e) => setDiscountThreeMonths(e.target.value)}
                placeholder="5"
                className="bg-white text-xs h-9"
              />
              <p className="text-[11px] font-semibold text-orange-800 mt-1">
                3 Mo Price: ₹
                {Math.round(
                  benefitSubtotal * 3 * (1 - (parseFloat(discountThreeMonths) || 0) / 100) +
                    (parseFloat(miscellaneousCost) || 0) * 3
                )}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="disc6" className="text-xs">
                6 Months Discount (%)
              </Label>
              <Input
                id="disc6"
                type="number"
                value={discountSixMonths}
                onChange={(e) => setDiscountSixMonths(e.target.value)}
                placeholder="10"
                className="bg-white text-xs h-9"
              />
              <p className="text-[11px] font-semibold text-orange-800 mt-1">
                6 Mo Price: ₹
                {Math.round(
                  benefitSubtotal * 6 * (1 - (parseFloat(discountSixMonths) || 0) / 100) +
                    (parseFloat(miscellaneousCost) || 0) * 6
                )}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="disc12" className="text-xs">
                12 Months (Annual) Discount (%)
              </Label>
              <Input
                id="disc12"
                type="number"
                value={discountAnnual}
                onChange={(e) => setDiscountAnnual(e.target.value)}
                placeholder="20"
                className="bg-white text-xs h-9"
              />
              <p className="text-[11px] font-semibold text-orange-800 mt-1">
                12 Mo Price: ₹
                {Math.round(
                  benefitSubtotal * 12 * (1 - (parseFloat(discountAnnual) || 0) / 100) +
                    (parseFloat(miscellaneousCost) || 0) * 12
                )}
              </p>
            </div>
          </div>
        </div>

        {/* MRP & Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mrp">Total MRP (₹)</Label>
            <Input id="mrp" disabled value={mrp} className="bg-secondary/50 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Final 1-Month Price (₹)</Label>
            <div className="flex gap-2">
              <Input
                id="cost"
                type="number"
                value={totalCost}
                onChange={(e) => {
                  setTotalCost(e.target.value);
                  setIsManualPrice(true);
                }}
                className={`font-bold border-primary/20 ${
                  isManualPrice ? 'bg-orange-50 text-orange-700' : 'bg-input-background text-primary'
                }`}
                placeholder="Set final cost..."
              />
              {isManualPrice && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsManualPrice(false);
                    setTotalCost(String(calculatedPriceOne));
                  }}
                  className="text-[10px] h-10"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Active Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="activeFrom">Active From</Label>
            <Input
              id="activeFrom"
              type="date"
              value={activeFrom}
              onChange={(e) => setActiveFrom(e.target.value)}
              className="bg-input-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activeTo">Active To</Label>
            <Input
              id="activeTo"
              type="date"
              value={activeTo}
              onChange={(e) => setActiveTo(e.target.value)}
              className="bg-input-background"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
