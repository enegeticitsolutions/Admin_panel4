/**
 * FieldManagerView — Field Manager's own dashboard
 * Shows their team (CCs) and their assigned beneficiaries.
 * CC appointment handled by Ops Manager — FM has read-only view here.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { fieldManagerApi, visitApi } from '../../../services/api';
import { toast } from 'sonner';
import { Users, UserCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { LoadingState, StatCard } from './SharedComponents';
import TeamPanel, { type CCMember } from './TeamPanel';
import BeneficiaryList, { type BeneficiaryItem } from './BeneficiaryList';
import ScheduledVisitsPanel from './ScheduledVisitsPanel';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { key: 'team', label: 'My Team', icon: Users },
  { key: 'beneficiaries', label: 'Beneficiaries', icon: UserCheck },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function FieldManagerView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('team');
  const [team, setTeam] = useState<CCMember[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [benLoading, setBenLoading] = useState(false);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const data = await fieldManagerApi.getMyTeam();
      setTeam(data as CCMember[]);
    } catch (e: any) {
      toast.error('Failed to load team');
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const loadBeneficiaries = useCallback(async () => {
    setBenLoading(true);
    try {
      const raw = await fieldManagerApi.getBeneficiaries();
      setBeneficiaries(
        raw.map((b: any): BeneficiaryItem => ({
          id: b.id,
          name: b.name,
          age: b.age,
          phone: b.phone,
          city: b.city,
          pincode: b.pincode,
          primaryCcId: b.primaryCcId ?? null,
          primaryCcName: b.primaryCcName ?? null,
          secondaryCcId: b.secondaryCcId ?? null,
          secondaryCcName: b.secondaryCcName ?? null,
          activePackage: b.activePackage ?? null,
        }))
      );
    } catch (e: any) {
      toast.error('Failed to load beneficiaries');
    } finally {
      setBenLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    if (activeTab === 'beneficiaries' && beneficiaries.length === 0) {
      loadBeneficiaries();
    }
  }, [activeTab, loadBeneficiaries]);

  const assignedCount = beneficiaries.filter(b => b.primaryCcId).length;
  const availableCCs = team.filter(cc => cc.isAvailable).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Team Size" value={teamLoading ? '…' : team.length} icon={<Users size={16} />} color="orange" />
        <StatCard label="Available" value={teamLoading ? '…' : availableCCs} icon={<CheckCircle2 size={16} />} color="green" />
        <StatCard label="Beneficiaries" value={benLoading ? '…' : beneficiaries.length} icon={<UserCheck size={16} />} color="blue" />
        <StatCard label="Assigned" value={benLoading ? '…' : assignedCount} icon={<CheckCircle2 size={16} />} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E7DED6]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === tab.key
                ? 'border-[#FF7A00] text-[#FF7A00]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex items-center pr-1">
          <button
            onClick={() => { loadTeam(); if (activeTab === 'beneficiaries') loadBeneficiaries(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-gray-400 hover:text-[#FF7A00] transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'team' && (
        <TeamPanel team={team} loading={teamLoading} onRefresh={loadTeam} />
      )}

      {activeTab === 'beneficiaries' && (
        <BeneficiaryList
          beneficiaries={beneficiaries}
          team={team}
          loading={benLoading}
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
              toast.error(e.message || 'Scheduling failed');
            }
          }}
        />
      )}

      {/* Scheduled Visits Component */}
      <ScheduledVisitsPanel defaultFmUserId={user?.id || null} hideFmSelector={true} />
    </div>
  );
}
