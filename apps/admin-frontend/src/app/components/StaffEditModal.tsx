import React, { useEffect, useState } from 'react';
import { X, Loader2, Save, User, Briefcase, MapPin, Users, Phone, Mail, GraduationCap, Calendar, Languages, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { staffOnboardingApi } from '../../services/api';
import { ProfilePhotoUploader } from './common/ProfilePhotoUploader';
import type { StaffOnboardingMetadata, StaffOnboardingRole } from '../../types';

interface StaffEditModalProps {
  userId: string;
  role: StaffOnboardingRole;
  onClose: () => void;
  onSuccess: () => void;
}

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Punjabi', 'Urdu', 'Tamil', 'Bengali', 'Marathi', 'Telugu'];

export default function StaffEditModal({ userId, role, onClose, onSuccess }: StaffEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<StaffOnboardingMetadata | null>(null);
  const [formState, setFormState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'assignment'>('personal');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [staffData, metaData] = await Promise.all([
          staffOnboardingApi.getStaffDetails(userId),
          staffOnboardingApi.getMetadata()
        ]);
        setFormState(staffData);
        setMetadata(metaData);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load staff details');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const { personal } = formState;
    if (personal.mobileNumber && personal.mobileNumber.length !== 10) {
      toast.error('Mobile number must be 10 digits');
      return;
    }
    if (personal.alternatePhone && personal.mobileNumber === personal.alternatePhone) {
      toast.error('Mobile and Alternate numbers cannot be the same');
      return;
    }
    if (personal.aadhaarNumber && personal.aadhaarNumber.length !== 12) {
      toast.error('Aadhaar number must be 12 digits');
      return;
    }

    setSaving(true);
    try {
      await staffOnboardingApi.updateStaff(userId, formState);
      toast.success('Staff profile updated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const updateNestedField = (section: string, field: string, value: any) => {
    let sanitizedValue = value;

    // Apply restrictions
    if (field === 'mobileNumber' || field === 'pincode' || field === 'whatsappNumber' || field === 'alternatePhone') {
      const limit = field === 'pincode' ? 6 : 10;
      sanitizedValue = value.replace(/\D/g, '').slice(0, limit);
    } else if (field === 'aadhaarNumber') {
      sanitizedValue = value.replace(/\D/g, '').slice(0, 12);
    } else if (field === 'panNumber') {
      sanitizedValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    } else if (field === 'experience') {
      sanitizedValue = value.replace(/\D/g, '');
    }

    setFormState((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: sanitizedValue
      }
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-[32px] p-12 flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#FF7A00]" size={40} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Fetching Profile...</p>
        </div>
      </div>
    );
  }

  const roleLabels: Record<StaffOnboardingRole, string> = {
    care_companion: 'Care Companion',
    field_manager: 'Field Manager',
    operations_manager: 'Operations Manager',
    customer_service: 'Customer Service Agent',
    customer_service_manager: 'Customer Service Manager',
    saathi_coordinator: 'Saathi Coordinator'
  };

  const roleColors: Record<StaffOnboardingRole, string> = {
    care_companion: 'text-[#FF7A00]',
    field_manager: 'text-[#1F8A3E]',
    operations_manager: 'text-[#1D4ED8]',
    customer_service: 'text-[#7C3AED]',
    customer_service_manager: 'text-[#9333EA]',
    saathi_coordinator: 'text-[#0D9488]'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAF6F3] rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-[#E7DED6] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            {/* Profile Photo Uploader */}
            <ProfilePhotoUploader
              config={{
                targetType: role as any,
                targetId: userId,
                currentPhotoUrl: formState.personal?.photoUrl || null,
                name: formState.personal?.fullName || '',
                size: 56,
                editable: true,
                accentColor: 
                  role === 'care_companion' ? '#FF7A00' : 
                  role === 'field_manager' ? '#1F8A3E' : 
                  role === 'customer_service' ? '#7C3AED' :
                  '#1D4ED8',
                onSuccess: (url) => {
                  setFormState((prev: any) => ({
                    ...prev,
                    personal: { ...prev.personal, photoUrl: url },
                  }));
                  toast.success('Profile photo updated successfully');
                },
                onError: (err) => {
                  toast.error(`Photo upload failed: ${err}`);
                },
              }}
            />
            <div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Edit Profile</h2>
              <p className={`text-[10px] font-black uppercase tracking-widest ${roleColors[role]}`}>
                {roleLabels[role]}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white px-8 flex gap-8 border-b border-[#E7DED6] shrink-0">
          {[
            { id: 'personal', label: 'Personal Information', icon: User },
            { id: 'professional', label: 'Professional Setup', icon: Briefcase },
            { id: 'assignment', label: 'Team & Zone Access', icon: MapPin }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === tab.id
                  ? `border-[#FF7A00] text-[#FF7A00]`
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-sm font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <form id="edit-staff-form" onSubmit={handleSave} className="space-y-8">
            {/* PERSONAL TAB */}
            {activeTab === 'personal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      required
                      value={formState.personal.fullName}
                      onChange={(e) => updateNestedField('personal', 'fullName', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Preferred Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={formState.personal.preferredName || ''}
                      onChange={(e) => updateNestedField('personal', 'preferredName', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      required
                      value={formState.personal.mobileNumber}
                      onChange={(e) => updateNestedField('personal', 'mobileNumber', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      value={formState.personal.email}
                      onChange={(e) => updateNestedField('personal', 'email', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={formState.personal.whatsappNumber || ''}
                      onChange={(e) => updateNestedField('personal', 'whatsappNumber', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Alternate Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={formState.personal.alternatePhone || ''}
                      onChange={(e) => updateNestedField('personal', 'alternatePhone', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="date"
                      value={formState.personal.dateOfBirth}
                      onChange={(e) => updateNestedField('personal', 'dateOfBirth', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Address Line 1 *</label>
                    <input
                      required
                      value={formState.personal.addressLine1}
                      onChange={(e) => updateNestedField('personal', 'addressLine1', e.target.value)}
                      placeholder="Street address, block..."
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Address Line 2</label>
                    <input
                      value={formState.personal.addressLine2 || ''}
                      onChange={(e) => updateNestedField('personal', 'addressLine2', e.target.value)}
                      placeholder="Locality, landmarks..."
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">City *</label>
                    <input
                      required
                      value={formState.personal.city || ''}
                      onChange={(e) => updateNestedField('personal', 'city', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">State *</label>
                    <input
                      required
                      value={formState.personal.state || ''}
                      onChange={(e) => updateNestedField('personal', 'state', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Pincode *</label>
                    <input
                      required
                      value={formState.personal.pincode}
                      onChange={(e) => updateNestedField('personal', 'pincode', e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E7DED6]">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Aadhaar Number *</label>
                    <input
                      required
                      value={formState.personal.aadhaarNumber || ''}
                      onChange={(e) => updateNestedField('personal', 'aadhaarNumber', e.target.value)}
                      placeholder="12 digit Aadhaar"
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">PAN Number</label>
                    <input
                      value={formState.personal.panNumber || ''}
                      onChange={(e) => updateNestedField('personal', 'panNumber', e.target.value)}
                      placeholder="10 char PAN"
                      className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                {/* Bio — full width at bottom of Personal tab */}
                <div className="md:col-span-2 space-y-1 pt-4 border-t border-[#E7DED6]">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Professional Bio</label>
                  <p className="text-[10px] text-gray-400 px-1 mb-2">Shown to beneficiaries on the mobile app when they view their care team.</p>
                  <textarea
                    value={formState.professional.bio || ''}
                    onChange={(e) => updateNestedField('professional', 'bio', e.target.value)}
                    placeholder="e.g. Certified nurse with 5+ years of experience in geriatric home care and daily vitals monitoring..."
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00] resize-none"
                  />
                  <p className="text-[10px] text-gray-400 text-right px-1">
                    {(formState.professional.bio || '').length}/500
                  </p>
                </div>
              </div>
            )}

            {/* PROFESSIONAL TAB */}
            {activeTab === 'professional' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Highest Qualification</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={formState.professional.qualification}
                      onChange={(e) => updateNestedField('professional', 'qualification', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Experience (Years)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      value={formState.professional.experience}
                      onChange={(e) => updateNestedField('professional', 'experience', e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                    />
                  </div>
                </div>

                {role === 'care_companion' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nursing Registration #</label>
                      <input
                        value={formState.professional.nursingRegistrationNumber || ''}
                        onChange={(e) => updateNestedField('professional', 'nursingRegistrationNumber', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nursing Council</label>
                      <input
                        value={formState.professional.nursingCouncil || ''}
                        onChange={(e) => updateNestedField('professional', 'nursingCouncil', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Preferred Shift</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                          value={formState.professional.preferredShift || 'any'}
                          onChange={(e) => updateNestedField('professional', 'preferredShift', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00] appearance-none"
                        >
                          <option value="any">Any Shift</option>
                          <option value="day">Day (8 AM - 8 PM)</option>
                          <option value="night">Night (8 PM - 8 AM)</option>
                          <option value="live_in">Live-in (24 hrs)</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Max Daily Visits</label>
                      <input
                        type="number"
                        value={formState.professional.maxDailyVisits || 4}
                        onChange={(e) => updateNestedField('professional', 'maxDailyVisits', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2 mb-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Type of Care Companion</label>
                      <div className="flex gap-4">
                        {[
                          { id: 'nurse', label: 'Nurse' },
                          { id: 'care_assistant', label: 'Care Assistant' },
                        ].map((type) => (
                          <label
                            key={type.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
                              formState.professional.ccType === type.id
                                ? 'bg-[#FF7A00] border-[#FF7A00] text-white'
                                : 'bg-white border-[#E7DED6] text-gray-600 hover:border-[#FF7A00]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="ccType"
                              value={type.id}
                              checked={formState.professional.ccType === type.id}
                              onChange={(e) => updateNestedField('professional', 'ccType', e.target.value)}
                              className="hidden"
                            />
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formState.professional.ccType === type.id ? 'border-white' : 'border-gray-300'}`}>
                              {formState.professional.ccType === type.id && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="font-bold text-xs">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {role === 'field_manager' && (
                   <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Previous Employer</label>
                      <input
                        value={formState.professional.previousEmployer || ''}
                        onChange={(e) => updateNestedField('professional', 'previousEmployer', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Max Team Size</label>
                      <input
                        type="number"
                        value={formState.professional.maxTeamSize || 10}
                        onChange={(e) => updateNestedField('professional', 'maxTeamSize', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                  </>
                )}

                {role !== 'customer_service' && (
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                      <Languages size={14} /> Skills & Specializations
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(metadata?.specializations || []).map((spec) => (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => {
                            const current = formState.professional.specialization || [];
                            if (current.includes(spec)) {
                              updateNestedField('professional', 'specialization', current.filter((s: string) => s !== spec));
                            } else {
                              updateNestedField('professional', 'specialization', [...current, spec]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            (formState.professional.specialization || []).includes(spec)
                              ? 'bg-[#FF7A00] text-white shadow-md'
                              : 'bg-white text-gray-500 border border-[#E7DED6] hover:border-[#FF7A00]'
                          }`}
                        >
                          {spec}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 space-y-3 pt-4 border-t border-[#E7DED6]">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Languages size={14} /> Spoken Languages
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          const current = formState.professional.languages || [];
                          if (current.includes(lang)) {
                            updateNestedField('professional', 'languages', current.filter((l: string) => l !== lang));
                          } else {
                            updateNestedField('professional', 'languages', [...current, lang]);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          (formState.professional.languages || []).includes(lang)
                            ? 'bg-[#FF7A00] text-white shadow-md'
                            : 'bg-white text-gray-500 border border-[#E7DED6] hover:border-[#FF7A00]'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ASSIGNMENT TAB */}
                {activeTab === 'assignment' && (
                  <div className="space-y-6">
                    {role === 'customer_service' ? (
                      <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#7C3AED] shadow-sm">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-800">Global Support Access</p>
                          <p className="text-[10px] text-gray-500">CSAs are onboarded with system-wide access. No zone assignment is required.</p>
                        </div>
                      </div>
                    ) : role === 'operations_manager' ? (
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-4">Manage Zone Assignments (Multi-select)</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {metadata?.zones.map((zone) => (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => {
                                const current = formState.assignment.zoneIds || [];
                                if (current.includes(zone.id)) {
                                  updateNestedField('assignment', 'zoneIds', current.filter((id: string) => id !== zone.id));
                                } else {
                                  updateNestedField('assignment', 'zoneIds', [...current, zone.id]);
                                }
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                (formState.assignment.zoneIds || []).includes(zone.id)
                                  ? 'bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]'
                                  : 'bg-white border-[#E7DED6] text-gray-500'
                              }`}
                            >
                              <div className="text-left">
                                <p className="text-sm font-black">{zone.name}</p>
                                <p className="text-[10px] opacity-60 uppercase">{zone.city}</p>
                              </div>
                              {(formState.assignment.zoneIds || []).includes(zone.id) && <CheckCircle2 size={16} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Primary Assignment Zone</label>
                          <select
                            value={formState.assignment.zoneId}
                            onChange={(e) => updateNestedField('assignment', 'zoneId', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                          >
                            <option value="">Select a Zone</option>
                            {metadata?.zones.map((z) => (
                              <option key={z.id} value={z.id}>{z.name} ({z.city})</option>
                            ))}
                          </select>
                        </div>

                        {role === 'care_companion' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Assigned Team</label>
                            <select
                              value={formState.assignment.teamId}
                              onChange={(e) => updateNestedField('assignment', 'teamId', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                            >
                              <option value="">No Team Assigned</option>
                              {metadata?.teams
                                .filter(t => t.zone === formState.assignment.zoneId || formState.assignment.zoneId === '')
                                .map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {role === 'field_manager' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Reports to (OM)</label>
                            <select
                              value={formState.assignment.reportsToUserId}
                              onChange={(e) => updateNestedField('assignment', 'reportsToUserId', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                            >
                              <option value="">No Manager Assigned</option>
                              {metadata?.operationsManagers.map((m) => (
                                <option key={m.userId} value={m.userId}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Verification Status */}
                    <div className="mt-8 pt-6 border-t border-[#E7DED6]">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-4">Access & Security</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Set / Reset Password</label>
                          <input
                            type="text"
                            placeholder="Type new password..."
                            value={formState.personal.newPassword || ''}
                            onChange={(e) => updateNestedField('personal', 'newPassword', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                          />
                          <p className="text-[9px] text-gray-400 px-1">Leave blank to keep existing password. Minimum 6 characters.</p>
                        </div>
                      </div>
                    </div>

                    {/* Verification Status */}
                    <div className="mt-8 pt-6 border-t border-[#E7DED6]">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-4">Verification Status & Initiation</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">BGV Initiation Type</label>
                          <select
                            value={formState.assignment.bgvType || 'police_clearance'}
                            onChange={(e) => updateNestedField('assignment', 'bgvType', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                          >
                            <option value="police_clearance">Police clearance</option>
                            <option value="address_verification">Address verification</option>
                            <option value="employment_history">Employment history</option>
                            <option value="education_verification">Education verification</option>
                            <option value="identity_verification">Identity verification</option>
                            <option value="reference_check">Reference check</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">BGV Agency Name</label>
                          <input
                            value={formState.assignment.bgvAgency || ''}
                            onChange={(e) => updateNestedField('assignment', 'bgvAgency', e.target.value)}
                            placeholder="Agency / Partner Name"
                            className="w-full px-4 py-3 bg-white border border-[#E7DED6] rounded-2xl font-bold text-sm focus:outline-none focus:border-[#FF7A00]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center justify-between bg-white rounded-2xl p-4 border border-[#E7DED6] cursor-pointer hover:border-[#FF7A00] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                              <ShieldCheck size={16} />
                            </div>
                            <span className="font-bold text-gray-700">Background Verified</span>
                          </div>
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded-lg border-[#E7DED6] text-[#FF7A00] focus:ring-[#FF7A00]"
                            checked={Boolean(formState.assignment.bgvVerified)}
                            onChange={(e) => updateNestedField('assignment', 'bgvVerified', e.target.checked)}
                          />
                        </label>

                        <label className="flex items-center justify-between bg-white rounded-2xl p-4 border border-[#E7DED6] cursor-pointer hover:border-[#FF7A00] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                              <CheckCircle2 size={16} />
                            </div>
                            <span className="font-bold text-gray-700">KYC Verified</span>
                          </div>
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded-lg border-[#E7DED6] text-[#FF7A00] focus:ring-[#FF7A00]"
                            checked={Boolean(formState.assignment.kycVerified)}
                            onChange={(e) => updateNestedField('assignment', 'kycVerified', e.target.checked)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
          </form>
        </div>

        {/* Footer */}
        <div className="bg-white px-8 py-6 border-t border-[#E7DED6] flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Tracking</p>
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-xl text-[10px] font-black uppercase">
              <ShieldCheck size={12} /> Account Active
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              form="edit-staff-form"
              type="submit"
              disabled={saving}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-lg shadow-orange-100 disabled:opacity-60 ${
                role === 'care_companion' ? 'bg-[#FF7A00] hover:bg-[#e06e00]' : 
                role === 'field_manager' ? 'bg-[#1F8A3E] hover:bg-[#16652d]' : 
                role === 'customer_service' ? 'bg-[#7C3AED] hover:bg-[#6D28D9]' :
                'bg-[#1D4ED8] hover:bg-[#1539a1]'
              }`}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
