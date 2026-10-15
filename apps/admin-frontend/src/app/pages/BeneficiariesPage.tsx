/**
 * Beneficiaries Page - Full care profiles with Clinical Configuration
 * Updated: Assign primary/secondary CC and FM via pincode-based zone matching
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/common/PageHeader';
import { DataCard } from '../components/common/DataCard';
import { EntityAvatar } from '../components/common/EntityAvatar';
import { StatusChip } from '../components/common/StatusChip';
import { Button } from '../components/ui/button';
import { beneficiaryApi } from '../../services/api';
import type { Beneficiary } from '../../types';
import { Phone, RefreshCw, MapPin, UserCheck, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import DataFilter from '../components/common/DataFilter';



export default function BeneficiariesPage() {
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'expired' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const loadData = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const resp = await beneficiaryApi.getAllPaginated({ search, searchBy, page, limit, statusFilter });
      setBeneficiaries(resp.data || []);
      setTotal(resp.total || 0);
      setTotalPages(resp.totalPages || 1);
    } catch (e: any) {
      setError(e.message || 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
    }
  }, [search, searchBy, page, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const openBeneficiary = (ben: any) => {
    navigate(`/beneficiaries/${ben.id}`);
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Beneficiaries" description="Manage beneficiary care profiles and clinical configurations" />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={loadData}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Beneficiaries"
        description="Manage beneficiary care profiles and clinical configurations"
      />

      {/* Package Status Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white p-2.5 rounded-2xl border border-[#E7DED6] shadow-xs">
        <span className="text-xs font-black uppercase text-gray-400 px-3">Filter Package Status:</span>
        <button
          onClick={() => { setStatusFilter('active'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            statusFilter === 'active'
              ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400/20'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Active Beneficiaries
        </button>
        <button
          onClick={() => { setStatusFilter('expired'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            statusFilter === 'expired'
              ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400/20'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Package Expired
        </button>
        <button
          onClick={() => { setStatusFilter('all'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            statusFilter === 'all'
              ? 'bg-gray-800 text-white shadow-md ring-2 ring-gray-400/20'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Beneficiaries
        </button>
      </div>

      <div className="mb-6">
        <DataFilter 
          searchByOptions={[
            { label: 'Name', value: 'name' },
            { label: 'City', value: 'city' },
            { label: 'Pincode', value: 'pincode' }
          ]}
          onFilterChange={(state) => {
            setSearch(state.search);
            setSearchBy(state.searchBy || '');
            setPage(1);
          }} 
        />
      </div>

      <div className="relative min-h-[400px]">
        {loading && beneficiaries.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground bg-white/50 rounded-3xl border border-dashed border-[#E7DED6]">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading beneficiaries...
          </div>
        ) : beneficiaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white border border-[#E7DED6] rounded-3xl">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-sm">No Beneficiaries Found</p>
            <p className="text-xs">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {beneficiaries.map((ben) => (
              <div key={ben.id} className="cursor-pointer" onClick={() => openBeneficiary(ben)}>
                <DataCard 
                  title={ben.name} 
                  description={`Age: ${ben.age} • ${ben.gender}`}
                  avatar={<EntityAvatar name={ben.name} photoUrl={ben.photo} type="beneficiary" className="w-12 h-12" />}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {ben.packageStatus === 'active' ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded-full">
                          Active: {ben.activePackage || 'Package'}
                        </span>
                      ) : ben.packageStatus === 'pending' ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-full">
                          Pending Activation: {ben.activePackage || 'Package'}
                        </span>
                      ) : ben.packageStatus === 'expired' || ben.isPackageExpired ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded-full">
                          Package Expired
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full">
                          No Active Package
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(ben.medicalHistory || []).slice(0, 3).map((condition: string) => (
                        <span key={condition} className="text-xs px-2 py-1 bg-[#FFF5EE] text-[#FF7A00] rounded-full">
                          {condition}
                        </span>
                      ))}
                    </div>
                    {ben.pincode && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> Zone Pincode: <span className="font-semibold text-foreground">{ben.pincode}</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>Emergency: {ben.emergencyContact?.name || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-[#E7DED6] space-y-3">
                      {(ben.careCompanion || ben.secondaryCareCompanion) && (
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                          {ben.careCompanion && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-lg border border-orange-100">
                              <UserCheck size={12} /> {ben.careCompanion}
                            </span>
                          )}
                          {ben.secondaryCareCompanion && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                              <User size={12} /> {ben.secondaryCareCompanion}
                            </span>
                          )}
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="w-full py-5 rounded-xl border-[#E7DED6] text-gray-600 font-black uppercase tracking-widest hover:bg-[#F4EAE3]">
                        View Profile
                      </Button>
                    </div>
                  </div>
                </DataCard>
              </div>
            ))}
          </div>
        )}

        {/* Loading overlay for existing list */}
        {loading && beneficiaries.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] z-10 rounded-3xl">
            <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-[#E7DED6] flex items-center gap-2 text-sm font-bold text-gray-600">
              <RefreshCw className="w-4 h-4 animate-spin text-[#FF7A00]" /> Updating...
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex justify-between items-center bg-white border border-[#E7DED6] rounded-[24px] px-6 py-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Showing <span className="text-primary">{(page - 1) * limit + 1}</span> to <span className="text-primary">{Math.min(page * limit, total)}</span> of <span className="text-primary">{total}</span> beneficiaries
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
    </div>
  );
}
