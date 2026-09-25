import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, Navigation, Loader2, Check, Search } from 'lucide-react';
import { locationApi } from '../../../services/location';
import { LocationPickerModalProps } from '../../../types/location';

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

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  initialLat,
  initialLng,
  initialAddress,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          const config = await locationApi.getConfig();
          apiKey = config.apiKey;
        }
        await loadGoogleMapsScript(apiKey);

        if (!mapRef.current) return;

        // Default center: New Delhi
        let center = { lat: 28.6139, lng: 77.2090 };
        
        if (selectedPos) {
          center = selectedPos;
        } else if (initialAddress) {
          try {
            setSearching(true);
            const geocodeResult = await locationApi.geocode(initialAddress);
            center = { lat: geocodeResult.latitude, lng: geocodeResult.longitude };
            setSelectedPos(center);
            setSearchQuery(initialAddress);
          } catch (e) {
            console.warn('Initial geocoding failed, using default center', e);
          } finally {
            setSearching(false);
          }
        }

        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        const markerInstance = new window.google.maps.Marker({
          position: center,
          map: mapInstance,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        });

        markerInstance.addListener('dragend', () => {
          const pos = markerInstance.getPosition();
          setSelectedPos({ lat: pos.lat(), lng: pos.lng() });
        });

        mapInstance.addListener('click', (e: any) => {
          const pos = e.latLng;
          markerInstance.setPosition(pos);
          setSelectedPos({ lat: pos.lat(), lng: pos.lng() });
        });

        setMap(mapInstance);
        setMarker(markerInstance);
        setLoading(false);
      } catch (err: any) {
        console.error('Map initialization failed:', err);
        setError(err.message || 'Failed to load Google Maps');
        setLoading(false);
      }
    };

    initMap();
  }, [isOpen]);

  useEffect(() => {
    if (!map || !marker || !searchInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        console.warn("No geometry for the selected place");
        return;
      }

      const pos = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };

      map.setCenter(pos);
      map.setZoom(17);
      marker.setPosition(pos);
      setSelectedPos(pos);
      setSearchQuery(place.formatted_address || place.name || '');
    });

    // Prevent form submission if accidentally inside a form
    const input = searchInputRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') e.preventDefault();
    };
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
      input.removeEventListener('keydown', handleKeyDown);
      const containers = document.querySelectorAll('.pac-container');
      containers.forEach(container => container.remove());
    };
  }, [map, marker, loading]);

  const handleConfirm = async () => {
    if (selectedPos) {
      try {
        setLoading(true);
        console.log('Fetching reverse geocode for:', selectedPos);
        const addressData = await locationApi.reverseGeocode(selectedPos.lat, selectedPos.lng);
        console.log('Reverse geocode successful:', addressData);
        onSelectLocation(selectedPos.lat, selectedPos.lng, addressData);
      } catch (err) {
        console.error('Reverse geocoding failed:', err);
        onSelectLocation(selectedPos.lat, selectedPos.lng);
      } finally {
        setLoading(false);
        onClose();
      }
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setSearching(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setSelectedPos(pos);
          if (map && marker) {
            map.setCenter(pos);
            marker.setPosition(pos);
          }
          setSearching(false);
        },
        () => {
          alert('Error: The Geolocation service failed.');
          setSearching(false);
        }
      );
    } else {
      alert("Error: Your browser doesn't support geolocation.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
              <MapPin className="text-[#FF7A00]" size={24} />
              Pick Accurate Location
            </h2>
            <p className="text-xs text-gray-500 mt-1">Drag the pin to the exact spot or click on the map</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition">
            <X size={20} />
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-gray-50">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/80 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-[#FF7A00]" size={48} />
                <p className="font-bold text-sm uppercase tracking-widest text-gray-400">Initializing Maps...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-8 text-center">
              <div className="max-w-xs">
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-4 border border-red-100">
                  <p className="font-bold text-sm">{error}</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="text-[#FF7A00] font-black uppercase text-xs tracking-widest underline"
                >
                  Retry Loading
                </button>
              </div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />

          {/* Search Bar Overlay */}
          {!loading && !error && (
            <div className="absolute top-6 left-6 right-6 z-20 pointer-events-none">
              <div className="relative pointer-events-auto max-w-md mx-auto">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="text-gray-400" size={18} />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white border border-gray-100 rounded-2xl shadow-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (searchInputRef.current) searchInputRef.current.focus();
                    }}
                    className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 transition"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Map Controls */}
          {!loading && !error && (
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center pointer-events-none">
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={searching}
                className="pointer-events-auto bg-white p-4 rounded-2xl shadow-xl border border-gray-100 text-gray-700 hover:text-[#FF7A00] transition group flex items-center gap-2"
                title="Use Current Location"
              >
                {searching ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
                <span className="font-bold text-xs uppercase tracking-wider">My Location</span>
              </button>

              <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-white/50 text-xs font-bold text-gray-600 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase">Lat:</span>
                  <span className="text-[#FF7A00]">{selectedPos?.lat.toFixed(6) || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase">Lng:</span>
                  <span className="text-[#FF7A00]">{selectedPos?.lng.toFixed(6) || '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPos || loading || !!error}
            className="flex-[2] bg-[#FF7A00] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 hover:bg-[#e06e00] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            <Check size={18} />
            Confirm Location
          </button>
        </div>
      </div>
      <style>{`
        .pac-container {
          z-index: 9999 !important;
          border-radius: 16px;
          border: none;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          margin-top: 8px;
          padding: 8px 0;
          font-family: inherit;
        }
        .pac-item {
          padding: 12px 16px;
          border-top: 1px solid #f3f4f6;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background-color: #fff7ed;
        }
        .pac-item-query {
          font-size: 14px;
          color: #1f2937;
          font-weight: 700;
        }
        .pac-matched {
          color: #FF7A00;
        }
        .pac-icon {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default LocationPickerModal;
