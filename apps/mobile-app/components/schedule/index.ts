export * from './UpcomingVisitHeroCard';
export * from './CompanionVisitReportModal';

export interface ScheduleVitalItem {
  id?: string;
  name: string;
  code?: string;
  value: string;
  unit?: string;
}

export interface ScheduleVisit {
  id: string;
  title: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  location?: string;
  date: string;
  shortDate?: string;
  fullDateTime?: string;
  relativeDayLabel?: string;
  dayShort?: string;
  dayNumber?: string;
  time: string;
  timeRange?: string;
  arrivalWindow?: string;
  duration: string;
  companionName: string;
  companionFirstName?: string;
  companionInitials?: string;
  companionPhoto?: string | null;
  companionPhone?: string | null;
  companionRating?: number;
  companionVerified?: boolean;
  type: string;
  status: string;
  visitSummary?: string | null;
  notes?: string | null;
  mood?: string | null;
  vitals?: ScheduleVitalItem[];
  photos?: string[];
  checkInTime?: string | null;
  checkOutTime?: string | null;
  changeRequestedAt?: string;
  changeRequestStatus?: string;
  changeResolutionReason?: string;
  rawScheduledTime?: string;
}
