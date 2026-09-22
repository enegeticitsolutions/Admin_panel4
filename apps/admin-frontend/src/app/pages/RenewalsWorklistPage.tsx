import React, { useState, useEffect, useCallback } from 'react';
import { subscriptionApi } from '../../services/api';
import {
  Calendar, CheckCircle2, XCircle, AlertCircle, Loader2, Phone, Search,
  MessageCircle, RefreshCw, Clock, Ban, X, FileText, User, UserSquare, ShieldAlert, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { sanitizeTelLink, sanitizeWhatsappLink } from '../utils/sanitizeUrl';
import { AddonBenefitModal } from '../components/addons/AddonBenefitModal';

export default function RenewalsWorklistPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState(30);
  const [search, setSearch] = useState('');
  
  // Terminate Action Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [terminationReason, setTerminationReason] = useState('');
  const [terminating, setTerminating] = useState(false);

  // Addon Action Modal State
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [selectedAddonSub, setSelectedAddonSub] = useState<any>(null);

  // Terminated Subscriptions View Modal State
  const [showTerminatedModal, setShowTerminatedModal] = useState(false);
  const [terminatedList, setTerminatedList] = useState<any[]>([]);
  const [loadingTerminated, setLoadingTerminated] = useState(false);
  const [terminatedSearch, setTerminatedSearch] = useState('');

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscriptionApi.getExpiringSubscriptions(daysFilter);
      setSubscriptions(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch expiring subscriptions');
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  const fetchTerminated = useCallback(async () => {
    setLoadingTerminated(true);
    try {
      const data = await subscriptionApi.getTerminatedSubscriptions();
      setTerminatedList(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch terminated subscriptions');
    } finally {
      setLoadingTerminated(false);
    }
  }, []);

  useEffect(() => {
    fetchExpiring();
    fetchTerminated();
  }, [fetchExpiring, fetchTerminated]);

  const handleTerminate = async () => {
    if (!selectedSubId || !terminationReason.trim()) {
      toast.error('Reason is required');
      return;
    }

    setTerminating(true);
    try {
      await subscriptionApi.terminateSubscription(selectedSubId, terminationReason);
      toast.success('Subscription terminated successfully');
      setShowModal(false);
      setTerminationReason('');
      fetchExpiring();
      fetchTerminated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate subscription');
    } finally {
      setTerminating(false);
    }
  };

  const navigate = useNavigate();

  const filteredSubs = subscriptions.filter(sub => {
    const sName = sub.subscriber?.name?.toLowerCase() || '';
    const bName = sub.beneficiary?.name?.toLowerCase() || '';
    const phone = sub.subscriber?.phone || '';
    const term = search.toLowerCase();
    return sName.includes(term) || bName.includes(term) || phone.includes(term);
  });

  const filteredTerminated = terminatedList.filter(sub => {
    const sName = sub.subscriber?.name?.toLowerCase() || '';
    const bName = sub.beneficiary?.name?.toLowerCase() || '';
    const phone = sub.subscriber?.phone || '';
    const reason = sub.cancellationNote?.toLowerCase() || '';
    const term = terminatedSearch.toLowerCase();
    return sName.includes(term) || bName.includes(term) || phone.includes(term) || reason.includes(term);
  });

  const criticalCount = filteredSubs.filter(sub => {
    const end = new Date(sub.endDate);
    const daysLeft = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return daysLeft <= 7;
  }).length;

  return (
    <div className="p-8 bg-[#F4EAE3] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Renewal Reminder Worklist</h1>
          <p className="text-gray-600">Track and manage upcoming subscription expirations.</p>
        </div>
        <div className="flex gap-3 items-center">
          <select 
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white font-medium shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value={7}>Next 7 Days</option>
            <option value={15}>Next 15 Days</option>
            <option value={30}>Next 30 Days</option>
            <option value={60}>Next 60 Days</option>
          </select>

          {/* Button to View Terminated Subscriptions */}
          <button
            onClick={() => {
              fetchTerminated();
              setShowTerminatedModal(true);
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm cursor-pointer"
          >
            <Ban className="w-4 h-4" />
            Terminated Subscriptions
            {terminatedList.length > 0 && (
              <span className="ml-1 bg-white text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {terminatedList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-[#E7DED6] flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Expiring</p>
            <p className="text-2xl font-black text-gray-800">{filteredSubs.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E7DED6] flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Critical (&le; 7 Days)</p>
            <p className="text-2xl font-black text-gray-800">{criticalCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E7DED6] flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Action Needed</p>
            <p className="text-2xl font-black text-gray-800">{filteredSubs.length > 0 ? 'Follow-up' : 'All Clear'}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by subscriber or beneficiary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E7DED6] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-black">
                <th className="p-4 pl-6">Subscriber</th>
                <th className="p-4">Beneficiary</th>
                <th className="p-4">Package Details</th>
                <th className="p-4">Expiration</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                    Loading worklist...
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 font-medium">
                    No expiring subscriptions found for the next {daysFilter} days.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub: any) => {
                  const end = new Date(sub.endDate);
                  const daysLeft = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-gray-800">{sub.subscriber?.name || 'N/A'}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="w-3 h-3" /> {sub.subscriber?.phone || 'No phone'}
                          </div>
                          {sub.subscriber?.phone && (
                            <div className="flex gap-1">
                              <a href={sanitizeTelLink(sub.subscriber.phone)} className="p-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Call">
                                <Phone className="w-3 h-3" />
                              </a>
                              <a href={sanitizeWhatsappLink(sub.subscriber.phone)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp">
                                <MessageCircle className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-700">{sub.beneficiary?.name || 'Unassigned'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{sub.packageVersion?.name || sub.package?.name || sub.packageType}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{end.toLocaleDateString()}</div>
                        <div className={`text-xs font-bold mt-1 ${daysLeft <= 7 ? 'text-red-500' : 'text-orange-500'}`}>
                          {daysLeft <= 0 ? 'Expired' : `${daysLeft} days left`}
                        </div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const isCancelled = !sub.isActive || Boolean(sub.cancelledAt);
                          const isExpired = daysLeft <= 0;

                          if (isCancelled) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                <Ban size={12} /> Terminated
                              </span>
                            );
                          }
                          if (isExpired) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                                <AlertCircle size={12} /> Expired
                              </span>
                            );
                          }
                          if (daysLeft <= 7) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock size={12} /> Expiring Soon
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle2 size={12} /> Active
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedAddonSub(sub);
                              setShowAddonModal(true);
                            }}
                            className="px-3 py-2 bg-orange-50 text-[#FF7A00] hover:bg-orange-100 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 border border-orange-200 cursor-pointer shadow-sm"
                            title="Add Add-on Benefit / Service"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add-on
                          </button>
                          <button 
                            onClick={() => navigate(`/renew/${sub.id}`)}
                            className="px-4 py-2 bg-[#7C3AED] text-white hover:bg-[#6D28D9] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" /> Renew
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedSubId(sub.id);
                              setShowModal(true);
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Terminate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminate Action Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Terminate Subscription</h2>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancelling this subscription.</p>
            
            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 min-h-[100px]"
              placeholder="E.g. Customer requested cancellation due to relocation..."
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setTerminationReason('');
                }}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                disabled={terminating}
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={terminating || !terminationReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {terminating && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminated Subscriptions View Modal */}
      {showTerminatedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-red-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Terminated Subscriptions</h2>
                  <p className="text-xs text-gray-500">History of cancelled subscriptions and reasons</p>
                </div>
              </div>
              <button
                onClick={() => setShowTerminatedModal(false)}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search terminated list by subscriber, beneficiary, or reason..."
                  value={terminatedSearch}
                  onChange={(e) => setTerminatedSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingTerminated ? (
                <div className="py-12 text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-red-600" />
                  Loading terminated subscriptions...
                </div>
              ) : filteredTerminated.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-medium">
                  <Ban className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  No terminated subscriptions found.
                </div>
              ) : (
                filteredTerminated.map((sub: any) => (
                  <div key={sub.id} className="p-5 border border-red-100 bg-red-50/20 rounded-2xl space-y-3 hover:border-red-200 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-bold text-gray-800 text-base">{sub.subscriber?.name || 'N/A'}</span>
                          <span className="text-xs text-gray-500 font-mono">({sub.subscriber?.phone || 'No phone'})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Terminated
                        </span>
                        <span className="text-xs text-gray-400">
                          {sub.cancelledAt ? new Date(sub.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(sub.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <UserSquare className="w-3.5 h-3.5 text-gray-400" />
                        <span>Beneficiary: <strong className="text-gray-700">{sub.beneficiary?.name || 'Unassigned'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span>Package: <strong className="text-gray-700">{sub.packageVersion?.name || sub.package?.name || sub.packageType}</strong></span>
                      </div>
                    </div>

                    {/* Reason box */}
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900 flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-red-800 block mb-0.5">Reason for Termination:</span>
                        <span className="text-red-900 font-medium italic">"{sub.cancellationNote || 'No reason provided'}"</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowTerminatedModal(false)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 font-bold text-sm text-gray-700 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add-on Benefit Modal */}
      {selectedAddonSub && (
        <AddonBenefitModal
          isOpen={showAddonModal}
          onClose={() => {
            setShowAddonModal(false);
            setSelectedAddonSub(null);
          }}
          subscriptionId={selectedAddonSub.id}
          beneficiaryId={selectedAddonSub.beneficiaryId || selectedAddonSub.beneficiary?.id}
          beneficiaryName={selectedAddonSub.beneficiary?.name}
          subscriberId={selectedAddonSub.subscriberId || selectedAddonSub.subscriber?.id}
          subscriberName={selectedAddonSub.subscriber?.name}
          subscriberPhone={selectedAddonSub.subscriber?.phone}
          subscriberEmail={selectedAddonSub.subscriber?.email}
          defaultPincode={selectedAddonSub.beneficiary?.pincode || selectedAddonSub.subscriber?.pincode}
          onSuccess={() => {
            fetchExpiring();
          }}
        />
      )}
    </div>
  );
}
