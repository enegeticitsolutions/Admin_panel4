import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { 
  User, Phone, Mail, MapPin, Calendar, Loader2, Heart, Activity, 
  Thermometer, Droplet, Scale, RefreshCw, UserCheck, ArrowLeft, Edit2, Trash2,
  CalendarClock, Eye, Pencil, CheckCircle2, XCircle
} from 'lucide-react';
import { beneficiaryApi, visitApi, fileAccessApi } from '../../services/api';
import { StatusChip } from '../components/common/StatusChip';
import { ProfilePhotoUploader } from '../components/common/ProfilePhotoUploader';
import { RefreshButton } from '../components/common/RefreshButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { EditBeneficiaryDialog } from '../components/forms/EditBeneficiaryDialog';
import { AddMedicineDialog } from '../components/forms/AddMedicineDialog';
import { AddConditionDialog } from '../components/forms/AddConditionDialog';
import { PackageUtilizationPanel } from '../components/PackageUtilizationPanel';
import VisitDetailsModal from '../components/field-management/VisitDetailsModal';
import { format } from 'date-fns';

interface StaffPool {
  careCompanions: { id: string; userId: string; name: string; zone: string; isAvailable: boolean }[];
  fieldManagers: { id: string; userId: string; name: string; zone: string; isAvailable: boolean }[];
  zones: { id: string; name: string; pincode: string }[];
}

const vitalIcons: any = {
  bloodPressure: Activity, spO2: Activity, temperature: Thermometer,
  heartRate: Heart, bloodSugar: Droplet, weight: Scale,
};

