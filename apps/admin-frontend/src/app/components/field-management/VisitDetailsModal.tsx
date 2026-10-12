import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  X, CalendarClock, User, UserCheck, Activity, Brain, Image as ImageIcon,
  CheckCircle, XCircle, MapPin, Loader2, Pill, Clock, Edit3, Save, RotateCcw,
  AlertTriangle, ChevronRight, Trash2, Plus, Upload, Star, AlertCircle
} from 'lucide-react';
import { visitApi } from '../../../services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

interface VisitDetailsModalProps {
  visitId: string;
  onClose: () => void;
}

export default function VisitDetailsModal({ visitId, onClose }: VisitDetailsModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingChange, setResolvingChange] = useState(false);
  const [rejectingChange, setRejectingChange] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const toDateTimeLocal = (dateVal?: string | Date | null) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return '';
    }
  };

  // Edit form state
  const [editForm, setEditForm] = useState({
    notes: '',
    visitSummary: '',
    followUpRequired: false,
    followUpNotes: '',
    followUpDate: '',
    escalateToManager: false,
    escalationReason: '',
    checkInTime: '',
    checkOutTime: '',
  });

  const parseImageUrls = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (_) {}
    }
    return [];
  };

  useEffect(() => {
    setLoading(true);
    visitApi.getById(visitId)
      .then((res: any) => {
        if (res) {
          setVisit(res);
          setEditImages(parseImageUrls(res.imageUrls));
          setEditForm({
            notes: res.notes || '',
            visitSummary: res.visitSummary || '',
            followUpRequired: res.followUpRequired || false,
            followUpNotes: res.followUpNotes || '',
            followUpDate: res.followUpDate ? format(new Date(res.followUpDate), 'yyyy-MM-dd') : '',
            escalateToManager: res.escalateToManager || false,
            escalationReason: res.escalationReason || '',
            checkInTime: toDateTimeLocal(res.checkInTime),
            checkOutTime: toDateTimeLocal(res.checkOutTime),
          });
        } else {
          toast.error('Invalid visit data received');
        }
      })
      .catch((err) => {
        toast.error('Failed to load visit details');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [visitId]);

  const handleSave = async () => {
    if (editForm.checkInTime && editForm.checkOutTime) {
      if (new Date(editForm.checkInTime) > new Date(editForm.checkOutTime)) {
        toast.error('Check-in time cannot be after check-out time');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        notes: editForm.notes || null,
        visitSummary: editForm.visitSummary || null,
        followUpRequired: editForm.followUpRequired,
        followUpNotes: editForm.followUpNotes || null,
        followUpDate: editForm.followUpDate || null,
        escalateToManager: editForm.escalateToManager,
        escalationReason: editForm.escalationReason || null,
        actorName: user?.name || 'Admin',
        imageUrls: editImages, // send updated photos list
        checkInTime: editForm.checkInTime ? new Date(editForm.checkInTime).toISOString() : null,
        checkOutTime: editForm.checkOutTime ? new Date(editForm.checkOutTime).toISOString() : null,
      };

      const res = await visitApi.editVisit(visitId, payload);
      const fresh = await visitApi.getById(visitId);
      setVisit(fresh);
      setEditImages(parseImageUrls(fresh.imageUrls));
      setEditMode(false);
      const changesCount = Object.keys((res as any).changesLogged || {}).length;
      toast.success(`Visit updated! ${changesCount} field(s) changed and logged.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setEditImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleResolveChange = async (status: 'accepted' | 'rejected') => {
    if (status === 'rejected' && !rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setResolvingChange(true);
    try {
      await visitApi.resolveChangeRequest(visit.id, status, rejectReason.trim() || undefined);
      const fresh = await visitApi.getById(visitId);
      setVisit(fresh);
      toast.success(`Change request ${status}.`);
    } catch (error: any) {
      console.error('Error resolving change request:', error);
      alert(error.message || 'An error occurred');
    } finally {
      setResolvingChange(false);
      setRejectingChange(false);
      setRejectReason('');
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await visitApi.uploadVisitImage(visitId, file);
      const newUrls = parseImageUrls(res.imageUrls);
      setEditImages(newUrls);
      setVisit((prev: any) => prev ? { ...prev, imageUrls: JSON.stringify(newUrls) } : prev);
      toast.success('Image uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCancelEdit = () => {
    if (!visit) return;
    setEditForm({
      notes: visit.notes || '',
      visitSummary: visit.visitSummary || '',
      followUpRequired: visit.followUpRequired || false,
      followUpNotes: visit.followUpNotes || '',
      followUpDate: visit.followUpDate ? format(new Date(visit.followUpDate), 'yyyy-MM-dd') : '',
      escalateToManager: visit.escalateToManager || false,
      escalationReason: visit.escalationReason || '',
      checkInTime: toDateTimeLocal(visit.checkInTime),
      checkOutTime: toDateTimeLocal(visit.checkOutTime),
    });
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-[24px] p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-[#FF7A00] animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-600">Loading visit details...</p>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-[24px] p-8 flex flex-col items-center max-w-sm w-full">
          <XCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-sm font-bold text-gray-800 text-center mb-6">Could not load visit details.</p>
          <button onClick={onClose} className="w-full py-3 bg-gray-100 rounded-xl text-gray-700 font-bold hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    );
  }

  const imageUrls = parseImageUrls(visit.imageUrls);

  const renderVital = (label: string, value: any, unit: string) => {
    if (value === null || value === undefined) return null;
    return (
      <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6]">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-gray-800 mt-1">{value} <span className="text-xs text-gray-500 font-medium">{unit}</span></p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-white rounded-[24px] shadow-2xl border border-[#E7DED6] w-full max-w-4xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E7DED6] bg-[#FAF8F5] flex justify-between items-center sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <CalendarClock className="text-[#1D4ED8]" />
              Visit Details
            </h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              {visit.visitCode
                ? <span className="px-2 py-0.5 bg-[#FFF5EE] text-[#FF7A00] border border-[#FFE0C7] rounded-md">{visit.visitCode}</span>
                : `Encounter ${visit.encounterId}`
              }
              <span className={`px-2 py-0.5 rounded-md ${
                visit.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                visit.status === 'cancelled' ? 'bg-red-100 text-red-400' :
                visit.status === 'missed' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                'bg-gray-100 text-gray-500'
              }`}>{visit.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-bold hover:bg-[#1e40af] transition-colors"
              >
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Edit mode banner */}
        {editMode && (
          <div className="px-5 sm:px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <Edit3 size={14} className="text-amber-600" />
            <p className="text-xs font-bold text-amber-700">
              Edit mode active — all changes will be saved and attributed to <strong>{user?.name || 'you'}</strong> in the activity log.
            </p>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          
          {visit.changeRequestedAt && visit.changeRequestStatus === 'pending' && (
            <div className="mb-6 bg-[#FFF5EE] border border-[#FF7A00]/30 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3 justify-between">
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 bg-[#FF7A00]/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={20} className="text-[#FF7A00]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[#FF7A00] uppercase tracking-widest mb-1">Beneficiary Requested Reschedule</h4>
                    <p className="text-sm text-gray-800">
                      <span className="font-bold">Preferred:</span> {visit.changePreferredDate} at {visit.changePreferredTime}
                    </p>
                    {visit.changeReason && (
                      <p className="text-sm text-gray-600 italic mt-1 bg-white/50 px-3 py-2 rounded-lg border border-[#FF7A00]/10">
                        "{visit.changeReason}"
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">
                      Requested on {format(new Date(visit.changeRequestedAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {!rejectingChange ? (
                    <>
                      <button 
                        onClick={() => handleResolveChange('accepted')}
                        disabled={resolvingChange}
                        className="px-4 py-2 bg-[#10B981] text-white text-xs font-bold rounded-xl hover:bg-[#059669] transition-colors shadow-sm disabled:opacity-50"
                      >
                        {resolvingChange ? 'Processing...' : 'Accept'}
                      </button>
                      <button 
                        onClick={() => setRejectingChange(true)}
                        disabled={resolvingChange}
                        className="px-4 py-2 bg-white text-[#EF4444] border border-[#EF4444]/30 text-xs font-bold rounded-xl hover:bg-[#FEF2F2] transition-colors shadow-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setRejectingChange(false)}
                          className="flex-1 px-2 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleResolveChange('rejected')}
                          disabled={resolvingChange || !rejectReason.trim()}
                          className="flex-1 px-2 py-1.5 bg-[#EF4444] text-white text-xs font-bold rounded-lg hover:bg-[#DC2626] disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Left Column ─────────────────────────────────────────────── */}
            <div className="space-y-6">
              
              {/* People — clickable cards */}
              <div className="space-y-4">
                {/* Beneficiary card */}
                <button
                  onClick={() => { onClose(); navigate(`/beneficiaries/${visit.beneficiary?.id}`); }}
                  className="w-full bg-[#FFF5EE] border border-[#FFE4D3] rounded-2xl p-4 flex items-center gap-4 hover:bg-[#FFE8D5] hover:border-[#FFCCA8] transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-[#FFD3B4] rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-[#FF7A00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Beneficiary</p>
                    <p className="text-base font-black text-gray-800">{visit.beneficiary?.name || 'Unknown'}</p>
                    {visit.beneficiary?.phone && <p className="text-xs text-gray-500 font-medium">{visit.beneficiary.phone}</p>}
                  </div>
                  <ChevronRight size={16} className="text-[#FF7A00] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>

                {/* Care Companion card */}
                <button
                  onClick={() => { onClose(); navigate('/care-companions'); }}
                  className="w-full bg-[#E8F0FF] border border-[#D1E0FF] rounded-2xl p-4 flex items-center gap-4 hover:bg-[#D6E6FF] hover:border-[#A8C8FF] transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-[#C2D6FF] rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCheck size={20} className="text-[#1D4ED8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Care Companion</p>
                    <p className="text-base font-black text-gray-800">{visit.careCompanion?.name || 'Unknown'}</p>
                    {visit.careCompanion?.phone && <p className="text-xs text-gray-500 font-medium">{visit.careCompanion.phone}</p>}
                  </div>
                  <ChevronRight size={16} className="text-[#1D4ED8] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              </div>

              {/* Time & Duration */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" /> Time & Duration
                </h4>
                <div className="bg-white border border-[#E7DED6] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scheduled For</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">{format(new Date(visit.scheduledTime), 'PPp')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Duration</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">
                      {editMode && editForm.checkInTime && editForm.checkOutTime
                        ? `${Math.max(1, Math.round((new Date(editForm.checkOutTime).getTime() - new Date(editForm.checkInTime).getTime()) / 60000))} minutes (calculated)`
                        : `${visit.durationMinutes || 60} minutes`}
                    </p>
                  </div>

                  {editMode ? (
                    <>
                      <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest">
                            Check In Time
                          </label>
                          {editForm.checkInTime ? (
                            <button
                              type="button"
                              onClick={() => setEditForm(prev => ({ ...prev, checkInTime: '' }))}
                              className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:underline"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        <input
                          type="datetime-local"
                          value={editForm.checkInTime}
                          onChange={(e) => setEditForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                          className="w-full text-xs font-semibold p-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7A00] text-gray-800"
                        />
                      </div>
                      <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest">
                            Check Out Time
                          </label>
                          {editForm.checkOutTime ? (
                            <button
                              type="button"
                              onClick={() => setEditForm(prev => ({ ...prev, checkOutTime: '' }))}
                              className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:underline"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                        <input
                          type="datetime-local"
                          value={editForm.checkOutTime}
                          onChange={(e) => setEditForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                          className="w-full text-xs font-semibold p-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7A00] text-gray-800"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Check In</p>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {visit.checkInTime ? format(new Date(visit.checkInTime), 'PPp') : <span className="text-gray-400 font-medium italic text-xs">Not recorded</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Check Out</p>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {visit.checkOutTime ? format(new Date(visit.checkOutTime), 'PPp') : <span className="text-gray-400 font-medium italic text-xs">Not recorded</span>}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" /> Location Context
                </h4>
                <div className="bg-white border border-[#E7DED6] rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    {visit.isGeoVerified
                      ? <CheckCircle size={16} className="text-green-500 mt-0.5" />
                      : <XCircle size={16} className="text-red-400 mt-0.5" />}
                    <div>
                      <p className="text-sm font-bold text-gray-800">Check-in Geo-Verified: {visit.isGeoVerified ? 'Yes' : 'No'}</p>
                      {visit.geoDistanceMeters != null && <p className="text-xs text-gray-500">Distance: {visit.geoDistanceMeters}m</p>}
                      {visit.manualCheckInReason && (
                        <p className="text-xs text-amber-600 mt-1 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                          Manual Check-in: {visit.manualCheckInReason}
                        </p>
                      )}
                    </div>
                  </div>
                  {(visit.isCheckOutGeoVerified != null || visit.manualCheckOutReason) && (
                    <div className="flex items-start gap-2 pt-3 border-t border-[#E7DED6]">
                      {visit.isCheckOutGeoVerified
                        ? <CheckCircle size={16} className="text-green-500 mt-0.5" />
                        : <XCircle size={16} className="text-red-400 mt-0.5" />}
                      <div>
                        <p className="text-sm font-bold text-gray-800">Check-out Geo-Verified: {visit.isCheckOutGeoVerified ? 'Yes' : 'No'}</p>
                        {visit.checkOutGeoDistanceMeters != null && <p className="text-xs text-gray-500">Distance: {visit.checkOutGeoDistanceMeters}m</p>}
                        {visit.manualCheckOutReason && (
                          <p className="text-xs text-amber-600 mt-1 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                            Manual Check-out: {visit.manualCheckOutReason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right Column ─────────────────────────────────────────────── */}
            <div className="space-y-6">

              {/* Encounter Records */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-gray-400" /> Encounter Records
                </h4>
                <div className="bg-white border border-[#E7DED6] rounded-2xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6] flex items-center gap-3">
                      <Brain className="text-indigo-500" size={20} />
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mood</p>
                        <p className="text-sm font-bold text-gray-800 capitalize">{visit.mood || 'Not recorded'}</p>
                      </div>
                    </div>
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6] flex items-center gap-3">
                      <Pill className={visit.medicationAdherence ? 'text-green-500' : 'text-amber-500'} size={20} />
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Med Adherence</p>
                        <p className="text-sm font-bold text-gray-800">{visit.medicationAdherence ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Vitals from VitalReadings */}
                  {visit.vitalReadings && visit.vitalReadings.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {visit.vitalReadings.map((r: any) => {
                        const def = r.vitalDefinition;
                        if (!def) return null;
                        const isSelf = r.source === 'beneficiary';
                        const recorderName = isSelf
                          ? 'Self-reported'
                          : (r.capturedBy ? [r.capturedBy.firstName, r.capturedBy.lastName].filter(Boolean).join(' ') : 'Care Companion');

                        let displayVal = '--';
                        if (r.valueNumeric != null && r.valueNumeric2 != null) {
                          displayVal = `${r.valueNumeric}/${r.valueNumeric2}${def.unit ? ' ' + def.unit : ''}`;
                        } else if (r.valueBoolean != null) {
                          displayVal = r.valueBoolean ? (def.booleanTrueLabel || 'Yes') : (def.booleanFalseLabel || 'No');
                        } else if (r.valueText) {
                          displayVal = r.valueText;
                        } else if (r.valueNumeric != null) {
                          displayVal = `${r.valueNumeric}${def.unit ? ' ' + def.unit : ''}`;
                        }

                        return (
                          <div key={r.id} className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6]">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{def.name}</p>
                              <span
                                title={recorderName}
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isSelf ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                              >
                                {isSelf ? 'Self' : 'CC'}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-800">{displayVal}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{recorderName}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-2">No vitals recorded for this visit.</p>
                  )}

                  {/* Notes — editable */}
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                    {editMode ? (
                      <textarea
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        className="w-full text-sm text-gray-700 bg-[#FAF8F5] border border-[#1D4ED8]/50 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                        placeholder="Add notes…"
                      />
                    ) : (
                      visit.notes
                        ? <p className="text-sm text-gray-700 whitespace-pre-wrap bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6]">{visit.notes}</p>
                        : <p className="text-sm text-gray-400 italic">No notes</p>
                    )}
                  </div>

                  {/* Additional Medication Notes */}
                  {!editMode && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Additional Med Notes (CC)</p>
                      {visit.medicationNotes ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DED6]">{visit.medicationNotes}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic bg-[#FAF8F5]/30 p-2.5 rounded-xl border border-dashed border-[#E7DED6]">No medication notes recorded</p>
                      )}
                    </div>
                  )}

                  {/* Visit Summary — editable */}
                  <div>
                    <p className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-widest mb-1">Visit Summary</p>
                    {editMode ? (
                      <textarea
                        value={editForm.visitSummary}
                        onChange={e => setEditForm(f => ({ ...f, visitSummary: e.target.value }))}
                        rows={4}
                        className="w-full text-sm text-gray-800 bg-[#E8F0FF]/30 border border-[#1D4ED8]/50 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                        placeholder="Add visit summary…"
                      />
                    ) : (
                      visit.visitSummary
                        ? <p className="text-sm text-gray-800 whitespace-pre-wrap bg-[#E8F0FF]/30 p-3 rounded-xl border border-[#D1E0FF]">{visit.visitSummary}</p>
                        : <p className="text-sm text-gray-400 italic">No summary</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ratings */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <Star size={16} className="text-gray-400" /> Ratings & Feedback
                </h4>
                <div className="bg-white border border-[#E7DED6] rounded-2xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subscriber Rating</p>
                      {visit.subscriberRating ? (
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={16}
                              className={s <= visit.subscriberRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}
                            />
                          ))}
                          <span className="text-xs font-bold text-gray-600 ml-1">{visit.subscriberRating}/5</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-1">Not rated yet</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Beneficiary Rating</p>
                      {visit.beneficiaryRating ? (
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={16}
                              className={s <= visit.beneficiaryRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}
                            />
                          ))}
                          <span className="text-xs font-bold text-gray-600 ml-1">{visit.beneficiaryRating}/5</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic mt-1">Not rated yet</p>
                      )}
                    </div>
                  </div>

                  {visit.feedback && (
                    <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E7DED6] text-xs">
                      <p className="font-black text-gray-400 uppercase tracking-widest text-[9px] mb-1.5">Beneficiary/Subscriber Feedback</p>
                      <p className="font-bold text-gray-700 italic leading-relaxed">"{visit.feedback}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-Up & Escalation — always editable */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-gray-400" /> Follow-Up & Escalation
                </h4>
                <div className="bg-white border border-[#E7DED6] rounded-2xl p-4 space-y-4">
                  {/* Follow-up */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700">Follow-Up Required</p>
                    {editMode ? (
                      <button
                        onClick={() => setEditForm(f => ({ ...f, followUpRequired: !f.followUpRequired }))}
                        className={`w-10 h-5 rounded-full transition-colors ${editForm.followUpRequired ? 'bg-green-500' : 'bg-gray-300'} flex items-center`}
                      >
                        <span className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mx-0.5 ${editForm.followUpRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    ) : (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${visit.followUpRequired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {visit.followUpRequired ? 'Yes' : 'No'}
                      </span>
                    )}
                  </div>

                  {(editMode ? editForm.followUpRequired : visit.followUpRequired) && (
                    <>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Follow-Up Date</p>
                        {editMode ? (
                          <input
                            type="date"
                            value={editForm.followUpDate}
                            onChange={e => setEditForm(f => ({ ...f, followUpDate: e.target.value }))}
                            className="w-full text-sm text-gray-700 bg-[#FAF8F5] border border-[#1D4ED8]/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                          />
                        ) : (
                          <p className="text-sm font-bold text-gray-800">
                            {visit.followUpDate ? format(new Date(visit.followUpDate), 'PP') : '—'}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Follow-Up Notes</p>
                        {editMode ? (
                          <textarea
                            value={editForm.followUpNotes}
                            onChange={e => setEditForm(f => ({ ...f, followUpNotes: e.target.value }))}
                            rows={2}
                            className="w-full text-sm text-gray-700 bg-[#FAF8F5] border border-[#1D4ED8]/50 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                            placeholder="Describe follow-up action…"
                          />
                        ) : (
                          <p className="text-sm text-gray-700">{visit.followUpNotes || '—'}</p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="border-t border-[#E7DED6] pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-700">Escalate to Manager</p>
                      {editMode ? (
                        <button
                          onClick={() => setEditForm(f => ({ ...f, escalateToManager: !f.escalateToManager }))}
                          className={`w-10 h-5 rounded-full transition-colors ${editForm.escalateToManager ? 'bg-red-500' : 'bg-gray-300'} flex items-center`}
                        >
                          <span className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mx-0.5 ${editForm.escalateToManager ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      ) : (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${visit.escalateToManager ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {visit.escalateToManager ? 'Yes' : 'No'}
                        </span>
                      )}
                    </div>

                    {(editMode ? editForm.escalateToManager : visit.escalateToManager) && (
                      <div className="mt-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Escalation Reason</p>
                        {editMode ? (
                          <textarea
                            value={editForm.escalationReason}
                            onChange={e => setEditForm(f => ({ ...f, escalationReason: e.target.value }))}
                            rows={2}
                            className="w-full text-sm text-gray-700 bg-red-50 border border-red-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                            placeholder="Reason for escalation…"
                          />
                        ) : (
                          <p className="text-sm text-red-700 bg-red-50 p-2 rounded-lg border border-red-100">{visit.escalationReason || '—'}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div>
                <h4 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-gray-400" />
                  Photos ({editMode ? editImages.length : imageUrls.length})
                  {editMode && (
                    <span className="ml-auto text-[10px] font-bold text-amber-600 uppercase tracking-wider">Edit mode</span>
                  )}
                </h4>

                {/* Hidden file input */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = '';
                  }}
                />

                {editMode ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {editImages.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#E7DED6] bg-gray-100 group">
                        <img src={url} alt={`Visit Image ${idx + 1}`} className="w-full h-full object-cover" />
                        {/* Dark overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a href={url} target="_blank" rel="noreferrer"
                            className="p-2 bg-white/20 rounded-lg backdrop-blur-sm text-white hover:bg-white/40 transition-colors"
                            title="View full">
                            <ImageIcon size={14} />
                          </a>
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="p-2 bg-red-500/80 rounded-lg backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
                            title="Delete photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {/* Index badge */}
                        <span className="absolute top-1 left-1 text-[9px] font-black bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                          {idx + 1}
                        </span>
                      </div>
                    ))}

                    {/* Upload button tile */}
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="aspect-square rounded-xl border-2 border-dashed border-[#1D4ED8]/50 bg-blue-50/30 hover:bg-blue-50 hover:border-[#1D4ED8] transition-all flex flex-col items-center justify-center gap-2 text-[#1D4ED8] disabled:opacity-50"
                    >
                      {uploadingImage
                        ? <Loader2 size={22} className="animate-spin" />
                        : <Plus size={22} />}
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {uploadingImage ? 'Uploading…' : 'Add Photo'}
                      </span>
                    </button>
                  </div>
                ) : imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imageUrls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-[#E7DED6] hover:border-[#1D4ED8] transition-colors relative group bg-gray-100">
                        <img src={url} alt={`Visit Image ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-bold px-2 py-1 bg-black/50 rounded-lg backdrop-blur-sm">View Full</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border-2 border-dashed border-[#E7DED6] rounded-2xl p-6 text-center">
                    <ImageIcon className="mx-auto text-gray-300 mb-2" size={24} />
                    <p className="text-xs text-gray-500 font-medium">No images uploaded during this visit.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
