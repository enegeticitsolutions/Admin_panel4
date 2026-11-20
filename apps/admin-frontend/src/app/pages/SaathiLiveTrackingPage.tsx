import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  MapPin,
  Clock,
  Phone,
  User,
  RefreshCw,
  Search,
  ExternalLink,
  Navigation,
  AlertCircle,
  CheckCircle2,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Layers,
  Heart,
  Home,
  Compass,
  UserCheck,
  Stethoscope,
  Handshake,
  Zap,
} from 'lucide-react';
import { volunteerApi, visitApi } from '../../services/api';
import { locationApi } from '../../services/location';
import { OngoingVolunteerVisit, OngoingCCVisit, LiveCompanionVisit } from '../../types';
import { sanitizeImgSrc, sanitizeTelLink } from '../utils/sanitizeUrl';

declare global {
  interface Window {
    google: any;
  }
}

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

// Formats elapsed seconds into human readable duration: "1h 14m 20s" or "42m 08s"
const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${minutes}m ${pad(seconds)}s`;
};

// Format check-in timestamp to local time: "11:45 AM"
const formatCheckInTime = (isoString?: string | null): string => {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '--:--';
  }
};

// Calculates Great-Circle distance in meters using Haversine formula
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// Formats distance in meters into human-readable string: "85 m" or "7.1 km"
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

// Type guard helper to differentiate CC visits from Saathi visits
export const isCCVisit = (visit: LiveCompanionVisit): visit is OngoingCCVisit => {
  return (visit as any).type === 'cc' || 'careCompanion' in visit;
};

export const SaathiLiveTrackingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as 'all' | 'cc' | 'saathi') || 'all';

  const [companionFilter, setCompanionFilter] = useState<'all' | 'cc' | 'saathi'>(
    ['all', 'cc', 'saathi'].includes(initialType) ? initialType : 'all'
  );

  const [ccVisits, setCcVisits] = useState<OngoingCCVisit[]>([]);
  const [saathiVisits, setSaathiVisits] = useState<OngoingVolunteerVisit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(20);
  const [mobileView, setMobileView] = useState<'split' | 'map' | 'list'>('split');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [cleaningStuck, setCleaningStuck] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);

  // Synchronize URL search params when filter changes
  const handleFilterChange = (type: 'all' | 'cc' | 'saathi') => {
    setCompanionFilter(type);
    const newParams = new URLSearchParams(searchParams);
    if (type === 'all') {
      newParams.delete('type');
    } else {
      newParams.set('type', type);
    }
    setSearchParams(newParams, { replace: true });
  };

  // 1-second timer to update current time for live ticking duration timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch ongoing visits from backend (both CC and Saathi)
  const fetchOngoingVisits = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setRefreshing(true);
    }
    setError(null);
    try {
      const [ccResult, saathiResult] = await Promise.allSettled([
        visitApi.getOngoingVisits(),
        volunteerApi.getOngoingVisits(),
      ]);

      if (ccResult.status === 'fulfilled') {
        setCcVisits((ccResult.value || []).map((v) => ({ ...v, type: 'cc' as const })));
      } else {
        console.error('Failed to fetch ongoing CC visits:', ccResult.reason);
      }

      if (saathiResult.status === 'fulfilled') {
        setSaathiVisits((saathiResult.value || []).map((v) => ({ ...v, type: 'saathi' as const })));
      } else {
        console.error('Failed to fetch ongoing Saathi visits:', saathiResult.reason);
      }

      if (ccResult.status === 'rejected' && saathiResult.status === 'rejected') {
        throw new Error('Failed to load ongoing visits');
      }

      setCountdown(20);
    } catch (err: any) {
      console.error('Failed to fetch ongoing visits:', err);
      if (!isBackground) {
        setError(err.message || 'Failed to load ongoing visits');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Force-clean stuck or stale visits (>12h old or exhausted)
  const handleCleanStuckVisits = async () => {
    setCleaningStuck(true);
    try {
      const res = await visitApi.closeStuckVisits();
      const count = res.data?.closedCount ?? res.closedCount ?? 0;
      toast.success(
        count > 0 
          ? `Successfully cleared ${count} stuck / stale visit(s)!` 
          : 'No stuck visits found. Active visits are healthy.'
      );
      await fetchOngoingVisits(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clean stuck visits');
    } finally {
      setCleaningStuck(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchOngoingVisits();
  }, [fetchOngoingVisits]);

  // Auto-refresh interval (every 20s)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchOngoingVisits(true);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchOngoingVisits]);

  // Initialize Google Maps
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      try {
        let apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          const config = await locationApi.getConfig();
          apiKey = config.apiKey;
        }
        await loadGoogleMapsScript(apiKey);
        if (!isMounted) return;

        setMapsLoaded(true);

        if (!mapContainerRef.current) return;

        // Default center: New Delhi
        const defaultCenter = { lat: 28.6139, lng: 77.2090 };

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 11,
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: window.google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'administrative.land_parcel',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'poi',
              elementType: 'labels.text',
              stylers: [{ visibility: 'simplified' }],
            },
          ],
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new window.google.maps.InfoWindow();

        // Clicking empty map deselects companion and closes InfoWindow
        map.addListener('click', () => {
          setSelectedVisitId(null);
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }
        });
      } catch (err: any) {
        console.error('Error initializing Google Maps:', err);
        if (isMounted) {
          setError('Failed to initialize Google Maps. Please check your API key.');
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Combine and filter visits according to active filter
  const allVisits: LiveCompanionVisit[] = [
    ...(companionFilter === 'all' || companionFilter === 'cc' ? ccVisits : []),
    ...(companionFilter === 'all' || companionFilter === 'saathi' ? saathiVisits : []),
  ];

  // Helper getters for visit fields
  const getCompanionName = (visit: LiveCompanionVisit): string => {
    return isCCVisit(visit)
      ? visit.careCompanion?.name || 'Care Companion'
      : visit.volunteer?.name || 'Saathi Volunteer';
  };

  const getCompanionPhone = (visit: LiveCompanionVisit): string => {
    return isCCVisit(visit)
      ? visit.careCompanion?.phone || ''
      : visit.volunteer?.phone || '';
  };

  const getCompanionCoords = (visit: LiveCompanionVisit): { lat?: number | null; lng?: number | null } => {
    if (isCCVisit(visit)) {
      return {
        lat: visit.careCompanion?.latitude,
        lng: visit.careCompanion?.longitude,
      };
    }
    return {
      lat: visit.volunteer?.latitude,
      lng: visit.volunteer?.longitude,
    };
  };

  // Focus a specific visit on the map and open its InfoWindow
  const focusVisitOnMap = useCallback(
    (visit: LiveCompanionVisit) => {
      setSelectedVisitId(visit.id);
      if (!mapInstanceRef.current) return;

      const cCoords = getCompanionCoords(visit);
      const bLat = visit.beneficiary?.latitude;
      const bLng = visit.beneficiary?.longitude;

      const vLat = cCoords.lat;
      const vLng = cCoords.lng;

      const distance =
        visit.distanceMeters ??
        (vLat && vLng && bLat && bLng ? getDistanceInMeters(vLat, vLng, bLat, bLng) : null);
      const isWith = visit.isWithBeneficiary || (distance !== null ? distance <= 100 : false);

      if (vLat && vLng && bLat && bLng && !isWith) {
        const b = new window.google.maps.LatLngBounds();
        b.extend({ lat: vLat, lng: vLng });
        b.extend({ lat: bLat, lng: bLng });
        mapInstanceRef.current.fitBounds(b, { top: 80, right: 80, bottom: 80, left: 80 });
      } else {
        const primaryLat = vLat || bLat;
        const primaryLng = vLng || bLng;
        if (primaryLat && primaryLng) {
          mapInstanceRef.current.panTo({ lat: primaryLat, lng: primaryLng });
          mapInstanceRef.current.setZoom(16);
        }
      }

      // Open InfoWindow on the Companion marker
      const marker = markersRef.current.get(visit.id);
      if (marker && infoWindowRef.current) {
        const content = generateInfoWindowHtml(visit, currentTime);
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      }
    },
    [currentTime]
  );

  // Auto-focus companion if ccId is passed via URL search parameters
  useEffect(() => {
    const ccIdParam = searchParams.get('ccId');
    if (!ccIdParam || allVisits.length === 0 || !mapsLoaded) return;

    const matchedVisit = allVisits.find(
      (v) => isCCVisit(v) && (v.careCompanion?.id === ccIdParam || v.careCompanionId === ccIdParam)
    );

    if (matchedVisit) {
      focusVisitOnMap(matchedVisit);
    }
  }, [searchParams, allVisits, mapsLoaded, focusVisitOnMap]);

  // Generate rich HTML for InfoWindow
  const generateInfoWindowHtml = (visit: LiveCompanionVisit, now: Date): string => {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(visit.checkInTime).getTime()) / 1000)
    );
    const durationStr = formatDuration(elapsedSeconds);
    const checkInFormatted = formatCheckInTime(visit.checkInTime);

    const isCC = isCCVisit(visit);
    const cName = getCompanionName(visit);
    const cPhone = getCompanionPhone(visit);
    const bName = visit.beneficiary?.name || 'Beneficiary';
    const bAddress = visit.beneficiary?.address || 'Saved Address';
    const bPhone = visit.beneficiary?.phone || '';

    const cCoords = getCompanionCoords(visit);
    const vLat = cCoords.lat;
    const vLng = cCoords.lng;
    const bLat = visit.beneficiary?.latitude;
    const bLng = visit.beneficiary?.longitude;

    const distance =
      visit.distanceMeters ??
      (vLat && vLng && bLat && bLng ? getDistanceInMeters(vLat, vLng, bLat, bLng) : null);
    const isWith = visit.isWithBeneficiary || (distance !== null ? distance <= 100 : false);

    const navBenUrl = bLat && bLng ? `https://www.google.com/maps/dir/?api=1&destination=${bLat},${bLng}` : '#';

    const typeBadge = isCC
      ? `<span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🩺 Care Companion</span>`
      : `<span style="background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🤝 Saathi Volunteer</span>`;

    const isManual = isCC && (Boolean((visit as OngoingCCVisit).isManualCheckIn) || Boolean((visit as OngoingCCVisit).manualCheckInReason));
    const manualReason = isCC ? (visit as OngoingCCVisit).manualCheckInReason : null;

    const manualBannerHtml = isManual
      ? `
        <div style="background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 8px; font-size: 11px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-weight: 700; color: #b45309;">⚠️ Manual Check-in (Flagged)</span>
            <span style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 1px 5px; border-radius: 4px; font-weight: 600;">At Residence</span>
          </div>
          ${manualReason ? `<div style="font-size: 10px; color: #78350f; margin-top: 3px;">Reason: <strong>"${manualReason}"</strong></div>` : ''}
          <div style="font-size: 10px; color: #a16207; margin-top: 2px;">📍 Live GPS was not captured. Pin placed at senior's residence.</div>
        </div>
      `
      : '';

    const teamZoneHtml = isCC && (visit.careCompanion?.teamName || visit.careCompanion?.zone)
      ? `<div style="font-size: 11px; color: #4338ca; margin-top: 2px; font-weight: 500;">Zone: ${visit.careCompanion.zone || 'N/A'}${visit.careCompanion.teamName ? ` • Team: ${visit.careCompanion.teamName}` : ''}</div>`
      : '';

    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 320px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${isWith ? '#10b981' : isManual ? '#f59e0b' : isCC ? '#6366f1' : '#f97316'};"></span>
            <span style="font-size: 11px; font-weight: 700; color: ${isWith ? '#059669' : isManual ? '#d97706' : isCC ? '#4f46e5' : '#ea580c'}; text-transform: uppercase; letter-spacing: 0.5px;">
              ${isWith ? 'With Beneficiary' : isManual ? 'Manual Check-in' : 'Visit Active'}
            </span>
          </div>
          <div style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 9999px; font-size: 11px; font-weight: 700; font-family: monospace; padding: 2px 8px;">
            ⏱️ ${durationStr}
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          ${typeBadge}
        </div>

        ${manualBannerHtml}

        ${
          distance !== null
            ? isWith
              ? `<div style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span>🟢</span>
                  <span>Companion is with beneficiary (&lt;100m • ${Math.round(distance)}m)</span>
                </div>`
              : `<div style="background: #fffbeb; color: #92400e; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                  <span>📍 Distance between them:</span>
                  <span style="background: #fef3c7; padding: 1px 6px; border-radius: 4px; border: 1px solid #fcd34d;">${formatDistance(distance)}</span>
                </div>`
            : ''
        }

        <div style="margin-bottom: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">${isCC ? 'Care Companion' : 'Saathi Volunteer'} (Live GPS)</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${cName}</div>
          ${teamZoneHtml}
          ${cPhone ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">📞 <a href="tel:${cPhone}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${cPhone}</a></div>` : ''}
          ${vLat && vLng ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">📡 Live GPS: ${vLat.toFixed(5)}, ${vLng.toFixed(5)}</div>` : ''}
        </div>

        <div style="margin-bottom: 10px; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Beneficiary Residence</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${bName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px; line-height: 1.3;">📍 ${bAddress}</div>
          ${bPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">📞 <a href="tel:${bPhone}" style="color: #2563eb; text-decoration: none;">${bPhone}</a></div>` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
          <span>Checked In: <strong>${checkInFormatted}</strong></span>
          ${bLat && bLng ? `<a href="${navBenUrl}" target="_blank" rel="noopener noreferrer" style="color: ${isCC ? '#4f46e5' : '#ea580c'}; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">Beneficiary Map ↗</a>` : ''}
        </div>
      </div>
    `;
  };

  // Update map markers whenever visits change or map becomes ready
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const existingMarkers = markersRef.current;
    const existingPolylines = polylinesRef.current;

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;

    // Track active keys to cleanly garbage collect old markers
    const activeMarkerKeys = new Set<string>();
    const activePolylineKeys = new Set<string>();

    allVisits.forEach((visit) => {
      const isCC = isCCVisit(visit);
      const cCoords = getCompanionCoords(visit);
      const vLat = cCoords.lat;
      const vLng = cCoords.lng;
      const bLat = visit.beneficiary?.latitude;
      const bLng = visit.beneficiary?.longitude;

      const distance =
        visit.distanceMeters ??
        (vLat && vLng && bLat && bLng ? getDistanceInMeters(vLat, vLng, bLat, bLng) : null);
      const isWith = visit.isWithBeneficiary || (distance !== null ? distance <= 100 : false);

      const cName = getCompanionName(visit);
      const bName = visit.beneficiary?.name || 'Beneficiary';

      const companionThemeColor = isCC ? '#4f46e5' : '#ea580c';
      const companionLightColor = isCC ? '#6366f1' : '#f97316';

      // Case 1: Within 100 meters (or only one location exists) -> Unified pin
      if (isWith || !(vLat && vLng && bLat && bLng)) {
        const lat = vLat || bLat;
        const lng = vLng || bLng;
        if (!lat || !lng) return;

        hasValidCoords = true;
        const pos = { lat, lng };
        bounds.extend(pos);

        const markerKey = visit.id;
        activeMarkerKeys.add(markerKey);

        const isManual = isCC && (Boolean((visit as OngoingCCVisit).isManualCheckIn) || Boolean((visit as OngoingCCVisit).manualCheckInReason));

        const markerSvg = isWith
          ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow-green-${visit.id}" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
                </filter>
              </defs>
              <path d="M23 0C11.4 0 2 9.4 2 21c0 14.8 19.1 31.8 19.9 32.5a1.5 1.5 0 0 0 2.2 0C24.9 52.8 44 35.8 44 21 44 9.4 34.6 0 23 0z" fill="#059669" filter="url(#shadow-green-${visit.id})"/>
              <circle cx="23" cy="20" r="15" fill="#ffffff"/>
              <circle cx="23" cy="20" r="12" fill="#10b981"/>
              <path d="M19.5 24.5l-4-4 1.4-1.4 2.6 2.6 7-7 1.4 1.4z" fill="#ffffff"/>
            </svg>
          `
          : isManual
          ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow-warn-${visit.id}" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
                </filter>
              </defs>
              <path d="M23 0C11.4 0 2 9.4 2 21c0 14.8 19.1 31.8 19.9 32.5a1.5 1.5 0 0 0 2.2 0C24.9 52.8 44 35.8 44 21 44 9.4 34.6 0 23 0z" fill="#d97706" filter="url(#shadow-warn-${visit.id})"/>
              <circle cx="23" cy="20" r="15" fill="#ffffff"/>
              <circle cx="23" cy="20" r="12" fill="#f59e0b"/>
              <path d="M23 14v8M23 25v1.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          `
          : `
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
              <defs>
                <filter id="shadow-theme-${visit.id}" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
                </filter>
              </defs>
              <path d="M23 0C11.4 0 2 9.4 2 21c0 14.8 19.1 31.8 19.9 32.5a1.5 1.5 0 0 0 2.2 0C24.9 52.8 44 35.8 44 21 44 9.4 34.6 0 23 0z" fill="${companionThemeColor}" filter="url(#shadow-theme-${visit.id})"/>
              <circle cx="23" cy="20" r="15" fill="#ffffff"/>
              <circle cx="23" cy="20" r="12" fill="${companionLightColor}"/>
              ${isCC
                ? `<path d="M22 14h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="#ffffff"/>`
                : `<path d="M23 24.5l-1.05-.95C18.2 20 15.7 17.7 15.7 14.9c0-2.3 1.8-4.1 4.1-4.1 1.3 0 2.55.6 3.2 1.55.65-.95 1.9-1.55 3.2-1.55 2.3 0 4.1 1.8 4.1 4.1 0 2.8-2.5 5.1-6.25 8.65L23 24.5z" fill="#ffffff" transform="scale(0.7) translate(10, 9)"/>`
              }
            </svg>
          `;

        const pinTitle = isWith
          ? `${cName} is with ${bName} (<100m)`
          : isManual
          ? `${cName} (Manual Check-in at ${bName}'s residence)`
          : `${cName} → ${bName}`;

        let marker = existingMarkers.get(markerKey);
        if (!marker) {
          marker = new window.google.maps.Marker({
            position: pos,
            map,
            title: pinTitle,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
              scaledSize: new window.google.maps.Size(46, 54),
              anchor: new window.google.maps.Point(23, 52),
            },
          });
          marker.addListener('click', () => {
            setSelectedVisitId(visit.id);
            if (infoWindowRef.current) {
              const content = generateInfoWindowHtml(visit, currentTime);
              infoWindowRef.current.setContent(content);
              infoWindowRef.current.open(map, marker);
            }
          });
          existingMarkers.set(markerKey, marker);
        } else {
          marker.setPosition(pos);
          marker.setTitle(pinTitle);
          marker.setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
            scaledSize: new window.google.maps.Size(46, 54),
            anchor: new window.google.maps.Point(23, 52),
          });
        }
      } else {
        // Case 2: Distance > 100m -> Separate Companion Live GPS Pin, Beneficiary Residence Pin, and connecting Polyline
        hasValidCoords = true;
        bounds.extend({ lat: vLat, lng: vLng });
        bounds.extend({ lat: bLat, lng: bLng });

        const companionKey = visit.id;
        const benKey = `${visit.id}_ben`;
        activeMarkerKeys.add(companionKey);
        activeMarkerKeys.add(benKey);
        // Note: Polylines are strictly rendered only when this visit is explicitly selected

        const companionSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
            <defs>
              <filter id="shadow-comp-${visit.id}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <path d="M23 0C11.4 0 2 9.4 2 21c0 14.8 19.1 31.8 19.9 32.5a1.5 1.5 0 0 0 2.2 0C24.9 52.8 44 35.8 44 21 44 9.4 34.6 0 23 0z" fill="${companionThemeColor}" filter="url(#shadow-comp-${visit.id})"/>
            <circle cx="23" cy="20" r="15" fill="#ffffff"/>
            <circle cx="23" cy="20" r="12" fill="${companionLightColor}"/>
            ${isCC
              ? `<path d="M22 14h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="#ffffff"/>`
              : `<path d="M23 24.5l-1.05-.95C18.2 20 15.7 17.7 15.7 14.9c0-2.3 1.8-4.1 4.1-4.1 1.3 0 2.55.6 3.2 1.55.65-.95 1.9-1.55 3.2-1.55 2.3 0 4.1 1.8 4.1 4.1 0 2.8-2.5 5.1-6.25 8.65L23 24.5z" fill="#ffffff" transform="scale(0.7) translate(10, 9)"/>`
            }
          </svg>
        `;

        const benSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="46" height="54" viewBox="0 0 46 54">
            <defs>
              <filter id="shadow-ben-${visit.id}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
              </filter>
            </defs>
            <path d="M23 0C11.4 0 2 9.4 2 21c0 14.8 19.1 31.8 19.9 32.5a1.5 1.5 0 0 0 2.2 0C24.9 52.8 44 35.8 44 21 44 9.4 34.6 0 23 0z" fill="#2563eb" filter="url(#shadow-ben-${visit.id})"/>
            <circle cx="23" cy="20" r="15" fill="#ffffff"/>
            <circle cx="23" cy="20" r="12" fill="#3b82f6"/>
            <!-- House Icon -->
            <path d="M23 12l-7 6v7h4v-4h6v4h4v-7z" fill="#ffffff"/>
          </svg>
        `;

        // 1. Companion Live GPS Marker
        let companionMarker = existingMarkers.get(companionKey);
        if (!companionMarker) {
          companionMarker = new window.google.maps.Marker({
            position: { lat: vLat, lng: vLng },
            map,
            title: `${cName} (${isCC ? 'Care Companion' : 'Saathi'} Live GPS • ${formatDistance(distance)} from Beneficiary)`,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(companionSvg)}`,
              scaledSize: new window.google.maps.Size(46, 54),
              anchor: new window.google.maps.Point(23, 52),
            },
          });
          companionMarker.addListener('click', () => {
            setSelectedVisitId(visit.id);
            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(generateInfoWindowHtml(visit, currentTime));
              infoWindowRef.current.open(map, companionMarker);
            }
          });
          existingMarkers.set(companionKey, companionMarker);
        } else {
          companionMarker.setPosition({ lat: vLat, lng: vLng });
          companionMarker.setTitle(`${cName} (${isCC ? 'Care Companion' : 'Saathi'} Live GPS • ${formatDistance(distance)} from Beneficiary)`);
          companionMarker.setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(companionSvg)}`,
            scaledSize: new window.google.maps.Size(46, 54),
            anchor: new window.google.maps.Point(23, 52),
          });
        }

        // 2. Beneficiary Residence Marker
        let benMarker = existingMarkers.get(benKey);
        if (!benMarker) {
          benMarker = new window.google.maps.Marker({
            position: { lat: bLat, lng: bLng },
            map,
            title: `${bName} (Beneficiary Residence)`,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(benSvg)}`,
              scaledSize: new window.google.maps.Size(46, 54),
              anchor: new window.google.maps.Point(23, 52),
            },
          });
          benMarker.addListener('click', () => {
            setSelectedVisitId(visit.id);
            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(generateInfoWindowHtml(visit, currentTime));
              infoWindowRef.current.open(map, benMarker);
            }
          });
          existingMarkers.set(benKey, benMarker);
        } else {
          benMarker.setPosition({ lat: bLat, lng: bLng });
          benMarker.setTitle(`${bName} (Beneficiary Residence)`);
          benMarker.setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(benSvg)}`,
            scaledSize: new window.google.maps.Size(46, 54),
            anchor: new window.google.maps.Point(23, 52),
          });
        }

        // 3. Distance Connection Polyline (ONLY rendered when this specific companion/visit is selected)
        const isSelected = selectedVisitId === visit.id;
        if (isSelected) {
          activePolylineKeys.add(visit.id);
          let poly = existingPolylines.get(visit.id);
          const path = [
            { lat: vLat, lng: vLng },
            { lat: bLat, lng: bLng },
          ];
          if (!poly) {
            poly = new window.google.maps.Polyline({
              path,
              strokeColor: companionThemeColor,
              strokeOpacity: 0.85,
              strokeWeight: 3,
              icons: [
                {
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 3,
                  },
                  offset: '0',
                  repeat: '15px',
                },
              ],
              map,
            });
            existingPolylines.set(visit.id, poly);
          } else {
            poly.setMap(map);
            poly.setPath(path);
            poly.setOptions({ strokeColor: companionThemeColor });
          }
        }
      }
    });

    // Cleanup markers and polylines that are no longer active
    existingMarkers.forEach((marker, key) => {
      if (!activeMarkerKeys.has(key)) {
        marker.setMap(null);
        existingMarkers.delete(key);
      }
    });

    existingPolylines.forEach((line, key) => {
      if (!activePolylineKeys.has(key)) {
        line.setMap(null);
        existingPolylines.delete(key);
      }
    });

    // Auto fit bounds if coordinates exist and no visit was explicitly selected
    if (hasValidCoords && !selectedVisitId) {
      if (allVisits.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      }
    }
  }, [allVisits, mapsLoaded, selectedVisitId, currentTime]);

  // Filtered visits list based on search query
  const filteredVisits = allVisits.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cName = getCompanionName(v).toLowerCase();
    const cPhone = getCompanionPhone(v);
    const bName = (v.beneficiary?.name || '').toLowerCase();
    const bAddress = (v.beneficiary?.address || '').toLowerCase();
    const notes = (v.notes || '').toLowerCase();
    const zone = isCCVisit(v) ? (v.careCompanion?.zone || '').toLowerCase() : '';
    const team = isCCVisit(v) ? (v.careCompanion?.teamName || '').toLowerCase() : '';

    return (
      cName.includes(q) ||
      cPhone.includes(q) ||
      bName.includes(q) ||
      bAddress.includes(q) ||
      notes.includes(q) ||
      zone.includes(q) ||
      team.includes(q)
    );
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {/* ── Top Bar / Header ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-sm z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <Navigation size={18} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Live Companion Tracker
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {allVisits.length} Ongoing {allVisits.length === 1 ? 'Visit' : 'Visits'}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time Google Maps monitoring for Field Managers (FM) and Operations Managers (OM).
            </p>
          </div>

          {/* Action buttons, Companion Filter Tabs & Auto-refresh status */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Tabs: All | Care Companions | Saathi Volunteers */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-3 py-1.5 rounded-md transition ${
                  companionFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({ccVisits.length + saathiVisits.length})
              </button>
              <button
                onClick={() => handleFilterChange('cc')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
                  companionFilter === 'cc'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                <Stethoscope size={12} />
                <span>Care Companions ({ccVisits.length})</span>
              </button>
              <button
                onClick={() => handleFilterChange('saathi')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition ${
                  companionFilter === 'saathi'
                    ? 'bg-orange-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-orange-600'
                }`}
              >
                <Handshake size={12} />
                <span>Saathi ({saathiVisits.length})</span>
              </button>
            </div>

            {/* Auto refresh status pill */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Click to toggle auto-refresh"
            >
              <Radio size={13} className={autoRefresh ? 'animate-pulse text-emerald-600' : 'text-slate-400'} />
              <span>{autoRefresh ? `Auto Sync: ${countdown}s` : 'Auto Sync: Paused'}</span>
            </button>

            {/* Manual refresh button */}
            <button
              onClick={() => fetchOngoingVisits(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-orange-600' : ''} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            {/* Clean Stuck / Stale Visits button */}
            <button
              onClick={handleCleanStuckVisits}
              disabled={cleaningStuck}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 active:bg-amber-200 transition shadow-xs disabled:opacity-50"
              title="Auto-close stuck visits exceeding shift duration or client benefit capacity"
            >
              <Zap size={13} className={cleaningStuck ? 'animate-spin text-amber-600' : 'text-amber-600'} />
              <span>{cleaningStuck ? 'Cleaning...' : 'Clean Stuck Visits'}</span>
            </button>

            {/* View switcher for small screens */}
            <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setMobileView('list')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  mobileView === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                List ({filteredVisits.length})
              </button>
              <button
                onClick={() => setMobileView('map')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  mobileView === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Map View
              </button>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchOngoingVisits()}
              className="font-semibold text-red-800 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area (Split Screen) ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ── Left Side Panel: Ongoing Visits List ── */}
        <div
          className={`w-full lg:w-[420px] xl:w-[460px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 transition-all ${
            mobileView === 'map' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search box inside panel */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Companion, Beneficiary, Zone, or Area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Visits Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="py-16 text-center">
                <RefreshCw size={26} className="animate-spin text-orange-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading live ongoing visits...</p>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Compass size={28} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {searchQuery ? 'No matching ongoing visits' : 'No Ongoing Visits Right Now'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? 'Try clearing your search query to see all active visits.'
                    : companionFilter === 'cc'
                    ? 'As soon as a Care Companion checks in for a scheduled visit, their live location and interaction duration will appear here automatically.'
                    : companionFilter === 'saathi'
                    ? 'As soon as a Saathi checks in with a matched senior citizen, their live location and interaction duration will appear here.'
                    : 'As soon as a Care Companion or Saathi volunteer checks in, their live location and ticking interaction duration timer will appear here automatically.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              filteredVisits.map((visit) => {
                const isSelected = selectedVisitId === visit.id;
                const isCC = isCCVisit(visit);
                const elapsedSeconds = Math.max(
                  0,
                  Math.floor((currentTime.getTime() - new Date(visit.checkInTime).getTime()) / 1000)
                );
                const liveDurationText = formatDuration(elapsedSeconds);
                const checkInFormatted = formatCheckInTime(visit.checkInTime);

                const cName = getCompanionName(visit);
                const cPhone = getCompanionPhone(visit);
                const cCoords = getCompanionCoords(visit);
                const vLat = cCoords.lat;
                const vLng = cCoords.lng;
                const bLat = visit.beneficiary?.latitude;
                const bLng = visit.beneficiary?.longitude;

                const distance =
                  visit.distanceMeters ??
                  (vLat && vLng && bLat && bLng ? getDistanceInMeters(vLat, vLng, bLat, bLng) : null);
                const isWith = visit.isWithBeneficiary || (distance !== null ? distance <= 100 : false);

                const hasGps = Boolean(vLat && vLng);

                const telHref = cPhone ? sanitizeTelLink(`tel:${cPhone}`) : '';
                const benTelHref = visit.beneficiary?.phone
                  ? sanitizeTelLink(`tel:${visit.beneficiary.phone}`)
                  : '';

                return (
                  <div
                    key={visit.id}
                    onClick={() => focusVisitOnMap(visit)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                      isSelected
                        ? isCC
                          ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md bg-indigo-50/20'
                          : 'border-orange-500 ring-2 ring-orange-200 shadow-md bg-orange-50/20'
                        : 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                    }`}
                  >
                    {/* Header: Type Badge, Status Pulse & Ticking Duration Timer */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        {isCC ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Stethoscope size={11} /> CC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            <Handshake size={11} /> Saathi
                          </span>
                        )}

                        {isCC && ((visit as OngoingCCVisit).isManualCheckIn || (visit as OngoingCCVisit).manualCheckInReason) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle size={10} /> Manual
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">
                            In Progress
                          </span>
                        </div>
                      </div>

                      {/* Live Ticking Duration Badge */}
                      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono shadow-xs">
                        <Clock size={12} className="text-amber-600 animate-spin-slow" />
                        <span>{liveDurationText}</span>
                      </div>
                    </div>

                    {/* Companion Information Row */}
                    <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                      <div
                        className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${
                          isCC
                            ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                            : 'bg-orange-100 border-orange-200 text-orange-700'
                        }`}
                      >
                        {isCC ? (
                          (cName || 'C').charAt(0).toUpperCase()
                        ) : visit.volunteer?.profilePhoto ? (
                          <img
                            src={sanitizeImgSrc(visit.volunteer.profilePhoto)}
                            alt={cName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          (cName || 'S').charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {cName}
                          </h4>
                          {hasGps ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              GPS Active
                            </span>
                          ) : isCC && ((visit as OngoingCCVisit).isManualCheckIn || (visit as OngoingCCVisit).manualCheckInReason) ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0 flex items-center gap-1">
                              <AlertCircle size={10} />
                              Manual Check-in
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              No GPS
                            </span>
                          )}
                        </div>

                        {/* Zone / Team for CC */}
                        {isCC && (visit.careCompanion?.zone || visit.careCompanion?.teamName) && (
                          <div className="text-[11px] font-medium text-indigo-700 mt-0.5 truncate">
                            {visit.careCompanion.zone && `Zone: ${visit.careCompanion.zone}`}
                            {visit.careCompanion.teamName && ` • Team: ${visit.careCompanion.teamName}`}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          {cPhone && (
                            <a
                              href={telHref}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium"
                            >
                              <Phone size={11} className={isCC ? 'text-indigo-500' : 'text-orange-500'} />
                              <span>{cPhone}</span>
                            </a>
                          )}
                        </div>

                        {vLat && vLng && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <span>📡</span>
                            <span>{vLat.toFixed(5)}, {vLng.toFixed(5)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Beneficiary Information Card */}
                    <div className="mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        <span className="flex items-center gap-1">
                          <Heart size={12} className="text-rose-500" /> Beneficiary Senior
                        </span>
                        {visit.beneficiary?.phone && (
                          <a
                            href={benTelHref}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-blue-600 hover:underline font-medium lowercase"
                          >
                            <Phone size={10} /> Call
                          </a>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-800">
                        {visit.beneficiary?.name || 'Senior Citizen'}
                        {visit.beneficiary?.age && (
                          <span className="font-normal text-slate-500 ml-1">
                            ({visit.beneficiary.age}y
                            {visit.beneficiary.gender ? `, ${visit.beneficiary.gender}` : ''})
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-1.5 mt-1 text-[11px] text-slate-600 leading-tight">
                        <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {visit.beneficiary?.address || 'Saved residence location'}
                        </span>
                      </div>
                    </div>

                    {/* Proximity / Distance Status Block */}
                    {isCC && ((visit as OngoingCCVisit).isManualCheckIn || (visit as OngoingCCVisit).manualCheckInReason) ? (
                      <div className="mt-2.5 bg-amber-50 border border-amber-200/90 rounded-lg p-2.5 text-xs shadow-2xs">
                        <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle size={13} className="text-amber-600 shrink-0" />
                            Manual Check-in (Flagged)
                          </span>
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                            At Residence
                          </span>
                        </div>
                        {(visit as OngoingCCVisit).manualCheckInReason && (
                          <div className="text-[11px] text-amber-800 font-medium">
                            Reason: <span className="font-bold">"{(visit as OngoingCCVisit).manualCheckInReason}"</span>
                          </div>
                        )}
                        <div className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                          <MapPin size={10} /> Pin shown at Beneficiary registered residence
                        </div>
                      </div>
                    ) : distance !== null ? (
                      isWith ? (
                        <div className="mt-2.5 bg-emerald-50 border border-emerald-200/90 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-2xs">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Companion is with beneficiary</span>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md font-mono border border-emerald-200">
                            &lt;100m ({Math.round(distance)}m)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2.5 bg-amber-50 border border-amber-200/90 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-2xs">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                            <Navigation size={13} className="text-amber-600 shrink-0" />
                            <span>Distance between them</span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md font-mono border border-amber-300">
                            {formatDistance(distance)}
                          </span>
                        </div>
                      )
                    ) : null}

                    {/* Footer / Meta info */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Checked In: <strong className="text-slate-700">{checkInFormatted}</strong></span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          focusVisitOnMap(visit);
                          if (window.innerWidth < 1024) {
                            setMobileView('map');
                          }
                        }}
                        className={`inline-flex items-center gap-1 font-semibold group ${
                          isCC ? 'text-indigo-600 hover:text-indigo-700' : 'text-orange-600 hover:text-orange-700'
                        }`}
                      >
                        <span>Focus on Map</span>
                        <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Main Panel: Google Maps Canvas ── */}
        <div
          className={`flex-1 h-full relative ${
            mobileView === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Map canvas container */}
          <div ref={mapContainerRef} className="w-full h-full bg-slate-100" />

          {/* Map floating controls overlay */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-xs p-2 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 px-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              {allVisits.length} Active {allVisits.length === 1 ? 'Visit' : 'Visits'} on Live Map
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={() => {
                if (mapInstanceRef.current && allVisits.length > 0) {
                  const bounds = new window.google.maps.LatLngBounds();
                  let count = 0;
                  allVisits.forEach((v) => {
                    const cCoords = getCompanionCoords(v);
                    const lat = cCoords.lat || v.beneficiary?.latitude;
                    const lng = cCoords.lng || v.beneficiary?.longitude;
                    if (lat && lng) {
                      bounds.extend({ lat, lng });
                      count++;
                    }
                  });
                  if (count > 0) {
                    mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
                  }
                }
              }}
              className="text-xs font-semibold text-slate-700 hover:text-indigo-600 px-2 py-1 rounded hover:bg-slate-100 transition"
              title="Fit all active visits on map"
            >
              Fit All Bounds
            </button>
          </div>

          {/* Map Legend (Bottom Right) */}
          <div className="absolute bottom-6 right-4 z-10 bg-white/95 backdrop-blur-xs p-3 rounded-xl shadow-lg border border-slate-200 text-xs space-y-2 hidden sm:block">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider border-b border-slate-100 pb-1">
              Tracker Legend
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 border border-white shadow-xs inline-block"></span>
              <span className="text-slate-700 font-medium">Care Companion (CC)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-white shadow-xs inline-block"></span>
              <span className="text-slate-700 font-medium">Saathi Volunteer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow-xs inline-block"></span>
              <span className="text-slate-700 font-medium">Beneficiary Residence</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white shadow-xs inline-block"></span>
              <span className="text-slate-700 font-medium">With Beneficiary (&le;100m)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-xs inline-block"></span>
              <span className="text-slate-700 font-medium">Manual Check-in (At Residence)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-indigo-500 inline-block"></span>
              <span className="text-slate-700 font-medium">Distance Connection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaathiLiveTrackingPage;
