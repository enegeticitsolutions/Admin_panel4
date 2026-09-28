import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Plus, X, Globe, Phone, Edit2, Trash2, Loader2,
  Navigation, AlertTriangle, ChevronRight, Check, Search, ShieldAlert,
  Building2, Sliders, CheckCircle
} from 'lucide-react';
import { regionApi } from '../../services/api';
import { locationApi } from '../../services/location';

declare global {
  interface Window {
    google: any;
  }
}

interface Region {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  isActive: boolean;
  zoneCount: number;
}

const emptyForm = {
  name: '',
  city: '',
  state: '',
  latitude: '28.6139',
  longitude: '77.2090',
  radiusKm: '30.0',
};

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

const RegionsPage = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Maps Picker State
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [circle, setCircle] = useState<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Fetch Regions ────────────────────────────────────────────────────────
  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await regionApi.getAll();
      setRegions(res);
    } catch (err: any) {
      console.error('Fetch regions error:', err);
      setError(err.message || 'Failed to load regions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  // ─── Map Initialization ───────────────────────────────────────────────────
  const initMap = async () => {
    if (!showModal || !mapRef.current) return;

    try {
      setMapsLoading(true);
      setMapsError(null);

      let apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        const config = await locationApi.getConfig();
        apiKey = config.apiKey;
      }
      await loadGoogleMapsScript(apiKey);
      setMapsLoaded(true);

      const lat = parseFloat(form.latitude) || 28.6139;
      const lng = parseFloat(form.longitude) || 77.2090;
      const center = { lat, lng };
      const radiusMeters = (parseFloat(form.radiusKm) || 30.0) * 1000;

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      const markerInstance = new window.google.maps.Marker({
        position: center,
        map: mapInstance,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });

      const circleInstance = new window.google.maps.Circle({
        map: mapInstance,
        center,
        radius: radiusMeters,
        fillColor: '#FF7A00',
        fillOpacity: 0.15,
        strokeColor: '#FF7A00',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        clickable: false,
        editable: true,
      });

      // Update form when user resizes circle directly on the map
      circleInstance.addListener('radius_changed', () => {
        const newRadiusMeters = circleInstance.getRadius();
        if (newRadiusMeters > 0) {
          const newKm = (newRadiusMeters / 1000).toFixed(1);
          setForm((prev) => ({
            ...prev,
            radiusKm: parseFloat(newKm).toString(),
          }));
        }
      });

      // Drag Listener
      markerInstance.addListener('dragend', async () => {
        const pos = markerInstance.getPosition();
        const newLat = pos.lat();
        const newLng = pos.lng();

        circleInstance.setCenter(pos);
        setForm((prev) => ({
          ...prev,
          latitude: newLat.toFixed(6),
          longitude: newLng.toFixed(6),
        }));

        // Auto Reverse Geocode to populate City and State
        try {
          const addressData = await locationApi.reverseGeocode(newLat, newLng);
          setForm((prev) => ({
            ...prev,
            city: addressData.city || prev.city,
            state: addressData.state || prev.state,
          }));
        } catch (e) {
          console.warn('Reverse geocode on drag failed', e);
        }
      });

      // Click Map Listener
      mapInstance.addListener('click', async (e: any) => {
        const pos = e.latLng;
        const newLat = pos.lat();
        const newLng = pos.lng();

        markerInstance.setPosition(pos);
        circleInstance.setCenter(pos);

        setForm((prev) => ({
          ...prev,
          latitude: newLat.toFixed(6),
          longitude: newLng.toFixed(6),
        }));

        try {
          const addressData = await locationApi.reverseGeocode(newLat, newLng);
          setForm((prev) => ({
            ...prev,
            city: addressData.city || prev.city,
            state: addressData.state || prev.state,
          }));
        } catch (err) {
          console.warn('Reverse geocode on map click failed', err);
        }
      });

      setMap(mapInstance);
      setMarker(markerInstance);
      setCircle(circleInstance);
      setMapsLoading(false);
    } catch (err: any) {
      console.error('Map initialization failed:', err);
      setMapsError(err.message || 'Failed to load Google Maps');
      setMapsLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        initMap();
      }, 100);
    } else {
      setMap(null);
      setMarker(null);
      setCircle(null);
    }
  }, [showModal]);

  // Update Circle when Radius Input changes
  useEffect(() => {
    if (circle && map) {
      const radiusKmNum = parseFloat(form.radiusKm);
      if (!isNaN(radiusKmNum) && radiusKmNum > 0) {
        const radiusMeters = radiusKmNum * 1000;
        if (Math.abs(circle.getRadius() - radiusMeters) > 30) {
          circle.setRadius(radiusMeters);
        }
        
        // Auto adjust zoom depending on radius
        if (radiusMeters > 60000) {
          map.setZoom(8);
        } else if (radiusMeters > 30000) {
          map.setZoom(9);
        } else if (radiusMeters > 15000) {
          map.setZoom(10);
        } else if (radiusMeters > 7000) {
          map.setZoom(11);
        } else if (radiusMeters > 3000) {
          map.setZoom(12);
        } else {
          map.setZoom(13);
        }
      }
    }
  }, [form.radiusKm, circle, map]);

  // Autocomplete search integration
  useEffect(() => {
    if (!map || !marker || !circle || !searchInputRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address', 'name', 'address_components'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) {
        console.warn('No geometry for selected place');
        return;
      }

      const pos = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      map.setCenter(pos);
      marker.setPosition(pos);
      circle.setCenter(pos);

      let detectedCity = '';
      let detectedState = '';

      if (place.address_components) {
        place.address_components.forEach((c: any) => {
          if (c.types.includes('locality')) detectedCity = c.long_name;
          if (c.types.includes('administrative_area_level_1')) detectedState = c.long_name;
          if (!detectedCity && c.types.includes('administrative_area_level_2')) detectedCity = c.long_name;
        });
      }

      setForm((prev) => ({
        ...prev,
        latitude: pos.lat.toFixed(6),
        longitude: pos.lng.toFixed(6),
        city: detectedCity || prev.city,
        state: detectedState || prev.state,
      }));
      setSearchQuery(place.formatted_address || place.name || '');
    });

    const input = searchInputRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') e.preventDefault();
    };
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
      input.removeEventListener('keydown', handleKeyDown);
    };
  }, [map, marker, circle]);

  // ─── Modal Openers ────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingRegion(null);
    setForm({ ...emptyForm });
    setSearchQuery('');
    setShowModal(true);
  };

  const handleOpenEdit = (region: Region) => {
    setEditingRegion(region);
    setForm({
      name: region.name,
      city: region.city,
      state: region.state,
      latitude: region.latitude.toString(),
      longitude: region.longitude.toString(),
      radiusKm: region.radiusKm.toString(),
    });
    setSearchQuery('');
    setShowModal(true);
  };

  // ─── Save Action ──────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedRadius = parseFloat(form.radiusKm);
      if (isNaN(parsedRadius) || parsedRadius <= 0) {
        alert('Please enter a valid coverage radius in km (greater than 0)');
        return;
      }

      setSaving(true);
      const payload = {
        name: form.name,
        city: form.city,
        state: form.state,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radiusKm: parsedRadius,
      };

      if (editingRegion) {
        await regionApi.update(editingRegion.id, payload);
      } else {
        await regionApi.create(payload);
      }

      setShowModal(false);
      fetchRegions();
    } catch (err: any) {
      alert(err.message || 'Failed to save region');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Action ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this region? This cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await regionApi.delete(id);
      fetchRegions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete region');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Toggle Active Status ─────────────────────────────────────────────────
  const handleToggleActive = async (region: Region) => {
    try {
      await regionApi.update(region.id, { isActive: !region.isActive });
      fetchRegions();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Filter regions
  const filteredRegions = regions.filter((r) => {
    const term = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.city.toLowerCase().includes(term) ||
      r.state.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-800 uppercase flex items-center gap-2">
            <Globe className="text-[#FF7A00]" size={28} />
            Region Realignment
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage 20-40 km regional sectors (city sectors) that aggregate Zone offices
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#FF7A00] text-white hover:bg-[#e06e00] px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all duration-200 flex items-center gap-2 shadow-md shadow-orange-100"
        >
          <Plus size={16} />
          Create Region
        </button>
      </div>

      {/* Search Filter */}
      <div className="flex bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by region name, city, or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
          />
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 h-64">
          <Loader2 className="animate-spin text-[#FF7A00] mb-4" size={40} />
          <p className="font-bold text-xs uppercase tracking-widest text-gray-400">Loading Regions...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 rounded-3xl border border-red-100">
          <ShieldAlert className="text-red-500 mx-auto mb-3" size={48} />
          <p className="text-red-800 font-bold mb-2">{error}</p>
          <button
            onClick={fetchRegions}
            className="text-[#FF7A00] font-black uppercase text-xs tracking-wider underline hover:text-[#e06e00]"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredRegions.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border border-gray-100">
          <Globe className="text-gray-300 mx-auto mb-4" size={56} />
          <h3 className="font-black text-gray-800 text-lg uppercase">No Regions Found</h3>
          <p className="text-gray-500 text-sm mt-1">Try refining your search or add a new region above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRegions.map((region) => (
            <div
              key={region.id}
              className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden group shadow-sm hover:shadow-lg ${
                region.isActive ? 'border-gray-100' : 'border-gray-200 opacity-80'
              }`}
            >
              {/* Card Header Color */}
              <div className={`h-2 ${region.isActive ? 'bg-[#FF7A00]' : 'bg-gray-400'}`} />

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-lg text-gray-800 uppercase tracking-tight group-hover:text-[#FF7A00] transition">
                      {region.name}
                    </h3>
                    <p className="text-xs font-bold text-gray-400 uppercase mt-0.5">
                      {region.city}, {region.state}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleActive(region)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                      region.isActive
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {region.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <hr className="border-gray-50" />

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Coverage Radius</span>
                    <span className="font-black text-gray-800 text-sm">{region.radiusKm} km</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Linked Hubs/Zones</span>
                    <span className="font-black text-gray-800 text-sm flex items-center gap-1.5">
                      <Building2 size={14} className="text-[#FF7A00]" />
                      {region.zoneCount} Zones
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-400 font-bold pt-2">
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">Lat: {region.latitude.toFixed(4)}</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded">Lng: {region.longitude.toFixed(4)}</span>
                  </div>
                </div>

                <hr className="border-gray-50" />

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleOpenEdit(region)}
                    className="p-3 bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-[#FF7A00] rounded-xl transition-all"
                    title="Edit Region"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(region.id)}
                    disabled={region.zoneCount > 0}
                    className={`p-3 rounded-xl transition-all ${
                      region.zoneCount > 0
                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-500'
                    }`}
                    title={
                      region.zoneCount > 0
                        ? 'Cannot delete Region with active Zones'
                        : 'Delete Region'
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[80vh]">
            {/* Left: Input Form */}
            <form onSubmit={handleSave} className="flex-1 p-6 flex flex-col justify-between overflow-y-auto bg-white border-r border-gray-100">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">
                    {editingRegion ? 'Edit Region' : 'Create Region'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition md:hidden"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-gray-500">Region Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Delhi NCR East"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
                    />
                  </div>

                  {/* City & State */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-gray-500">City</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Delhi"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-gray-500">State</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Delhi"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-gray-500">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black uppercase text-gray-500">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#FF7A00] focus:border-[#FF7A00] outline-none font-bold text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Coverage Radius: Manual Input, Slider & Presets */}
                  <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase text-gray-500 flex items-center gap-1.5">
                        <Sliders size={14} className="text-[#FF7A00]" />
                        Coverage Radius
                      </label>
                      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 focus-within:border-[#FF7A00] focus-within:ring-2 focus-within:ring-orange-100 transition shadow-sm">
                        <input
                          type="number"
                          min="0.5"
                          max="500"
                          step="any"
                          required
                          value={form.radiusKm}
                          onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                          className="w-16 font-black text-sm text-[#FF7A00] outline-none bg-transparent text-right"
                          placeholder="e.g. 5, 10"
                        />
                        <span className="text-xs font-black text-gray-500">km</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="0.5"
                      value={Math.min(Math.max(parseFloat(form.radiusKm) || 1, 1), 100)}
                      onChange={(e) => setForm({ ...form, radiusKm: e.target.value })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF7A00]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold px-0.5">
                      <span>Min: 1 km</span>
                      <span>Max: 100 km</span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mr-0.5">Presets:</span>
                      {[5, 10, 15, 20, 30, 40, 50].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setForm({ ...form, radiusKm: preset.toString() })}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition ${
                            parseFloat(form.radiusKm) === preset
                              ? 'bg-[#FF7A00] text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FF7A00] hover:text-[#FF7A00]'
                          }`}
                        >
                          {preset} km
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-3 pt-6 bg-white border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] bg-[#FF7A00] text-white hover:bg-[#e06e00] py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 className="animate-spin" size={16} />}
                  {editingRegion ? 'Save Changes' : 'Create Region'}
                </button>
              </div>
            </form>

            {/* Right: Map Area */}
            <div className="flex-1 relative bg-gray-100 flex flex-col">
              <div className="absolute top-6 left-6 right-6 z-20 pointer-events-none">
                <div className="relative pointer-events-auto max-w-sm mx-auto">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="text-gray-400" size={16} />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search location to set center..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-xl focus:ring-2 focus:ring-[#FF7A00] outline-none font-bold text-xs transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {mapsLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/80 backdrop-blur-[2px]">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-[#FF7A00]" size={36} />
                    <p className="font-bold text-[10px] uppercase tracking-widest text-gray-400">Loading Map...</p>
                  </div>
                </div>
              )}

              {mapsError && (
                <div className="absolute inset-0 flex items-center justify-center z-10 p-6 text-center">
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-xs font-bold">
                    {mapsError}
                  </div>
                </div>
              )}

              <div ref={mapRef} className="w-full h-full flex-1" />

              {/* Close Button overlay */}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition hidden md:block"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionsPage;
