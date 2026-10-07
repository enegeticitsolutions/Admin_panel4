/**
 * Reusable Status Chip Component
 * Displays status indicators with appropriate colors
 */

import React from 'react';
import { cn } from '../ui/utils';

interface StatusChipProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
}

export function StatusChip({ status, variant = 'default', className, onClick, clickable }: StatusChipProps) {
  const variantStyles = {
    default: 'bg-secondary text-secondary-foreground border border-gray-200',
    success: 'bg-[#DFF4E6] text-[#1F8A3E] border border-emerald-300',
    warning: 'bg-[#FFF5EE] text-[#FF7A00] border border-amber-300',
    error: 'bg-rose-50 text-rose-700 border border-rose-300',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
  };

  // Auto-detect variant based on status text
  const autoVariant = (() => {
    const lowerStatus = status.toLowerCase();
    // Check inactive/disabled first before matching 'active'
    if (lowerStatus.includes('inactive') || lowerStatus.includes('deactivated') || lowerStatus.includes('disabled')) {
      return 'error';
    }
    if (lowerStatus.includes('completed') || lowerStatus.includes('verified') || lowerStatus.includes('active') || lowerStatus.includes('success')) {
      return 'success';
    }
    if (lowerStatus.includes('pending') || lowerStatus.includes('scheduled') || lowerStatus.includes('in_progress')) {
      return 'warning';
    }
    if (lowerStatus.includes('failed') || lowerStatus.includes('rejected') || lowerStatus.includes('cancelled')) {
      return 'error';
    }
    return variant;
  })();

  const isInteractive = Boolean(onClick || clickable);

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none',
          variantStyles[autoVariant],
          className
        )}
      >
        {status}
      </button>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[autoVariant],
        className
      )}
    >
      {status}
    </span>
  );
}
