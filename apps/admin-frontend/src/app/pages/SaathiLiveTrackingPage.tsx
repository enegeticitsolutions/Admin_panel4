import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { volunteerApi } from '../../services/api';
import { locationApi } from '../../services/location';
import { OngoingVolunteerVisit } from '../../types';
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
const formatCheckInTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '--:--';
  }
};

export const SaathiLiveTrackingPage: React.FC = () => {
  const [visits, setVisits] = useState<OngoingVolunteerVisit[]>([]);
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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);

  // 1-second timer to update current time for live ticking duration timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch ongoing visits from backend
  const fetchOngoingVisits = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await volunteerApi.getOngoingVisits();
      setVisits(data || []);
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

  // Focus a specific visit on the map and open its InfoWindow
  const focusVisitOnMap = useCallback(
    (visit: OngoingVolunteerVisit) => {
      setSelectedVisitId(visit.id);
      if (!mapInstanceRef.current) return;

      const lat = visit.volunteer?.latitude || visit.beneficiary?.latitude;
      const lng = visit.volunteer?.longitude || visit.beneficiary?.longitude;

      if (lat && lng) {
        const pos = { lat, lng };
        mapInstanceRef.current.panTo(pos);
        mapInstanceRef.current.setZoom(15);

        // Open InfoWindow for this marker
        const marker = markersRef.current.get(visit.id);
        if (marker && infoWindowRef.current) {
          const content = generateInfoWindowHtml(visit, currentTime);
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(mapInstanceRef.current, marker);
        }
      }
    },
    [currentTime]
  );

  // Generate rich HTML for InfoWindow
  const generateInfoWindowHtml = (visit: OngoingVolunteerVisit, now: Date): string => {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(visit.checkInTime).getTime()) / 1000)
    );
    const durationStr = formatDuration(elapsedSeconds);
    const checkInFormatted = formatCheckInTime(visit.checkInTime);

    const vName = visit.volunteer?.name || 'Saathi Volunteer';
    const vPhone = visit.volunteer?.phone || '';
    const bName = visit.beneficiary?.name || 'Beneficiary';
    const bAddress = visit.beneficiary?.address || 'Saved Address';
    const bPhone = visit.beneficiary?.phone || '';

    const lat = visit.volunteer?.latitude || visit.beneficiary?.latitude;
    const lng = visit.volunteer?.longitude || visit.beneficiary?.longitude;
    const navUrl = lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : '#';

    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; max-width: 300px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
            <span style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">Active Visit</span>
          </div>
          <div style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; border-radius: 9999px; font-size: 11px; font-weight: 700; font-family: monospace; padding: 2px 8px;">
            ⏱️ ${durationStr}
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Saathi Volunteer</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${vName}</div>
          ${vPhone ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">📞 <a href="tel:${vPhone}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${vPhone}</a></div>` : ''}
        </div>

        <div style="margin-bottom: 10px; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Beneficiary</div>
          <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${bName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px; line-height: 1.3;">📍 ${bAddress}</div>
          ${bPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">📞 <a href="tel:${bPhone}" style="color: #2563eb; text-decoration: none;">${bPhone}</a></div>` : ''}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
          <span>Checked In: <strong>${checkInFormatted}</strong></span>
          ${lat && lng ? `<a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="color: #ea580c; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">Navigate ↗</a>` : ''}
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

    // Clear removed markers
    const currentVisitIds = new Set(visits.map((v) => v.id));
    existingMarkers.forEach((marker, id) => {
      if (!currentVisitIds.has(id)) {
        marker.setMap(null);
        existingMarkers.delete(id);
      }
    });

    existingPolylines.forEach((line, id) => {
      if (!currentVisitIds.has(id)) {
        line.setMap(null);
        existingPolylines.delete(id);
      }
    });

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;

    visits.forEach((visit) => {
      const vLat = visit.volunteer?.latitude;
      const vLng = visit.volunteer?.longitude;
      const bLat = visit.beneficiary?.latitude;
      const bLng = visit.beneficiary?.longitude;

      const primaryLat = vLat || bLat;
      const primaryLng = vLng || bLng;

      if (!primaryLat || !primaryLng) return;

      hasValidCoords = true;
      const pos = { lat: primaryLat, lng: primaryLng };
      bounds.extend(pos);

      // Create or update marker
      let marker = existingMarkers.get(visit.id);
      if (!marker) {
        // High visibility custom pulse marker
        const markerSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
              </filter>
            </defs>
            <path d="M22 0C10.95 0 2 8.95 2 20c0 14.25 18.2 30.6 18.98 31.3a1.49 1.49 0 0 0 2.04 0C23.8 50.6 42 34.25 42 20 42 8.95 33.05 0 22 0z" fill="#ea580c" filter="url(#shadow)"/>
            <circle cx="22" cy="19" r="14" fill="#ffffff"/>
            <circle cx="22" cy="19" r="11" fill="#f97316"/>
            <!-- Heart / Companion Icon -->
            <path d="M22 23.5l-1.05-.95C17.2 19 14.7 16.7 14.7 13.9c0-2.3 1.8-4.1 4.1-4.1 1.3 0 2.55.6 3.2 1.55.65-.95 1.9-1.55 3.2-1.55 2.3 0 4.1 1.8 4.1 4.1 0 2.8-2.5 5.1-6.25 8.65L22 23.5z" fill="#ffffff" transform="scale(0.7) translate(9, 8)"/>
          </svg>
        `;

        marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: `${visit.volunteer?.name || 'Saathi'} → ${visit.beneficiary?.name || 'Beneficiary'}`,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
            scaledSize: new window.google.maps.Size(44, 52),
            anchor: new window.google.maps.Point(22, 50),
          },
          animation: window.google.maps.Animation.DROP,
        });

        marker.addListener('click', () => {
          setSelectedVisitId(visit.id);
          if (infoWindowRef.current) {
            const content = generateInfoWindowHtml(visit, currentTime);
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
          }
        });

        existingMarkers.set(visit.id, marker);
      } else {
        marker.setPosition(pos);
      }

      // If both coordinates exist and differ by at least 15m, draw a dotted connection line
      if (vLat && vLng && bLat && bLng && (Math.abs(vLat - bLat) > 0.0002 || Math.abs(vLng - bLng) > 0.0002)) {
        let poly = existingPolylines.get(visit.id);
        const path = [
          { lat: vLat, lng: vLng },
          { lat: bLat, lng: bLng },
        ];
        if (!poly) {
          poly = new window.google.maps.Polyline({
            path,
            strokeColor: '#ea580c',
            strokeOpacity: 0.8,
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
          poly.setPath(path);
        }
      }
    });

    // Auto fit bounds if coordinates exist and no visit was explicitly selected
    if (hasValidCoords && !selectedVisitId) {
      if (visits.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
      } else {
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      }
    }
  }, [visits, mapsLoaded, selectedVisitId, currentTime]);

  // Filtered visits list based on search query
  const filteredVisits = visits.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.volunteer?.name?.toLowerCase().includes(q) ||
      v.volunteer?.phone?.includes(q) ||
      v.beneficiary?.name?.toLowerCase().includes(q) ||
      v.beneficiary?.address?.toLowerCase().includes(q) ||
      v.notes?.toLowerCase().includes(q)
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
                Live Saathi Companion Tracker
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {visits.length} Ongoing {visits.length === 1 ? 'Visit' : 'Visits'}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time Google Maps companion monitoring for Field Managers (FM) and Operations Managers (OM).
            </p>
          </div>

          {/* Action buttons & Auto-refresh status */}
          <div className="flex items-center gap-2.5">
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

            {/* View switcher for small screens */}
            <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setMobileView('list')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  mobileView === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                List ({visits.length})
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
                placeholder="Search by Saathi, Beneficiary, or Area..."
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
                  {searchQuery ? 'No matching ongoing visits' : 'No Ongoing Companion Visits'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? 'Try clearing your search query to see all active visits.'
                    : 'As soon as a Saathi checks in with their matched senior citizen from their mobile app, their live location, details, and live elapsed timer will appear here automatically.'}
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
                const elapsedSeconds = Math.max(
                  0,
                  Math.floor((currentTime.getTime() - new Date(visit.checkInTime).getTime()) / 1000)
                );
                const liveDurationText = formatDuration(elapsedSeconds);
                const checkInFormatted = formatCheckInTime(visit.checkInTime);

                const hasGps = Boolean(
                  (visit.volunteer?.latitude && visit.volunteer?.longitude) ||
                    (visit.beneficiary?.latitude && visit.beneficiary?.longitude)
                );

                const telHref = visit.volunteer?.phone
                  ? sanitizeTelLink(`tel:${visit.volunteer.phone}`)
                  : '';
                const benTelHref = visit.beneficiary?.phone
                  ? sanitizeTelLink(`tel:${visit.beneficiary.phone}`)
                  : '';

                return (
                  <div
                    key={visit.id}
                    onClick={() => focusVisitOnMap(visit)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-200 shadow-md bg-orange-50/20'
                        : 'border-slate-200 hover:border-orange-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Header: Status Pulse & Ticking Duration Timer */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">
                          In Progress
                        </span>
                      </div>

                      {/* Live Ticking Duration Badge */}
                      <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono shadow-xs">
                        <Clock size={12} className="text-amber-600 animate-spin-slow" />
                        <span>{liveDurationText}</span>
                      </div>
                    </div>

                    {/* Saathi Information Row */}
                    <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-200 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {visit.volunteer?.profilePhoto ? (
                          <img
                            src={sanitizeImgSrc(visit.volunteer.profilePhoto)}
                            alt={visit.volunteer.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          (visit.volunteer?.name || 'S').charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {visit.volunteer?.name || 'Unknown Saathi'}
                          </h4>
                          {hasGps ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              GPS Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              Address Only
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          {visit.volunteer?.phone && (
                            <a
                              href={telHref}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-orange-600 font-medium"
                            >
                              <Phone size={11} className="text-orange-500" />
                              <span>{visit.volunteer.phone}</span>
                            </a>
                          )}
                          {visit.volunteer?.totalCreditHours !== undefined && (
                            <span className="text-slate-400">
                              • {visit.volunteer.totalCreditHours.toFixed(1)}h logged
                            </span>
                          )}
                        </div>
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
                        className="inline-flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700 group"
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
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
              {visits.length} Companion {visits.length === 1 ? 'Pin' : 'Pins'} on Live Map
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={() => {
                if (mapInstanceRef.current && visits.length > 0) {
                  const bounds = new window.google.maps.LatLngBounds();
                  let count = 0;
                  visits.forEach((v) => {
                    const lat = v.volunteer?.latitude || v.beneficiary?.latitude;
                    const lng = v.volunteer?.longitude || v.beneficiary?.longitude;
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
              className="text-xs font-semibold text-slate-700 hover:text-orange-600 px-2 py-1 rounded hover:bg-slate-100 transition"
              title="Fit all active visits on map"
            >
              Fit All Bounds
            </button>
          </div>

          {/* Map Legend (Bottom Right) */}
          <div className="absolute bottom-6 right-4 z-10 bg-white/90 backdrop-blur-xs p-2.5 rounded-xl shadow-md border border-slate-200 text-xs space-y-1.5 hidden sm:block">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
              Tracker Legend
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-xs"></span>
              <span className="text-slate-600">Active Companion Visit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-orange-500 rounded"></span>
              <span className="text-slate-600">Saathi ↔ Beneficiary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-600">Real-time GPS Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaathiLiveTrackingPage;
