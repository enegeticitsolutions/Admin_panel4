import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { ArrowLeft, ArrowRight, Check, Copy, Package, Plus } from 'lucide-react';
import type { Benefit } from '../../../../types';
import type { BenefitSetting, WizardStep } from './wizardTypes';
import { Step1DefinePackage } from './Step1DefinePackage';
import { Step2SelectBenefits } from './Step2SelectBenefits';
import { Step3ConfigureUnits } from './Step3ConfigureUnits';
import { Step4ReviewPackage } from './Step4ReviewPackage';

interface PackageWizardProps {
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  clonedFromPackageName: string | null;
  editingPackageId: string | null;
  onResetWizard: () => void;
  onPublish: () => Promise<void>;

  // Step 1 props
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

  // Step 2 & 3 props
  benefits: Benefit[];
  selectedBenefits: Set<string>;
  toggleBenefit: (benefitId: string) => void;
  uniqueBenefitTypes: string[];
  benefitConfigs: Record<string, BenefitSetting>;
  benefitUnits: Record<string, number>;
  updateBenefitSetting: (benefitId: string, partial: Partial<BenefitSetting>) => void;

  // Step 4 props
  priceThreeMonths: string;
  setPriceThreeMonths: (val: string) => void;
  priceSixMonths: string;
  setPriceSixMonths: (val: string) => void;
  priceTwelveMonths: string;
  setPriceTwelveMonths: (val: string) => void;
  isManualPriceThree: boolean;
  setIsManualPriceThree: (val: boolean) => void;
  isManualPriceSix: boolean;
  setIsManualPriceSix: (val: boolean) => void;
  isManualPriceTwelve: boolean;
  setIsManualPriceTwelve: (val: boolean) => void;
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
  selectedRegionIds: string[];
  setSelectedRegionIds: (val: string[]) => void;
  regions: any[];
}

