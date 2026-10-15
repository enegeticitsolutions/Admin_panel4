import React, { useState } from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type { Benefit } from '../../../../types';
import { CategoryInfoTooltip } from '../CategoryInfoTooltip';
import {
  BENEFIT_CATEGORIES_CONFIG,
  type BenefitSetting,
  type BenefitTierCategory,
} from './wizardTypes';

interface Step3ConfigureUnitsProps {
  benefits: Benefit[];
  selectedBenefits: Set<string>;
  benefitConfigs: Record<string, BenefitSetting>;
  benefitUnits: Record<string, number>;
  updateBenefitSetting: (benefitId: string, partial: Partial<BenefitSetting>) => void;
}

export function Step3ConfigureUnits({
  benefits,
  selectedBenefits,
  benefitConfigs,
  benefitUnits,
  updateBenefitSetting,
}: Step3ConfigureUnitsProps) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | BenefitTierCategory>('all');

  const selectedBenefitIds = Array.from(selectedBenefits);

  // Filtered by selected category filter tab
  const filteredIds = selectedBenefitIds.filter((bId) => {
    if (activeCategoryFilter === 'all') return true;
    const cfg = benefitConfigs[bId];
    return (cfg?.category || 'included') === activeCategoryFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold mb-1">Set Allowances &amp; Categories</h2>
          <p className="text-sm text-muted-foreground">
            Configure quantity, cadence, plan tier category (Included, Member Rate / On-Demand, or We arrange it), and rollover rules.
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-slate-50 p-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              activeCategoryFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All ({selectedBenefitIds.length})
          </button>
          {BENEFIT_CATEGORIES_CONFIG.map((cat) => {
            const count = selectedBenefitIds.filter(
              (id) => (benefitConfigs[id]?.category || 'included') === cat.id
            ).length;
            const tabName = cat.id === 'addon' ? 'Member Rate' : cat.label.split('·')[0].trim();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeCategoryFilter === cat.id
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${cat.dotBg}`} />
                <span>{tabName}</span>
                <span className="text-[10px] text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-muted-foreground">
          No benefits in this category filter. Switch to "All" or change the category below.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIds.map((benefitId) => {
            const benefit = benefits.find((b) => b.id === benefitId);
            if (!benefit) return null;
            const cfg = benefitConfigs[benefitId] || {
              quantity: benefitUnits[benefitId] || 1,
              frequency: 'monthly',
              allocationBasis: 'per_billing_cycle',
              minSubscriptionMonths: 1,
              allowRollover: false,
              maxRolloverUnits: 0,
              isUnlimited: false,
              category: 'included',
            };

            const isChargeable = benefit.isChargeable !== false;
            const unitCost = isChargeable ? benefit.unitCost || 0 : 0;
            let monthlyImpact = 0;
            if (isChargeable && !cfg.isUnlimited) {
              if (cfg.frequency === 'monthly') monthlyImpact = unitCost * cfg.quantity;
              else if (cfg.frequency === 'yearly' || cfg.frequency === 'one_time')
                monthlyImpact = Math.round((unitCost * cfg.quantity) / 12);
            }

            const currentCategoryConfig =
              BENEFIT_CATEGORIES_CONFIG.find((c) => c.id === cfg.category) || BENEFIT_CATEGORIES_CONFIG[0];

            return (
              <div
                key={benefitId}
                className="p-4 border border-border rounded-xl bg-card space-y-3.5 shadow-xs transition-all hover:border-gray-300"
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base text-foreground">{benefit.name}</h3>
                      {benefit.code && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border">
                          {benefit.code}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${currentCategoryConfig.badgeBg} ${currentCategoryConfig.badgeText} border ${currentCategoryConfig.badgeBorder} flex items-center gap-1`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${currentCategoryConfig.dotBg}`} />
                        {currentCategoryConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Unit: <strong className="text-foreground">{benefit.unitLabel || 'visits'}</strong>
                      {isChargeable && unitCost ? ` • Standalone Unit Cost: ₹${unitCost}` : ' • Included (₹0)'}
                      {benefit.isGstExempt || benefit.gstRate === 0
                        ? ' • 0% GST (Exempt)'
                        : benefit.gstRate !== undefined && benefit.gstRate !== null
                        ? ` • ${benefit.gstRate}% GST`
                        : benefit.taxCategory
                        ? ` • ${benefit.taxCategory.replace(/_/g, ' ')}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Monthly Base Cost:</span>
                    <span className="text-sm font-bold text-primary">
                      {!isChargeable
                        ? 'Included (₹0)'
                        : cfg.isUnlimited
                        ? 'Unlimited (₹0)'
                        : `₹${monthlyImpact}/mo`}
                    </span>
                    {isChargeable && cfg.frequency === 'yearly' && !cfg.isUnlimited && (
                      <span className="text-[10px] text-muted-foreground block">
                        (₹{unitCost * cfg.quantity} amortized over 12m)
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid of 4 Configuration Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2.5 border-t border-dashed">
                  {/* 1. Category / Tier Selection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        Plan Category / Tier
                        <CategoryInfoTooltip category={cfg.category} iconSize={13} />
                      </Label>
                    </div>
                    <Select
                      value={cfg.category || 'included'}
                      onValueChange={(val: BenefitTierCategory) =>
                        updateBenefitSetting(benefitId, { category: val })
                      }
                    >
                      <SelectTrigger className="h-9 bg-input-background text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BENEFIT_CATEGORIES_CONFIG.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${cat.dotBg}`} />
                              <span>{cat.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {currentCategoryConfig.explanation}
                    </p>
                  </div>

                  {/* 2. Quantity / Allowance */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-800">Quantity / Allowance</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        disabled={cfg.isUnlimited}
                        value={cfg.isUnlimited ? '' : cfg.quantity}
                        onChange={(e) =>
                          updateBenefitSetting(benefitId, {
                            quantity: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="h-9 bg-input-background text-sm"
                        placeholder={cfg.isUnlimited ? 'Unlimited' : 'e.g. 10'}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {(benefit.unitLabel || '').replace(/^per\s+/i, '')}
                      </span>
                    </div>
                  </div>

                  {/* 3. Frequency / Cadence */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-800">Frequency / Cadence</Label>
                    <Select
                      value={cfg.frequency}
                      onValueChange={(val: any) => {
                        const isUnl = val === 'unlimited';
                        updateBenefitSetting(benefitId, {
                          frequency: val,
                          isUnlimited: isUnl,
                          allocationBasis: isUnl
                            ? 'per_subscription_term'
                            : val === 'yearly'
                            ? 'per_subscription_term'
                            : 'per_billing_cycle',
                          allowRollover: isUnl || val === 'yearly' ? false : cfg.allowRollover,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 bg-input-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Every Month (/month)</SelectItem>
                        <SelectItem value="3_months">Every 3 Months (/quarter)</SelectItem>
                        <SelectItem value="6_months">Every 6 Months (/half-year)</SelectItem>
                        <SelectItem value="yearly">Every Year (/year)</SelectItem>
                        <SelectItem value="one_time">One-Time / Onboarding</SelectItem>
                        <SelectItem value="unlimited">24/7 Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 4. Allocation Basis */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-800">Allocation Rule</Label>
                    <Select
                      value={cfg.allocationBasis}
                      onValueChange={(val: any) => {
                        updateBenefitSetting(benefitId, {
                          allocationBasis: val,
                          minSubscriptionMonths: val === 'min_tenure_required' ? 12 : 1,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 bg-input-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_billing_cycle">Per Billing Cycle (Refreshes monthly)</SelectItem>
                        <SelectItem value="per_subscription_term">Per Subscription Term (Fixed pool)</SelectItem>
                        <SelectItem value="min_tenure_required">Annual Only (Requires 12M Tenure)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Rollover Settings (Monthly only) */}
                {cfg.frequency === 'monthly' && !cfg.isUnlimited && (
                  <div className="flex items-center justify-between pt-2 border-t text-xs bg-slate-50 p-2.5 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`rollover-${benefitId}`}
                        checked={cfg.allowRollover}
                        onCheckedChange={(checked) =>
                          updateBenefitSetting(benefitId, { allowRollover: !!checked })
                        }
                      />
                      <Label htmlFor={`rollover-${benefitId}`} className="text-xs cursor-pointer font-medium">
                        Allow unused units to rollover to next month
                      </Label>
                    </div>
                    {cfg.allowRollover && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">Max Rollover:</span>
                        <Input
                          type="number"
                          value={cfg.maxRolloverUnits || ''}
                          onChange={(e) =>
                            updateBenefitSetting(benefitId, {
                              maxRolloverUnits: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="h-7 w-20 bg-white text-xs"
                          placeholder="Cap (e.g. 5)"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Show Unit Setting */}
                <div className="flex items-center space-x-2 pt-2 border-t text-xs px-1">
                  <Checkbox
                    id={`showUnit-${benefitId}`}
                    checked={cfg.showUnit !== false}
                    onCheckedChange={(checked) =>
                      updateBenefitSetting(benefitId, { showUnit: !!checked })
                    }
                  />
                  <Label
                    htmlFor={`showUnit-${benefitId}`}
                    className="text-xs cursor-pointer font-medium text-muted-foreground"
                  >
                    Show quantity/unit to users on mobile app and website (Uncheck to only show benefit name)
                  </Label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
