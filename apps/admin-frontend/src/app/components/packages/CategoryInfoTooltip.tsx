import React from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { BENEFIT_CATEGORIES_CONFIG, type BenefitTierCategory, type CategoryConfig } from './wizard/wizardTypes';

interface CategoryInfoTooltipProps {
  category: BenefitTierCategory | CategoryConfig;
  className?: string;
  iconSize?: number;
  showText?: boolean;
}

export function CategoryInfoTooltip({
  category,
  className = '',
  iconSize = 14,
  showText = false,
}: CategoryInfoTooltipProps) {
  const config =
    typeof category === 'string'
      ? BENEFIT_CATEGORIES_CONFIG.find((c) => c.id === category) || BENEFIT_CATEGORIES_CONFIG[0]
      : category;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-slate-200/60 hover:text-foreground cursor-help ${className}`}
          aria-label={`About ${config.label}`}
        >
          <Info size={iconSize} className="shrink-0" />
          {showText && <span className="text-[11px] underline">Details</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="w-80 rounded-xl border border-gray-700 bg-gray-900 p-3.5 shadow-xl text-white"
      >
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.badgeBg} border ${config.badgeBorder}`}>
            <span className={`h-2 w-2 rounded-full ${config.dotBg}`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white">{config.label}</h4>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${config.badgeBg} ${config.badgeText}`}>
                {config.tagline}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-300">
              {config.explanation}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
