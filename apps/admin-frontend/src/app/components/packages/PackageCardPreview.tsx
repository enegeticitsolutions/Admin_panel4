import React, { useState } from 'react';
import { ChevronDown, Sparkles, Eye, EyeOff } from 'lucide-react';
import PackageCard from './PackageCard';
import PlanDetailsModal from './PlanDetailsModal';

interface PackageCardPreviewProps {
  packageName: string;
  description: string;
  finalBasePrice: number;
  isFreeTrial: boolean;
  trialDurationDays: string;
  isGlobal: boolean;
  isPopular: boolean;
  packageBenefits: any[];
}

export function PackageCardPreview({
  packageName,
  description,
  finalBasePrice,
  isFreeTrial,
  trialDurationDays,
  isGlobal,
  isPopular,
  packageBenefits,
}: PackageCardPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSelected, setIsSelected] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<any>(null);

  const plan = {
    name: packageName || 'Untitled Package',
    description: description || 'Care Mitra visits & family connectivity',
    basePrice: finalBasePrice,
    isFreeTrial: isFreeTrial,
    trialDurationDays: parseInt(trialDurationDays) || 7,
    isGlobal: isGlobal,
    isPopular: isPopular,
    features: [],
    packageBenefits: packageBenefits,
  };

  const handleOpenDetails = (planForCheckout: any) => {
    setModalPlan(planForCheckout || plan);
    setIsModalOpen(true);
  };

  return (
    <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200">
      {/* Collapsible Accordion Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between p-4 bg-gray-50/75 hover:bg-gray-100/80 transition-colors text-left focus:outline-none"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">
                Live Website Card & Modal Preview
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                Website Clone
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isExpanded
                ? 'Showing live preview (click to collapse and save vertical space)'
                : 'Click to expand live website card & test the "Read more" details modal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 hidden sm:inline-flex items-center gap-1.5">
            {isExpanded ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Collapse
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Expand Preview
              </>
            )}
          </span>
          <div className="p-1 rounded-md hover:bg-gray-200/60 text-gray-500 transition-colors">
            <ChevronDown
              className={`w-5 h-5 transition-transform duration-300 ${
                isExpanded ? 'rotate-180 text-purple-700' : 'rotate-0'
              }`}
            />
          </div>
        </div>
      </button>

      {/* Expandable Preview Body */}
      {isExpanded && (
        <div className="p-6 border-t border-gray-200 bg-gray-50/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span>Tip: Click card to toggle selection state</span>
            <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/50">
              Interactive Preview Active
            </span>
          </div>

          <div className="flex justify-center p-6 bg-slate-100/70 rounded-2xl border border-gray-200 shadow-inner">
            <div className="w-full max-w-[380px] bg-white rounded-[22px]">
              <PackageCard
                plan={plan}
                selectedCycle="3"
                isSelected={isSelected}
                onCardClick={() => setIsSelected(prev => !prev)}
                onOpenDetails={handleOpenDetails}
              />
            </div>
          </div>
        </div>
      )}

      {/* 1:1 Live Website Plan Details Modal (Pops up when "Read more" is clicked) */}
      <PlanDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        plan={modalPlan || plan}
        selectedCycle="3"
      />
    </div>
  );
}
