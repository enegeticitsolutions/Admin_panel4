import React from 'react';
import { Check, Info } from 'lucide-react';
import { CategoryInfoTooltip } from './CategoryInfoTooltip';
import {
  BENEFIT_CATEGORIES_CONFIG,
  type BenefitTierCategory,
  type CategoryConfig,
} from './wizard/wizardTypes';

export interface CategorizedBenefitItem {
  id: string;
  name: string;
  category: BenefitTierCategory;
  formattedText?: string;
  code?: string;
  description?: string;
  quantity?: number;
  unitLabel?: string;
  frequency?: string;
  allowRollover?: boolean;
  maxRolloverUnits?: number;
  isUnlimited?: boolean;
  showUnit?: boolean;
  isChargeable?: boolean;
  unitCost?: number;
  gstRate?: number | null;
  isGstExempt?: boolean;
  taxCategory?: string;
  allocationBasis?: string;
}

interface CategorizedBenefitsListProps {
  items: CategorizedBenefitItem[];
  variant?: 'modal' | 'review' | 'compact';
  emptyMessage?: string;
  className?: string;
}

export function CategorizedBenefitsList({
  items,
  variant = 'review',
  emptyMessage = 'No benefits assigned yet.',
  className = '',
}: CategorizedBenefitsListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // Group items by category according to BENEFIT_CATEGORIES_CONFIG order
  const grouped = BENEFIT_CATEGORIES_CONFIG.map((config) => {
    const categoryItems = items.filter((item) => (item.category || 'included') === config.id);
    return {
      config,
      items: categoryItems,
    };
  }).filter((group) => group.items.length > 0);

  return (
    <div className={`space-y-5 ${className}`}>
      {grouped.map(({ config, items: groupItems }) => {
        return (
          <div
            key={config.id}
            className="rounded-xl border border-border bg-card overflow-hidden shadow-xs transition-all"
          >
            {/* Category Header with (i) Info Tooltip */}
            <div className={`flex items-center justify-between px-4 py-3 ${config.headerBg} border-b border-border/80`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${config.dotBg}`} />
                <h4 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                  {config.label}
                  <CategoryInfoTooltip category={config} iconSize={15} />
                </h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder}`}>
                  {config.tagline}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-500">
                {groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Inclusions List for this Category */}
            <div className="divide-y divide-gray-100 bg-white">
              {groupItems.map((item) => {
                const unitClean = (item.unitLabel || '').replace(/^per\s+/i, '');
                let freqLabel = 'Every Month';
                if (item.frequency === 'yearly') {
                  freqLabel = item.allocationBasis === 'min_tenure_required' ? 'Annual Only (12M)' : 'Every Year';
                } else if (item.frequency === '3_months') {
                  freqLabel = 'Quarterly';
                } else if (item.frequency === '6_months') {
                  freqLabel = 'Half-Yearly';
                } else if (item.frequency === 'one_time') {
                  freqLabel = 'One-Time Onboarding';
                } else if (item.frequency === 'unlimited') {
                  freqLabel = '24/7 Unlimited';
                }

                if (variant === 'modal') {
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check size={13} strokeWidth={2.8} />
                      </div>
                      <div className="flex-1 text-sm text-gray-800 leading-snug">
                        {item.formattedText || item.name}
                        {item.allowRollover && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Rollover Included
                          </span>
                        )}
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Review variant for Product Factory Wizard
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{item.name}</span>
                        {item.code && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border">
                            {item.code}
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                          {freqLabel}
                        </span>
                        {item.allowRollover && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Rollover {item.maxRolloverUnits ? `(max ${item.maxRolloverUnits})` : 'allowed'}
                          </span>
                        )}
                        {item.showUnit === false && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Units hidden for users
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.isGstExempt || item.gstRate === 0
                          ? 'GST Exempt (0%)'
                          : `${item.gstRate ?? 18}% GST${item.taxCategory ? ` • ${item.taxCategory.replace(/_/g, ' ')}` : ''}`}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="font-bold text-sm text-foreground">
                        {item.isUnlimited ? 'Unlimited' : `${item.quantity ?? 1} ${unitClean}`}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {item.frequency === 'monthly'
                          ? '/month'
                          : item.frequency === 'yearly'
                          ? '/year'
                          : item.frequency === '3_months'
                          ? '/quarter'
                          : item.frequency === '6_months'
                          ? '/half-year'
                          : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
