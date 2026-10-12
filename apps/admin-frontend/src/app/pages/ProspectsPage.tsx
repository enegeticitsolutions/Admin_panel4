import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Users,
  Search,
  Phone,
  MessageCircle,
  Smartphone,
  Calendar,
  Clock,
  Heart,
  UserPlus,
  RefreshCw,
  Loader2,
  Flame,
  X,
  MapPin,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { prospectApi } from '../../services/api';
import { EntityAvatar } from '../components/common/EntityAvatar';
import { cn } from '../components/ui/utils';

export default function ProspectsPage() {
  const navigate = useNavigate();

  // Data states
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProspects: 0,
    loggedInCount: 0,
    withBeneficiaryCount: 0,
    appActive: 0,
  });

  // Search & Pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 12;

  // Outreach / Callback Modal state
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [callbackNotes, setCallbackNotes] = useState('');
  const [callbackStatus, setCallbackStatus] = useState('pending');
  const [savingCallback, setSavingCallback] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await prospectApi.getAll({
        search,
        page,
        limit,
      });

      if (resp && resp.data) {
        setProspects(resp.data);
        setTotalCount(resp.pagination?.total || 0);
        setTotalPages(resp.pagination?.totalPages || 1);
        if (resp.stats) {
          setStats({
            totalProspects: resp.stats.totalProspects || 0,
            loggedInCount: resp.stats.loggedInCount || 0,
            withBeneficiaryCount: resp.stats.withBeneficiaryCount || 0,
            appActive: resp.stats.appActive || 0,
          });
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleSaveCallback = async () => {
    if (!selectedProspect) return;
    setSavingCallback(true);
    try {
      await prospectApi.logCallback(selectedProspect.id, {
        notes: callbackNotes.trim(),
        status: callbackStatus,
      });
      toast.success('Follow-up callback note recorded successfully');
      setSelectedProspect(null);
      setCallbackNotes('');
      fetchProspects();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record follow-up');
    } finally {
      setSavingCallback(false);
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const text = encodeURIComponent(
      `Hello ${name || 'there'}, greetings from MaiHoonNa! We noticed you recently joined our elder care companion app. How can we assist you with our senior care plans or scheduling a visit?`
    );
    window.open(`https://wa.me/91${cleanPhone}?text=${text}`, '_blank');
  };

  const handleEnrollNow = (prospect: any) => {
    navigate('/enroll', {
      state: {
        prefill: {
          subscriberName: prospect.name,
          subscriberPhone: prospect.phone,
          subscriberEmail: prospect.email || '',
          city: prospect.city || '',
          beneficiaries: prospect.beneficiaries || [],
        },
      },
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Prospects (App Installs)"
        description="Users who downloaded the mobile app and registered, but haven't purchased any subscription package yet"
        action={
          <Button
            onClick={() => fetchProspects()}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 gap-2 text-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Total Prospects Stat Card */}
      <div className="max-w-sm">
        <Card className="border border-slate-200/80 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Prospects
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {stats.totalProspects}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Installed app, 0 active packages
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clean Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search prospects by name, phone number, email, or city..."
              className="pl-10 h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all w-full"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-500 whitespace-nowrap px-2">
            Showing <strong className="text-slate-900">{totalCount}</strong> prospects
          </div>
        </div>
      </div>

      {/* Prospects List Area */}
      {loading && prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading prospects...
          </p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-3">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <h4 className="text-base font-bold text-slate-800">No Prospects Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {search
              ? 'No registered prospects match your search criteria. Try a different query.'
              : 'There are currently no users registered without a subscription package.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prospects.map((p) => {
            const isHighIntent = p.intentLevel === 'HIGH';
            return (
              <Card
                key={p.id}
                className="border border-slate-200/80 shadow-xs hover:shadow-md transition-all rounded-2xl bg-white overflow-hidden flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top user header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <EntityAvatar
                        name={p.name}
                        photoUrl={p.profilePhoto}
                        type="subscriber"
                        className="w-11 h-11 rounded-xl shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {p.name}
                          </h4>
                          {p.lastLoginAt ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Logged In
                            </span>
                          ) : isHighIntent ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Flame className="w-2.5 h-2.5 text-rose-500" />
                              High Intent
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              Registered
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-medium text-slate-700">
                            {p.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* App Install Badge */}
                    <div className="flex-shrink-0 text-right">
                      {p.isAppInstalled ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title="Mobile App FCM Token active"
                        >
                          <Smartphone className="w-2.5 h-2.5" />
                          App Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Web / Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location & Signup Details */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        Last Logged In:
                      </span>
                      {p.lastLoginAt ? (
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200">
                          {new Date(p.lastLoginAt).toLocaleDateString()} {new Date(p.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Never</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Registered:
                      </span>
                      <span className="font-medium text-slate-700">
                        {p.signupDate ? new Date(p.signupDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    {p.city && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Location:
                        </span>
                        <span className="font-medium text-slate-700 truncate max-w-[150px]">
                          {p.city}
                          {p.state ? `, ${p.state}` : ''}
                        </span>
                      </div>
                    )}

                    {p.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          Email:
                        </span>
                        <span className="font-medium text-slate-700 truncate max-w-[150px]">
                          {p.email}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Beneficiaries Section */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-orange-500" />
                        Added Elders / Beneficiaries:
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {p.beneficiaryCount}
                      </span>
                    </div>

                    {p.beneficiaries.length > 0 ? (
                      <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                        {p.beneficiaries.map((b: any) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between text-xs px-2.5 py-1 rounded-lg bg-orange-50/60 border border-orange-100 text-slate-700"
                          >
                            <span className="font-semibold truncate">{b.name}</span>
                            <span className="text-[10px] text-slate-500">
                              {b.relationship || 'Elder'} {b.age ? `(${b.age} yrs)` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        No beneficiaries added before drop-off
                      </p>
                    )}
                  </div>

                  {/* Latest Callback notes if any */}
                  {p.latestCallback && (
                    <div className="text-[11px] p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                      <span className="font-bold">Follow-up: </span>
                      <span className="capitalize text-amber-700">
                        {p.latestCallback.status}
                      </span>
                      {p.latestCallback.notes && ` — "${p.latestCallback.notes}"`}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {/* Call & WhatsApp Quick Buttons */}
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${p.phone}`}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                        title="Call Prospect"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => openWhatsApp(p.phone, p.name)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-700 transition-colors border border-emerald-200"
                        title="Send WhatsApp Follow-up Message"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProspect(p);
                          setCallbackNotes(p.latestCallback?.notes || '');
                          setCallbackStatus(p.latestCallback?.status || 'pending');
                        }}
                        className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Log Note
                      </Button>
                    </div>

                    {/* Convert / Enroll Button */}
                    <Button
                      size="sm"
                      onClick={() => handleEnrollNow(p)}
                      className="h-8 px-3 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      Enroll
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-xs">
          <span className="text-slate-500 font-medium">
            Showing Page <strong className="text-slate-800">{page}</strong> of{' '}
            <strong className="text-slate-800">{totalPages}</strong> ({totalCount} total prospects)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs rounded-xl"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 text-xs rounded-xl"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Log Follow-up / Callback Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedProspect(null)}
          />

          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Log Follow-up / Callback
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record conversion outreach notes for {selectedProspect.name} ({selectedProspect.phone})
                </p>
              </div>
              <button
                onClick={() => setSelectedProspect(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Follow-up Status
                </label>
                <select
                  value={callbackStatus}
                  onChange={(e) => setCallbackStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="pending">Pending (Call back later)</option>
                  <option value="in_progress">In Progress (Left message / WhatsApp)</option>
                  <option value="completed">Completed (Spoke with client)</option>
                  <option value="cancelled">Not Interested / Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Outreach Notes & Feedback
                </label>
                <textarea
                  rows={4}
                  value={callbackNotes}
                  onChange={(e) => setCallbackNotes(e.target.value)}
                  placeholder="e.g., Spoke to client. Mother is 74 yrs old in Jaipur, interested in Silver Care package. Follow up on Monday..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs rounded-xl"
                  onClick={() => setSelectedProspect(null)}
                  disabled={savingCallback}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
                  onClick={handleSaveCallback}
                  disabled={savingCallback}
                >
                  {savingCallback ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
