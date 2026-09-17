/**
 * Legacy Circle Approval Page
 * Allows admins to review pending Legacy Circle requests and approve them.
 * Approved profiles automatically become visible in the mobile Legacy Circle section.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataCard } from '../components/common/DataCard';
import { EntityAvatar } from '../components/common/EntityAvatar';
import { legacyCircleApi, LegacyCircleRequest } from '../../services/api';
import {
  CheckCircle,
  Clock,
  Users,
  Briefcase,
  Mail,
  MapPin,
  Calendar,
  Award,
  RefreshCw,
  Crown,
} from 'lucide-react';
import { cn } from '../components/ui/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatGender(gender: string) {
  const map: Record<string, string> = {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    prefer_not_to_say: 'Not specified',
  };
  return map[gender] || gender;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}
function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground/60 mt-0.5 shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium text-foreground">{value || '—'}</span>
    </div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: LegacyCircleRequest;
  onApprove: (id: string) => void;
  approving: boolean;
}

function RequestCard({ request, onApprove, approving }: RequestCardProps) {
  return (
    <DataCard
      title={request.name}
      description={`ID: ${request.beneficiaryId.slice(0, 8).toUpperCase()}`}
      avatar={
        <EntityAvatar
          name={request.name}
          photoUrl={request.photo}
          type="beneficiary"
          className="w-14 h-14 text-lg"
        />
      }
    >
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-2">
          <InfoRow
            icon={<Users className="w-3 h-3" />}
            label="Age / Gender"
            value={`${request.age} yrs / ${formatGender(request.gender)}`}
          />
          {request.city && (
            <InfoRow
              icon={<MapPin className="w-3 h-3" />}
              label="Location"
              value={[request.city, request.state, request.pincode].filter(Boolean).join(', ')}
            />
          )}
          <InfoRow
            icon={<Calendar className="w-3 h-3" />}
            label="Submitted"
            value={formatDate(request.createdAt)}
          />
        </div>

        {/* Legacy Circle Info */}
        <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl space-y-2">
          <p className="text-[10px] font-bold uppercase text-orange-700 flex items-center gap-1">
            <Crown className="w-3 h-3" /> Legacy Circle Info
          </p>

          <InfoRow
            icon={<Briefcase className="w-3 h-3" />}
            label="Title"
            value={request.title}
          />
          <InfoRow
            icon={<Award className="w-3 h-3" />}
            label="Industry"
            value={request.industry}
          />
          <InfoRow
            icon={<Clock className="w-3 h-3" />}
            label="Experience"
            value={`${request.yearsOfExperience} years`}
          />
          <InfoRow
            icon={<Mail className="w-3 h-3" />}
            label="Contact Email"
            value={request.email}
          />

          {request.headline && (
            <div className="pt-1">
              <p className="text-[10px] text-orange-700/70 uppercase font-bold mb-1">Headline</p>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {request.headline}
              </p>
            </div>
          )}
        </div>

        {/* Approve Button */}
        <button
          onClick={() => onApprove(request.id)}
          disabled={approving}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200',
            approving
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-[#DFF4E6] text-green-800 hover:bg-[#C9EDDA] active:scale-[0.98]'
          )}
        >
          {approving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Approve
            </>
          )}
        </button>
      </div>
    </DataCard>
  );
}

// ─── Approved Card ────────────────────────────────────────────────────────────

function ApprovedCard({ request }: { request: LegacyCircleRequest }) {
  return (
    <DataCard
      title={request.name}
      description={`ID: ${request.beneficiaryId.slice(0, 8).toUpperCase()}`}
      avatar={
        <EntityAvatar
          name={request.name}
          photoUrl={request.photo}
          type="beneficiary"
          className="w-14 h-14 text-lg"
        />
      }
      headerAction={
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DFF4E6] text-green-800 text-[10px] font-bold uppercase">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      }
    >
      <div className="space-y-2">
        <InfoRow
          icon={<Briefcase className="w-3 h-3" />}
          label="Title"
          value={request.title}
        />
        <InfoRow
          icon={<Award className="w-3 h-3" />}
          label="Industry"
          value={request.industry}
        />
        <InfoRow
          icon={<Clock className="w-3 h-3" />}
          label="Experience"
          value={`${request.yearsOfExperience} years`}
        />
        <InfoRow
          icon={<Users className="w-3 h-3" />}
          label="Age / Gender"
          value={`${request.age} yrs / ${formatGender(request.gender)}`}
        />
        {request.city && (
          <InfoRow
            icon={<MapPin className="w-3 h-3" />}
            label="Location"
            value={[request.city, request.state].filter(Boolean).join(', ')}
          />
        )}
        <InfoRow
          icon={<Calendar className="w-3 h-3" />}
          label="Approved on"
          value={formatDate(request.updatedAt)}
        />

        {request.headline && (
          <div className="mt-2 p-2.5 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground line-clamp-2">{request.headline}</p>
          </div>
        )}
      </div>
    </DataCard>
  );
}

// ─── Empty / Loading States ───────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-2xl text-center space-y-3">
      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-80 bg-secondary/50 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'requests' | 'approved';

export default function LegacyCirclePage() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [pending, setPending] = useState<LegacyCircleRequest[]>([]);
  const [approved, setApproved] = useState<LegacyCircleRequest[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingApproved, setLoadingApproved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    setError(null);
    try {
      const data = await legacyCircleApi.getPending();
      setPending(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending requests.');
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const loadApproved = useCallback(async () => {
    setLoadingApproved(true);
    setError(null);
    try {
      const data = await legacyCircleApi.getApproved();
      setApproved(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load approved members.');
    } finally {
      setLoadingApproved(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
    loadApproved();
  }, [loadPending, loadApproved]);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this Legacy Circle profile? The user will receive a WhatsApp notification.')) return;
    setApprovingId(id);
    try {
      await legacyCircleApi.approve(id);
      // Refresh both tabs so the card moves from Requests → Approved
      await Promise.all([loadPending(), loadApproved()]);
    } catch (err: any) {
      alert(err.message || 'Failed to approve profile. Please try again.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRefresh = () => {
    loadPending();
    loadApproved();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legacy Circle Approval"
        description="Review Legacy Circle requests from beneficiaries. Approved profiles appear automatically on the mobile app."
        action={
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', (loadingPending || loadingApproved) && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            activeTab === 'requests'
              ? 'bg-white shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock className="w-4 h-4" />
          Requests
          {pending.length > 0 && (
            <span className="ml-1 min-w-[20px] h-5 px-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={cn(
            'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
            activeTab === 'approved'
              ? 'bg-white shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <CheckCircle className="w-4 h-4" />
          Approved
          {approved.length > 0 && (
            <span className="ml-1 min-w-[20px] h-5 px-1.5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {approved.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Requests Tab ── */}
      {activeTab === 'requests' && (
        <>
          {loadingPending ? (
            <LoadingGrid />
          ) : pending.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onApprove={handleApprove}
                  approving={approvingId === req.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock className="w-6 h-6" />}
              title="No pending Legacy Circle requests"
              description="All caught up! New requests will appear here when beneficiaries submit their Legacy Circle profiles."
            />
          )}
        </>
      )}

      {/* ── Approved Tab ── */}
      {activeTab === 'approved' && (
        <>
          {loadingApproved ? (
            <LoadingGrid />
          ) : approved.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approved.map((req) => (
                <ApprovedCard key={req.id} request={req} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Crown className="w-6 h-6" />}
              title="No approved Legacy Circle members yet"
              description="Approved profiles will appear here. Approve a request from the Requests tab to get started."
            />
          )}
        </>
      )}
    </div>
  );
}
