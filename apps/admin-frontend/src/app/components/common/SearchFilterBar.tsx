import React from 'react';
import { Search, X, RotateCcw, LucideIcon, Filter } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface FilterSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon | React.ReactNode;
}

export interface FilterSelectConfig {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  widthClass?: string;
  options: FilterSelectOption[];
}

export interface ActiveBadgeItem {
  id: string;
  label: string;
  value: string;
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'gray';
  onRemove?: () => void;
}

export interface SearchFilterBarProps {
  // Search Bar
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  filters?: FilterSelectConfig[];

  // Counts & Summaries
  filteredCount?: number;
  totalCount?: number;
  entityName?: string; // e.g. "packages", "benefits", "users"

  // Active Badges in Summary Bar
  activeBadges?: ActiveBadgeItem[];

  // Reset Button
  onReset?: () => void;
  showReset?: boolean;

  // Custom Extra Actions (e.g. buttons on the right)
  children?: React.ReactNode;

  className?: string;
}

/**
 * Reusable, Modular Search and Filter Bar Component
 * Used across admin tables, cards, and catalog lists.
 */
export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  filteredCount,
  totalCount,
  entityName = 'items',
  activeBadges = [],
  onReset,
  showReset = false,
  children,
  className = '',
}) => {
  const badgeColorStyles: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className={`bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3 ${className}`}>
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-10 w-full bg-gray-50/50 focus:bg-white text-sm"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer rounded-full hover:bg-gray-100 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns and Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((filter) => (
            <div key={filter.id} className={filter.widthClass || 'w-38 sm:w-44'}>
              <Select value={filter.value} onValueChange={filter.onChange}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder={filter.placeholder || 'Filter'} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* Reset Button */}
          {showReset && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset to default filters"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}

          {/* Optional Extra Elements */}
          {children}
        </div>
      </div>

      {/* Summary Row with Counts & Badges */}
      {(filteredCount !== undefined || activeBadges.length > 0 || searchValue) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {filteredCount !== undefined && totalCount !== undefined && (
              <span>
                Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> {entityName}
              </span>
            )}

            {/* Render active badges */}
            {activeBadges.map((badge) => (
              <span
                key={badge.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                  badgeColorStyles[badge.color || 'gray']
                }`}
              >
                <span>{badge.label}: <strong>{badge.value}</strong></span>
                {badge.onRemove && (
                  <button
                    type="button"
                    onClick={badge.onRemove}
                    className="hover:text-red-600 cursor-pointer ml-0.5"
                    title="Remove filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}

            {/* Search query badge */}
            {searchValue.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                <span>Query: "<strong>{searchValue}</strong>"</span>
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="hover:text-red-600 cursor-pointer ml-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface FilterEmptyStateProps {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
  icon?: LucideIcon;
}

export const FilterEmptyState: React.FC<FilterEmptyStateProps> = ({
  title = 'No items found',
  description = 'No results match the current search query or filter selection.',
  onReset,
  resetLabel = 'Reset All Filters',
  icon: Icon = Filter,
}) => {
  return (
    <div className="text-center py-12 px-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 space-y-3">
      <Icon className="w-10 h-10 text-gray-400 mx-auto" />
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">{description}</p>
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset} className="text-xs cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
};
