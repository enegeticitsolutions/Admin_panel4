/**
 * OpsManagerFieldView — Complete Rewrite
 *
 * Flow:
 *   1. Select Field Manager from dropdown
 *   2. Auto-load FM's team (CCs) + assigned beneficiaries
 *   3. Appoint a CC to any beneficiary (inline)
 *   4. Notifications sent to CC, beneficiary, and subscriber via backend
 */

import React, { useEffect, useState, useCallback } from 'react';
import { fieldManagerApi, visitApi, beneficiaryApi } from '../../../services/api';
import { toast } from 'sonner';
import { Users, UserCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { LoadingState, StatCard } from './SharedComponents';
import FMSelectorDropdown, { type FieldManagerItem } from './FMSelectorDropdown';
import TeamPanel, { type CCMember } from './TeamPanel';
import BeneficiaryList, { type BeneficiaryItem } from './BeneficiaryList';
import ScheduledVisitsPanel from './ScheduledVisitsPanel';

export default function OpsManagerFieldView() {
  // ── State ───────────────────────────────────────────────────────────────────
  const [fieldManagers, setFieldManagers] = useState<FieldManagerItem[]>([]);
  const [selectedFM, setSelectedFM] = useState<FieldManagerItem | null>(null);
  const [team, setTeam] = useState<CCMember[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([]);

  const [fmLoading, setFmLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [benLoading, setBenLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // ── Load field managers ─────────────────────────────────────────────────────
  const loadFMs = useCallback(async () => {
    setFmLoading(true);
    try {
      const raw: any[] = await fieldManagerApi.getAll();
      const fms: FieldManagerItem[] = raw.map((fm: any) => ({
        id: fm.id,           // FieldManager profile id
        userId: fm.userId,   // User id (used as fieldManagerId on Beneficiary)
        name: fm.name,
        zone: fm.zone,
        teamCount: fm.teamCount,
        beneficiaryCount: fm.beneficiaryCount,
        isAvailable: fm.isAvailable ?? true,
      }));
      setFieldManagers(fms);
    } catch (e: any) {
      toast.error('Failed to load field managers');
    } finally {
      setFmLoading(false);
    }
  }, []);

  useEffect(() => { loadFMs(); }, [loadFMs]);

  // ── Load team CCs for selected FM ──────────────────────────────────────────
  const loadTeam = useCallback(async (fm: FieldManagerItem) => {
    setTeamLoading(true);
    try {
      // /field-manager/my-team?fmId=<fm.id>  (passes FM profile ID)
      const raw = await fieldManagerApi.getMyTeam(fm.id);
      setTeam(raw as CCMember[]);
    } catch (e: any) {
      toast.error('Failed to load team');
    } finally {
      setTeamLoading(false);
    }
  }, []);

  // ── Load beneficiaries for selected FM ─────────────────────────────────────
  const loadBeneficiaries = useCallback(async (fm: FieldManagerItem) => {
    setBenLoading(true);
    try {
      // GET /field-manager/beneficiaries?fmId=<fm.userId>
      const raw = await fieldManagerApi.getBeneficiariesByFM(fm.userId);
      console.log("raw FM beneficiaries:", raw);

      // Fetch unread requests globally to guarantee correct dot notification badges
      const unreadRequests = await beneficiaryApi.getUnreadServiceRequests(fm.userId);
      const unreadBenIds = new Set(unreadRequests.map((r: any) => r.beneficiaryId));

      setBeneficiaries(raw.map((b: any): BeneficiaryItem => ({
        id: b.id,
        name: b.name,
        age: b.age,
        gender: b.gender,
        phone: b.phone || b.subscriberPhone,
        city: b.city,
        pincode: b.pincode,
        primaryCcId: b.primaryCcId ?? null,
        primaryCcUserId: b.primaryCcUserId ?? null,
        primaryCcName: b.careCompanion ?? b.primaryCcName ?? null,
        secondaryCcId: b.secondaryCcId ?? null,
        secondaryCcUserId: b.secondaryCcUserId ?? null,
        secondaryCcName: b.secondaryCareCompanion ?? b.secondaryCcName ?? null,
        activePackage: b.activePackage ?? null,
        subscriberName: b.subscriberName ?? null,
        hasUnreadRequests: unreadBenIds.has(b.id) || b.hasUnreadRequests || false,
      })));
    } catch (e: any) {
      toast.error('Failed to load beneficiaries');
    } finally {
      setBenLoading(false);
    }
  }, []);

  // ── Handle FM selection ─────────────────────────────────────────────────────
  const handleSelectFM = (fm: FieldManagerItem) => {
    setSelectedFM(fm);
    setTeam([]);
    setBeneficiaries([]);
    loadTeam(fm);
    loadBeneficiaries(fm);
  };


  // ── Schedule Visit for beneficiary ──────────────────────────────────────────
  const handleScheduleVisit = async (beneficiaryId: string, ccId: string, scheduledTime: string, durationMinutes: number, benefitId?: string, subscriptionId?: string) => {
    setSubmittingId(beneficiaryId);
    try {
      await visitApi.create({
        beneficiaryId,
        careCompanionId: ccId === 'THIRD_PARTY' ? null : ccId,
        is3rdParty: ccId === 'THIRD_PARTY',
        scheduledTime,
        durationMinutes,
        benefitId,
        subscriptionId,
      });
      toast.success(`✅ Visit scheduled successfully!`);
    } catch (e: any) {
      toast.error(e.message || 'Scheduling failed');
    } finally {
      setSubmittingId(null);
    }
  };

  // ── Refresh all data ────────────────────────────────────────────────────────
  const handleRefreshAll = () => {
    if (!selectedFM) return;
    loadTeam(selectedFM);
    loadBeneficiaries(selectedFM);
  };

  // ── Auto-refresh every 2 minutes ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedFM) return;

    const interval = setInterval(() => {
      loadTeam(selectedFM);
      loadBeneficiaries(selectedFM);
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [selectedFM, loadTeam, loadBeneficiaries]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const assignedCount = beneficiaries.filter(b => b.primaryCcId).length;
  const availableCCs = team.filter(cc => cc.isAvailable).length;

  return (
    <div className="space-y-5">
      {/* ── FM Selector ──────────────────────────────────────────────────── */}
      <FMSelectorDropdown
        fieldManagers={fieldManagers}
        selectedId={selectedFM?.id ?? null}
        onChange={handleSelectFM}
        loading={fmLoading}
      />

      {/* ── Nothing selected yet ────────────────────────────────────────── */}
      {!selectedFM && !fmLoading && (
        <div className="bg-white border border-dashed border-[#E7DED6] rounded-2xl py-16 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF5EE] flex items-center justify-center text-[#FF7A00]">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-black text-gray-700">Select a Field Manager</h3>
          <p className="text-sm text-gray-400 max-w-xs">
            Choose a field manager from the dropdown above to view their team and manage beneficiary assignments.
          </p>
        </div>
      )}

      {/* ── Dashboard (after FM selected) ───────────────────────────────── */}
      {selectedFM && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Team Size"
              value={teamLoading ? '…' : team.length}
              icon={<Users size={16} />}
              color="orange"
            />
            <StatCard
              label="Available CCs"
              value={teamLoading ? '…' : availableCCs}
              icon={<CheckCircle2 size={16} />}
              color="green"
            />
            <StatCard
              label="Beneficiaries"
              value={benLoading ? '…' : beneficiaries.length}
              icon={<UserCheck size={16} />}
              color="blue"
            />
            <StatCard
              label="Assigned"
              value={benLoading ? '…' : assignedCount}
              icon={<CheckCircle2 size={16} />}
              color="purple"
            />
          </div>

          {/* Refresh */}
          <div className="flex justify-end">
            <button
              onClick={handleRefreshAll}
              disabled={teamLoading || benLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-gray-400 hover:text-[#FF7A00] border border-[#E7DED6] rounded-xl hover:border-[#FF7A00] transition-all disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={teamLoading || benLoading ? 'animate-spin' : ''}
              />
              Refresh Data
            </button>
          </div>

          {/* Stacked layout: Team then Beneficiaries */}
          <div className="flex flex-col gap-5">
            {/* Team Panel */}
            <div>
              <TeamPanel
                team={team}
                loading={teamLoading}
                onRefresh={() => loadTeam(selectedFM)}
              />
            </div>

            {/* Beneficiary List */}
            <div>
              <BeneficiaryList
                beneficiaries={beneficiaries}
                team={team}
                loading={benLoading}
                submittingId={submittingId}
                onScheduleVisit={handleScheduleVisit}
                onRefresh={() => loadBeneficiaries(selectedFM)}
              />
            </div>
          </div>
          <ScheduledVisitsPanel defaultFmUserId={selectedFM.userId} />
        </>
      )}
    </div>
  );
}
