import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, ShieldCheck, CreditCard, MapPin, Phone, CheckCircle2, Users, Filter, X, Loader2, Edit2, Radio, Clock, Battery, Navigation, History, Activity } from 'lucide-react';
import { careCompanionApi, teamApi, userApi } from '../../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import StaffEditModal from '../components/StaffEditModal';
import DataFilter from '../components/common/DataFilter';
import DeactivationSummaryModal from '../components/DeactivationSummaryModal';
import { staffOnboardingApi } from '../../services/api';
import { UserCheck } from 'lucide-react';
import { EntityAvatar } from '../components/common/EntityAvatar';
import { Trash2 } from 'lucide-react';
import { DutyHistoryModal } from '../components/care-companion/DutyHistoryModal';

interface CareCompanionItem {
  id: string;
  userId: string;
  name: string;
  photo?: string | null;
  phone: string;
  gender: string;
  zone: string;
  hubName?: string;
  isAvailable: boolean;
  teamName?: string;
  bgvVerified: boolean;
  kycVerified: boolean;
  ccType: string;
  isWorking?: boolean;
  loginTime?: string | null;
  elapsedShiftMinutes?: number;
  lastLocation?: {
    lat: number | null;
    lng: number | null;
    updatedAt: string | null;
    batteryLevel: number | null;
    isGpsActive: boolean;
  } | null;
  lastLogoutTime?: string | null;
  currentVisit?: {
    id: string;
    visitCode?: string;
    beneficiaryName: string;
  } | null;
}