export default function BeneficiaryProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [isAddConditionOpen, setIsAddConditionOpen] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string>('');

  // Visits tab state
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [openModalVisitId, setOpenModalVisitId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const handleOpenPreview = async (doc: any) => {
    try {
      setLoadingPreviewId(doc.id);
      const presignedUrl = await fileAccessApi.getPresignedUrl('medical_record', doc.id);
      setPreviewDoc({ ...doc, fileUrl: presignedUrl });
    } catch (e) {
      console.warn('Could not fetch presigned URL, falling back to direct URL:', e);
      setPreviewDoc(doc);
    } finally {
      setLoadingPreviewId(null);
    }
  };
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'profile');

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  const [staffPool, setStaffPool] = useState<StaffPool>({ careCompanions: [], fieldManagers: [], zones: [] });
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pendingPrimary, setPendingPrimary] = useState<string | null | undefined>(undefined);
  const [pendingSecondary, setPendingSecondary] = useState<string | null | undefined>(undefined);

  const fetchDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await beneficiaryApi.getById(id);
      setDetails(data);
      if (data.pincode) {
        fetchStaffPool(data.pincode, data.teamId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load beneficiary details');
    } finally {
      setLoading(false);
    }
  };

  const refreshDetailsBackground = async () => {
    if (!id) return;
    try {
      const data = await beneficiaryApi.getById(id);
      setDetails(data);
      // Optional: don't auto-fetch staff pool to avoid heavy nested calls unless needed, 
      // but here we just update the details to catch relationship/med change.
    } catch (err) {
      console.error('Background refresh failed', err);
    }
  };

  const fetchStaffPool = async (pincode: string, teamId?: string | null) => {
    setLoadingStaff(true);
    try {
      const pool = await beneficiaryApi.getAvailableStaff(pincode, teamId);
      setStaffPool(pool);
    } catch (err) {
      console.error('Failed to load available staff', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchVisits = async () => {
    if (!id) return;
    setVisitsLoading(true);
    try {
      const data = await visitApi.getAll({ beneficiaryId: id });
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load visits', err);
    } finally {
      setVisitsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'visits') fetchVisits();
  }, [activeTab, id]);

  const handleAssignStaff = async () => {
    if (!details || !id) return;
    setAssigning(true);
    try {
      const payload: any = {};
      if (pendingPrimary !== undefined) payload.primaryCcId = pendingPrimary;
      if (pendingSecondary !== undefined) payload.secondaryCcId = pendingSecondary;
      await beneficiaryApi.assignStaff(id, payload);
      toast.success('Staff assigned successfully!');
      setPendingPrimary(undefined);
      setPendingSecondary(undefined);
      await fetchDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign staff');
    } finally {
      setAssigning(false);
    }
  };

  const handleVitalToggle = async (vitalKey: string, enabled: boolean) => {
    if (!details) return;
    try {
      await beneficiaryApi.updateClinicalConfig(details.id, {
        [vitalKey]: { ...details.clinicalConfiguration?.[vitalKey], enabled },
      });
      await fetchDetails();
      toast.success(`${vitalKey} monitoring ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update configuration');
    }
  };

  const handleStopMedication = async (medicationId: string) => {
    if (!id || !confirm('Are you sure you want to stop this medication?')) return;
    try {
      await beneficiaryApi.stopMedication(id, medicationId);
      toast.success('Medication stopped');
      refreshDetailsBackground();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop medication');
    }
  };

  const handleRemoveCondition = async (conditionId: string) => {
    if (!id || !confirm('Are you sure you want to remove this medical condition?')) return;
    try {
      await beneficiaryApi.removeCondition(id, conditionId);
      toast.success('Condition removed');
      refreshDetailsBackground();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove condition');
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#F4EAE3] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF7A00]" />
          <p className="font-bold text-sm uppercase tracking-widest text-gray-500">Loading Beneficiary Profile...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-8 bg-[#F4EAE3] min-h-screen">
        <Button variant="ghost" onClick={() => navigate('/beneficiaries')} className="mb-6 gap-2">
          <ArrowLeft size={16} /> Back to Beneficiaries
        </Button>
        <div className="bg-white rounded-[32px] p-20 border border-dashed border-[#E7DED6] text-center">
          <h2 className="text-xl font-bold text-gray-800">{error || 'Beneficiary not found'}</h2>
          <Button onClick={() => navigate('/beneficiaries')} className="mt-6 bg-[#FF7A00]">Return to List</Button>
        </div>
      </div>
    );
  }

  const effectivePrimary = pendingPrimary !== undefined ? pendingPrimary : details.primaryCcId;
  const effectiveSecondary = pendingSecondary !== undefined ? pendingSecondary : details.secondaryCcId;
  const hasChanges = pendingPrimary !== undefined || pendingSecondary !== undefined;

  const primaryContact = Array.isArray(details.emergencyContacts)
    ? details.emergencyContacts.find((c: any) => c.isPrimary) || details.emergencyContacts[0]
    : null;
  const isFallback = primaryContact?.name?.toLowerCase() === 'subscriber';
  const hasRealContact = primaryContact && !isFallback;

  return (
    <div className="p-8 bg-[#F4EAE3] min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <RefreshButton onRefresh={refreshDetailsBackground} label="Refresh Data" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
              <div className="flex flex-col items-center text-center">
                {/* Profile Photo Uploader */}
                <div className="mb-4">
                  <ProfilePhotoUploader
                    config={{
                      targetType: 'beneficiary',
                      targetId: details.id,
                      currentPhotoUrl: details.photo || null,
                      name: details.name,
                      size: 96,
                      editable: true,
                      accentColor: '#FF7A00',
                      onSuccess: (url) => {
                        setDetails((prev: any) => ({ ...prev, photo: url }));
                        toast.success('Beneficiary photo updated successfully');
                      },
                      onError: (err) => {
                        toast.error(`Photo upload failed: ${err}`);
                      },
                    }}
                  />
                </div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{details.name}</h1>
                <div className="mt-2 flex flex-col gap-1 items-center">
                  {details.verificationStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                      Pending Verification
                    </span>
                  ) : (
                    <StatusChip status={details.isActive ? 'Active' : 'Inactive'} />
                  )}
                </div>
                <p className="text-xs font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">Age: {details.age} • {details.gender}{details.relationship ? ` • ${details.relationship}` : ''}</p>
              </div>

              <div className="mt-8 space-y-4 pt-8 border-t border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-[#FF7A00] flex-shrink-0">
                    <Phone size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Beneficiary Number</p>
                    <p className="text-sm font-bold text-gray-700">{details.phone || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0">
                    <Phone size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Emergency Contact</p>
                    {hasRealContact ? (
                      <>
                        <p className="text-sm font-bold text-gray-700">{primaryContact.name} ({primaryContact.relationship || 'Emergency'})</p>
                        <p className="text-xs text-gray-500">{primaryContact.phone}</p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-gray-700 text-gray-400 italic">N/A</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Zone / Pincode</p>
                    <p className="text-sm font-bold text-gray-700">{details.pincode || 'N/A'}</p>
                    {details.city && <p className="text-xs text-gray-500">{details.city}, {details.state}</p>}
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Date of Birth</p>
                    {details.dateOfBirth ? (
                      <>
                        <p className="text-sm font-bold text-gray-700">
                          {new Date(details.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500">Age: {details.age}</p>
                      </>
                    ) : (
                      <p className="text-sm font-bold text-gray-400 italic">Not set — click Edit Care Profile</p>
                    )}
                  </div>
                </div>

                {/* Registered On */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Registered On</p>
                    <p className="text-sm font-bold text-gray-700">{details.createdAt ? new Date(details.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '--'}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="w-full mt-8 py-3 rounded-2xl bg-[#F4EAE3] text-gray-700 font-black uppercase tracking-widest text-[10px] border border-[#E7DED6] hover:bg-[#E7DED6] transition-colors flex items-center justify-center gap-2">
                <Edit2 size={14} /> Edit Care Profile
              </button>
            </div>


            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#E7DED6]">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Subscriber Info</h4>
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                     <User size={20} />
                  </div>
                  <div className="flex-1">
                     <p className="text-sm font-bold text-gray-800">{details.subscriber?.name || 'Unknown'}</p>
                     <p className="text-xs font-bold text-gray-500">{details.subscriber?.phone}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/subscribers/${details.subscriberId}`)}>
                     View
                  </Button>
               </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
              <TabsList className="bg-white/50 p-1.5 rounded-3xl h-auto flex gap-1 border border-[#E7DED6] backdrop-blur-sm flex-wrap">
                <TabsTrigger value="profile" className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl data-[state=active]:bg-white data-[state=active]:text-[#FF7A00] data-[state=active]:shadow-md transition-all">Health Profile</TabsTrigger>
                <TabsTrigger value="usage" className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl data-[state=active]:bg-white data-[state=active]:text-[#FF7A00] data-[state=active]:shadow-md transition-all">Membership & Package Usage</TabsTrigger>
                <TabsTrigger value="assign" className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl data-[state=active]:bg-white data-[state=active]:text-[#FF7A00] data-[state=active]:shadow-md transition-all">Staff Assignment</TabsTrigger>
                <TabsTrigger value="clinical" className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl data-[state=active]:bg-white data-[state=active]:text-[#FF7A00] data-[state=active]:shadow-md transition-all">Clinical Config</TabsTrigger>
                <TabsTrigger value="visits" className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl data-[state=active]:bg-white data-[state=active]:text-[#1D4ED8] data-[state=active]:shadow-md transition-all flex items-center gap-1.5"><CalendarClock size={12} />Visits</TabsTrigger>
              </TabsList>

               <TabsContent value="profile" className="space-y-8 mt-0 outline-none">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                   <h3 className="text-lg font-black text-gray-800 mb-6">Medical Summary</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-black text-gray-700 block uppercase tracking-widest">Medical Information</Label>
                          <button onClick={() => setIsAddConditionOpen(true)} className="text-[#FF7A00] font-black text-[10px] uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full">+ Add</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(details.conditions || []).filter((bc: any) => bc.isActive).length > 0 ? (
                            details.conditions.filter((bc: any) => bc.isActive).map((bc: any) => (
                              <span key={bc.conditionId} className="group relative px-4 py-2 bg-[#FFF5EE] text-[#FF7A00] rounded-2xl text-xs font-bold border border-orange-100 flex items-center gap-2">
                                {bc.condition?.name}
                                <Trash2 
                                  size={12} 
                                  className="cursor-pointer opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all" 
                                  onClick={() => handleRemoveCondition(bc.conditionId)}
                                />
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400 italic">None recorded</span>
                          )}
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-black text-gray-700 block uppercase tracking-widest">Current Medications</Label>
                          <button onClick={() => setIsAddMedOpen(true)} className="text-blue-600 font-black text-[10px] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">+ Add</button>
                        </div>
                        <div className="flex flex-col gap-3">
                          {details.medications && details.medications.filter((m: any) => m.isActive).length > 0 ? (
                            details.medications.filter((m: any) => m.isActive).map((m: any) => (
                              <div key={m.id} className="group flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-blue-900">{m.name} <span className="font-bold text-blue-600 opacity-80">{m.dosage}</span></span>
                                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">
                                    {m.frequency.replace('_', ' ')} &bull; {m.timeSlots.join(', ')} {m.setReminders ? '🔔' : ''}
                                  </span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Start: {m.startDate ? new Date(m.startDate).toLocaleDateString() : 'N/A'}</span>
                                    {m.endDate && <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">End: {new Date(m.endDate).toLocaleDateString()}</span>}
                                    {m.instructions && <span className="text-[9px] font-medium text-gray-500 italic">"{m.instructions}"</span>}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleStopMedication(m.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Stop Medication"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400 italic">No structured medications logged</span>
                          )}
                        </div>
                     </div>
                   </div>
                   <div className="mt-12 pt-8 border-t border-gray-50">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Care Scores</h4>
                      <div className="grid grid-cols-3 gap-4">
                         <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Emotional</p>
                            <p className="text-3xl font-black text-blue-600">{details.emotionalScore || '8.0'}</p>
                         </div>
                         <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Health</p>
                            <p className="text-3xl font-black text-green-600">{details.healthScore || '7.5'}</p>
                         </div>
                         <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Medication</p>
                            <p className="text-3xl font-black text-orange-600">{details.medicationScore || '100'}%</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Medical Records Section */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                   <h3 className="text-lg font-black text-gray-800 mb-2">Medical Records</h3>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Uploaded medical documents by the subscriber</p>
                   
                   {!details.medicalRecords || details.medicalRecords.length === 0 ? (
                      <div className="py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                         <p className="text-sm font-bold text-gray-400 uppercase">No documents uploaded yet</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {details.medicalRecords.map((doc: any) => (
                          <div 
                            key={doc.id} 
                            className={`p-5 rounded-[24px] border flex items-center justify-between transition-all ${
                              doc.isActive 
                                ? 'bg-white border-orange-100 hover:border-[#FF7A00]/40' 
                                : 'bg-gray-50/50 border-gray-100 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${doc.isActive ? 'bg-orange-50 text-[#FF7A00]' : 'bg-gray-200 text-gray-400'}`}>
                                <Activity size={20} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-sm truncate ${doc.isActive ? 'text-gray-800' : 'text-gray-500 line-through'}`}>{doc.title}</p>
                                  {!doc.isActive && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-100 text-red-600 rounded">REMOVED</span>
                                  )}
                                </div>
                                <p className="text-[10px] font-black text-gray-400 uppercase mt-1">
                                  Uploaded: {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            
                            {doc.fileUrl && (
                              <button 
                                onClick={() => handleOpenPreview(doc)}
                                disabled={loadingPreviewId === doc.id}
                                className="inline-flex items-center justify-center p-2 rounded-xl bg-orange-50 text-[#FF7A00] hover:bg-orange-100 transition-colors"
                              >
                                {loadingPreviewId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                   )}
                </div>
              </TabsContent>

              {/* ──────────────── MEMBERSHIP & PACKAGE USAGE TAB ──────────────── */}
              <TabsContent value="usage" className="mt-0 outline-none">
                <PackageUtilizationPanel
                  beneficiaryId={details.id}
                  beneficiaryName={details.name}
                  subscriberId={details.subscriber?.id || details.subscriberId}
                  subscriberName={details.subscriber?.name}
                  subscriberPhone={details.subscriber?.phone}
                  subscriberEmail={details.subscriber?.email}
                  defaultPincode={details.pincode}
                />
              </TabsContent>

              <TabsContent value="assign" className="space-y-6 mt-0 outline-none">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h3 className="text-lg font-black text-gray-800">Staff Assignment</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Manage Care Companions & Field Managers</p>
                     </div>
                     {details.pincode && (
                        <div className="bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 flex items-center gap-2">
                           <MapPin size={14} className="text-[#FF7A00]" />
                           <span className="text-xs font-black text-[#FF7A00]">PIN: {details.pincode}</span>
                        </div>
                     )}
                  </div>

                  {!details.teamId ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                      <UserCheck className="w-12 h-12 text-gray-200" />
                      <p className="font-bold text-gray-400 uppercase tracking-widest text-sm">Not Allocated to a Team</p>
                      <button 
                        onClick={() => navigate('/allocation')}
                        className="text-[#FF7A00] font-black text-[10px] uppercase tracking-widest bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 hover:bg-orange-100 transition-colors"
                      >
                        Allocate in Team
                      </button>
                    </div>
                  ) : !details.pincode ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                      <MapPin className="w-12 h-12 text-gray-200" />
                      <p className="font-bold text-gray-400 uppercase tracking-widest text-sm">Pincode missing on profile</p>
                      <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="text-[#FF7A00] font-black text-[10px] uppercase tracking-widest underline underline-offset-4"
                      >
                        Add Pincode to continue
                      </button>
                    </div>
                  ) : loadingStaff ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <RefreshCw className="w-10 h-10 animate-spin text-[#FF7A00]" />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Searching Zone Staff...</p>
                    </div>
                  ) : (
                    <div className="space-y-10">
                      {staffPool.zones.length > 0 ? (
                        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl text-xs font-bold text-green-700 uppercase tracking-tight">
                          <UserCheck className="w-5 h-5 flex-shrink-0" /> 
                          Successfully matched with Zone: <span className="underline ml-1">{staffPool.zones[0].name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl text-xs font-bold text-[#FF7A00] uppercase tracking-tight">
                          <Activity className="w-5 h-5 flex-shrink-0" /> 
                          No exact zone match for PIN {details.pincode}. Showing all available staff.
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Primary CC Selection */}
                        <div className="space-y-4">
                          <Label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-orange-500"></div> Primary Companion
                          </Label>
                          <div className="space-y-2">
                            {staffPool.careCompanions.map(cc => (
                              <button key={cc.id} onClick={() => setPendingPrimary(cc.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${effectivePrimary === cc.id ? 'bg-orange-50 border-[#FF7A00] shadow-sm' : 'bg-white border-gray-100 hover:border-orange-200 hover:bg-gray-50/50'}`}>
                                <div className="text-left">
                                  <p className="font-bold text-gray-800 text-sm">{cc.name}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{cc.isAvailable ? 'Available' : 'Limited availability'}</p>
                                </div>
                                {effectivePrimary === cc.id && <div className="w-6 h-6 rounded-full bg-[#FF7A00] flex items-center justify-center text-white shadow-sm shadow-orange-200"><UserCheck size={12} /></div>}
                              </button>
                            ))}
                            <button onClick={() => setPendingPrimary(null)} className={`w-full p-4 rounded-2xl border border-dashed transition-all text-center text-[10px] font-black uppercase tracking-widest ${effectivePrimary === null ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500'}`}>
                               Unassign Primary
                            </button>
                          </div>
                        </div>
                        {/* Secondary CC Selection */}
                        <div className="space-y-4">
                          <Label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500"></div> Secondary / Temporary
                          </Label>
                          <div className="space-y-2">
                            {staffPool.careCompanions.filter(cc => cc.id !== effectivePrimary).map(cc => (
                              <button key={cc.id} onClick={() => setPendingSecondary(cc.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${effectiveSecondary === cc.id ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50/50'}`}>
                                <div className="text-left">
                                  <p className="font-bold text-gray-800 text-sm">{cc.name}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{cc.isAvailable ? 'Available' : 'Assigned'}</p>
                                </div>
                                {effectiveSecondary === cc.id && <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm shadow-blue-200"><UserCheck size={12} /></div>}
                              </button>
                            ))}
                            <button onClick={() => setPendingSecondary(null)} className={`w-full p-4 rounded-2xl border border-dashed transition-all text-center text-[10px] font-black uppercase tracking-widest ${effectiveSecondary === null ? 'bg-red-50 border-red-200 text-red-600' : 'border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-500'}`}>
                               Unassign Secondary
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="pt-8 border-t border-gray-50">
                        <Button onClick={handleAssignStaff} disabled={!hasChanges || assigning} className="w-full h-16 bg-[#FF7A00] hover:bg-orange-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-50">
                          {assigning ? <><RefreshCw className="w-5 h-5 mr-3 animate-spin" /> Committing Changes...</> : 'Save Assignment Configuration'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="clinical" className="space-y-6 mt-0 outline-none">
                 <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                    <h3 className="text-lg font-black text-gray-800 mb-2">Vitals Monitoring</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8">Configure live tracking parameters</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {Object.entries(details.clinicalConfiguration || {}).map(([key, config]: [string, any]) => {
                          const Icon = vitalIcons[key] || Activity;
                          const vitalLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                          return (
                             <div key={key} className={`flex items-center justify-between p-6 rounded-[24px] border transition-all ${config.enabled ? 'bg-white border-orange-100 shadow-sm' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}>
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.enabled ? 'bg-orange-50 text-[#FF7A00]' : 'bg-gray-200 text-gray-400'}`}>
                                      <Icon size={24} />
                                   </div>
                                   <div>
                                      <p className="font-bold text-gray-800 text-sm">{vitalLabel}</p>
                                      <p className="text-[10px] font-black text-gray-400 uppercase mt-1">Freq: {config.frequency}</p>
                                   </div>
                                </div>
                                <Switch checked={config.enabled} onCheckedChange={(checked) => handleVitalToggle(key, checked)} className="data-[state=checked]:bg-[#FF7A00]" />
                             </div>
                          );
                       })}
                    </div>
                 </div>

                 {/* Historical Vitals Records */}
                 <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                    <h3 className="text-lg font-black text-gray-800 mb-2">Historical Clinical Records</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Select a past visit to view recorded vitals and remarks</p>
                    
                    {(!details.visits || details.visits.length === 0) ? (
                      <div className="py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                         <p className="text-sm font-bold text-gray-400 uppercase">No past visits found</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <select 
                          className="w-full h-14 rounded-2xl border-gray-200 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 focus:border-[#FF7A00] focus:ring-[#FF7A00] transition-all"
                          value={selectedVisitId}
                          onChange={(e) => setSelectedVisitId(e.target.value)}
                        >
                          <option value="" disabled>Select a visit to view records...</option>
                          {details.visits.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {new Date(v.scheduledTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - {v.status.toUpperCase()}
                            </option>
                          ))}
                        </select>

                        {selectedVisitId && details.visits.find((v: any) => v.id === selectedVisitId) && (() => {
                          const v = details.visits.find((v: any) => v.id === selectedVisitId);
                          
                          // 1. Map new dynamic readings
                          const dynamicVitals = (v.readings || []).map((r: any) => {
                             let valStr = r.valueText || '';
                             if (r.valueNumeric !== null && r.valueNumeric2 !== null) {
                               valStr = `${r.valueNumeric}/${r.valueNumeric2}`;
                             } else if (r.valueNumeric !== null) {
                               valStr = `${r.valueNumeric}`;
                             }
                             if (r.vitalDefinition?.unit && r.valueText === null) {
                               valStr += ` ${r.vitalDefinition.unit}`;
                             }
                             
                             let Icon = Activity;
                             const code = r.vitalDefinition?.code || '';
                             if (code.includes('BP') || code === 'PULSE') Icon = Heart;
                             if (code === 'TEMP') Icon = Thermometer;
                             if (code === 'WEIGHT') Icon = Scale;
                             if (code.includes('GLUCOSE') || code.includes('BLOOD')) Icon = Droplet;

                             return {
                               label: r.vitalDefinition?.name || 'Unknown',
                               value: valStr,
                               icon: Icon
                             };
                          });

                          // 2. Map legacy vitals if dynamic readings are missing
                          const legacyVitals: any[] = [];
                          const config = details.clinicalConfiguration || {};
                          
                          if (dynamicVitals.length === 0) {
                            if (config['bloodPressure']?.enabled && v.bpSystolic && v.bpDiastolic) legacyVitals.push({ label: 'Blood Pressure', value: `${v.bpSystolic}/${v.bpDiastolic} mmHg`, icon: Activity });
                            if (config['heartRate']?.enabled && v.heartRate) legacyVitals.push({ label: 'Heart Rate', value: `${v.heartRate} bpm`, icon: Heart });
                            if (config['spO2']?.enabled && v.oxygenLevel) legacyVitals.push({ label: 'SpO2', value: `${v.oxygenLevel}%`, icon: Activity });
                            if (config['temperature']?.enabled && v.temperature) legacyVitals.push({ label: 'Temperature', value: `${v.temperature}°F`, icon: Thermometer });
                            if (config['bloodSugar']?.enabled && v.bloodSugarFasting) legacyVitals.push({ label: 'Blood Sugar (Fasting)', value: `${v.bloodSugarFasting} mg/dL`, icon: Droplet });
                            if (config['bloodSugar']?.enabled && v.bloodSugarPostMeal) legacyVitals.push({ label: 'Blood Sugar (Post-meal)', value: `${v.bloodSugarPostMeal} mg/dL`, icon: Droplet });
                            if (config['weight']?.enabled && v.weight) legacyVitals.push({ label: 'Weight', value: `${v.weight} kg`, icon: Scale });
                            if (config['respiratoryRate']?.enabled && v.respiratoryRate) legacyVitals.push({ label: 'Resp. Rate', value: `${v.respiratoryRate} bpm`, icon: Activity });
                          }

                          const vitalsToShow = [...dynamicVitals, ...legacyVitals];

                          return (
                            <div className="mt-6 space-y-6">
                               {/* Remarks / Status */}
                               <div className="p-5 rounded-2xl bg-orange-50 border border-orange-100">
                                  <div className="flex items-center gap-3 mb-2">
                                     <StatusChip status={v.status} />
                                  </div>
                                  <p className="text-sm text-gray-700 font-medium">
                                    <span className="font-bold">Remarks: </span> 
                                    {v.visitSummary || v.notes || v.manualCheckInReason || 'No remarks recorded.'}
                                  </p>
                               </div>

                               {/* Vitals Grid */}
                               {vitalsToShow.length > 0 ? (
                                 <div>
                                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Recorded Vitals</h4>
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     {vitalsToShow.map((vital, idx) => {
                                       const Icon = vital.icon;
                                       return (
                                         <div key={idx} className="bg-[#FDFBF9] p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                                           <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF7A00] flex items-center justify-center mb-2">
                                              <Icon size={14} />
                                           </div>
                                           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{vital.label}</p>
                                           <p className="text-sm font-black text-gray-800 mt-1">{vital.value}</p>
                                         </div>
                                       );
                                     })}
                                   </div>
                                 </div>
                               ) : (
                                 <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-sm font-bold text-gray-400 uppercase">No active vitals recorded for this visit</p>
                                 </div>
                               )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                 </div>
              </TabsContent>

              {/* ──────────────── VISITS TAB ──────────────── */}
              <TabsContent value="visits" className="mt-0 outline-none">
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-[#E7DED6]">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-black text-gray-800">Visit Records</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">All visits for {details.name}</p>
                    </div>
                    <button onClick={fetchVisits} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors">
                      <RefreshCw size={14} className={visitsLoading ? 'animate-spin' : ''} /> Refresh
                    </button>
                  </div>

                  {visitsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading visits...</p>
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="py-16 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <CalendarClock className="mx-auto w-10 h-10 text-gray-300 mb-3" />
                      <p className="text-sm font-bold text-gray-400 uppercase">No visits found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visits.map((v: any) => (
                        <div key={v.id} className="group flex items-center justify-between p-4 bg-[#FAF8F5] border border-[#E7DED6] rounded-2xl hover:border-[#1D4ED8]/40 hover:bg-blue-50/20 transition-all">
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Status dot */}
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              v.status === 'completed' ? 'bg-green-500' :
                              v.status === 'checked_in' ? 'bg-blue-500 animate-pulse' :
                              v.status === 'cancelled' ? 'bg-red-400' :
                              'bg-amber-400'
                            }`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {v.visitCode && (
                                  <span className="font-mono text-[11px] font-black px-2 py-0.5 bg-[#FFF5EE] text-[#FF7A00] border border-[#FFE0C7] rounded-md">{v.visitCode}</span>
                                )}
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                                  v.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  v.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                                  v.status === 'cancelled' ? 'bg-red-100 text-red-400' :
                                  'bg-amber-100 text-amber-700'
                                }`}>{v.status.replace('_', ' ')}</span>
                              </div>
                              <p className="text-sm font-bold text-gray-800 mt-1">
                                {format(new Date(v.scheduledTime), 'PPp')}
                              </p>
                              {v.careCompanion?.name && (
                                <p className="text-xs text-gray-500 font-medium mt-0.5">CC: {v.careCompanion.name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button
                              onClick={() => setOpenModalVisitId(v.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E7DED6] text-gray-600 text-xs font-bold hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-colors"
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => setOpenModalVisitId(v.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-bold hover:bg-[#1e40af] transition-colors"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Visit Details / Edit Modal */}
            {openModalVisitId && (
              <VisitDetailsModal
                visitId={openModalVisitId}
                onClose={() => setOpenModalVisitId(null)}
              />
            )}
          </div>
        </div>
      </div>

      <EditBeneficiaryDialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        beneficiary={details}
        onSuccess={() => {
          setIsEditModalOpen(false);
          refreshDetailsBackground();
        }}
      />

      <AddMedicineDialog 
        isOpen={isAddMedOpen} 
        onClose={() => setIsAddMedOpen(false)} 
        beneficiaryId={details.id} 
        onSuccess={() => {
          setIsAddMedOpen(false);
          refreshDetailsBackground();
        }} 
      />

      <AddConditionDialog 
        isOpen={isAddConditionOpen} 
        onClose={() => setIsAddConditionOpen(false)} 
        beneficiaryId={details.id} 
        onSuccess={() => {
          setIsAddConditionOpen(false);
          refreshDetailsBackground();
        }} 
      />

      {/* Document Preview Overlay */}
      {previewDoc && (
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-4xl w-full h-[85vh] flex flex-col p-6 bg-white border border-[#E7DED6]">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-black text-gray-800 uppercase tracking-wide">
                Preview Document: {previewDoc.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Document preview window
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 w-full bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-100">
              {previewDoc.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewDoc.fileUrl) ? (
                <img 
                  src={previewDoc.fileUrl} 
                  alt={previewDoc.title} 
                  className="max-w-full max-h-full object-contain" 
                />
              ) : (
                <iframe 
                  src={previewDoc.fileUrl} 
                  title={previewDoc.title} 
                  className="w-full h-full border-0"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
