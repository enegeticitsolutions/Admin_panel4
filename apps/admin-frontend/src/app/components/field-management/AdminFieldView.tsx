import React, { useEffect, useState, useCallback } from 'react';
import { zoneApi, operationsManagerApi, fieldManagerApi, careCompanionApi, beneficiaryApi, visitApi } from '../../../services/api';
import { toast } from 'sonner';
import {
  MapPin, Users, ChevronRight, ArrowLeft,
  Briefcase, Activity, UserCheck, Search
} from 'lucide-react';
import { LoadingState, StatCard } from './SharedComponents';
import TeamPanel from './TeamPanel';
import BeneficiaryList from './BeneficiaryList';

type DrillLevel = 'zones' | 'oms' | 'fms' | 'detail';

export default function AdminFieldView() {
  const [level, setLevel] = useState<DrillLevel>('zones');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<{ id: string; name: string; level: DrillLevel }[]>([]);
  const [search, setSearch] = useState('');
  const [globalCcCount, setGlobalCcCount] = useState<number>(0);
  const [globalBenCount, setGlobalBenCount] = useState<number>(0);
  const [detailData, setDetailData] = useState<{ team: any[]; beneficiaries: any[] }>({ team: [], beneficiaries: [] });
  const [detailLoading, setDetailLoading] = useState(false);

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      // Use a safe fetch helper to prevent one failure from breaking the whole dashboard
      const safeFetch = async (apiCall: () => Promise<any>) => {
        try {
          const res = await apiCall();
          return Array.isArray(res) ? res : (res?.data || []);
        } catch (err) {
          console.error('Safe fetch failed:', err);
          return [];
        }
      };

      const [zones, ccs, bens, oms, fms] = await Promise.all([
        safeFetch(() => zoneApi.getAll()),
        safeFetch(() => careCompanionApi.getAll()),
        safeFetch(() => beneficiaryApi.getAll()),
        safeFetch(() => operationsManagerApi.getAll()),
        safeFetch(() => fieldManagerApi.getAll())
      ]);
      
      if (zones.length === 0) {
        // Only show error if zones fail (core data)
        console.warn('No zones loaded or zone fetch failed');
      }

      // Map live counts to each zone
      const enrichedZones = zones.map((zone: any) => {
        const zoneOms = oms.filter((om: any) => 
          om.assignedZones?.includes(zone.id) || 
          om.assignedZones?.includes(zone.name) ||
          om.assignedZones?.some((z: any) => {
            const zStr = typeof z === 'string' ? z : (z?.name ?? z?.id ?? '');
            return zStr.toLowerCase() === zone.name.toLowerCase();
          })
        );
        const zoneFms = fms.filter((fm: any) => 
          fm.zoneId === zone.id || 
          fm.zone === zone.name ||
          fm.zone?.toLowerCase() === zone.name.toLowerCase()
        );
        const zoneBens = bens.filter((b: any) => 
          b.zoneId === zone.id || 
          b.city === zone.city || 
          b.city === zone.name
        );
        
        return {
          ...zone,
          omCount: zoneOms.length,
          fmCount: zoneFms.length,
          activeRequestCount: zoneBens.length
        };
      });

      setData(enrichedZones);
      setGlobalCcCount(ccs.length);
      setGlobalBenCount(bens.length);
    } catch (e) {
      console.error('Fatal error in loadZones:', e);
      toast.error('Partial failure loading operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOMs = useCallback(async (zoneId: string) => {
    setLoading(true);
    try {
      const oms = await operationsManagerApi.getAll();
      // Filter OMs who are assigned to this zone
      const zoneOms = oms.filter(om => om.assignedZones?.includes(zoneId));
      setData(zoneOms);
    } catch (e) {
      toast.error('Failed to load operations managers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFMs = useCallback(async (omId: string) => {
    setLoading(true);
    try {
      // Find the zone from the path to filter FMs by zone
      const zoneId = path[0]?.id;
      const fms = await fieldManagerApi.getAll();
      const zoneFms = fms.filter(fm => fm.zoneId === zoneId || fm.zone === path[0]?.name);
      setData(zoneFms);
    } catch (e) {
      toast.error('Failed to load field managers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (fmId: string) => {
    setDetailLoading(true);
    try {
      // In a real app, these would be filtered by fmId
      // For now, we fetch all and filter by FM
      const [team, bens] = await Promise.all([
        fieldManagerApi.getMyTeam(), // This usually gets current user's team, but admin sees all in mock
        fieldManagerApi.getBeneficiaries()
      ]);
      
      // If we had a real filter by fmId, we'd use it here
      setDetailData({ 
        team: team.filter(cc => cc.fieldManagerId === fmId),
        beneficiaries: bens.filter(b => b.fieldManagerId === fmId)
      });
    } catch (e) {
      toast.error('Failed to load team details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (level === 'zones') loadZones();
  }, [level, loadZones]);

  const handleSelect = (item: any) => {
    const nextPath = [...path, { id: item.id, name: item.name || item.id, level }];
    setPath(nextPath);
    
    if (level === 'zones') {
      if (item.omCount === 0 && item.fmCount > 0) {
        // Skip OMs level if none exist but FMs do
        setLevel('fms');
        loadFMs(item.id);
      } else {
        setLevel('oms');
        loadOMs(item.id);
      }
    } else if (level === 'oms') {
      setLevel('fms');
      loadFMs(item.id);
    } else if (level === 'fms') {
      setLevel('detail');
      loadDetail(item.id);
    }
  };

  const goBack = () => {
    const nextPath = [...path];
    const current = nextPath.pop();
    setPath(nextPath);
    
    if (current?.level === 'zones') {
      setLevel('zones');
      loadZones();
    } else if (current?.level === 'oms') {
      setLevel('zones'); // Go back to zones
      loadZones();
    } else if (current?.level === 'fms') {
      // If we skipped OMs, go back to zones, otherwise go to OMs
      const parent = nextPath[nextPath.length - 1];
      if (parent?.level === 'zones') {
        const zone = data.find(z => z.id === parent.id);
        if (zone?.omCount === 0) {
          setLevel('zones');
          loadZones();
        } else {
          setLevel('oms');
          loadOMs(parent.id);
        }
      } else {
        setLevel('oms');
        loadOMs(path[0]?.id);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          <button 
            onClick={() => { setLevel('zones'); setPath([]); loadZones(); }}
            className={`hover:text-orange-600 transition-colors ${level === 'zones' ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
          >
            All Zones
          </button>
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button 
                onClick={() => {
                  const newPath = path.slice(0, i + 1);
                  setPath(newPath);
                  // Logic to jump back
                  if (p.level === 'zones') {
                    const zone = data.find(z => z.id === p.id);
                    if (zone?.omCount === 0 && zone?.fmCount > 0) {
                      setLevel('fms');
                      loadFMs(p.id);
                    } else {
                      setLevel('oms');
                      loadOMs(p.id);
                    }
                  } else if (p.level === 'oms') {
                    setLevel('fms');
                    loadFMs(p.id);
                  } else if (p.level === 'fms') {
                    setLevel('detail');
                    loadDetail(p.id);
                  }
                }}
                className={`hover:text-orange-600 transition-colors ${i === path.length - 1 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
              >
                {p.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {level !== 'zones' && (
              <button onClick={goBack} className="p-1 hover:bg-secondary rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {level === 'zones' ? 'Regional Zones' : 
             level === 'oms' ? 'Operations Managers' : 
             level === 'fms' ? 'Field Managers' : `Team Detail: ${path[path.length - 1]?.name}`}
          </h2>
          {level !== 'detail' && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Quick search..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {loading && level !== 'detail' ? <LoadingState message="Fetching global operations status..." /> : (
        <>
          {level !== 'detail' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data
                .filter(item => (item.name || item.id).toLowerCase().includes(search.toLowerCase()))
                .map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleSelect(item)}
                  className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-orange-400 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                      {level === 'zones' ? <MapPin className="w-6 h-6" /> : 
                       level === 'oms' ? <Briefcase className="w-6 h-6" /> : 
                       <Users className="w-6 h-6" />}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-orange-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1">{item.name || item.id}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {level === 'zones' ? `${item.city || ''}${item.state ? ', ' + item.state : ''}` : 
                     level === 'oms' ? 'Regional Oversight' : 'Team Lead'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                    <div className="text-xs">
                      <p className="text-muted-foreground mb-1 uppercase font-bold tracking-tighter">
                        {level === 'zones' ? (item.omCount > 0 ? 'OMs' : 'FMs') : 
                         level === 'oms' ? 'FMs' : 'CCs'}
                      </p>
                      <p className="font-bold text-base">
                        {level === 'zones' ? (item.omCount > 0 ? item.omCount : item.fmCount) : 
                         level === 'oms' ? (item.fmCount || 0) : (item.teamSize || 0)}
                      </p>
                    </div>
                    <div className="text-xs">
                      <p className="text-muted-foreground mb-1 uppercase font-bold tracking-tighter">Active</p>
                      <p className="font-bold text-base text-green-600">{item.activeRequestCount || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard label="Team Members" value={detailData.team.length} icon={<Users className="w-4 h-4" />} color="orange" />
                <StatCard label="Assigned Beneficiaries" value={detailData.beneficiaries.length} icon={<UserCheck className="w-4 h-4" />} color="blue" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-2">Care Companions</h3>
                <TeamPanel team={detailData.team} loading={detailLoading} />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-bold border-b pb-2">Assigned Beneficiaries</h3>
                <BeneficiaryList
                  beneficiaries={detailData.beneficiaries}
                  team={detailData.team}
                  loading={detailLoading}
                  submittingId={null}
                  onScheduleVisit={async (benId, ccId, time, dur, benefitId, subscriptionId) => {
                     try {
                       await visitApi.create({
                         beneficiaryId: benId,
                         careCompanionId: ccId === 'THIRD_PARTY' ? null : ccId,
                         is3rdParty: ccId === 'THIRD_PARTY',
                         scheduledTime: time,
                         durationMinutes: dur,
                         benefitId,
                         subscriptionId,
                       });
                       toast.success('Visit scheduled successfully!');
                     } catch (e: any) {
                       toast.error(e.message || 'Failed to schedule visit');
                     }
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Global Stats bar at bottom for Admin */}
      {level === 'zones' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <StatCard label="Total Zones" value={data.length} icon={<MapPin className="w-4 h-4" />} color="orange" />
          <StatCard label="Global CCs" value={globalCcCount} icon={<UserCheck className="w-4 h-4" />} color="green" />
          <StatCard label="Active Requests" value={globalBenCount} icon={<Activity className="w-4 h-4" />} color="blue" />
          <StatCard label="Performance" value="98%" icon={<ChevronRight className="w-4 h-4" />} color="purple" />
        </div>
      )}
    </div>
  );
}