const CareCompanions = () => {
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CareCompanionItem[]>([]);
  const [nodalCenters, setNodalCenters] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [dutyHistoryCCId, setDutyHistoryCCId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivationSummary, setDeactivationSummary] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState('');
  const [ccTypeFilter, setCcTypeFilter] = useState('all');
  const [dutyStatus, setDutyStatus] = useState<'all' | 'working' | 'not_working'>('all');
  const [dutyMeta, setDutyMeta] = useState<{ total: number; workingCount: number; notWorkingCount: number }>({
    total: 0,
    workingCount: 0,
    notWorkingCount: 0,
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [zones, ccResponse] = await Promise.all([
        teamApi.getZones(),
        careCompanionApi.getAllPaginated({
          search,
          searchBy,
          page,
          limit,
          ccType: ccTypeFilter,
          dutyStatus,
        })
      ]);

      setNodalCenters(zones);

      const items = ccResponse.data?.data || ccResponse.data || [];
      const dbCompanions: CareCompanionItem[] = items.map((cc: any) => ({
        id: cc.id,
        userId: cc.userId,
        name: cc.name,
        photo: cc.photo || null,
        phone: cc.phone || '',
        gender: 'Professional',
        zone: cc.zone,
        hubName: zones.find((z: any) => z.id === cc.zoneId || z.id === cc.zone || z.name === cc.zone)?.name || cc.zone,
        isAvailable: cc.isAvailable,
        teamName: cc.teamName,
        bgvVerified: cc.bgvVerified || false,
        kycVerified: cc.kycVerified || false,
        ccType: cc.ccType || 'care_assistant',
        isWorking: Boolean(cc.isWorking),
        loginTime: cc.loginTime || null,
        elapsedShiftMinutes: cc.elapsedShiftMinutes || 0,
        lastLocation: cc.lastLocation || null,
        lastLogoutTime: cc.lastLogoutTime || null,
        currentVisit: cc.currentVisit || null,
      }));

      setCompanions(dbCompanions);
      const respTotal = ccResponse.data?.total ?? ccResponse.total ?? 0;
      setTotal(respTotal);
      setTotalPages(ccResponse.data?.totalPages ?? ccResponse.totalPages ?? 1);

      if (ccResponse.data?.meta || ccResponse.meta) {
        setDutyMeta(ccResponse.data?.meta || ccResponse.meta);
      }
    } catch (err) {
      console.error('Failed to load data', err);
      toast.error('Failed to load care companions');
    } finally {
      setLoading(false);
    }
  }, [search, searchBy, page, limit, ccTypeFilter, dutyStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCC = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const name = data.get('name') as string;
    const phone = data.get('phone') as string;
    const gender = data.get('gender') as string;
    const hubId = data.get('hubId') as string;

    try {
      await userApi.createStaff({
        name,
        phone,
        role: 'care_companion',
        zoneId: hubId,
      });

      toast.success(`${name} successfully onboarded as Care Companion!`);
      form.reset();
      setShowModal(false);
      fetchData(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || 'Failed to onboard Care Companion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (userId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}? This will mark their profile as inactive.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await staffOnboardingApi.deactivateStaff(userId);
      setDeactivationSummary(response);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-[#F4EAE3] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Care Companions (CC)</h1>
          <p className="text-gray-600">Onboard, manage, and monitor live attendance of care professionals</p>
        </div>
        <button
          onClick={() => navigate('/staff-onboarding?role=care_companion')}
          className="flex items-center gap-2 bg-[#FF7A00] text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-orange-600 transition-colors"
        >
          <UserPlus size={20} /> Onboard New CC
        </button>
      </div>

      {/* Duty Roster Tabs (Working vs Not Working vs All) */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 p-1.5 bg-white/80 rounded-2xl border border-[#E7DED6] shadow-xs">
          <button
            onClick={() => {
              setDutyStatus('all');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              dutyStatus === 'all'
                ? 'bg-[#FF7A00] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users size={16} />
            All Companions
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              dutyStatus === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {dutyMeta.total || total}
            </span>
          </button>

          <button
            onClick={() => {
              setDutyStatus('working');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              dutyStatus === 'working'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Working / Logged In
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              dutyStatus === 'working' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {dutyMeta.workingCount}
            </span>
          </button>

          <button
            onClick={() => {
              setDutyStatus('not_working');
              setPage(1);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              dutyStatus === 'not_working'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-gray-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Radio size={14} className="text-gray-400" />
            Not Working (Offline)
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              dutyStatus === 'not_working' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {dutyMeta.notWorkingCount}
            </span>
          </button>
        </div>

        {/* Live Tracking Deep Link */}
        <button
          onClick={() => navigate('/saathi-tracking')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors text-xs font-bold"
          title="Open Google Maps Live Companion Tracker"
        >
          <Navigation size={14} />
          View Live On Map
        </button>
      </div>

      {/* Data Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1">
          <DataFilter 
            searchByOptions={[
              { label: 'Name', value: 'name' },
              { label: 'Zone', value: 'zone' }
            ]}
            onFilterChange={(state) => {
              setSearch(state.search);
              setSearchBy(state.searchBy || '');
              setPage(1);
            }} 
          />
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-2 rounded-2xl border border-[#E7DED6]">
          <Filter size={18} className="text-gray-400" />
          <select 
            value={ccTypeFilter}
            onChange={(e) => {
              setCcTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-transparent text-sm font-bold text-gray-700 outline-none pr-4 cursor-pointer"
          >
            <option value="all">All Staff Types</option>
            <option value="nurse">Nurses</option>
            <option value="care_assistant">Care Assistants</option>
          </select>
        </div>
      </div>

      {/* Results Area */}
      <div className="relative min-h-[400px]">
        {loading && companions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="animate-spin text-[#FF7A00]" size={24} />
              <span className="font-medium">Loading care companions...</span>
            </div>
          </div>
        ) : companions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-[#E7DED6]">
            <div className="w-20 h-20 bg-[#F4EAE3] rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-[#FF7A00]" />
            </div>
            <h3 className="text-lg font-bold text-gray-600 mb-2">No Care Companions Found</h3>
            <p className="text-gray-400 mb-6">
              {dutyStatus === 'working'
                ? 'No care companions are currently logged in or on duty.'
                : dutyStatus === 'not_working'
                ? 'All onboarded companions are currently on duty.'
                : 'Start by onboarding your first care companion or adjust filters.'}
            </p>
            {dutyStatus === 'all' && (
              <button
                onClick={() => navigate('/staff-onboarding?role=care_companion')}
                className="bg-[#FF7A00] text-white px-6 py-3 rounded-xl font-bold"
              >
                Onboard First CC
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {companions.map((cc) => (
            <div key={cc.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-[#E7DED6] hover:shadow-md transition-shadow">
              <div className="flex justify-between mb-4">
                <div className="flex gap-4">
                  <EntityAvatar 
                    name={cc.name} 
                    photoUrl={cc.photo} 
                    type="care_companion" 
                    className="w-14 h-14 text-xl" 
                  />
                  <div>
                    <h3 className="font-bold text-gray-800">{cc.name}</h3>
                    <p className="text-xs text-[#FF7A00] uppercase font-black tracking-tight mt-0.5">
                      {cc.ccType === 'nurse' ? '👨‍⚕️ Nurse' : '🏠 Care Assistant'}
                    </p>
                  </div>
                </div>
                <span className={`h-fit px-3 py-1 rounded-full text-[10px] font-black uppercase ${cc.isWorking ? 'bg-[#DFF4E6] text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {cc.isWorking ? '🟢 Working' : '⚪ Logged Out'}
                </span>
              </div>

              {/* Duty & Attendance Status Banner */}
              <div 
                className="mb-4 cursor-pointer group"
                onClick={() => setDutyHistoryCCId(cc.id)}
                title="Click to view full duty & attendance history"
              >
                {cc.isWorking ? (
                  <div className="bg-emerald-50/80 hover:bg-emerald-100/80 transition-colors border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        On Duty (Logged In)
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                        ⏱️ {Math.floor((cc.elapsedShiftMinutes || 0) / 60)}h {(cc.elapsedShiftMinutes || 0) % 60}m
                      </span>
                    </div>
                    {cc.loginTime && (
                      <div className="text-[11px] text-emerald-900">
                        Clocked in at <span className="font-semibold">{new Date(cc.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    {cc.currentVisit ? (
                      <div className="text-[11px] text-indigo-700 font-semibold bg-indigo-50/70 p-1.5 rounded border border-indigo-100 flex items-center justify-between">
                        <span>🩺 In Visit: {cc.currentVisit.beneficiaryName} {cc.currentVisit.visitCode ? `(#${cc.currentVisit.visitCode})` : ''}</span>
                        <span className="text-[10px] text-indigo-500 underline ml-1">Live Map &rarr;</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 font-medium flex items-center justify-between">
                        <span>🚗 On Standby / In-Transit</span>
                        <span className="text-[10px] text-emerald-600 underline">View History &rarr;</span>
                      </div>
                    )}
                    {cc.lastLocation?.lat && cc.lastLocation?.lng && (
                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-emerald-100">
                        <span>📍 GPS: {cc.lastLocation.lat.toFixed(4)}, {cc.lastLocation.lng.toFixed(4)}</span>
                        {cc.lastLocation.batteryLevel !== null && (
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <Battery size={11} /> {cc.lastLocation.batteryLevel}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 hover:bg-gray-100/70 transition-colors border border-gray-200 rounded-xl p-2.5 text-xs flex items-center justify-between text-gray-500">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Off Duty / Not Logged In
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      {cc.lastLogoutTime ? (
                        <>Shift ended {new Date(cc.lastLogoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                      ) : (
                        <>View History &rarr;</>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-4">
                {cc.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone size={14} className="text-[#FF7A00]" /> {cc.phone}
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <MapPin size={14} className="text-[#FF7A00]" /> {cc.hubName || cc.zone || 'Unassigned'}
                </div>
                {cc.teamName && (
                  <div className="flex items-center gap-3 text-sm text-blue-600 font-bold">
                    <Users size={14} /> Team: {cc.teamName}
                  </div>
                )}
              </div>

              {/* Action Buttons: Live Location & Duty History */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => navigate(`/saathi-tracking?type=cc&ccId=${cc.id}`)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-[11px] font-bold shadow-xs border border-indigo-200"
                  title="Track live GPS location on Google Maps"
                >
                  <Navigation size={13} className="text-indigo-600" /> Live Location
                </button>
                <button
                  onClick={() => setDutyHistoryCCId(cc.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 transition text-[11px] font-bold shadow-xs border border-amber-200"
                  title="View shifts, hours worked, and attendance history"
                >
                  <History size={13} className="text-amber-700" /> Duty History
                </button>
              </div>

              {/* Compliance Badges & Actions */}
              <div className="pt-3 border-t border-[#E7DED6] space-y-3">
                <div className="flex flex-wrap gap-2">
                  {cc.bgvVerified && (
                    <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      <ShieldCheck size={12} /> BGV
                    </div>
                  )}
                  {cc.kycVerified && (
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 size={12} /> KYC
                    </div>
                  )}
                  {!cc.bgvVerified && !cc.kycVerified && (
                    <div className="flex items-center gap-1 bg-gray-50 text-gray-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      <ShieldCheck size={12} /> Verification Pending
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditingUserId(cc.userId)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#FFF0E0] text-[#FF7A00] hover:bg-[#FFE0C0] transition text-[10px] font-black uppercase tracking-wider shadow-sm border border-[#FFE0C0]"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(cc.userId, cc.name)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition text-[10px] font-black uppercase tracking-wider shadow-sm border border-red-100"
                  >
                    <Trash2 size={12} /> Deactivate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading overlay for existing list */}
        {loading && companions.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] z-10 rounded-[32px]">
            <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-[#E7DED6] flex items-center gap-3 text-sm font-bold text-gray-700">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" /> 
              <span>Updating list...</span>
            </div>
          </div>
        )}
        </>
      )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex justify-between items-center bg-white border border-[#E7DED6] rounded-[24px] px-6 py-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Showing <span className="text-[#FF7A00]">{(page - 1) * limit + 1}</span> to <span className="text-[#FF7A00]">{Math.min(page * limit, total)}</span> of <span className="text-[#FF7A00]">{total}</span> companions
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition bg-[#F4EAE3] text-gray-600 hover:bg-[#E7DED6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition bg-[#F4EAE3] text-gray-600 hover:bg-[#E7DED6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800 uppercase">Onboard Care Companion</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCC} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Full Name</label>
                  <input name="name" required placeholder="e.g. Priya Sharma" className="w-full mt-1 px-4 py-3 rounded-xl bg-[#F4EAE3]/30 border border-[#E7DED6] focus:outline-none focus:border-[#FF7A00]" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Gender</label>
                  <select name="gender" className="w-full mt-1 px-4 py-3 rounded-xl bg-[#F4EAE3]/30 border border-[#E7DED6] focus:outline-none focus:border-[#FF7A00]">
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Phone Number</label>
                <input name="phone" required placeholder="10-digit mobile number" maxLength={10} className="w-full mt-1 px-4 py-3 rounded-xl bg-[#F4EAE3]/30 border border-[#E7DED6] focus:outline-none focus:border-[#FF7A00]" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Aadhaar Number</label>
                <input name="aadhaar" required placeholder="12-digit Aadhaar number" maxLength={12} className="w-full mt-1 px-4 py-3 rounded-xl bg-[#F4EAE3]/30 border border-[#E7DED6] focus:outline-none focus:border-[#FF7A00]" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Assign to Nodal Hub</label>
                <select name="hubId" required className="w-full mt-1 px-4 py-3 rounded-xl bg-[#F4EAE3]/30 border border-[#E7DED6] focus:outline-none focus:border-[#FF7A00]">
                  <option value="">Select a Hub</option>
                  {nodalCenters.map((hub: any) => (
                    <option key={hub.id} value={hub.id}>{hub.name} — {hub.city} ({hub.pincode})</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#FF7A00] text-white py-4 rounded-xl font-black uppercase tracking-widest mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : 'Verify & Onboard'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* STAFF EDIT MODAL */}
      {editingUserId && (
        <StaffEditModal
          userId={editingUserId}
          role="care_companion"
          onClose={() => setEditingUserId(null)}
          onSuccess={fetchData}
        />
      )}
      {/* DEACTIVATION SUMMARY MODAL */}
      {deactivationSummary && (
        <DeactivationSummaryModal 
          data={deactivationSummary} 
          onClose={() => setDeactivationSummary(null)} 
        />
      )}
      {/* DUTY & ATTENDANCE HISTORY MODAL */}
      {dutyHistoryCCId && (
        <DutyHistoryModal
          companionId={dutyHistoryCCId}
          onClose={() => setDutyHistoryCCId(null)}
        />
      )}
    </div>
  );
};

export default CareCompanions;
