import React from 'react';
import { useNavigate } from 'react-router';
import ScheduledVisitsPanel from '../components/field-management/ScheduledVisitsPanel';
import { CalendarClock, Navigation } from 'lucide-react';

export default function VisitsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-[#FAF8F5] p-6 rounded-[24px] border border-[#E7DED6] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Global Visits</h1>
          <p className="text-sm font-bold text-gray-500 mt-1">
            Monitor and manage all scheduled, in-progress, and completed visits across all zones.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/saathi-tracking?type=cc')}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition-all"
          >
            <Navigation size={15} className="animate-pulse" />
            Live Map Tracker
          </button>
          <button
            onClick={() => navigate('/field-management')}
            className="flex items-center gap-2 px-5 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm transition-all"
          >
            <CalendarClock size={16} />
            View Roster & Reports
          </button>
        </div>
      </div>

      <ScheduledVisitsPanel hideFmSelector={false} />
    </div>
  );
}
