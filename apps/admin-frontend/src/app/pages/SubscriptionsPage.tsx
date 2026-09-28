/**
 * Subscriptions Page - Product Factory Wizard
 * Step-by-step package creation for non-tech admins
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { packageApi, benefitApi, regionApi } from '../../services/api';
import type { SubscriptionPackage, Benefit, PackageBenefit } from '../../types';
import { Plus, Check, ArrowRight, ArrowLeft, Package, Edit, Trash2, Calendar, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { StatusChip } from '../components/common/StatusChip';
import { RegionSelector } from '../components/common/RegionSelector';

export interface BenefitSetting {
  quantity: number;
  frequency: 'monthly' | '3_months' | '6_months' | 'yearly' | 'one_time' | 'unlimited';
  allocationBasis: 'per_billing_cycle' | 'per_subscription_term' | 'min_tenure_required';
  minSubscriptionMonths: number;
  allowRollover: boolean;
  maxRolloverUnits?: number;
  isUnlimited: boolean;
  showUnit?: boolean;
}

type WizardStep = 'define' | 'benefits' | 'units' | 'review';

export default function SubscriptionsPage() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('define');
  const [packageName, setPackageName] = useState('');
  const [description, setDescription] = useState('');
  const [mrp, setMrp] = useState('0');
  const [discountPercentage, setDiscountPercentage] = useState('0');
  const [discountThreeMonths, setDiscountThreeMonths] = useState('5');
  const [discountSixMonths, setDiscountSixMonths] = useState('10');
  const [discountAnnual, setDiscountAnnual] = useState('20');
  const [priceThreeMonths, setPriceThreeMonths] = useState<string>('');
  const [priceSixMonths, setPriceSixMonths] = useState<string>('');
  const [priceTwelveMonths, setPriceTwelveMonths] = useState<string>('');
  const [isManualPriceThree, setIsManualPriceThree] = useState(false);
  const [isManualPriceSix, setIsManualPriceSix] = useState(false);
  const [isManualPriceTwelve, setIsManualPriceTwelve] = useState(false);
  const [miscellaneousCost, setMiscellaneousCost] = useState('0');
  const [benefitSubtotal, setBenefitSubtotal] = useState(0);
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [activeFrom, setActiveFrom] = useState('2026-01-01');
  const [activeTo, setActiveTo] = useState('2026-12-31');
  const [selectedBenefits, setSelectedBenefits] = useState<Set<string>>(new Set());
  const [benefitUnits, setBenefitUnits] = useState<Record<string, number>>({});
  const [benefitConfigs, setBenefitConfigs] = useState<Record<string, BenefitSetting>>({});
  const [totalCost, setTotalCost] = useState('0');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  const calculatedPriceOne = Math.round(
    (benefitSubtotal * (1 - (parseFloat(discountPercentage) || 0) / 100)) +
    (parseFloat(miscellaneousCost) || 0)
  );
  const calculatedPriceThree = Math.round(
    (benefitSubtotal * 3 * (1 - (parseFloat(discountThreeMonths) || 0) / 100)) +
    ((parseFloat(miscellaneousCost) || 0) * 3)
  );
  const calculatedPriceSix = Math.round(
    (benefitSubtotal * 6 * (1 - (parseFloat(discountSixMonths) || 0) / 100)) +
    ((parseFloat(miscellaneousCost) || 0) * 6)
  );
  const calculatedPriceTwelve = Math.round(
    (benefitSubtotal * 12 * (1 - (parseFloat(discountAnnual) || 0) / 100)) +
    ((parseFloat(miscellaneousCost) || 0) * 12)
  );

  const isPriceOneOverridden = Math.round(parseFloat(totalCost) || 0) !== calculatedPriceOne;
  const isPriceThreeOverridden = Math.round(parseFloat(priceThreeMonths) || 0) !== calculatedPriceThree;
  const isPriceSixOverridden = Math.round(parseFloat(priceSixMonths) || 0) !== calculatedPriceSix;
  const isPriceTwelveOverridden = Math.round(parseFloat(priceTwelveMonths) || 0) !== calculatedPriceTwelve;

  useEffect(() => {
    if (!isManualPriceThree) setPriceThreeMonths(String(calculatedPriceThree));
  }, [benefitSubtotal, discountThreeMonths, miscellaneousCost, isManualPriceThree, calculatedPriceThree]);

  useEffect(() => {
    if (!isManualPriceSix) setPriceSixMonths(String(calculatedPriceSix));
  }, [benefitSubtotal, discountSixMonths, miscellaneousCost, isManualPriceSix, calculatedPriceSix]);

  useEffect(() => {
    if (!isManualPriceTwelve) setPriceTwelveMonths(String(calculatedPriceTwelve));
  }, [benefitSubtotal, discountAnnual, miscellaneousCost, isManualPriceTwelve, calculatedPriceTwelve]);
  const [isGlobal, setIsGlobal] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [isCompared, setIsCompared] = useState(false);
  // Trial package fields
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [trialDurationDays, setTrialDurationDays] = useState('7');

  // Region targeting states
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [regionFocused, setRegionFocused] = useState(false);

  // Region filtering memo
  const filteredRegions = React.useMemo(() => {
    if (!regionSearch) return regions;
    return regions.filter(r => 
      r.name?.toLowerCase().includes(regionSearch.toLowerCase()) ||
      r.city?.toLowerCase().includes(regionSearch.toLowerCase())
    );
  }, [regions, regionSearch]);

  // Rule 1: If isGlobal is checked, clear all region targets
  useEffect(() => {
    if (isGlobal) {
      setSelectedRegionIds([]);
    }
  }, [isGlobal]);

  // Rule 2: If regions are selected, unmark the Global checkbox
  useEffect(() => {
    if (selectedRegionIds.length > 0) {
      setIsGlobal(false);
    }
  }, [selectedRegionIds]);

  useEffect(() => {
    loadData();
  }, []);

  // Automatic cost calculation (frequency-aware: monthly vs yearly vs one-time vs unlimited)
  useEffect(() => {
    if (!showWizard) return;
    
    let monthlySubtotal = 0;
    Array.from(selectedBenefits).forEach(id => {
      const benefit = benefits.find(b => b.id === id);
      if (!benefit) return;
      const cfg = benefitConfigs[id] || {
        quantity: benefitUnits[id] || 1,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
      };

      const isChargeable = benefit.isChargeable !== false;
      const unitCost = isChargeable ? (benefit.unitCost || 0) : 0;
      if (cfg.isUnlimited || !isChargeable) {
        // Unlimited or unchargeable services have no variable linear cost in monthly subtotal
        return;
      }

      if (cfg.frequency === 'monthly') {
        monthlySubtotal += unitCost * (cfg.quantity || 0);
      } else if (cfg.frequency === '3_months') {
        monthlySubtotal += (unitCost * (cfg.quantity || 0)) / 3;
      } else if (cfg.frequency === '6_months') {
        monthlySubtotal += (unitCost * (cfg.quantity || 0)) / 6;
      } else if (cfg.frequency === 'yearly') {
        // Annual benefit amortized across 12 months for baseline monthly calculation
        monthlySubtotal += (unitCost * (cfg.quantity || 0)) / 12;
      } else if (cfg.frequency === 'one_time') {
        monthlySubtotal += (unitCost * (cfg.quantity || 0)) / 12;
      }
    });

    const subtotal = Math.round(monthlySubtotal);
    setBenefitSubtotal(subtotal);

    // Discount applies ONLY to benefit subtotal
    const discVal = parseFloat(discountPercentage) || 0;
    const discountedSubtotal = subtotal * (1 - discVal / 100);
    
    // Final Price = Discounted Benefit Subtotal + Miscellaneous Cost
    const misc = parseFloat(miscellaneousCost) || 0;
    const finalCalculated = Math.round(discountedSubtotal + misc);
    
    if (!isManualPrice) {
      setTotalCost(String(finalCalculated));
    }

    // MRP = Subtotal + Miscellaneous Cost (Original full price)
    setMrp(String(Math.round(subtotal + misc)));

  }, [selectedBenefits, benefitConfigs, benefitUnits, discountPercentage, miscellaneousCost, benefits, showWizard, isManualPrice]);

  const loadData = async () => {
    const [pkgs, bnfs, regionsData] = await Promise.all([
      packageApi.getAll({ all: true }),
      benefitApi.getAll({ activeOnly: true }),
      regionApi.getAll()
    ]);
    setPackages(pkgs);
    setBenefits(bnfs);
    setRegions(regionsData || []);
  };

  const toggleBenefit = (benefitId: string) => {
    const newSelected = new Set(selectedBenefits);
    if (newSelected.has(benefitId)) {
      newSelected.delete(benefitId);
      const newConfigs = { ...benefitConfigs };
      delete newConfigs[benefitId];
      setBenefitConfigs(newConfigs);
      const newUnits = { ...benefitUnits };
      delete newUnits[benefitId];
      setBenefitUnits(newUnits);
    } else {
      newSelected.add(benefitId);
      const benefit = benefits.find(b => b.id === benefitId);
      const name = (benefit?.name || '').toLowerCase();
      const isYearlyDefault = name.includes('emergency') || name.includes('ambulance') || name.includes('annual');
      const isAmbulance = name.includes('ambulance');
      const isUnlimitedDefault = name.includes('24/7') || name.includes('coordination');

      const initialSetting: BenefitSetting = {
        quantity: isUnlimitedDefault ? 1 : (benefit?.defaultUnits || 1),
        frequency: isUnlimitedDefault ? 'unlimited' : isYearlyDefault ? 'yearly' : 'monthly',
        allocationBasis: isUnlimitedDefault ? 'per_subscription_term' : isAmbulance ? 'min_tenure_required' : isYearlyDefault ? 'per_subscription_term' : 'per_billing_cycle',
        minSubscriptionMonths: isAmbulance ? 12 : 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: isUnlimitedDefault,
        showUnit: true,
      };

      setBenefitConfigs(prev => ({ ...prev, [benefitId]: initialSetting }));
      setBenefitUnits(prev => ({ ...prev, [benefitId]: initialSetting.quantity }));
    }
    setSelectedBenefits(newSelected);
  };

  const updateUnits = (benefitId: string, units: number) => {
    setBenefitUnits(u => ({ ...u, [benefitId]: units }));
    setBenefitConfigs(c => {
      const existing = c[benefitId] || {
        quantity: units,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
        showUnit: true,
      };
      return { ...c, [benefitId]: { ...existing, quantity: units } };
    });
  };

  const updateBenefitSetting = (benefitId: string, partial: Partial<BenefitSetting>) => {
    setBenefitConfigs(prev => {
      const current = prev[benefitId] || {
        quantity: benefitUnits[benefitId] || 1,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
        showUnit: true,
      };
      const updated = { ...current, ...partial };
      if (partial.quantity !== undefined) {
        setBenefitUnits(u => ({ ...u, [benefitId]: partial.quantity! }));
      }
      return { ...prev, [benefitId]: updated };
    });
  };

  const handlePublish = async () => {
    const packageBenefits: any[] = Array.from(selectedBenefits).map(benefitId => {
      const cfg = benefitConfigs[benefitId] || {
        quantity: benefitUnits[benefitId] || 1,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
        showUnit: true,
      };
      return {
        benefitId,
        monthlyUnits: cfg.frequency === 'monthly' ? cfg.quantity : 
                      cfg.frequency === '3_months' ? Math.round(cfg.quantity / 3) :
                      cfg.frequency === '6_months' ? Math.round(cfg.quantity / 6) :
                      Math.round(cfg.quantity / 12),
        unitsIncluded: cfg.quantity,
        unitsPeriod: cfg.frequency,
        allocationBasis: cfg.allocationBasis,
        minSubscriptionMonths: cfg.minSubscriptionMonths,
        allowRollover: cfg.allowRollover,
        maxRolloverUnits: cfg.maxRolloverUnits || null,
        isUnlimited: cfg.isUnlimited,
        showUnit: cfg.showUnit !== undefined ? cfg.showUnit : true,
      };
    });

    const payload = {
      name: packageName,
      description,
      benefits: packageBenefits,
      packageCost: parseFloat(totalCost),
      mrp: parseFloat(mrp),
      discountPercentage: parseFloat(discountPercentage),
      discountThreeMonths: parseFloat(discountThreeMonths) || 0,
      discountSixMonths: parseFloat(discountSixMonths) || 0,
      discountAnnual: parseFloat(discountAnnual) || 0,
      priceThreeMonths: parseFloat(priceThreeMonths) || null,
      priceSixMonths: parseFloat(priceSixMonths) || null,
      priceTwelveMonths: parseFloat(priceTwelveMonths) || null,
      miscellaneousCost: parseFloat(miscellaneousCost),
      isActive: true,
      activeFrom: new Date(activeFrom).toISOString(),
      activeTo: activeTo ? new Date(activeTo).toISOString() : null,
      createdBy: 'U001',
      isGlobal,
      isPopular,
      isCompared,
      isFreeTrial,
      trialDurationDays: isFreeTrial ? (parseInt(trialDurationDays) || 7) : null,
      regionIds: isGlobal ? [] : selectedRegionIds,
    };

    if (activeFrom && activeTo) {
      if (new Date(activeTo) < new Date(activeFrom)) {
        toast.error('Expiry date (Active To) cannot be before the Start date (Active From)');
        return;
      }
    }

    try {
      if (editingPackageId) {
        await packageApi.update(editingPackageId, payload);
        toast.success('Package updated successfully!');
      } else {
        await packageApi.create(payload);
        toast.success('Package published successfully!');
      }
      await loadData();
      resetWizard();
    } catch (error) {
      toast.error(editingPackageId ? 'Failed to update package' : 'Failed to publish package');
    }
  };

  const handleEdit = (pkg: any) => {
    setEditingPackageId(pkg.id);
    setPackageName(pkg.name);
    setDescription(pkg.description || '');
    setMrp(String(pkg.mrp || 0));
    setDiscountPercentage(String(pkg.discountPercentage || 0));
    setDiscountThreeMonths(String(pkg.discountThreeMonths ?? 5));
    setDiscountSixMonths(String(pkg.discountSixMonths ?? 10));
    setDiscountAnnual(String(pkg.discountAnnual ?? 20));
    setPriceThreeMonths(pkg.priceThreeMonths ? String(pkg.priceThreeMonths) : String(Math.round(((pkg.basePrice || pkg.totalCost) * 3 * (1 - (pkg.discountThreeMonths ?? 5) / 100)))));
    setPriceSixMonths(pkg.priceSixMonths ? String(pkg.priceSixMonths) : String(Math.round(((pkg.basePrice || pkg.totalCost) * 6 * (1 - (pkg.discountSixMonths ?? 10) / 100)))));
    setPriceTwelveMonths(pkg.priceTwelveMonths ? String(pkg.priceTwelveMonths) : String(Math.round(((pkg.basePrice || pkg.totalCost) * 12 * (1 - (pkg.discountAnnual ?? 20) / 100)))));
    setIsManualPriceThree(!!pkg.priceThreeMonths);
    setIsManualPriceSix(!!pkg.priceSixMonths);
    setIsManualPriceTwelve(!!pkg.priceTwelveMonths);
    setMiscellaneousCost(String(pkg.miscellaneousCost || 0));
    setTotalCost(String(pkg.basePrice || pkg.totalCost));
    setIsManualPrice(true); // Don't auto-recalculate when editing existing
    // Date strings for input[type="date"] need to be YYYY-MM-DD
    setActiveFrom(pkg.activeFrom ? pkg.activeFrom.split('T')[0] : '');
    setActiveTo(pkg.activeTo ? pkg.activeTo.split('T')[0] : '');
    setIsGlobal(pkg.isGlobal ?? true);
    setIsPopular(pkg.isPopular ?? false);
    setIsCompared(pkg.isCompared ?? false);
    setIsFreeTrial(pkg.isFreeTrial ?? false);
    setTrialDurationDays(String(pkg.trialDurationDays ?? 7));
    setSelectedRegionIds(pkg.regionIds || []);
    
    const selected = new Set<string>();
    const units: Record<string, number> = {};
    const configs: Record<string, BenefitSetting> = {};
    
    const rawBenefits = pkg.packageBenefits || pkg.benefits || [];
    rawBenefits.forEach((b: any) => {
      const bId = b.benefitId || b.benefit?.id;
      if (!bId) return;
      selected.add(bId);
      const qty = b.unitsIncluded ?? b.monthlyUnits ?? 1;
      units[bId] = qty;
      configs[bId] = {
        quantity: qty,
        frequency: (b.unitsPeriod as any) || 'monthly',
        allocationBasis: (b.allocationBasis as any) || 'per_billing_cycle',
        minSubscriptionMonths: b.minSubscriptionMonths || 1,
        allowRollover: !!b.allowRollover,
        maxRolloverUnits: b.maxRolloverUnits || undefined,
        isUnlimited: !!b.isUnlimited,
        showUnit: b.showUnit !== undefined ? Boolean(b.showUnit) : true,
      };
    });
    
    setSelectedBenefits(selected);
    setBenefitUnits(units);
    setBenefitConfigs(configs);
    setShowWizard(true);
  };

  const handleToggleStatus = async (pkg: any) => {
    const newStatus = !pkg.isActive;
    const action = newStatus ? 'Active' : 'Inactive';
    if (!window.confirm(`Do you want to set this package to ${action}?`)) return;
    try {
      await packageApi.toggleStatus(pkg.id, newStatus);
      toast.success(`Package set to ${action}`);
      await loadData();
    } catch (error) {
      toast.error(`Failed to set package to ${action}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    try {
      const res: any = await packageApi.delete(id);
      if (res?.softDeleted) {
        toast.info(res.message || 'Package is in use and has been archived (deactivated).');
      } else {
        toast.success(res?.message || 'Package deleted successfully');
      }
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete package. It may be in use.');
    }
  };

  const resetWizard = () => {
    setShowWizard(false);
    setCurrentStep('define');
    setPackageName('');
    setDescription('');
    setMrp('0');
    setDiscountPercentage('0');
    setDiscountThreeMonths('5');
    setDiscountSixMonths('10');
    setDiscountAnnual('20');
    setPriceThreeMonths('');
    setPriceSixMonths('');
    setPriceTwelveMonths('');
    setIsManualPriceThree(false);
    setIsManualPriceSix(false);
    setIsManualPriceTwelve(false);
    setMiscellaneousCost('0');
    setSelectedBenefits(new Set());
    setBenefitUnits({});
    setBenefitConfigs({});
    setTotalCost('0');
    setIsManualPrice(false);
    setEditingPackageId(null);
    setIsGlobal(true);
    setIsPopular(false);
    setIsCompared(false);
    setIsFreeTrial(false);
    setTrialDurationDays('7');
    setSelectedRegionIds([]);
    setRegionSearch('');
  };

  const steps = [
    { id: 'define', label: 'Define Package', icon: Package },
    { id: 'benefits', label: 'Add Benefits', icon: Plus },
    { id: 'units', label: 'Set Units', icon: Check },
    { id: 'review', label: 'Review', icon: Check },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div>
      <PageHeader
        title="Product Factory"
        description="Create and manage subscription packages"
        action={
          !showWizard && (
            <Button onClick={() => setShowWizard(true)} className="bg-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create New Package
            </Button>
          )
        }
      />

      {showWizard && (
        <div className="mb-4">
          <Button variant="ghost" onClick={resetWizard} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Catalog
          </Button>
        </div>
      )}

      {showWizard ? (
        <div className="max-w-4xl mx-auto">
          {/* Wizard Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
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
                      <div className={`h-0.5 w-20 mx-2 ${isCompleted ? 'bg-[#1F8A3E]' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {currentStep === 'define' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Define Package</h2>
                    <p className="text-sm text-muted-foreground">Enter basic package information</p>
                  </div>
                  <div className="space-y-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
                        <p className="text-[10px] text-muted-foreground">Non-discountable extra costs</p>
                      </div>
                    </div>

                    {/* Trial Package Toggle */}
                    <div className={`p-4 border rounded-lg space-y-3 transition-colors ${isFreeTrial ? 'border-purple-300 bg-purple-50/60' : 'border-dashed border-gray-300 bg-gray-50/40'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="isFreeTrial"
                            checked={isFreeTrial}
                            onCheckedChange={(val) => setIsFreeTrial(!!val)}
                          />
                          <div>
                            <Label htmlFor="isFreeTrial" className="font-bold text-purple-900 cursor-pointer text-sm">🧪 Trial Package</Label>
                            <p className="text-xs text-purple-700 mt-0.5">Fixed-day access (e.g. 7-day trial). Duration pricing matrix is hidden for trial packages.</p>
                          </div>
                        </div>
                        {isFreeTrial && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor="trialDays" className="text-xs font-semibold text-purple-900 whitespace-nowrap">Duration (days):</Label>
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

                    <div className={`p-4 border border-orange-200 rounded-lg bg-orange-50/40 space-y-3 transition-all ${isFreeTrial ? 'opacity-40 pointer-events-none' : ''}`}>
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-semibold text-orange-950">Duration Discounts & Pricing (3, 6, 12 Months)</Label>
                        <span className="text-[11px] text-orange-700 font-medium">{isFreeTrial ? 'Disabled for trial packages' : 'Saved to DB & accessible across apps'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="disc3" className="text-xs">3 Months Discount (%)</Label>
                          <Input
                            id="disc3"
                            type="number"
                            value={discountThreeMonths}
                            onChange={(e) => setDiscountThreeMonths(e.target.value)}
                            placeholder="5"
                            className="bg-white text-xs h-9"
                          />
                          <p className="text-[11px] font-semibold text-orange-800 mt-1">
                            3 Mo Price: ₹{Math.round((benefitSubtotal * 3 * (1 - (parseFloat(discountThreeMonths) || 0) / 100)) + ((parseFloat(miscellaneousCost) || 0) * 3))}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="disc6" className="text-xs">6 Months Discount (%)</Label>
                          <Input
                            id="disc6"
                            type="number"
                            value={discountSixMonths}
                            onChange={(e) => setDiscountSixMonths(e.target.value)}
                            placeholder="10"
                            className="bg-white text-xs h-9"
                          />
                          <p className="text-[11px] font-semibold text-orange-800 mt-1">
                            6 Mo Price: ₹{Math.round((benefitSubtotal * 6 * (1 - (parseFloat(discountSixMonths) || 0) / 100)) + ((parseFloat(miscellaneousCost) || 0) * 6))}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="disc12" className="text-xs">12 Months (Annual) Discount (%)</Label>
                          <Input
                            id="disc12"
                            type="number"
                            value={discountAnnual}
                            onChange={(e) => setDiscountAnnual(e.target.value)}
                            placeholder="20"
                            className="bg-white text-xs h-9"
                          />
                          <p className="text-[11px] font-semibold text-orange-800 mt-1">
                            12 Mo Price: ₹{Math.round((benefitSubtotal * 12 * (1 - (parseFloat(discountAnnual) || 0) / 100)) + ((parseFloat(miscellaneousCost) || 0) * 12))}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mrp">Total MRP (₹)</Label>
                        <Input
                            id="mrp"
                            disabled
                            value={mrp}
                            className="bg-secondary/50 text-muted-foreground"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost">Final Price (₹)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="cost"
                            type="number"
                            value={totalCost}
                            onChange={(e) => {
                              setTotalCost(e.target.value);
                              setIsManualPrice(true);
                            }}
                            className={`font-bold border-primary/20 ${isManualPrice ? 'bg-orange-50 text-orange-700' : 'bg-input-background text-primary'}`}
                            placeholder="Set final cost..."
                          />
                          {isManualPrice && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setIsManualPrice(false)}
                              className="text-[10px] h-10"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
              )}

              {currentStep === 'benefits' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Add Benefits</h2>
                    <p className="text-sm text-muted-foreground">Select benefits from the library</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {benefits.map((benefit) => (
                      <div
                        key={benefit.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedBenefits.has(benefit.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleBenefit(benefit.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedBenefits.has(benefit.id)}
                            onCheckedChange={() => toggleBenefit(benefit.id)}
                          />
                          <div className="flex-1">
                            <h3 className="font-medium">{benefit.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {benefit.description}
                            </p>
                            <p className="text-xs text-primary mt-2">
                              Default: {benefit.defaultUnits} {benefit.unitLabel}
                              {benefit.isChargeable !== false && benefit.unitCost ? ` • ₹${benefit.unitCost}/${(benefit.unitLabel || '').replace(/s$/, '')}` : ' • Included / Free'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 'units' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Set Allowances &amp; Frequencies</h2>
                    <p className="text-sm text-muted-foreground">
                      Configure quantity, recurrence frequency (Monthly, Yearly, One-time), allocation rules, and rollover for each benefit.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {Array.from(selectedBenefits).map(benefitId => {
                      const benefit = benefits.find(b => b.id === benefitId);
                      if (!benefit) return null;
                      const cfg = benefitConfigs[benefitId] || {
                        quantity: benefitUnits[benefitId] || 1,
                        frequency: 'monthly',
                        allocationBasis: 'per_billing_cycle',
                        minSubscriptionMonths: 1,
                        allowRollover: false,
                        maxRolloverUnits: 0,
                        isUnlimited: false,
                      };

                      const isChargeable = benefit.isChargeable !== false;
                      const unitCost = isChargeable ? (benefit.unitCost || 0) : 0;
                      let monthlyImpact = 0;
                      if (isChargeable && !cfg.isUnlimited) {
                        if (cfg.frequency === 'monthly') monthlyImpact = unitCost * cfg.quantity;
                        else if (cfg.frequency === 'yearly' || cfg.frequency === 'one_time') monthlyImpact = Math.round((unitCost * cfg.quantity) / 12);
                      }

                      return (
                        <div key={benefitId} className="p-4 border border-border rounded-xl bg-card space-y-3 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base text-foreground">{benefit.name}</h3>
                                {benefit.code && (
                                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border">
                                    {benefit.code}
                                  </span>
                                )}
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
                                {!isChargeable ? 'Included (₹0)' : cfg.isUnlimited ? 'Unlimited (₹0)' : `₹${monthlyImpact}/mo`}
                              </span>
                              {isChargeable && cfg.frequency === 'yearly' && !cfg.isUnlimited && (
                                <span className="text-[10px] text-muted-foreground block">
                                  (₹{unitCost * cfg.quantity} amortized over 12m)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-dashed">
                            {/* Quantity */}
                            <div className="space-y-1">
                              <Label className="text-xs">Quantity / Allowance</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  disabled={cfg.isUnlimited}
                                  value={cfg.isUnlimited ? '' : cfg.quantity}
                                  onChange={(e) => updateBenefitSetting(benefitId, { quantity: parseInt(e.target.value) || 0 })}
                                  className="h-9 bg-input-background text-sm"
                                  placeholder={cfg.isUnlimited ? 'Unlimited' : 'e.g. 10'}
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {(benefit.unitLabel || '').replace(/^per\s+/i, '')}
                                </span>
                              </div>
                            </div>

                            {/* Frequency */}
                            <div className="space-y-1">
                              <Label className="text-xs">Frequency / Cadence</Label>
                              <Select
                                value={cfg.frequency}
                                onValueChange={(val: any) => {
                                  const isUnl = val === 'unlimited';
                                  updateBenefitSetting(benefitId, {
                                    frequency: val,
                                    isUnlimited: isUnl,
                                    allocationBasis: isUnl ? 'per_subscription_term' : (val === 'yearly' ? 'per_subscription_term' : 'per_billing_cycle'),
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

                            {/* Allocation Basis */}
                            <div className="space-y-1">
                              <Label className="text-xs">Allocation Rule</Label>
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
                                  onCheckedChange={(checked) => updateBenefitSetting(benefitId, { allowRollover: !!checked })}
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
                                    onChange={(e) => updateBenefitSetting(benefitId, { maxRolloverUnits: parseInt(e.target.value) || 0 })}
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
                              checked={cfg.showUnit !== false} // default true
                              onCheckedChange={(checked) => updateBenefitSetting(benefitId, { showUnit: !!checked })}
                            />
                            <Label htmlFor={`showUnit-${benefitId}`} className="text-xs cursor-pointer font-medium text-muted-foreground">
                              Show quantity/unit to users on mobile app and website (Uncheck to only show benefit name)
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentStep === 'review' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Review Package</h2>
                    <p className="text-sm text-muted-foreground">
                      Review and publish your package
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 mb-6">
                    <RegionSelector
                      isGlobal={isGlobal}
                      setIsGlobal={setIsGlobal}
                      selectedRegionIds={selectedRegionIds}
                      setSelectedRegionIds={setSelectedRegionIds}
                      regions={regions}
                      globalLabel="Make this package Global"
                      globalDescription="When checked, this package will be visible to all app users across all regions. When unchecked, it will be restricted to targeted regions."
                      title="Target Regions"
                      description="Search and select specific regions this package is limited to (applicable only if non-global)."
                    />

                    <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <Checkbox
                        id="isPopular"
                        checked={isPopular}
                        onCheckedChange={(val) => setIsPopular(!!val)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="isPopular" className="font-semibold text-orange-900 cursor-pointer text-base">Mark as "Most Popular"</Label>
                        <p className="text-sm text-orange-700">
                          When checked, this package will be highlighted with a badge in the mobile app.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <Checkbox
                        id="isCompared"
                        checked={isCompared}
                        onCheckedChange={(val) => setIsCompared(!!val)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="isCompared" className="font-semibold text-orange-900 cursor-pointer text-base">Include in Comparison Table</Label>
                        <p className="text-sm text-orange-700">
                          When checked, this package will be featured side-by-side in the Comparison Table on the website.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
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

                      {/* Full Editable Pricing & Discount Matrix */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-orange-950 flex items-center gap-2">
                            <span>Duration Pricing & Discount Overrides</span>
                            <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-semibold">Saved to DB</span>
                          </h4>
                          <span className="text-xs text-gray-500 italic">Adjust discounts (%) or type custom final prices (₹) directly below</span>
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
                                className={`h-9 font-bold text-sm ${isPriceOneOverridden ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-white text-primary'}`}
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
                                className={`h-9 font-bold text-sm ${isPriceThreeOverridden ? 'bg-orange-100 text-orange-800 border-orange-400' : 'bg-white text-orange-950'}`}
                              />
                            </div>
                            <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                              <span>Monthly Eq: <strong>₹{Math.round((parseFloat(priceThreeMonths) || calculatedPriceThree) / 3)}/mo</strong></span>
                              {Math.max(0, (parseFloat(totalCost) || 0) * 3 - (parseFloat(priceThreeMonths) || calculatedPriceThree)) > 0 && (
                                <span className="text-emerald-700 font-semibold">Save ₹{Math.max(0, (parseFloat(totalCost) || 0) * 3 - (parseFloat(priceThreeMonths) || calculatedPriceThree))}</span>
                              )}
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
                                className={`h-9 font-bold text-sm ${isPriceSixOverridden ? 'bg-orange-100 text-orange-800 border-orange-400' : 'bg-white text-orange-950'}`}
                              />
                            </div>
                            <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                              <span>Monthly Eq: <strong>₹{Math.round((parseFloat(priceSixMonths) || calculatedPriceSix) / 6)}/mo</strong></span>
                              {Math.max(0, (parseFloat(totalCost) || 0) * 6 - (parseFloat(priceSixMonths) || calculatedPriceSix)) > 0 && (
                                <span className="text-emerald-700 font-semibold">Save ₹{Math.max(0, (parseFloat(totalCost) || 0) * 6 - (parseFloat(priceSixMonths) || calculatedPriceSix))}</span>
                              )}
                            </div>
                          </div>

                          {/* 12 Months (Annual) Option */}
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
                                className={`h-9 font-bold text-sm ${isPriceTwelveOverridden ? 'bg-orange-100 text-orange-800 border-orange-400' : 'bg-white text-orange-950'}`}
                              />
                            </div>
                            <div className="text-[10px] text-orange-900 pt-1 border-t border-orange-200/60 flex justify-between">
                              <span>Monthly Eq: <strong>₹{Math.round((parseFloat(priceTwelveMonths) || calculatedPriceTwelve) / 12)}/mo</strong></span>
                              {Math.max(0, (parseFloat(totalCost) || 0) * 12 - (parseFloat(priceTwelveMonths) || calculatedPriceTwelve)) > 0 && (
                                <span className="text-emerald-700 font-semibold">Save ₹{Math.max(0, (parseFloat(totalCost) || 0) * 12 - (parseFloat(priceTwelveMonths) || calculatedPriceTwelve))}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Included Benefits & Allowances:</h4>
                      <div className="space-y-2">
                        {Array.from(selectedBenefits).map(benefitId => {
                          const benefit = benefits.find(b => b.id === benefitId);
                          if (!benefit) return null;
                          const cfg = benefitConfigs[benefitId] || {
                            quantity: benefitUnits[benefitId] || 1,
                            frequency: 'monthly',
                            allocationBasis: 'per_billing_cycle',
                            minSubscriptionMonths: 1,
                            allowRollover: false,
                            maxRolloverUnits: 0,
                            isUnlimited: false,
                          };
                          const unitLabelClean = (benefit.unitLabel || '').replace(/^per\s+/i, '');
                          
                          let freqBadge = 'Every Month';
                          if (cfg.frequency === 'yearly') freqBadge = cfg.allocationBasis === 'min_tenure_required' ? 'Annual Plan Only (12M)' : 'Every Year';
                          else if (cfg.frequency === 'one_time') freqBadge = 'One-Time Onboarding';
                          else if (cfg.frequency === 'unlimited') freqBadge = '24/7 Unlimited';

                          return (
                            <div key={benefitId} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card text-sm">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{benefit.name}</span>
                                  {benefit.code && (
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1 py-0.2 rounded border">
                                      {benefit.code}
                                    </span>
                                  )}
                                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                                    {freqBadge}
                                  </span>
                                  {cfg.allowRollover && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Rollover allowed {cfg.maxRolloverUnits ? `(max ${cfg.maxRolloverUnits})` : ''}
                                    </span>
                                  )}
                                  {cfg.showUnit === false && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      Units hidden for users
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {benefit.isGstExempt || benefit.gstRate === 0
                                    ? 'GST Exempt (0%)'
                                    : `${benefit.gstRate ?? 18}% GST${benefit.taxCategory ? ` • ${benefit.taxCategory.replace(/_/g, ' ')}` : ''}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-foreground">
                                  {cfg.isUnlimited ? 'Unlimited' : `${cfg.quantity} ${unitLabelClean}`}
                                </span>
                                <span className="text-xs text-muted-foreground block">
                                  {cfg.frequency === 'monthly' ? '/month' : cfg.frequency === 'yearly' ? '/year' : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (currentStep === 'define') {
                      resetWizard();
                    } else {
                      const prevIndex = Math.max(0, currentStepIndex - 1);
                      setCurrentStep(steps[prevIndex].id as WizardStep);
                    }
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {currentStep === 'define' ? 'Cancel' : 'Back'}
                </Button>

                {currentStep === 'review' ? (
                  <Button onClick={handlePublish} className="bg-primary">
                    <Check className="w-4 h-4 mr-2" />
                    Publish Package
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
                      setCurrentStep(steps[nextIndex].id as WizardStep);
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
      ) : (
        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="benefits">Benefits Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg: any) => (
                <Card key={pkg.id} className="relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-4">
                    <StatusChip status={pkg.isActive ? 'active' : 'inactive'} />
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      {pkg.isFreeTrial && (
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold border border-purple-200">🧪 {pkg.trialDurationDays ?? 7}-Day Trial</span>
                      )}
                      {pkg.isGlobal ? (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-medium">Global</span>
                      ) : (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">Regional</span>
                      )}
                      {pkg.isPopular && (
                        <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold border border-orange-200">★ Popular</span>
                      )}
                      {pkg.isCompared && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-medium">Comparison</span>
                      )}
                    </div>
                    <CardDescription>{pkg.description}</CardDescription>
                    {pkg.mrp && pkg.mrp > (pkg.basePrice || pkg.totalCost) && (
                      <CardDescription className="text-xs">
                        <span className="line-through text-muted-foreground">MRP ₹{pkg.mrp}</span>
                        <span className="ml-2 text-green-600 font-medium">
                          Save {pkg.discountPercentage}%
                        </span>
                        {pkg.miscellaneousCost > 0 && (
                          <span className="text-[10px] ml-2 text-muted-foreground">(+ ₹{pkg.miscellaneousCost} misc)</span>
                        )}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">₹{pkg.basePrice || pkg.totalCost}</span>
                    </div>
                     <div className="text-xs text-muted-foreground">
                      <p>Active: {pkg.activeFrom ? pkg.activeFrom.split('T')[0] : 'N/A'} to {pkg.activeTo ? pkg.activeTo.split('T')[0] : 'N/A'}</p>
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-200 text-xs space-y-1">
                      <p className="text-[11px] font-semibold text-gray-700">Duration Pricing Breakdown & /mo:</p>
                      <div className="grid grid-cols-3 gap-1 text-[10px] bg-orange-50/50 p-2 rounded border border-orange-100 text-orange-950">
                        <div>
                          <span className="text-gray-500">3 Mo:</span> <span className="font-bold">₹{pkg.priceThreeMonths || Math.round(((pkg.basePrice || pkg.totalCost) * 3 * (1 - (pkg.discountThreeMonths ?? 5) / 100)))}</span>
                          <span className="text-[9px] text-gray-500 block">₹{Math.round((pkg.priceThreeMonths || ((pkg.basePrice || pkg.totalCost) * 3 * (1 - (pkg.discountThreeMonths ?? 5) / 100))) / 3)}/mo</span>
                        </div>
                        <div>
                          <span className="text-gray-500">6 Mo:</span> <span className="font-bold">₹{pkg.priceSixMonths || Math.round(((pkg.basePrice || pkg.totalCost) * 6 * (1 - (pkg.discountSixMonths ?? 10) / 100)))}</span>
                          <span className="text-[9px] text-gray-500 block">₹{Math.round((pkg.priceSixMonths || ((pkg.basePrice || pkg.totalCost) * 6 * (1 - (pkg.discountSixMonths ?? 10) / 100))) / 6)}/mo</span>
                        </div>
                        <div>
                          <span className="text-gray-500">12 Mo:</span> <span className="font-bold">₹{pkg.priceTwelveMonths || Math.round(((pkg.basePrice || pkg.totalCost) * 12 * (1 - (pkg.discountAnnual ?? 20) / 100)))}</span>
                          <span className="text-[9px] text-gray-500 block">₹{Math.round((pkg.priceTwelveMonths || ((pkg.basePrice || pkg.totalCost) * 12 * (1 - (pkg.discountAnnual ?? 20) / 100))) / 12)}/mo</span>
                        </div>
                      </div>
                    </div>
                    {!pkg.isGlobal && pkg.regions && pkg.regions.length > 0 && (
                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1 items-center">
                        <span className="font-semibold text-gray-500">Regions:</span>
                        {pkg.regions.map((r: any) => (
                          <span key={r.id} className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100 font-semibold">{r.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {pkg.benefits.length} benefits included
                      </p>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary"
                          onClick={() => handleEdit(pkg)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(pkg.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="benefits" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {benefits.map((benefit) => (
                <Card key={benefit.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{benefit.name}</CardTitle>
                    <CardDescription className="text-xs">{benefit.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{benefit.description}</p>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Default:</span>
                      <span className="ml-2 font-medium">
                        {benefit.defaultUnits} {benefit.unitLabel}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
