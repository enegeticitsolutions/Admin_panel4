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
import { Plus, Check, ArrowRight, ArrowLeft, Package, Edit, Trash2, Calendar, Clock, ShieldCheck, Sparkles, Lock, Globe, Search, Filter, X, RotateCcw, Copy, Info, HelpCircle } from 'lucide-react';
import { PackageCardPreview } from '../components/packages/PackageCardPreview';
import { PackageWizard } from '../components/packages/wizard/PackageWizard';
import {
  type BenefitTierCategory,
  type BenefitSetting,
  type WizardStep,
  BENEFIT_CATEGORIES_CONFIG,
  detectDefaultBenefitCategory,
} from '../components/packages/wizard/wizardTypes';
import { toast } from 'sonner';
import { StatusChip } from '../components/common/StatusChip';
import { RegionSelector } from '../components/common/RegionSelector';
import { SearchFilterBar, FilterEmptyState } from '../components/common/SearchFilterBar';

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
  const [clonedFromPackageName, setClonedFromPackageName] = useState<string | null>(null);

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

  // Packages Tab Filters (Defaulting to 'active' packages as requested)
  const [packageSearch, setPackageSearch] = useState('');
  const [packageStatusFilter, setPackageStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [packageScopeFilter, setPackageScopeFilter] = useState<'all' | 'global' | 'regional' | 'private'>('all');

  // Benefits Catalog Tab Filters
  const [benefitSearch, setBenefitSearch] = useState('');
  const [benefitTypeFilter, setBenefitTypeFilter] = useState('all');
  const [benefitChargeableFilter, setBenefitChargeableFilter] = useState<'all' | 'chargeable' | 'included'>('all');

  // Memoized Filtered Packages
  const filteredPackages = React.useMemo(() => {
    return packages.filter((pkg: any) => {
      // 1. Status Filter
      if (packageStatusFilter === 'active' && !pkg.isActive) return false;
      if (packageStatusFilter === 'inactive' && pkg.isActive) return false;

      // 2. Scope Filter (global, regional, private)
      const isPrivate = !pkg.isGlobal && (!pkg.regions || pkg.regions.length === 0);
      const isRegional = !pkg.isGlobal && pkg.regions && pkg.regions.length > 0;
      const isGlobal = !!pkg.isGlobal;

      if (packageScopeFilter === 'global' && !isGlobal) return false;
      if (packageScopeFilter === 'regional' && !isRegional) return false;
      if (packageScopeFilter === 'private' && !isPrivate) return false;

      // 3. Search Query
      if (packageSearch.trim()) {
        const q = packageSearch.toLowerCase().trim();
        const matchName = (pkg.name || '').toLowerCase().includes(q);
        const matchDesc = (pkg.description || '').toLowerCase().includes(q);
        const matchRegions = (pkg.regions || []).some((r: any) => (r.name || '').toLowerCase().includes(q));
        const matchBenefits = (pkg.benefits || []).some((b: any) => 
          (b.benefit?.name || b.name || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchDesc && !matchRegions && !matchBenefits) {
          return false;
        }
      }

      return true;
    });
  }, [packages, packageStatusFilter, packageScopeFilter, packageSearch]);

  // Unique benefit categories/types for the filter dropdown
  const uniqueBenefitTypes = React.useMemo(() => {
    const set = new Set<string>();
    benefits.forEach((b: any) => {
      const typeName = b.benefitType?.name || b.type;
      if (typeName) set.add(typeName);
    });
    return Array.from(set).sort();
  }, [benefits]);

  // Memoized Filtered Benefits Catalog
  const filteredBenefits = React.useMemo(() => {
    return benefits.filter((b: any) => {
      // 1. Category / Type filter
      if (benefitTypeFilter !== 'all') {
        const typeName = b.benefitType?.name || b.type;
        if (typeName !== benefitTypeFilter) return false;
      }

      // 2. Chargeable filter
      if (benefitChargeableFilter === 'chargeable' && b.isChargeable === false) return false;
      if (benefitChargeableFilter === 'included' && b.isChargeable !== false) return false;

      // 3. Search query
      if (benefitSearch.trim()) {
        const q = benefitSearch.toLowerCase().trim();
        const matchName = (b.name || '').toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        const matchCode = (b.code || '').toLowerCase().includes(q);
        const matchType = (b.benefitType?.name || b.type || '').toLowerCase().includes(q);
        const matchUnit = (b.unitLabel || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCode && !matchType && !matchUnit) {
          return false;
        }
      }

      return true;
    });
  }, [benefits, benefitSearch, benefitTypeFilter, benefitChargeableFilter]);

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

      const defaultCat = detectDefaultBenefitCategory(benefit);
      const initialSetting: BenefitSetting = {
        quantity: isUnlimitedDefault ? 1 : (benefit?.defaultUnits || 1),
        frequency: isUnlimitedDefault ? 'unlimited' : isYearlyDefault ? 'yearly' : 'monthly',
        allocationBasis: isUnlimitedDefault ? 'per_subscription_term' : isAmbulance ? 'min_tenure_required' : isYearlyDefault ? 'per_subscription_term' : 'per_billing_cycle',
        minSubscriptionMonths: isAmbulance ? 12 : 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: isUnlimitedDefault,
        showUnit: true,
        category: defaultCat,
      };

      setBenefitConfigs(prev => ({ ...prev, [benefitId]: initialSetting }));
      setBenefitUnits(prev => ({ ...prev, [benefitId]: initialSetting.quantity }));
    }
    setSelectedBenefits(newSelected);
  };

  const updateUnits = (benefitId: string, units: number) => {
    setBenefitUnits(u => ({ ...u, [benefitId]: units }));
    setBenefitConfigs(c => {
      const benefit = benefits.find(b => b.id === benefitId);
      const existing = c[benefitId] || {
        quantity: units,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
        showUnit: true,
        category: detectDefaultBenefitCategory(benefit),
      };
      return { ...c, [benefitId]: { ...existing, quantity: units } };
    });
  };

  const updateBenefitSetting = (benefitId: string, partial: Partial<BenefitSetting>) => {
    setBenefitConfigs(prev => {
      const benefit = benefits.find(b => b.id === benefitId);
      const current = prev[benefitId] || {
        quantity: benefitUnits[benefitId] || 1,
        frequency: 'monthly',
        allocationBasis: 'per_billing_cycle',
        minSubscriptionMonths: 1,
        allowRollover: false,
        maxRolloverUnits: 0,
        isUnlimited: false,
        showUnit: true,
        category: detectDefaultBenefitCategory(benefit),
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
        category: 'included' as BenefitTierCategory,
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
        category: cfg.category || 'included',
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
    setClonedFromPackageName(null);
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
      const benefitObj = b.benefit || benefits.find(bn => bn.id === bId);
      const categoryVal = (b.category as BenefitTierCategory) || detectDefaultBenefitCategory(benefitObj);
      configs[bId] = {
        quantity: qty,
        frequency: (b.unitsPeriod as any) || 'monthly',
        allocationBasis: (b.allocationBasis as any) || 'per_billing_cycle',
        minSubscriptionMonths: b.minSubscriptionMonths || 1,
        allowRollover: !!b.allowRollover,
        maxRolloverUnits: b.maxRolloverUnits || undefined,
        isUnlimited: !!b.isUnlimited,
        showUnit: b.showUnit !== undefined ? Boolean(b.showUnit) : true,
        category: categoryVal,
      };
    });
    
    setSelectedBenefits(selected);
    setBenefitUnits(units);
    setBenefitConfigs(configs);
    setShowWizard(true);
  };

  const handleClone = (pkg: any) => {
    // 1. Mark as new package draft (null editingPackageId ensures creation, not update)
    setEditingPackageId(null);
    setClonedFromPackageName(pkg.name);

    // 2. Derive new package name
    setPackageName(`${pkg.name} (Copy)`);
    setDescription(pkg.description || '');

    // 3. Clone financial & duration pricing
    setMrp(String(pkg.mrp || 0));
    setDiscountPercentage(String(pkg.discountPercentage || 0));
    setDiscountThreeMonths(String(pkg.discountThreeMonths ?? 5));
    setDiscountSixMonths(String(pkg.discountSixMonths ?? 10));
    setDiscountAnnual(String(pkg.discountAnnual ?? 20));

    const baseVal = pkg.basePrice || pkg.totalCost || 0;
    setPriceThreeMonths(
      pkg.priceThreeMonths
        ? String(pkg.priceThreeMonths)
        : String(Math.round(baseVal * 3 * (1 - (pkg.discountThreeMonths ?? 5) / 100)))
    );
    setPriceSixMonths(
      pkg.priceSixMonths
        ? String(pkg.priceSixMonths)
        : String(Math.round(baseVal * 6 * (1 - (pkg.discountSixMonths ?? 10) / 100)))
    );
    setPriceTwelveMonths(
      pkg.priceTwelveMonths
        ? String(pkg.priceTwelveMonths)
        : String(Math.round(baseVal * 12 * (1 - (pkg.discountAnnual ?? 20) / 100)))
    );
    setIsManualPriceThree(!!pkg.priceThreeMonths);
    setIsManualPriceSix(!!pkg.priceSixMonths);
    setIsManualPriceTwelve(!!pkg.priceTwelveMonths);
    setMiscellaneousCost(String(pkg.miscellaneousCost || 0));
    setTotalCost(String(baseVal));
    setIsManualPrice(true);

    // 4. Dates & settings
    const today = new Date().toISOString().split('T')[0];
    setActiveFrom(pkg.activeFrom ? pkg.activeFrom.split('T')[0] : today);
    setActiveTo(pkg.activeTo ? pkg.activeTo.split('T')[0] : '');
    setIsGlobal(pkg.isGlobal ?? true);
    setIsPopular(false);
    setIsCompared(pkg.isCompared ?? false);
    setIsFreeTrial(pkg.isFreeTrial ?? false);
    setTrialDurationDays(String(pkg.trialDurationDays ?? 7));
    setSelectedRegionIds(pkg.regionIds || (pkg.regions ? pkg.regions.map((r: any) => r.id) : []));

    // 5. Clone benefits & configs
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
      const benefitObj = b.benefit || benefits.find(bn => bn.id === bId);
      const categoryVal = (b.category as BenefitTierCategory) || detectDefaultBenefitCategory(benefitObj);
      configs[bId] = {
        quantity: qty,
        frequency: (b.unitsPeriod as any) || 'monthly',
        allocationBasis: (b.allocationBasis as any) || 'per_billing_cycle',
        minSubscriptionMonths: b.minSubscriptionMonths || 1,
        allowRollover: !!b.allowRollover,
        maxRolloverUnits: b.maxRolloverUnits || undefined,
        isUnlimited: !!b.isUnlimited,
        showUnit: b.showUnit !== undefined ? Boolean(b.showUnit) : true,
        category: categoryVal,
      };
    });

    setSelectedBenefits(selected);
    setBenefitUnits(units);
    setBenefitConfigs(configs);

    // 6. Launch wizard at Step 1
    setCurrentStep('define');
    setShowWizard(true);
    toast.info(`Cloned details from "${pkg.name}". Review settings and publish your new package.`);
  };

  const handleToggleStatus = async (pkg: any) => {
    const newStatus = !pkg.isActive;
    const action = newStatus ? 'Active' : 'Inactive';
    const alertMessage = newStatus
      ? `Activate Package?\n\nAre you sure you want to change "${pkg.name}" to ACTIVE?\nThis package will become active and available again.`
      : `Deactivate Package?\n\nAre you sure you want to change "${pkg.name}" to INACTIVE?\nThis package will be marked as inactive and hidden from active selections.`;

    if (!window.confirm(alertMessage)) return;

    try {
      await packageApi.toggleStatus(pkg.id, newStatus);
      toast.success(`Package "${pkg.name}" status changed to ${action}!`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || `Failed to set package to ${action}`);
    }
  };

  const handleTogglePrivacy = async (pkg: any) => {
    const isCurrentlyPrivate = !pkg.isGlobal && (!pkg.regions || pkg.regions.length === 0);
    const newIsPrivate = !isCurrentlyPrivate;
    const confirmMsg = newIsPrivate
      ? `Set "${pkg.name}" as Private?\n\nThis will remove it from the public website by default. It can still be assigned to users by admins.`
      : `Make "${pkg.name}" Global?\n\nThis will make it visible to all users on the public website.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await packageApi.togglePrivacy(pkg.id, newIsPrivate);
      toast.success(newIsPrivate ? 'Package set to Private (hidden from website)' : 'Package set to Global (public on website)');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update package privacy');
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
    setClonedFromPackageName(null);
    setIsGlobal(true);
    setIsPopular(false);
    setIsCompared(false);
    setIsFreeTrial(false);
    setTrialDurationDays('7');
    setSelectedRegionIds([]);
    setRegionSearch('');
  };

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
        <PackageWizard
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          clonedFromPackageName={clonedFromPackageName}
          editingPackageId={editingPackageId}
          onResetWizard={resetWizard}
          onPublish={handlePublish}
          packageName={packageName}
          setPackageName={setPackageName}
          description={description}
          setDescription={setDescription}
          discountPercentage={discountPercentage}
          setDiscountPercentage={setDiscountPercentage}
          miscellaneousCost={miscellaneousCost}
          setMiscellaneousCost={setMiscellaneousCost}
          discountThreeMonths={discountThreeMonths}
          setDiscountThreeMonths={setDiscountThreeMonths}
          discountSixMonths={discountSixMonths}
          setDiscountSixMonths={setDiscountSixMonths}
          discountAnnual={discountAnnual}
          setDiscountAnnual={setDiscountAnnual}
          mrp={mrp}
          totalCost={totalCost}
          setTotalCost={setTotalCost}
          isManualPrice={isManualPrice}
          setIsManualPrice={setIsManualPrice}
          benefitSubtotal={benefitSubtotal}
          calculatedPriceOne={calculatedPriceOne}
          activeFrom={activeFrom}
          setActiveFrom={setActiveFrom}
          activeTo={activeTo}
          setActiveTo={setActiveTo}
          isFreeTrial={isFreeTrial}
          setIsFreeTrial={setIsFreeTrial}
          trialDurationDays={trialDurationDays}
          setTrialDurationDays={setTrialDurationDays}
          benefits={benefits}
          selectedBenefits={selectedBenefits}
          toggleBenefit={toggleBenefit}
          uniqueBenefitTypes={uniqueBenefitTypes}
          benefitConfigs={benefitConfigs}
          benefitUnits={benefitUnits}
          updateBenefitSetting={updateBenefitSetting}
          priceThreeMonths={priceThreeMonths}
          setPriceThreeMonths={setPriceThreeMonths}
          priceSixMonths={priceSixMonths}
          setPriceSixMonths={setPriceSixMonths}
          priceTwelveMonths={priceTwelveMonths}
          setPriceTwelveMonths={setPriceTwelveMonths}
          isManualPriceThree={isManualPriceThree}
          setIsManualPriceThree={setIsManualPriceThree}
          isManualPriceSix={isManualPriceSix}
          setIsManualPriceSix={setIsManualPriceSix}
          isManualPriceTwelve={isManualPriceTwelve}
          setIsManualPriceTwelve={setIsManualPriceTwelve}
          calculatedPriceThree={calculatedPriceThree}
          calculatedPriceSix={calculatedPriceSix}
          calculatedPriceTwelve={calculatedPriceTwelve}
          isPriceOneOverridden={isPriceOneOverridden}
          isPriceThreeOverridden={isPriceThreeOverridden}
          isPriceSixOverridden={isPriceSixOverridden}
          isPriceTwelveOverridden={isPriceTwelveOverridden}
          isGlobal={isGlobal}
          setIsGlobal={setIsGlobal}
          isPopular={isPopular}
          setIsPopular={setIsPopular}
          isCompared={isCompared}
          setIsCompared={setIsCompared}
          selectedRegionIds={selectedRegionIds}
          setSelectedRegionIds={setSelectedRegionIds}
          regions={regions}
        />
      ) : (
        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="benefits">Benefits Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4">
          {/* Reusable Search and Filters Toolbar for Packages */}
          <SearchFilterBar
            searchValue={packageSearch}
            onSearchChange={setPackageSearch}
            searchPlaceholder="Search packages by name, description, region, or included benefit..."
            filteredCount={filteredPackages.length}
            totalCount={packages.length}
            entityName="packages"
            showReset={Boolean(packageSearch || packageStatusFilter !== 'active' || packageScopeFilter !== 'all')}
            onReset={() => {
              setPackageSearch('');
              setPackageStatusFilter('active');
              setPackageScopeFilter('all');
            }}
            filters={[
              {
                id: 'status',
                value: packageStatusFilter,
                onChange: (val: any) => setPackageStatusFilter(val),
                placeholder: 'Status',
                widthClass: 'w-44',
                options: [
                  { value: 'active', label: '🟢 Active Only (Default)' },
                  { value: 'inactive', label: '🔴 Inactive Only' },
                  { value: 'all', label: '⚪ All Statuses' },
                ],
              },
              {
                id: 'scope',
                value: packageScopeFilter,
                onChange: (val: any) => setPackageScopeFilter(val),
                placeholder: 'Scope',
                widthClass: 'w-38',
                options: [
                  { value: 'all', label: 'All Scopes' },
                  { value: 'global', label: '🌐 Global' },
                  { value: 'regional', label: '📍 Regional' },
                  { value: 'private', label: '🔒 Private' },
                ],
              },
            ]}
            activeBadges={[
              ...(packageStatusFilter !== 'all' ? [{
                id: 'status-badge',
                label: 'Status',
                value: packageStatusFilter === 'active' ? 'Active' : 'Inactive',
                color: (packageStatusFilter === 'active' ? 'emerald' : 'rose') as any,
                onRemove: () => setPackageStatusFilter('all'),
              }] : []),
              ...(packageScopeFilter !== 'all' ? [{
                id: 'scope-badge',
                label: 'Scope',
                value: packageScopeFilter.charAt(0).toUpperCase() + packageScopeFilter.slice(1),
                color: 'blue' as any,
                onRemove: () => setPackageScopeFilter('all'),
              }] : []),
            ]}
          />

          {/* Packages Grid or Empty State */}
          {filteredPackages.length === 0 ? (
            <FilterEmptyState
              title="No packages found"
              description={
                packageStatusFilter === 'active' && packages.some((p: any) => !p.isActive)
                  ? 'No active packages match your search or filter. You have inactive packages available in the "Inactive Only" or "All Statuses" filter.'
                  : 'No packages match the current search query or filter selection.'
              }
              icon={Package}
              resetLabel="View All Packages"
              onReset={() => {
                setPackageSearch('');
                setPackageStatusFilter('all');
                setPackageScopeFilter('all');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPackages.map((pkg: any) => (
                <Card key={pkg.id} className="relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 p-4">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(pkg)}
                      className="cursor-pointer transition-all hover:scale-105 active:scale-95 focus:outline-none"
                      title={pkg.isActive ? "Package is Active. Click to deactivate" : "Package is Inactive. Click to activate"}
                    >
                      {pkg.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DFF4E6] text-[#1F8A3E] border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-[#1F8A3E]"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 hover:border-rose-400 transition-all shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          Inactive (Click to Activate)
                        </span>
                      )}
                    </button>
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      {pkg.isFreeTrial && (
                        <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold border border-purple-200">🧪 {pkg.trialDurationDays ?? 7}-Day Trial</span>
                      )}
                      {pkg.isGlobal ? (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-medium">Global</span>
                      ) : pkg.regions && pkg.regions.length > 0 ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-medium">Regional</span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-300 font-semibold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-amber-600" /> Private
                        </span>
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
                      <div className="flex items-center gap-1.5">
                        {(!pkg.isGlobal && (!pkg.regions || pkg.regions.length === 0)) ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-1"
                            onClick={() => handleTogglePrivacy(pkg)}
                            title="Make Global (Public on Website)"
                          >
                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                            Make Public
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2.5 text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-1"
                            onClick={() => handleTogglePrivacy(pkg)}
                            title="Set as Private (Hide from Website)"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            Set Private
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleClone(pkg)}
                          title="Clone Package (Derive new package)"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary"
                          onClick={() => handleEdit(pkg)}
                          title="Edit Package"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(pkg.id)}
                          title="Delete Package"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="benefits" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search benefits..."
                  value={benefitSearch}
                  onChange={(e) => setBenefitSearch(e.target.value)}
                  className="pl-9 bg-card"
                />
        </div>
              <Select value={benefitTypeFilter} onValueChange={setBenefitTypeFilter}>
                <SelectTrigger className="w-[180px] bg-card">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueBenefitTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={benefitChargeableFilter} onValueChange={(val: any) => setBenefitChargeableFilter(val)}>
                <SelectTrigger className="w-[180px] bg-card">
                  <SelectValue placeholder="Pricing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pricing</SelectItem>
                  <SelectItem value="chargeable">Chargeable</SelectItem>
                  <SelectItem value="included">Free / Included</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Benefits Grid or Empty State */}
            {filteredBenefits.length === 0 ? (
              <FilterEmptyState
                title="No benefits found"
                description="No benefits match the search term or selected category filter."
                icon={ShieldCheck}
                resetLabel="View All Benefits"
                onReset={() => {
                  setBenefitSearch('');
                  setBenefitTypeFilter('all');
                  setBenefitChargeableFilter('all');
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBenefits.map((benefit) => (
                  <Card key={benefit.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{benefit.name}</CardTitle>
                        {benefit.code && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {benefit.code}
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-xs">{benefit.type}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{benefit.description}</p>
                      <div className="text-sm flex items-center justify-between">
                        <div>
                          <span className="text-muted-foreground">Default:</span>
                          <span className="ml-2 font-medium">
                            {benefit.defaultUnits} {benefit.unitLabel}
                          </span>
                        </div>
                        {benefit.isChargeable === false ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                            Free / Included
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                            ₹{benefit.unitCost || 0} / {benefit.unitLabel || 'unit'}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
