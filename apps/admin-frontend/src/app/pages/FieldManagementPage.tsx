/**
 * Field Management Portal — Unified Entry Point
 *
 * Provides tabbed views for:
 *   1. CC Allocation & Scheduling (existing workflows)
 *   2. Roster Timeline & Approvals (real-time Gantt view + approval flow)
 *   3. Planned vs. Actual Report (comparative verification logs)
 *   4. Daily Roster Feedback (CC and zone level review comments)
 */

import React, { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import OpsManagerFieldView from '../components/field-management/OpsManagerFieldView';
import FieldManagerView from '../components/field-management/FieldManagerView';
import RosterReviewPanel from '../components/field-management/RosterReviewPanel';
import PlannedVsActualReport from '../components/field-management/PlannedVsActualReport';
import { Calendar, Users, ClipboardList, MessageSquare, Navigation } from 'lucide-react';

export default function FieldManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'scheduling' | 'timeline' | 'report' | 'feedback'>('scheduling');

  const renderView = () => {
    switch (activeTab) {
      case 'timeline':
        return <RosterReviewPanel mode="timeline" />;
      case 'report':
        return <PlannedVsActualReport />;
      case 'feedback':
        return <RosterReviewPanel mode="feedback" />;
      case 'scheduling':
      default:
        switch (user?.role) {
          case 'field_manager':
            return <FieldManagerView />;
          case 'master_admin':
          case 'admin':
          case 'operations_manager':
          default:
            return <OpsManagerFieldView />;
        }
    }
  };

  const subtitle =
    activeTab === 'scheduling'
      ? user?.role === 'field_manager'
        ? 'Manage your assigned team and beneficiaries.'
        : 'Select a Field Manager to manage their team and appoint Care Companions.'
      : activeTab === 'timeline'
      ? 'View real-time planned vs. actual care companion timelines and approve rosters.'
      : activeTab === 'report'
      ? 'Compare scheduled check-ins against actual checkout and geo-verification metrics.'
      : 'Capture daily CC performance comments and overall zone-wide roster feedback.';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Field Management Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Link
          to="/saathi-tracking"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm hover:shadow transition-all shrink-0 self-start sm:self-auto"
        >
          <Navigation size={14} className="animate-pulse" />
          <span>Live Saathi Tracker</span>
        </Link>
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-1 border-b border-[#E7DED6] overflow-x-auto whitespace-nowrap">
        {[
          { key: 'scheduling', label: 'CC Allocation & Scheduling', icon: Users },
          { key: 'timeline', label: 'Roster Timeline & Approvals', icon: Calendar },
          { key: 'report', label: 'Planned vs. Actual Report', icon: ClipboardList },
          { key: 'feedback', label: 'Daily Roster Feedback', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-black border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#FF7A00] text-[#FF7A00]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4">
        {renderView()}
      </div>
    </div>
  );
}