export function PackageWizard(props: PackageWizardProps) {
  const steps: { id: WizardStep; label: string; icon: any }[] = [
    { id: 'define', label: 'Define Package', icon: Package },
    { id: 'benefits', label: 'Add Benefits', icon: Plus },
    { id: 'units', label: 'Set Units', icon: Check },
    { id: 'review', label: 'Review', icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === props.currentStep);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Wizard Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === props.currentStep;
            const isCompleted = index < currentStepIndex;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCompleted
                        ? 'border-[#1F8A3E] bg-[#DFF4E6] text-success-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs mt-1 font-medium">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-20 mx-2 ${
                      isCompleted ? 'bg-[#1F8A3E]' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Card Content */}
      <Card>
        <CardContent className="p-6">
          {/* Draft Clone Notification */}
          {props.clonedFromPackageName && (
            <div className="mb-6 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-blue-900">
                    Deriving New Package from "{props.clonedFromPackageName}"
                  </p>
                  <p className="text-blue-600 text-[11px]">
                    All benefits, duration pricing, and configurations have been duplicated. You can modify anything and publish as a new package.
                  </p>
                </div>
              </div>
              <span className="font-bold text-blue-700 bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-xs flex-shrink-0">
                Draft Clone
              </span>
            </div>
          )}

          {/* Edit Mode Notification */}
          {props.editingPackageId && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-amber-900">Editing Package</p>
                <p className="text-amber-700 text-[11px]">
                  Changes will directly update the existing active package upon publishing.
                </p>
              </div>
              <span className="font-bold text-amber-700 bg-white px-2.5 py-1 rounded-md border border-amber-200 shadow-xs flex-shrink-0">
                Edit Mode
              </span>
            </div>
          )}

          {/* Step 1: Define Package */}
          {props.currentStep === 'define' && (
            <Step1DefinePackage
              packageName={props.packageName}
              setPackageName={props.setPackageName}
              description={props.description}
              setDescription={props.setDescription}
              discountPercentage={props.discountPercentage}
              setDiscountPercentage={props.setDiscountPercentage}
              miscellaneousCost={props.miscellaneousCost}
              setMiscellaneousCost={props.setMiscellaneousCost}
              discountThreeMonths={props.discountThreeMonths}
              setDiscountThreeMonths={props.setDiscountThreeMonths}
              discountSixMonths={props.discountSixMonths}
              setDiscountSixMonths={props.setDiscountSixMonths}
              discountAnnual={props.discountAnnual}
              setDiscountAnnual={props.setDiscountAnnual}
              mrp={props.mrp}
              totalCost={props.totalCost}
              setTotalCost={props.setTotalCost}
              isManualPrice={props.isManualPrice}
              setIsManualPrice={props.setIsManualPrice}
              benefitSubtotal={props.benefitSubtotal}
              calculatedPriceOne={props.calculatedPriceOne}
              activeFrom={props.activeFrom}
              setActiveFrom={props.setActiveFrom}
              activeTo={props.activeTo}
              setActiveTo={props.setActiveTo}
              isFreeTrial={props.isFreeTrial}
              setIsFreeTrial={props.setIsFreeTrial}
              trialDurationDays={props.trialDurationDays}
              setTrialDurationDays={props.setTrialDurationDays}
            />
          )}

          {/* Step 2: Add Benefits */}
          {props.currentStep === 'benefits' && (
            <Step2SelectBenefits
              benefits={props.benefits}
              selectedBenefits={props.selectedBenefits}
              benefitConfigs={props.benefitConfigs}
              toggleBenefit={props.toggleBenefit}
              uniqueBenefitTypes={props.uniqueBenefitTypes}
            />
          )}

          {/* Step 3: Set Units & Categories */}
          {props.currentStep === 'units' && (
            <Step3ConfigureUnits
              benefits={props.benefits}
              selectedBenefits={props.selectedBenefits}
              benefitConfigs={props.benefitConfigs}
              benefitUnits={props.benefitUnits}
              updateBenefitSetting={props.updateBenefitSetting}
            />
          )}

          {/* Step 4: Review Package */}
          {props.currentStep === 'review' && (
            <Step4ReviewPackage
              packageName={props.packageName}
              description={props.description}
              benefitSubtotal={props.benefitSubtotal}
              miscellaneousCost={props.miscellaneousCost}
              discountPercentage={props.discountPercentage}
              setDiscountPercentage={props.setDiscountPercentage}
              discountThreeMonths={props.discountThreeMonths}
              setDiscountThreeMonths={props.setDiscountThreeMonths}
              discountSixMonths={props.discountSixMonths}
              setDiscountSixMonths={props.setDiscountSixMonths}
              discountAnnual={props.discountAnnual}
              setDiscountAnnual={props.setDiscountAnnual}
              totalCost={props.totalCost}
              setTotalCost={props.setTotalCost}
              priceThreeMonths={props.priceThreeMonths}
              setPriceThreeMonths={props.setPriceThreeMonths}
              priceSixMonths={props.priceSixMonths}
              setPriceSixMonths={props.setPriceSixMonths}
              priceTwelveMonths={props.priceTwelveMonths}
              setPriceTwelveMonths={props.setPriceTwelveMonths}
              isManualPrice={props.isManualPrice}
              setIsManualPrice={props.setIsManualPrice}
              isManualPriceThree={props.isManualPriceThree}
              setIsManualPriceThree={props.setIsManualPriceThree}
              isManualPriceSix={props.isManualPriceSix}
              setIsManualPriceSix={props.setIsManualPriceSix}
              isManualPriceTwelve={props.isManualPriceTwelve}
              setIsManualPriceTwelve={props.setIsManualPriceTwelve}
              calculatedPriceOne={props.calculatedPriceOne}
              calculatedPriceThree={props.calculatedPriceThree}
              calculatedPriceSix={props.calculatedPriceSix}
              calculatedPriceTwelve={props.calculatedPriceTwelve}
              isPriceOneOverridden={props.isPriceOneOverridden}
              isPriceThreeOverridden={props.isPriceThreeOverridden}
              isPriceSixOverridden={props.isPriceSixOverridden}
              isPriceTwelveOverridden={props.isPriceTwelveOverridden}
              isGlobal={props.isGlobal}
              setIsGlobal={props.setIsGlobal}
              isPopular={props.isPopular}
              setIsPopular={props.setIsPopular}
              isCompared={props.isCompared}
              setIsCompared={props.setIsCompared}
              isFreeTrial={props.isFreeTrial}
              trialDurationDays={props.trialDurationDays}
              selectedRegionIds={props.selectedRegionIds}
              setSelectedRegionIds={props.setSelectedRegionIds}
              regions={props.regions}
              selectedBenefits={props.selectedBenefits}
              benefits={props.benefits}
              benefitConfigs={props.benefitConfigs}
              benefitUnits={props.benefitUnits}
            />
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                if (props.currentStep === 'define') {
                  props.onResetWizard();
                } else {
                  const prevIndex = Math.max(0, currentStepIndex - 1);
                  props.setCurrentStep(steps[prevIndex].id);
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {props.currentStep === 'define' ? 'Cancel' : 'Back'}
            </Button>

            {props.currentStep === 'review' ? (
              <Button onClick={props.onPublish} className="bg-primary">
                <Check className="w-4 h-4 mr-2" />
                Publish Package
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
                  props.setCurrentStep(steps[nextIndex].id);
                }}
                className="bg-primary"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
