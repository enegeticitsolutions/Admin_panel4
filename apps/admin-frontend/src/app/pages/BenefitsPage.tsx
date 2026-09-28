/**
 * Benefits Library Page
 * Create and manage individual benefits (Morning Nurse Visit, Medicine Delivery, etc.)
 */

import React, { useEffect, useState, useRef } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { benefitApi, benefitTypeApi, taxCategoryApi } from '../../services/api';
import { Plus, Pencil, ToggleLeft, ToggleRight, Loader2, BookOpen, DollarSign, Check, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface BenefitType { id: string; name: string; iconCode?: string; isActive?: boolean; }
interface Benefit {
  id: string;
  code?: string;
  name: string;
  description?: string;
  isChargeable: boolean;
  unitCost?: number;
  cost?: number;
  unitLabel?: string;
  defaultUnits: number;
  isActive: boolean;
  displayOrder: number;
  benefitTypeId: string;
  benefitType: BenefitType;
  taxCategory?: string;
  gstRate?: number;
  hsnSacCode?: string;
  isGstExempt?: boolean;
}

const DEFAULT_TAX_CATEGORIES = [
  { code: 'GST_18', name: 'Standard Companion / Support Service (18% GST)', gstRate: 18, isExempt: false, hsnSacCode: '998399' },
  { code: 'GST_EXEMPT', name: 'Healthcare Clinical Service (GST Exempt - 0%)', gstRate: 0, isExempt: true, hsnSacCode: '999312' },
  { code: 'GST_5', name: 'Concessional Transport / Medical (5% GST)', gstRate: 5, isExempt: false, hsnSacCode: '999333' },
  { code: 'GST_12', name: 'Medical Goods & Supplies (12% GST)', gstRate: 12, isExempt: false, hsnSacCode: '3004' },
  { code: 'NON_TAXABLE', name: 'Non-Taxable Service (0%)', gstRate: 0, isExempt: true, hsnSacCode: '' },
];

const BLANK_FORM = {
  code: '',
  name: '',
  description: '',
  benefitTypeId: '',
  unitLabel: 'per visit',
  defaultUnits: 1,
  isChargeable: false,
  unitCost: undefined as number | undefined,
  cost: undefined as number | undefined,
  taxCategory: 'GST_18',
  gstRate: 18,
  hsnSacCode: '998399',
  isGstExempt: false,
};

const generateBenefitCode = (typeObj?: BenefitType, count: number = 101) => {
  if (!typeObj) return `BNF_${count}`;
  const name = typeObj.name.toUpperCase();
  let prefix = 'BNF';
  if (name.includes('EMERGENCY') || name.includes('AMBULANCE')) prefix = 'EMR';
  else if (name.includes('SATHI') || name.includes('COMPANION')) prefix = 'SATHI';
  else if (name.includes('NURSE')) prefix = 'NURS';
  else if (name.includes('TELE') || name.includes('DOCTOR')) prefix = 'DOC';
  else if (name.includes('PHYSIO')) prefix = 'PHY';
  else if (name.includes('LAB') || name.includes('TEST')) prefix = 'LAB';
  else if (name.includes('PHARMACY') || name.includes('MED')) prefix = 'MED';
  else prefix = name.substring(0, 4).replace(/[^A-Z]/g, '');

  return `${prefix}_${count}`;
};

const STANDARD_UNITS = [
  { value: 'per hour', label: 'Per Hour' },
  { value: 'per visit', label: 'Per Visit' },
  { value: 'per session', label: 'Per Session' },
  { value: 'per test', label: 'Per Test' },
  { value: 'per trip', label: 'Per Trip' },
  { value: 'per consult', label: 'Per Consult' },
  { value: 'per order', label: 'Per Order' },
];

export default function BenefitsPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([]);
  const [taxCategories, setTaxCategories] = useState<any[]>(DEFAULT_TAX_CATEGORIES);
  const [showNewTaxModal, setShowNewTaxModal] = useState(false);
  const [newTaxForm, setNewTaxForm] = useState({
    name: '',
    gstRate: 18,
    hsnSacCode: '',
    isExempt: false,
  });
  const [savingTaxCat, setSavingTaxCat] = useState(false);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState('all');
  const [form, setForm] = useState(BLANK_FORM);

  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const mainEl = document.querySelector('main');
        if (mainEl) {
          mainEl.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 60);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [b, t, tc] = await Promise.all([
        benefitApi.getAll(),
        benefitTypeApi.getAll(),
        taxCategoryApi.getAll().catch(() => DEFAULT_TAX_CATEGORIES)
      ]);
      setBenefits(b);
      setBenefitTypes(t);
      setTaxCategories(tc && tc.length > 0 ? tc : DEFAULT_TAX_CATEGORIES);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleCreateTaxCategory = async () => {
    if (!newTaxForm.name.trim()) return toast.error('Category name is required');
    setSavingTaxCat(true);
    try {
      const created = await taxCategoryApi.create(newTaxForm);
      toast.success(`Tax category "${created.name}" created!`);
      const updatedList = await taxCategoryApi.getAll();
      setTaxCategories(updatedList);
      // Auto-select into the current form!
      setForm(f => ({
        ...f,
        taxCategory: created.code,
        gstRate: created.gstRate,
        hsnSacCode: created.hsnSacCode || '',
        isGstExempt: created.isExempt,
      }));
      setShowNewTaxModal(false);
      setNewTaxForm({ name: '', gstRate: 18, hsnSacCode: '', isExempt: false });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create tax category');
    } finally {
      setSavingTaxCat(false);
    }
  };

  const handleTypeChange = (typeId: string) => {
    const selectedType = benefitTypes.find(t => t.id === typeId);
    const count = 100 + benefits.length + 1;
    const autoCode = generateBenefitCode(selectedType, count);
    setForm(f => ({
      ...f,
      benefitTypeId: typeId,
      code: autoCode,
    }));
  };

  const openNewForm = () => {
    setEditing(null);
    const defaultType = benefitTypes.find(t => t.isActive !== false) || benefitTypes[0];
    const typeId = defaultType ? defaultType.id : '';
    const count = 100 + benefits.length + 1;
    const autoCode = generateBenefitCode(defaultType, count);

    setForm({
      code: autoCode,
      name: '',
      description: '',
      benefitTypeId: typeId,
      unitLabel: 'per visit',
      defaultUnits: 1,
      isChargeable: false,
      unitCost: undefined,
      cost: undefined,
      taxCategory: 'GST_18',
      gstRate: 18,
      hsnSacCode: '998399',
      isGstExempt: false,
    });
    setShowForm(true);
    scrollToForm();
  };

  const openEdit = (b: Benefit) => {
    setEditing(b);
    const selectedType = benefitTypes.find(t => t.id === b.benefitTypeId);
    const count = 100 + benefits.length + 1;
    const autoCode = generateBenefitCode(selectedType, count);

    setForm({
      code: b.code && b.code.trim() !== '' ? b.code : autoCode,
      name: b.name,
      description: b.description ?? '',
      benefitTypeId: b.benefitTypeId,
      unitLabel: b.unitLabel ?? 'per visit',
      defaultUnits: b.defaultUnits,
      isChargeable: b.isChargeable,
      unitCost: b.unitCost,
      cost: b.cost,
      taxCategory: b.taxCategory || 'GST_18',
      gstRate: b.gstRate !== undefined ? b.gstRate : 18,
      hsnSacCode: b.hsnSacCode || '',
      isGstExempt: b.isGstExempt || false,
    });
    setShowForm(true);
    scrollToForm();
  };

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(BLANK_FORM); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.benefitTypeId) return toast.error('Name and type are required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        unitCost: form.isChargeable ? (form.unitCost ?? null) : null,
        cost: form.isChargeable ? (form.cost ?? null) : null,
      };
      if (editing) {
        await benefitApi.update(editing.id, payload);
        toast.success('Benefit updated');
      } else {
        await benefitApi.create(payload as any);
        toast.success('Benefit created');
      }
      resetForm();
      await load();
    } catch (err: any) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (b: Benefit) => {
    try {
      await benefitApi.update(b.id, { isActive: !b.isActive });
      toast.success(`${b.name} ${b.isActive ? 'deactivated' : 'activated'}`);
      await load();
    } catch { toast.error('Failed to update'); }
  };

  const filtered = filterTypeId === 'all' ? benefits : benefits.filter(b => b.benefitTypeId === filterTypeId);
  const grouped = filtered.reduce<Record<string, Benefit[]>>((acc, b) => {
    const key = b.benefitType?.name ?? 'Other';
    acc[key] = [...(acc[key] ?? []), b];
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Benefits Library"
        description="Manage individual benefits available to include in subscription packages"
        action={
          !showForm && (
            <Button onClick={openNewForm} className="bg-primary">
              <Plus className="w-4 h-4 mr-2" /> Add Benefit
            </Button>
          )
        }
      />

      {showForm && (
        <div ref={formRef} id="benefit-form-card" className="scroll-mt-4">
          <Card className="mb-6 max-w-lg shadow-md border-primary/20">
          <CardContent className="p-5 space-y-4 mt-2">
            <h3 className="font-semibold text-base">{editing ? 'Edit Benefit' : 'New Benefit'}</h3>
            <div className="space-y-1">
              <Label>Benefit Type *</Label>
              <Select value={form.benefitTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger className="bg-input-background">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {benefitTypes.filter(t => t.isActive !== false).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.iconCode} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label>Benefit ID / Code (Auto-Generated)</Label>
                <span className="text-[11px] text-muted-foreground">Ex: EMR_101 for Emergency</span>
              </div>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. EMR_101"
                className="font-mono uppercase font-medium bg-slate-50"
              />
            </div>

            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Nurse Visit" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Unit Type *</Label>
                <Select value={form.unitLabel} onValueChange={v => setForm(f => ({ ...f, unitLabel: v }))}>
                  <SelectTrigger className="bg-input-background">
                    <SelectValue placeholder="Select unit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_UNITS.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Default Units</Label>
                <Input type="number" value={form.defaultUnits} onChange={e => setForm(f => ({ ...f, defaultUnits: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  isChargeable: !f.isChargeable,
                  unitCost: !f.isChargeable ? f.unitCost : undefined,
                  cost: !f.isChargeable ? f.cost : undefined,
                }))}
                className={`w-10 h-6 rounded-full transition-colors flex items-center ${form.isChargeable ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}
              >
                <span className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
              </button>
              <span className="text-sm font-medium">Chargeable benefit</span>
            </div>
            {form.isChargeable && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cost (₹)</Label>
                  <Input type="number" value={form.cost ?? ''} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value) }))} placeholder="Internal cost" />
                  <p className="text-[11px] text-muted-foreground">Internal cost of the benefit.</p>
                </div>
                <div className="space-y-1">
                  <Label>Unit Price (₹)</Label>
                  <Input type="number" value={form.unitCost ?? ''} onChange={e => setForm(f => ({ ...f, unitCost: Number(e.target.value) }))} placeholder="e.g. 800" />
                  <p className="text-[11px] text-muted-foreground">Price charged to the subscriber.</p>
                </div>
              </div>
            )}

            {/* Tax & GST Configuration Section */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tax & GST Configuration</Label>
                <span className="text-[10px] text-muted-foreground">For invoice itemization & tax calculation</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Tax Category</Label>
                  <button
                    type="button"
                    onClick={() => setShowNewTaxModal(true)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Custom Category
                  </button>
                </div>
                <Select
                  value={form.taxCategory}
                  onValueChange={val => {
                    const cat = taxCategories.find(c => (c.code || c.value) === val);
                    setForm(f => ({
                      ...f,
                      taxCategory: val,
                      gstRate: cat ? (cat.gstRate ?? cat.defaultRate) : f.gstRate,
                      isGstExempt: cat ? (cat.isExempt ?? false) : false,
                      hsnSacCode: cat ? (cat.hsnSacCode ?? cat.defaultHsn ?? f.hsnSacCode) : f.hsnSacCode,
                    }));
                  }}
                >
                  <SelectTrigger className="bg-white text-xs">
                    <SelectValue placeholder="Select Tax Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxCategories.map(tc => (
                      <SelectItem key={tc.code || tc.value} value={tc.code || tc.value}>
                        {tc.name || tc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">GST Rate (%)</Label>
                  <Input
                    type="number"
                    value={form.gstRate}
                    disabled={form.isGstExempt}
                    onChange={e => setForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="bg-white text-xs"
                    placeholder="e.g. 18"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HSN / SAC Code</Label>
                  <Input
                    value={form.hsnSacCode}
                    onChange={e => setForm(f => ({ ...f, hsnSacCode: e.target.value }))}
                    className="bg-white text-xs"
                    placeholder="e.g. 998399 or 999312"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="bg-primary">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                {editing ? 'Update Benefit' : 'Create Benefit'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilterTypeId('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterTypeId === 'all' ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'}`}
        >
          All
        </button>
        {benefitTypes.map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTypeId(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterTypeId === t.id ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/50'}`}
          >
            {t.iconCode} {t.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading benefits…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No benefits yet</p>
          <p className="text-sm mt-1">Add your first benefit to the library</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([typeName, items]) => (
            <div key={typeName}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{typeName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(b => (
                  <Card key={b.id} className={!b.isActive ? 'opacity-60 bg-gray-50 border-dashed' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {b.code && (
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                {b.code}
                              </span>
                            )}
                            <h4 className="font-medium text-sm leading-snug">{b.name}</h4>
                          </div>
                        </div>
                        {b.isChargeable && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 ml-2">
                            <DollarSign className="w-3 h-3" /> {b.unitCost ? `₹${b.unitCost}` : 'Paid'}
                          </span>
                        )}
                      </div>
                      {b.description && <p className="text-xs text-muted-foreground mb-2">{b.description}</p>}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Default: <strong>{b.defaultUnits}</strong> {b.unitLabel ?? 'unit'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.isGstExempt || b.gstRate === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                            {b.isGstExempt || b.gstRate === 0 ? '0% GST (Exempt)' : `${b.gstRate ?? 18}% GST`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                            {b.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-2 border-t">
                        <Button size="sm" variant="outline" onClick={() => openEdit(b)} className="h-6 px-2 text-xs">
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={b.isActive ? 'ghost' : 'outline'}
                          onClick={() => toggleActive(b)}
                          className={`h-6 px-2 text-xs ${b.isActive ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'}`}
                        >
                          {b.isActive ? <ToggleRight className="w-3 h-3 mr-1 text-green-600" /> : <ToggleLeft className="w-3 h-3 mr-1 text-gray-400" />}
                          {b.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal Dialog to Create Custom Tax Category */}
      <Dialog open={showNewTaxModal} onOpenChange={setShowNewTaxModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" /> Create Tax Category
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define a new custom tax category or slab for benefits & invoicing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Category Name *</Label>
              <Input
                placeholder="e.g., General Physician (17% GST)"
                value={newTaxForm.name}
                onChange={(e) => setNewTaxForm(f => ({ ...f, name: e.target.value }))}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">GST Rate (%) *</Label>
                <Input
                  type="number"
                  disabled={newTaxForm.isExempt}
                  placeholder="e.g., 17"
                  value={newTaxForm.gstRate}
                  onChange={(e) => setNewTaxForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HSN / SAC Code</Label>
                <Input
                  placeholder="e.g., 999312"
                  value={newTaxForm.hsnSacCode}
                  onChange={(e) => setNewTaxForm(f => ({ ...f, hsnSacCode: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isExemptCheck"
                checked={newTaxForm.isExempt}
                onChange={(e) => setNewTaxForm(f => ({
                  ...f,
                  isExempt: e.target.checked,
                  gstRate: e.target.checked ? 0 : (f.gstRate === 0 ? 18 : f.gstRate)
                }))}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="isExemptCheck" className="text-xs cursor-pointer">
                This service is GST Exempt (0%)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowNewTaxModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateTaxCategory} disabled={savingTaxCat || !newTaxForm.name.trim()} className="bg-primary">
              {savingTaxCat ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
