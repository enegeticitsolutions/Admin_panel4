import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, MapPin, Radio, ShieldCheck, Battery, AlertCircle, Loader2 } from 'lucide-react';
import { careCompanionApi } from '../../../services/api';
import { EntityAvatar } from '../common/EntityAvatar';
import { toast } from 'sonner';

interface DutyHistoryModalProps {
  companionId: string;
  onClose: () => void;
}

export const DutyHistoryModal: React.FC<DutyHistoryModalProps> = ({ companionId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await careCompanionApi.getDutyHistory(companionId);
        if (isMounted) {
          setData(res.data || res);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load duty history');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [companionId]);

  const companion = data?.companion;
  const metrics = data?.metrics;
  const history: any[] = data?.history || [];

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-[#E7DED6]">
        {/* Header */}
        <div className="p-6 border-b border-[#E7DED6] flex items-center justify-between bg-gradient-to-r from-[#FAF3EB] to-white">
          <div className="flex items-center gap-4">
            <EntityAvatar
              name={companion?.name || 'Care Companion'}
              photoUrl={companion?.photo}
              type="care_companion"
              className="w-14 h-14 text-xl border-2 border-white shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{companion?.name || 'Care Companion'}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  companion?.isWorking ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {companion?.isWorking ? '🟢 On Duty (Working)' : '⚪ Off Duty'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {companion?.phone} {companion?.zone ? `• Zone: ${companion.zone}` : ''} {companion?.teamName ? `• Team: ${companion.teamName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-500 gap-3">
              <Loader2 className="animate-spin text-[#FF7A00]" size={32} />
              <p className="text-sm font-semibold">Loading duty & attendance history...</p>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#FAF3EB] border border-[#E7DED6] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <Calendar size={14} className="text-[#FF7A00]" /> Total Shifts
                  </div>
                  <div className="text-2xl font-black text-gray-900">{metrics?.totalShifts || 0}</div>
                  <div className="text-[11px] text-gray-500 mt-1">Logged attendances</div>
                </div>

                <div className="bg-[#FAF3EB] border border-[#E7DED6] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <Clock size={14} className="text-emerald-600" /> Total Hours
                  </div>
                  <div className="text-2xl font-black text-gray-900">{metrics?.totalHoursWorked || 0}h</div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {Math.round((metrics?.totalMinutesWorked || 0))} mins total
                  </div>
                </div>

                <div className="bg-[#FAF3EB] border border-[#E7DED6] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <Radio size={14} className="text-indigo-600" /> Current State
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1">
                    {metrics?.isWorking ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 font-black">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Working ({Math.floor((metrics?.currentShiftMinutes || 0) / 60)}h {(metrics?.currentShiftMinutes || 0) % 60}m)
                      </span>
                    ) : (
                      <span className="text-gray-500">Logged Out / Resting</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {metrics?.isWorking ? 'GPS tracking live' : 'Offline'}
                  </div>
                </div>
              </div>

              {/* History Timeline */}
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-3">
                  Attendance & Shift Logs ({history.length})
                </h3>

                {history.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                    <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                    <p className="font-semibold text-sm">No duty records found yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Shifts will appear once companion clocks in on their mobile app.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((record, index) => {
                      const isShiftActive = record.status === 'WORKING';
                      return (
                        <div
                          key={record.id || index}
                          className={`rounded-2xl p-4 border transition-all ${
                            isShiftActive
                              ? 'bg-emerald-50/70 border-emerald-200 shadow-xs'
                              : 'bg-white border-[#E7DED6] hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">
                                {formatDate(record.date || record.loginTime)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isShiftActive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {isShiftActive ? 'Active Shift' : 'Completed Shift'}
                              </span>
                            </div>

                            <div className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                              ⏱️ {record.durationHours}h ({record.durationMinutes} mins)
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 pt-2 border-t border-gray-100">
                            <div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Punch In
                              </div>
                              <div className="font-semibold text-gray-800 mt-0.5">
                                {formatDateTime(record.loginTime)}
                              </div>
                              {record.loginLat && record.loginLng ? (
                                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} className="text-[#FF7A00]" />
                                  {record.loginLat.toFixed(4)}, {record.loginLng.toFixed(4)}
                                  {record.loginAddress ? ` • ${record.loginAddress}` : ''}
                                </div>
                              ) : null}
                            </div>

                            <div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Punch Out
                              </div>
                              <div className="font-semibold text-gray-800 mt-0.5">
                                {isShiftActive ? (
                                  <span className="text-emerald-600 font-bold">Currently On Duty</span>
                                ) : (
                                  formatDateTime(record.logoutTime)
                                )}
                              </div>
                              {record.logoutLat && record.logoutLng ? (
                                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} className="text-gray-400" />
                                  {record.logoutLat.toFixed(4)}, {record.logoutLng.toFixed(4)}
                                  {record.logoutAddress ? ` • ${record.logoutAddress}` : ''}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {record.lastLocation?.updatedAt && isShiftActive && (
                            <div className="mt-3 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                              <span className="inline-flex items-center gap-1">
                                <ShieldCheck size={12} className="text-emerald-600" /> Live GPS Ping verified at {formatDateTime(record.lastLocation.updatedAt)}
                              </span>
                              {record.lastLocation.batteryLevel !== null && (
                                <span className="inline-flex items-center gap-1 text-gray-500">
                                  <Battery size={12} /> {record.lastLocation.batteryLevel}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-[#E7DED6] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default DutyHistoryModal;
