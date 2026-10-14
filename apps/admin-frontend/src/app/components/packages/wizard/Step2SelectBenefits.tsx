import React, { useMemo, useState } from 'react';
import { Search, Filter, Check, Plus, X } from 'lucide-react';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Button } from '../../ui/button';
import type { Benefit } from '../../../../types';
import {
  BENEFIT_CATEGORIES_CONFIG,
  detectDefaultBenefitCategory,
  type BenefitSetting,
} from './wizardTypes';

interface Step2SelectBenefitsProps {
  benefits: Benefit[];
  selectedBenefits: Set<string>;
  benefitConfigs: Record<string, BenefitSetting>;
  toggleBenefit: (benefitId: string) => void;
  uniqueBenefitTypes: string[];
}

export function Step2SelectBenefits({
  benefits,
  selectedBenefits,
  benefitConfigs,
  toggleBenefit,
  uniqueBenefitTypes,
}: Step2SelectBenefitsProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'selected' | 'unselected'>('all');

  // Filtered benefits list
  const filteredBenefits = useMemo(() => {
    return benefits.filter((b: any) => {
      // 1. Selection filter
      const isSelected = selectedBenefits.has(b.id);
      if (selectionFilter === 'selected' && !isSelected) return false;
      if (selectionFilter === 'unselected' && isSelected) return false;

      // 2. Category / Type filter
      if (typeFilter !== 'all') {
        const typeName = b.benefitType?.name || b.type;
        if (typeName !== typeFilter) return false;
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = (b.name || '').toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        const matchCode = (b.code || '').toLowerCase().includes(q);
        const matchType = (b.benefitType?.name || b.type || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCode && !matchType) return false;
      }

      return true;
    });
  }, [benefits, selectedBenefits, selectionFilter, typeFilter, search]);

  const selectedCount = selectedBenefits.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold mb-1">Add Benefits</h2>
          <p className="text-sm text-muted-foreground">
            Select benefits from the library to include in this package ({selectedCount} selected)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {selectedCount} Selected
          </span>
          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectionFilter(prev => prev === 'selected' ? 'all' : 'selected')}
              className="text-xs h-8 text-primary"
            >
              {selectionFilter === 'selected' ? 'Show All' : 'View Selected Only'}
            </Button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search benefits by name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white text-sm h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Benefit Type / Category Dropdown */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white h-9 text-xs">
            <SelectValue placeholder="Benefit Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Benefit Types</SelectItem>
            {uniqueBenefitTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Selection State Filter Tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectionFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectionFilter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({benefits.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectionFilter('selected')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectionFilter === 'selected'
                ? 'bg-primary text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Selected ({selectedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectionFilter('unselected')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              selectionFilter === 'unselected'
                ? 'bg-primary text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unselected ({benefits.length - selectedCount})
          </button>
        </div>
      </div>

      {/* Benefits Grid */}
      {filteredBenefits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-muted-foreground">
          No benefits match your filter or search query.
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setSelectionFilter('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[580px] overflow-y-auto pr-1">
          {filteredBenefits.map((benefit) => {
            const isSelected = selectedBenefits.has(benefit.id);
            const activeCfg = benefitConfigs[benefit.id];
            const categoryId = activeCfg?.category || detectDefaultBenefitCategory(benefit);
            const catConfig =
              BENEFIT_CATEGORIES_CONFIG.find((c) => c.id === categoryId) || BENEFIT_CATEGORIES_CONFIG[0];

            return (
              <div
                key={benefit.id}
                onClick={() => toggleBenefit(benefit.id)}
                className={`p-3.5 border-2 rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleBenefit(benefit.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground">{benefit.name}</h3>
                      {benefit.code && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded border">
                          {benefit.code}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catConfig.badgeBg} ${catConfig.badgeText} border ${catConfig.badgeBorder}`}
                        title={catConfig.explanation}
                      >
                        {catConfig.label}
                      </span>
                    </div>

                    {benefit.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {benefit.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-dashed border-gray-100 text-xs text-muted-foreground">
                  <span>
                    Default: {benefit.defaultUnits} {benefit.unitLabel}
                  </span>
                  <span className="font-medium text-foreground">
                    {benefit.isChargeable !== false && benefit.unitCost
                      ? `₹${benefit.unitCost}/${(benefit.unitLabel || '').replace(/s$/, '')}`
                      : 'Free / Included'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
