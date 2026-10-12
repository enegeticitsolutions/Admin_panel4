/**
 * Vital Config Templates Page
 * Admin-managed bundles of vitals for easy assignment
 */

import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { vitalApi } from '../../../services/api';
import {
  Plus,
  FileText,
  Users,
  CheckCircle2,
  Edit2,
  Copy,
  Trash2,
  Sparkles,
  Loader2,
  X,
  AlertTriangle,
  Activity,
  Heart,
  Thermometer,
  Scale,
  Droplets,
  Check,
  Search,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../components/ui/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface VitalDefinitionOption {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  dataType: string;
  isActive: boolean;
}

interface TemplateItem {
  id?: string;
  vitalDefinitionId: string;
  vitalCode?: string;
  vitalName?: string;
  frequency: string;
  isMandatory: boolean;
}

interface VitalTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  beneficiaryCount: number;
  items: TemplateItem[];
}

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
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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

const FREQUENCY_OPTIONS = [
  { value: 'every_visit', label: 'Every visit' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function VitalTemplatesPage() {
  const [templates, setTemplates] = useState<VitalTemplate[]>([]);
  const [availableVitals, setAvailableVitals] = useState<VitalDefinitionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VitalTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VitalTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formItems, setFormItems] = useState<TemplateItem[]>([]);
  const [vitalSearch, setVitalSearch] = useState('');

  useEffect(() => {
    load();
    loadVitals();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await vitalApi.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadVitals = async () => {
    try {
      // Fetch only active vitals directly from the user's master table
      const data = await vitalApi.getAll({ activeOnly: true });
      if (Array.isArray(data)) {
        setAvailableVitals(data.filter(v => v.isActive !== false));
      }
    } catch (_) {}
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await vitalApi.seedDefaultTemplates();
      toast.success('Standard vital templates seeded successfully!');
      if (Array.isArray(res)) {
        setTemplates(res);
      } else {
        await load();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed templates');
    } finally {
      setSeeding(false);
    }
  };

  const openCreateModal = () => {
    loadVitals(); // Always refresh to pick up newly added custom vitals
    setEditTarget(null);
    setFormName('');
    setFormDescription('');
    setFormIsDefault(templates.length === 0);
    // Do NOT hardcode any vitals — start empty so user chooses freely from their own table
    setFormItems([]);
    setVitalSearch('');
    setFormOpen(true);
  };

  const openEditModal = (template: VitalTemplate) => {
    loadVitals();
    setEditTarget(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormIsDefault(template.isDefault);
    setFormItems(
      (template.items || []).map(i => ({
        vitalDefinitionId: i.vitalDefinitionId,
        vitalCode: i.vitalCode,
        vitalName: i.vitalName,
        frequency: i.frequency || 'every_visit',
        isMandatory: !!i.isMandatory,
      }))
    );
    setVitalSearch('');
    setFormOpen(true);
  };

  const openCloneModal = (template: VitalTemplate) => {
    loadVitals();
    setEditTarget(null);
    setFormName(`Copy of ${template.name}`);
    setFormDescription(template.description || '');
    setFormIsDefault(false);
    setFormItems(
      (template.items || []).map(i => ({
        vitalDefinitionId: i.vitalDefinitionId,
        vitalCode: i.vitalCode,
        vitalName: i.vitalName,
        frequency: i.frequency || 'every_visit',
        isMandatory: !!i.isMandatory,
      }))
    );
    setVitalSearch('');
    setFormOpen(true);
  };

  const toggleVitalInForm = (vital: VitalDefinitionOption) => {
    const exists = formItems.some(i => i.vitalDefinitionId === vital.id);
    if (exists) {
      setFormItems(prev => prev.filter(i => i.vitalDefinitionId !== vital.id));
    } else {
      setFormItems(prev => [
        ...prev,
        {
          vitalDefinitionId: vital.id,
          vitalCode: vital.code,
          vitalName: vital.name,
          frequency: 'every_visit',
          isMandatory: false,
        },
      ]);
    }
  };

  const updateItemFrequency = (vitalDefinitionId: string, frequency: string) => {
    setFormItems(prev =>
      prev.map(i => (i.vitalDefinitionId === vitalDefinitionId ? { ...i, frequency } : i))
    );
  };

  const updateItemMandatory = (vitalDefinitionId: string, isMandatory: boolean) => {
    setFormItems(prev =>
      prev.map(i => (i.vitalDefinitionId === vitalDefinitionId ? { ...i, isMandatory } : i))
    );
  };

  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (formItems.length === 0) {
      toast.error('Please select at least one vital metric for this template');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        isDefault: formIsDefault,
        items: formItems.map((item, idx) => ({
          vitalDefinitionId: item.vitalDefinitionId,
          frequency: item.frequency,
          isMandatory: item.isMandatory,
          displayOrder: idx,
        })),
      };

      if (editTarget) {
        await vitalApi.updateTemplate(editTarget.id, payload);
        toast.success('Template updated successfully');
      } else {
        await vitalApi.createTemplate(payload);
        toast.success('Template created successfully');
      }

      setFormOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await vitalApi.deleteTemplate(deleteTarget.id);
      toast.success('Template removed');
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  // Calculations for stats cards
  const totalTemplates = templates.length;
  const defaultTemplatesCount = templates.filter(t => t.isDefault).length;
  const totalBeneficiariesAssigned = templates.reduce((acc, t) => acc + (t.beneficiaryCount || 0), 0);
  const activeTemplatesCount = templates.filter(t => t.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config templates"
        description="Admin > Vitals > Config templates"
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSeedDefaults}
              disabled={seeding}
              variant="outline"
              className="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Seed Standard Bundles
            </Button>
            <Button
              onClick={openCreateModal}
              className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Create template
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Templates', value: totalTemplates, color: 'text-orange-500' },
          { label: 'Default template', value: defaultTemplatesCount, color: 'text-slate-900' },
          { label: 'Beneficiaries on templates', value: totalBeneficiariesAssigned, color: 'text-slate-900' },
          { label: 'Active bundles', value: activeTemplatesCount, color: 'text-emerald-600' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className={cn('text-3xl font-bold mt-1', stat.color)}>{stat.value}</h3>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {!loading && templates.length === 0 && (
        <Card className="border-2 border-dashed border-orange-200 bg-white/60 p-12 text-center rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center p-0">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4 shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Config Templates Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Vital config templates group measurements into standardized bundles (e.g. Standard Care, Diabetic Care, Cardiac Care) to assign to seniors in one click.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Seed Standard Templates
              </Button>
              <Button
                onClick={openCreateModal}
                variant="outline"
                className="border-slate-300 text-slate-700 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="border-none shadow-sm bg-white animate-pulse h-32 rounded-2xl" />
            ))
        ) : (
          templates.map(template => (
            <Card
              key={template.id}
              className="border-none shadow-sm bg-white overflow-hidden group hover:ring-1 hover:ring-orange-200 transition-all rounded-2xl"
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
                      {template.isDefault && (
                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-50">Default</Badge>
                      )}
                      {template.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50">Active</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.description || 'No description provided'} —{' '}
                      <span className="font-semibold text-slate-700">{template.beneficiaryCount || 0}</span> beneficiaries assigned
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => openEditModal(template)}
                      variant="outline"
                      size="sm"
                      className="h-9 border-slate-200 hover:border-orange-200 hover:text-orange-600 font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => openCloneModal(template)}
                      variant="outline"
                      size="sm"
                      className="h-9 border-slate-200 hover:border-slate-300 font-medium"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Clone
                    </Button>
                    <Button
                      onClick={() => setDeleteTarget(template)}
                      variant="outline"
                      size="sm"
                      className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {(template.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors',
                        item.isMandatory
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      )}
                    >
                      <span className="font-semibold">{item.vitalName || item.vitalCode}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="font-bold uppercase tracking-tight text-[10px]">
                        {item.frequency?.replace('_', ' ') || 'Every visit'}
                      </span>
                      {item.isMandatory && (
                        <span className="ml-1 text-[9px] uppercase font-bold text-rose-500">Mandatory</span>
                      )}
                    </div>
                  ))}
                  {(!template.items || template.items.length === 0) && (
                    <span className="text-xs text-slate-400 italic">No vitals configured in this bundle yet.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? 'Edit vital template' : 'Create vital template'}
        subtitle={
          editTarget
            ? `Editing bundle: ${editTarget.name}`
            : 'Configure a bundle of vitals to quickly assign to beneficiaries'
        }
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                Template Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Diabetic Care, Cardiac Monitoring"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800 mb-1.5 block">Description</label>
              <textarea
                rows={2}
                placeholder="Summary of this care bundle and who it is recommended for"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none transition-all"
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/70 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={e => setFormIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 border-slate-300"
              />
              <div>
                <p className="text-sm font-bold text-slate-800">Set as Default Template</p>
                <p className="text-xs text-slate-500">Automatically applies to newly enrolled beneficiaries</p>
              </div>
            </label>
          </div>

          {/* Vitals Selection */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Included Vitals ({formItems.length})</h4>
                <p className="text-xs text-slate-500">Select which vital measurements belong to this bundle</p>
              </div>
            </div>

            {/* Vital search filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search available vitals to add..."
                className="pl-9 h-9 text-xs"
                value={vitalSearch}
                onChange={e => setVitalSearch(e.target.value)}
              />
            </div>

            {/* Selected items list with config */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {formItems.map(item => {
                const def = availableVitals.find(v => v.id === item.vitalDefinitionId);
                return (
                  <div
                    key={item.vitalDefinitionId}
                    className="p-3 rounded-xl border border-orange-200 bg-orange-50/30 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {item.vitalName || def?.name || item.vitalCode}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">({item.vitalCode || def?.code})</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Frequency */}
                      <select
                        value={item.frequency}
                        onChange={e => updateItemFrequency(item.vitalDefinitionId, e.target.value)}
                        className="bg-white border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none font-medium"
                      >
                        {FREQUENCY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* Mandatory Toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={item.isMandatory}
                          onChange={e => updateItemMandatory(item.vitalDefinitionId, e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-orange-500"
                        />
                        <span>Mandatory</span>
                      </label>

                      {/* Remove */}
                      <button
                        onClick={() =>
                          setFormItems(prev => prev.filter(i => i.vitalDefinitionId !== item.vitalDefinitionId))
                        }
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        title="Remove vital"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {formItems.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  No vitals selected. Pick from the available measurements below.
                </div>
              )}
            </div>

            {/* Available vitals pills to toggle */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Active Vitals from Master Table ({availableVitals.length})
                </p>
                {availableVitals.length === 0 && (
                  <span className="text-[11px] text-amber-600 font-medium">No active vitals found</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 rounded-xl bg-slate-50/60 border border-slate-100">
                {availableVitals
                  .filter(
                    v =>
                      !vitalSearch ||
                      v.name.toLowerCase().includes(vitalSearch.toLowerCase()) ||
                      v.code.toLowerCase().includes(vitalSearch.toLowerCase())
                  )
                  .map(v => {
                    const isSelected = formItems.some(i => i.vitalDefinitionId === v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVitalInForm(v)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all',
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{v.name}</span>
                        <span className={cn('text-[10px]', isSelected ? 'text-orange-100' : 'text-slate-400')}>
                          ({v.code})
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              onClick={handleSaveTemplate}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template?">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-slate-900">{deleteTarget.name}</p>
                <p className="text-xs text-slate-500">
                  {deleteTarget.beneficiaryCount || 0} beneficiaries currently linked
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Are you sure you want to delete this template? If any beneficiaries currently use this template, it will be
              deactivated to preserve their assigned metrics.
            </p>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold"
                onClick={handleDeleteTemplate}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
