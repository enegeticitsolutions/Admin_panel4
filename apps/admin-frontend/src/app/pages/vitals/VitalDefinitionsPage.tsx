/**
 * Vital Definitions Page — Full CRUD
 * Admin-managed catalog of all supported vitals
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { vitalApi } from '../../../services/api';
import {
  Plus, Search, Activity, Heart, Thermometer, Scale, Droplets,
  Edit2, Trash2, ToggleLeft, ToggleRight, X, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../components/ui/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  dataType: string;
  normalMin: number | null;
  normalMax: number | null;
  // Dual numeric
  value1Label: string | null;
  value2Label: string | null;
  normalMin2: number | null;
  normalMax2: number | null;
  inputMin: number | null;
  inputMax: number | null;
  // Text
  textOptions: string[];
  alertOptions: string[];
  // Boolean
  booleanTrueLabel: string | null;
  booleanFalseLabel: string | null;
  booleanAlertValue: boolean | null;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

const EMPTY_FORM = {
  code: '',
  name: '',
  unit: '',
  description: '',
  dataType: 'numeric',
  normalMin: '',
  normalMax: '',
  displayOrder: '0',
  // Dual
  value1Label: '',
  value2Label: '',
  normalMin2: '',
  normalMax2: '',
  inputMin: '',
  inputMax: '',
  // Text
  textOptionsRaw: '',
  alertOptionsRaw: '',
  // Boolean
  booleanTrueLabel: 'Yes',
  booleanFalseLabel: 'No',
  booleanAlertValue: 'none' as 'true' | 'false' | 'none',
  isActive: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getVitalIcon = (code: string) => {
  if (code.includes('BP') || code === 'PULSE') return <Heart className="w-4 h-4" />;
  if (code === 'SPO2') return <Activity className="w-4 h-4" />;
  if (code === 'TEMP') return <Thermometer className="w-4 h-4" />;
  if (code === 'WEIGHT') return <Scale className="w-4 h-4" />;
  if (code.includes('GLUCOSE') || code.includes('BLOOD')) return <Droplets className="w-4 h-4" />;
  return <Activity className="w-4 h-4" />;
};

const getIconBg = (code: string) => {
  if (code === 'SPO2') return 'bg-emerald-100 text-emerald-600';
  if (code.includes('BP')) return 'bg-rose-100 text-rose-600';
  if (code === 'TEMP') return 'bg-orange-100 text-orange-600';
  if (code === 'PULSE') return 'bg-blue-100 text-blue-600';
  if (code.includes('GLUCOSE')) return 'bg-purple-100 text-purple-600';
  if (code === 'WEIGHT') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-600';
};

const TYPE_COLORS: Record<string, string> = {
  numeric: 'bg-blue-50 text-blue-700',
  dual_numeric: 'bg-purple-50 text-purple-700',
  text: 'bg-amber-50 text-amber-700',
  boolean: 'bg-slate-50 text-slate-700',
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

function Modal({ open, onClose, children, title, subtitle }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VitalDefinitionsPage() {
  const [vitals, setVitals] = useState<VitalDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VitalDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VitalDefinition | null>(null);
  const [toggleTarget, setToggleTarget] = useState<VitalDefinition | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await vitalApi.getAll();
      setVitals(data);
    } catch {
      toast.error('Failed to load vital definitions');
    } finally {
      setLoading(false);
    }
  };

  // ── Open Add modal ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  // ── Open Edit modal ─────────────────────────────────────────────────────────
  const openEdit = (v: VitalDefinition) => {
    setEditTarget(v);
    setForm({
      code: v.code,
      name: v.name,
      unit: v.unit || '',
      description: v.description || '',
      dataType: v.dataType,
      normalMin: v.normalMin !== null ? String(v.normalMin) : '',
      normalMax: v.normalMax !== null ? String(v.normalMax) : '',
      displayOrder: String(v.displayOrder),
      // Dual
      value1Label: v.value1Label || '',
      value2Label: v.value2Label || '',
      normalMin2: v.normalMin2 !== null ? String(v.normalMin2) : '',
      normalMax2: v.normalMax2 !== null ? String(v.normalMax2) : '',
      inputMin: v.inputMin !== null ? String(v.inputMin) : '',
      inputMax: v.inputMax !== null ? String(v.inputMax) : '',
      // Text
      textOptionsRaw: (v.textOptions || []).join(', '),
      alertOptionsRaw: (v.alertOptions || []).join(', '),
      // Boolean
      booleanTrueLabel: v.booleanTrueLabel || 'Yes',
      booleanFalseLabel: v.booleanFalseLabel || 'No',
      booleanAlertValue: v.booleanAlertValue === true ? 'true' : v.booleanAlertValue === false ? 'false' : 'none',
      isActive: v.isActive,
    });
    setFormOpen(true);
  };

  // ── Save (Add or Edit) ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.dataType) {
      toast.error('Code, Name and Type are required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        unit: form.unit.trim() || null,
        description: form.description.trim() || null,
        dataType: form.dataType,
        normalMin: form.normalMin !== '' ? parseFloat(form.normalMin) : null,
        normalMax: form.normalMax !== '' ? parseFloat(form.normalMax) : null,
        displayOrder: parseInt(form.displayOrder) || 0,
        // Dual
        value1Label: form.value1Label || null,
        value2Label: form.value2Label || null,
        normalMin2: form.normalMin2 !== '' ? parseFloat(form.normalMin2) : null,
        normalMax2: form.normalMax2 !== '' ? parseFloat(form.normalMax2) : null,
        inputMin: form.inputMin !== '' ? parseFloat(form.inputMin) : null,
        inputMax: form.inputMax !== '' ? parseFloat(form.inputMax) : null,
        // Text
        textOptions: form.textOptionsRaw.split(',').map(s => s.trim()).filter(Boolean),
        alertOptions: form.alertOptionsRaw.split(',').map(s => s.trim()).filter(Boolean),
        // Boolean
        booleanTrueLabel: form.booleanTrueLabel || 'Yes',
        booleanFalseLabel: form.booleanFalseLabel || 'No',
        booleanAlertValue: form.booleanAlertValue === 'true' ? true : form.booleanAlertValue === 'false' ? false : null,
        isActive: form.isActive,
      };

      if (editTarget) {
        await vitalApi.update(editTarget.id, payload);
        toast.success(`"${payload.name}" updated successfully`);
      } else {
        await vitalApi.create(payload);
        toast.success(`"${payload.name}" added to vital definitions`);
      }
      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save vital');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await vitalApi.remove(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deactivated`);
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete vital');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle Active/Inactive ──────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      await vitalApi.update(toggleTarget.id, { isActive: !toggleTarget.isActive });
      toast.success(
        `"${toggleTarget.name}" marked as ${!toggleTarget.isActive ? 'Active' : 'Inactive'}`
      );
      setToggleTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = vitals.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || v.dataType === typeFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? v.isActive : !v.isActive);
    return matchSearch && matchType && matchStatus;
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vital definitions"
        description="Admin > Vitals > Vital definitions"
        action={
          <Button
            onClick={openAdd}
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> Add vital
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total vitals defined', value: vitals.length, color: 'text-orange-500' },
          { label: 'Active', value: vitals.filter(v => v.isActive).length, color: 'text-emerald-600' },
          { label: 'Inactive', value: vitals.filter(v => !v.isActive).length, color: 'text-slate-400' },
          { label: 'Custom vitals', value: vitals.filter(v => !v.isSystem).length, color: 'text-slate-900' },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-sm bg-white">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <h3 className={cn('text-3xl font-bold mt-1', s.color)}>{s.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vitals..."
                className="pl-9 bg-slate-50 border-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="bg-slate-50 border-none rounded-md px-3 py-2 text-sm outline-none"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="numeric">Numeric</option>
              <option value="dual_numeric">Dual numeric</option>
              <option value="text">Text</option>
              <option value="boolean">Boolean</option>
            </select>
            <select
              className="bg-slate-50 border-none rounded-md px-3 py-2 text-sm outline-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  <th className="px-6 py-4">Vital Name</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Nor. Range</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                      </td>
                    </tr>
                  ))
                  : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 font-medium">No vitals found</p>
                        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or add a new vital</p>
                      </td>
                    </tr>
                  )
                  : filtered.map(v => (
                    <tr
                      key={v.id}
                      className={cn(
                        'hover:bg-slate-50/60 transition-colors',
                        !v.isActive && 'opacity-60'
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0', getIconBg(v.code))}>
                            {getVitalIcon(v.code)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{v.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {v.isSystem ? 'System vital' : 'Custom vital'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                          {v.code}
                        </Badge>
                      </td>

                      <td className="px-6 py-4">
                        <Badge className={cn('font-medium border-none', TYPE_COLORS[v.dataType] || 'bg-slate-50 text-slate-700')}>
                          {v.dataType.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {v.unit || '—'}
                      </td>

                      <td className="px-6 py-4">
                        {v.dataType === 'numeric' && v.normalMin !== null && v.normalMax !== null ? (
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{v.normalMin}</span>
                              <span>{v.normalMax}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400/60 rounded-full mx-3" />
                            </div>
                          </div>
                        ) : v.dataType === 'dual_numeric' ? (
                          <div className="text-[10px] text-slate-600 space-y-0.5">
                            <p>{v.value1Label || 'V1'}: {v.normalMin}-{v.normalMax}</p>
                            <p>{v.value2Label || 'V2'}: {v.normalMin2}-{v.normalMax2}</p>
                          </div>
                        ) : v.dataType === 'text' && (v.alertOptions || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-muted-foreground mr-1">Alert on:</span>
                            {(v.alertOptions || []).map(opt => (
                              <Badge key={opt} variant="outline" className="px-1 py-0 h-4 text-[9px] bg-rose-50 text-rose-600 border-rose-100 uppercase">
                                {opt}
                              </Badge>
                            ))}
                          </div>
                        ) : v.dataType === 'boolean' && v.booleanAlertValue !== null ? (
                          <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                            Alert on: {v.booleanAlertValue ? (v.booleanTrueLabel || 'Yes') : (v.booleanFalseLabel || 'No')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No fixed range</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <Badge className={cn(
                          'rounded-full text-[11px] border-none',
                          v.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        )}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(v)}
                            title="Edit vital"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            onClick={() => setToggleTarget(v)}
                            title={v.isActive ? 'Deactivate' : 'Activate'}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              v.isActive
                                ? 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            )}
                          >
                            {v.isActive
                              ? <ToggleRight className="w-4 h-4" />
                              : <ToggleLeft className="w-4 h-4" />
                            }
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(v)}
                            title="Delete vital"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? 'Edit vital' : 'Add new vital'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Define a new vital metric for the system'}
      >
        <div className="space-y-8">
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Basic Information</h3>
            
            <FormField label="Vital name" required>
              <Input
                placeholder="e.g. Blood Oxygen Saturation"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Code" required>
                <Input
                  placeholder="e.g. SPO2"
                  className="uppercase"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  disabled={!!editTarget}
                />
              </FormField>
              <FormField label="Unit">
                <Input
                  placeholder="e.g. %, mmHg, °C"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                rows={2}
                placeholder="Optional description visible to admins only"
                className="w-full bg-white border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data type" required>
                <select
                  className="w-full bg-white border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={form.dataType}
                  onChange={e => setForm(f => ({ ...f, dataType: e.target.value }))}
                >
                  <option value="numeric">Numeric — single value</option>
                  <option value="dual_numeric">Dual numeric — two values (e.g. BP)</option>
                  <option value="text">Text — free text or selection</option>
                  <option value="boolean">Boolean — yes / no</option>
                </select>
              </FormField>
              <FormField label="Display order">
                <Input
                  type="number" dataType="integer"
                  placeholder="0"
                  value={form.displayOrder}
                  onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          {/* Section: Validation Range (for numbers) */}
          {(form.dataType === 'numeric' || form.dataType === 'dual_numeric') && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Validation Range</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Min allowed value">
                  <Input
                    type="number" dataType="integer"
                    placeholder="e.g. 0"
                    value={form.inputMin}
                    onChange={e => setForm(f => ({ ...f, inputMin: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Rejects readings below this</p>
                </FormField>
                <FormField label="Max allowed value">
                  <Input
                    type="number" dataType="integer"
                    placeholder="e.g. 100"
                    value={form.inputMax}
                    onChange={e => setForm(f => ({ ...f, inputMax: e.target.value }))}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Section: Configuration for Numeric */}
          {form.dataType === 'numeric' && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Normal Range (Default)</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Normal min">
                  <Input
                    type="number" dataType="integer"
                    placeholder="e.g. 95"
                    value={form.normalMin}
                    onChange={e => setForm(f => ({ ...f, normalMin: e.target.value }))}
                  />
                </FormField>
                <FormField label="Normal max">
                  <Input
                    type="number" dataType="integer"
                    placeholder="e.g. 100"
                    value={form.normalMax}
                    onChange={e => setForm(f => ({ ...f, normalMax: e.target.value }))}
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Section: Configuration for Dual Numeric */}
          {form.dataType === 'dual_numeric' && (
            <div className="space-y-6 pt-4 border-t border-slate-100">
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Field Labels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Value 1 label">
                    <Input
                      placeholder="e.g. Systolic"
                      value={form.value1Label}
                      onChange={e => setForm(f => ({ ...f, value1Label: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Value 2 label">
                    <Input
                      placeholder="e.g. Diastolic"
                      value={form.value2Label}
                      onChange={e => setForm(f => ({ ...f, value2Label: e.target.value }))}
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Normal Ranges (Default)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Value 1 normal min">
                    <Input
                      type="number" dataType="integer"
                      placeholder="90"
                      value={form.normalMin}
                      onChange={e => setForm(f => ({ ...f, normalMin: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Value 1 normal max">
                    <Input
                      type="number" dataType="integer"
                      placeholder="120"
                      value={form.normalMax}
                      onChange={e => setForm(f => ({ ...f, normalMax: e.target.value }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <FormField label="Value 2 normal min">
                    <Input
                      type="number" dataType="integer"
                      placeholder="60"
                      value={form.normalMin2}
                      onChange={e => setForm(f => ({ ...f, normalMin2: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Value 2 normal max">
                    <Input
                      type="number" dataType="integer"
                      placeholder="80"
                      value={form.normalMax2}
                      onChange={e => setForm(f => ({ ...f, normalMax2: e.target.value }))}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* Section: Configuration for Text */}
          {form.dataType === 'text' && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Text Options</h3>
              <FormField label="Predefined options">
                <Input
                  placeholder="Happy, Neutral, Sad, Anxious (comma separated)"
                  value={form.textOptionsRaw}
                  onChange={e => setForm(f => ({ ...f, textOptionsRaw: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Leave blank for free text</p>
              </FormField>
              <FormField label="Options that trigger alert">
                <Input
                  placeholder="Sad, Anxious (comma separated)"
                  value={form.alertOptionsRaw}
                  onChange={e => setForm(f => ({ ...f, alertOptionsRaw: e.target.value }))}
                />
              </FormField>
            </div>
          )}

          {/* Section: Configuration for Boolean */}
          {form.dataType === 'boolean' && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Boolean Config</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="True label">
                  <Input
                    placeholder="Yes"
                    value={form.booleanTrueLabel}
                    onChange={e => setForm(f => ({ ...f, booleanTrueLabel: e.target.value }))}
                  />
                </FormField>
                <FormField label="False label">
                  <Input
                    placeholder="No"
                    value={form.booleanFalseLabel}
                    onChange={e => setForm(f => ({ ...f, booleanFalseLabel: e.target.value }))}
                  />
                </FormField>
              </div>
              <FormField label="Trigger alert when value is">
                <select
                  className="w-full bg-white border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={form.booleanAlertValue}
                  onChange={e => setForm(f => ({ ...f, booleanAlertValue: e.target.value as any }))}
                >
                  <option value="none">No alert</option>
                  <option value="true">Alert when "{form.booleanTrueLabel}"</option>
                  <option value="false">Alert when "{form.booleanFalseLabel}"</option>
                </select>
              </FormField>
            </div>
          )}

          {/* Section: Behaviour */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Behaviour</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-900">Vital is active</p>
                <p className="text-xs text-slate-500">Only active vitals can be captured during visits</p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className="transition-colors"
              >
                {form.isActive 
                  ? <ToggleRight className="w-8 h-8 text-emerald-500" /> 
                  : <ToggleLeft className="w-8 h-8 text-slate-300" />
                }
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-6 flex-shrink-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Add vital'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Toggle Confirm Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.isActive ? 'Deactivate vital?' : 'Activate vital?'}
      >
        {toggleTarget && (
          <div className="space-y-4">
            <div className={cn(
              'flex items-center gap-3 p-4 rounded-xl',
              toggleTarget.isActive ? 'bg-orange-50' : 'bg-emerald-50'
            )}>
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                getIconBg(toggleTarget.code)
              )}>
                {getVitalIcon(toggleTarget.code)}
              </div>
              <div>
                <p className="font-bold text-slate-900">{toggleTarget.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{toggleTarget.code}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {toggleTarget.isActive
                ? 'This vital will be hidden from care companions. Existing readings will be preserved.'
                : 'This vital will become available to care companions for capture during visits.'}
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setToggleTarget(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className={cn(
                  'flex-1 text-white',
                  toggleTarget.isActive
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                )}
                onClick={handleToggle}
                disabled={saving}
              >
                {saving ? 'Updating…' : toggleTarget.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove vital?"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-900">{deleteTarget.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{deleteTarget.code}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              This vital will be <strong>deactivated</strong> (soft deleted). It won't appear in new
              configurations but existing readings will remain intact.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? 'Removing…' : 'Yes, remove it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
