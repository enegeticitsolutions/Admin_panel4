import React, { useEffect, useState, useRef } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataCard } from '../components/common/DataCard';
import { StatusChip } from '../components/common/StatusChip';
import { volunteerApi, beneficiaryApi, regionApi, zoneApi, configApi } from '../../services/api';
import type { Volunteer } from '../../types';
import { useSystemConfig } from '../context/SystemConfigContext';
import {
  Heart,
  Clock,
  Award,
  Users,
  Trash2,
  Plus,
  X,
  Search,
  Filter,
  Globe,
  MapPin,
  Building2,
  Navigation,
  RotateCcw,
  Check,
  ChevronDown,
} from 'lucide-react';

function MultiSelectDropdown({
  label,
  icon: Icon,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  icon: any;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCount = selectedValues.length;
  let buttonText = label;
  if (selectedCount > 0) {
    const firstMatch = options.find((o) => selectedValues.includes(o.value))?.label || selectedValues[0];
    buttonText = selectedCount === 1 ? `${label}: ${firstMatch}` : `${label} (${selectedCount})`;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
          selectedCount > 0
            ? 'bg-orange-50 border-orange-300 text-orange-900 font-bold ring-2 ring-orange-400/20'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Icon className={`w-3.5 h-3.5 ${selectedCount > 0 ? 'text-orange-600' : 'text-gray-500'}`} />
          <span className="truncate max-w-[130px]">{buttonText}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180 text-orange-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-2 space-y-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 mb-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            {selectedCount > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-800 font-extrabold px-1.5 py-0.5 rounded-full">
                {selectedCount} selected
              </span>
            )}
          </div>
          {options.length > 0 ? (
            options.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-orange-50/60 cursor-pointer select-none text-xs transition-colors"
                >
                  <span className={`truncate pr-2 ${isChecked ? 'font-bold text-orange-900' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(opt.value)}
                    className="rounded text-orange-600 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer accent-orange-600"
                  />
                </label>
              );
            })
          ) : (
            <p className="text-[11px] text-gray-400 italic p-2 text-center">No options available</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function VolunteersPage() {
  const { config } = useSystemConfig();
  const maxBeneficiariesPerVolunteer = config.maxBeneficiariesPerVolunteer;
  const maxVolunteersPerBeneficiary = config.maxVolunteersPerBeneficiary;
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-select location filter states
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  // Assign Senior Modal Filter & Pagination States
  const [modalGenderFilter, setModalGenderFilter] = useState<'ALL' | 'male' | 'female'>('ALL');
  const [modalMaxDistanceKm, setModalMaxDistanceKm] = useState<number>(0);
  const [modalHobbyFilter, setModalHobbyFilter] = useState<string>('ALL');
  const [modalPage, setModalPage] = useState<number>(1);

  // Selected entities for modals
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailedVolunteer, setDetailedVolunteer] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mainSearchTerm, setMainSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await volunteerApi.getAll('verified');
      setVolunteers(data);
      const bens = await beneficiaryApi.getAll();
      setBeneficiaries(bens);
      const regs = await regionApi.getAll().catch(() => []);
      setRegions(regs);
      const zns = await zoneApi.getAll().catch(() => []);
      setZones(zns);
    } catch (err: any) {
      setError(err.message || 'Failed to load volunteers data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssign = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setSearchTerm('');
    setModalGenderFilter('ALL');
    setModalMaxDistanceKm(0);
    setModalHobbyFilter('ALL');
    setModalPage(1);
    setShowAssignModal(true);
  };

  const handleOpenDetail = async (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    try {
      const detail = await volunteerApi.getById(volunteer.id);
      setDetailedVolunteer(detail);
      setShowDetailModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch details.');
    }
  };

  const handleAssign = async (beneficiaryId: string) => {
    if (!selectedVolunteer) return;
    try {
      await volunteerApi.assignBeneficiary(selectedVolunteer.id, beneficiaryId);
      alert('Beneficiary assigned successfully.');
      loadData();
      setShowAssignModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to assign beneficiary.');
    }
  };

  const handleRemoveAssignment = async (beneficiaryId: string) => {
    if (!selectedVolunteer) return;
    if (!confirm('Are you sure you want to remove this beneficiary assignment?')) return;
    try {
      await volunteerApi.removeAssignment(selectedVolunteer.id, beneficiaryId);
      alert('Assignment removed successfully.');
      loadData();
      setShowAssignModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignment.');
    }
  };

  // Helper for spatial distance calculation (Haversine formula)
  const getDistanceKm = (lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Helper to compute frontend match score for volunteer <-> beneficiary
  const computeMatchScore = (vol: any, ben: any) => {
    if (!vol || !ben) {
      return { total: 0, genderScore: 0, hobbyScore: 0, locationScore: 0, capacityScore: 0, commonHobbies: [] };
    }

    let genderScore = 0;
    const volGender = String(vol.gender || '').toLowerCase();
    const benGender = String(ben.gender || '').toLowerCase();
    if (volGender && benGender && volGender === benGender) {
      genderScore = 30;
    } else if (!volGender || !benGender || volGender.includes('not') || benGender.includes('not')) {
      genderScore = 15;
    }

    let hobbyScore = 0;
    const volInterests = Array.isArray(vol.interests)
      ? vol.interests.map((i: any) => String(i || '').toLowerCase()).filter(Boolean)
      : [];
    const benHobbies = Array.isArray(ben.hobbiesInterests)
      ? ben.hobbiesInterests.map((h: any) => String(h || '').toLowerCase()).filter(Boolean)
      : [];

    const commonHobbies = volInterests.filter((interest: string) =>
      benHobbies.some((h: string) => h.includes(interest) || interest.includes(h))
    );

    if (benHobbies.length > 0) {
      hobbyScore = Math.min(30, Math.round((commonHobbies.length / Math.max(1, benHobbies.length)) * 30));
    }

    const distKm = getDistanceKm(
      vol?.latitude,
      vol?.longitude,
      ben?.latitude,
      ben?.longitude
    );

    let locationScore = 0;
    if (distKm !== null) {
      if (distKm <= 2) locationScore = 25;
      else if (distKm <= 5) locationScore = 20;
      else if (distKm <= 10) locationScore = 12;
      else if (distKm <= 20) locationScore = 5;
    } else {
      const volPincode = String(vol.pincode || '').trim();
      const benPincode = String(ben.pincode || '').trim();
      const volCity = String(vol.city || '').trim().toLowerCase();
      const benCity = String(ben.city || '').trim().toLowerCase();

      if (volPincode && benPincode && volPincode === benPincode) {
        locationScore = 25;
      } else if (volCity && benCity && volCity === benCity) {
        locationScore = 15;
      }
    }

    const activeAssignments = vol.assignments?.length || 0;
    const maxPerVol = maxBeneficiariesPerVolunteer;
    const capacityScore = Math.round((Math.max(0, maxPerVol - activeAssignments) / maxPerVol) * 15);

    const total = genderScore + hobbyScore + locationScore + capacityScore;
    return {
      total,
      genderScore,
      hobbyScore,
      locationScore,
      capacityScore,
      commonHobbies,
      distanceKm: distKm !== null ? Math.round(distKm * 10) / 10 : null,
    };
  };

  // Collect all unique hobbies from beneficiaries for the in-modal filter dropdown
  const allBeneficiaryHobbies = Array.from(
    new Set(
      beneficiaries
        .flatMap((b) => b.hobbiesInterests || [])
        .map((h: string) => String(h || '').trim())
        .filter(Boolean)
    )
  );

  // Available beneficiaries for Modal sorted by nearest distance & match score
  const modalAvailableBeneficiaries = beneficiaries
    .filter((b) => {
      if (!selectedVolunteer) return false;
      const assignedIds = selectedVolunteer.assignments?.map((a) => a.beneficiaryId) || [];
      if (assignedIds.includes(b.id)) return false;

      // 0. Sathi benefit filter — only seniors whose package includes SATHI_COMPANION
      if (!b.hasSathiBenefit) return false;

      // 1. Search term filter
      if (searchTerm && !b.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // 2. Gender filter
      if (modalGenderFilter !== 'ALL') {
        const benGender = String(b.gender || '').toLowerCase();
        if (benGender !== modalGenderFilter.toLowerCase()) return false;
      }

      // 3. Hobby filter
      if (modalHobbyFilter !== 'ALL') {
        const benHobbies = (b.hobbiesInterests || []).map((h: string) => String(h || '').toLowerCase());
        if (!benHobbies.some((h: string) => h.includes(modalHobbyFilter.toLowerCase()))) return false;
      }

      return true;
    })

    .map((b) => {
      const match = selectedVolunteer
        ? computeMatchScore(selectedVolunteer, b)
        : { total: 0, commonHobbies: [], distanceKm: null };
      return { ...b, match };
    })
    .filter((b) => {
      // 4. Max distance filter
      if (modalMaxDistanceKm > 0) {
        if (b.match.distanceKm === null || b.match.distanceKm > modalMaxDistanceKm) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Sort nearest distance first, then highest match score
      if (a.match.distanceKm !== null && b.match.distanceKm !== null) {
        if (Math.abs(a.match.distanceKm - b.match.distanceKm) > 0.1) {
          return a.match.distanceKm - b.match.distanceKm;
        }
      }
      return b.match.total - a.match.total;
    });

  // Modal 10-per-page pagination
  const MODAL_PAGE_SIZE = 10;
  const totalModalPages = Math.max(1, Math.ceil(modalAvailableBeneficiaries.length / MODAL_PAGE_SIZE));
  const paginatedModalBeneficiaries = modalAvailableBeneficiaries.slice(
    (modalPage - 1) * MODAL_PAGE_SIZE,
    modalPage * MODAL_PAGE_SIZE
  );

  // Extract dynamic unique locations from volunteer dataset
  const availableCountries = Array.from(
    new Set(volunteers.map((v) => v.country || 'India').filter(Boolean))
  );
  const availableStates = Array.from(
    new Set(volunteers.map((v) => v.state).filter((s): s is string => Boolean(s)))
  );
  const availableCities = Array.from(
    new Set(volunteers.map((v) => v.city).filter((c): c is string => Boolean(c)))
  );

  // Helper for multi-select array toggles
  const toggleFilterItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  };

  const resetAllLocationFilters = () => {
    setSelectedCountries([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setSelectedRegionIds([]);
    setSelectedZoneIds([]);
  };

  const hasActiveLocationFilters =
    selectedCountries.length > 0 ||
    selectedStates.length > 0 ||
    selectedCities.length > 0 ||
    selectedRegionIds.length > 0 ||
    selectedZoneIds.length > 0;

  // Multi-select location reactive filtering (with spatial GPS & city fallback)
  const filteredVolunteers = volunteers.filter((v) => {
    if (mainSearchTerm) {
      const lowerSearch = mainSearchTerm.toLowerCase();
      const nameMatch = v.name.toLowerCase().includes(lowerSearch);
      const phoneMatch = v.phone.includes(lowerSearch);
      if (!nameMatch && !phoneMatch) return false;
    }

    const volCountry = v.country || 'India';
    const volState = (v.state || '').toLowerCase();
    const volCity = (v.city || '').toLowerCase();

    if (selectedCountries.length > 0 && !selectedCountries.includes(volCountry)) return false;
    if (selectedStates.length > 0 && !selectedStates.some((s) => s.toLowerCase() === volState)) return false;
    if (selectedCities.length > 0 && !selectedCities.some((c) => c.toLowerCase() === volCity)) return false;

    // Spatial Region Check
    if (selectedRegionIds.length > 0) {
      const matchesRegion = selectedRegionIds.some((regId) => {
        if (v.regionId === regId) return true;
        const targetRegion = regions.find((r) => r.id === regId);
        if (!targetRegion) return false;

        // Check GPS coordinates distance against Region radius
        const dist = getDistanceKm(v.latitude, v.longitude, targetRegion.latitude, targetRegion.longitude);
        const radius = targetRegion.radiusKm || 30;
        if (dist !== null && dist <= radius) return true;

        // City/State name match fallback
        if (targetRegion.city && targetRegion.city.toLowerCase() === volCity) return true;
        if (targetRegion.state && targetRegion.state.toLowerCase() === volState) return true;

        return false;
      });

      if (!matchesRegion) return false;
    }

    // Spatial Zone Check
    if (selectedZoneIds.length > 0) {
      const matchesZone = selectedZoneIds.some((zoneId) => {
        if (v.zoneId === zoneId) return true;
        const targetZone = zones.find((z) => z.id === zoneId);
        if (!targetZone) return false;

        // Check GPS coordinates distance against Zone radius
        const dist = getDistanceKm(v.latitude, v.longitude, targetZone.latitude, targetZone.longitude);
        const radius = targetZone.radiusKm || 10;
        if (dist !== null && dist <= radius) return true;

        // City/Pincode name match fallback
        if (targetZone.city && targetZone.city.toLowerCase() === volCity) return true;
        if (targetZone.pincode && v.pincode && targetZone.pincode === v.pincode) return true;

        return false;
      });

      if (!matchesZone) return false;
    }

    return true;
  });

  // Summary Metrics
  const totalVolunteers = filteredVolunteers.length;
  const totalPoints = filteredVolunteers.reduce((acc, v) => acc + (v.totalCreditPoints || 0), 0);
  const totalHours = filteredVolunteers.reduce((acc, v) => acc + (v.totalCreditHours || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verified Saathi Volunteers"
        description="View credit balances, log history, and manage senior companion assignments with smart matching & location filtering."
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-border rounded-xl flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Volunteers</p>
            <p className="text-2xl font-bold">{totalVolunteers}</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-border rounded-xl flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-lg text-success">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Volunteer Hours</p>
            <p className="text-2xl font-bold">{totalHours.toFixed(1)} Hrs</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-border rounded-xl flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Credit Points</p>
            <p className="text-2xl font-bold">{totalPoints.toFixed(0)} Pts</p>
          </div>
        </div>
      </div>

      {/* Location Multi-Select Dropdown Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1">
            <Filter className="w-4 h-4 text-orange-600" />
            <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wide">
              Location Filters
            </h3>
            {hasActiveLocationFilters && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                Active
              </span>
            )}
          </div>

          {/* 1. Country Dropdown */}
          <MultiSelectDropdown
            label="Country"
            icon={Globe}
            options={availableCountries.map((c) => ({ label: c, value: c }))}
            selectedValues={selectedCountries}
            onToggle={(val) => toggleFilterItem(selectedCountries, setSelectedCountries, val)}
          />

          {/* 2. State Dropdown */}
          <MultiSelectDropdown
            label="State"
            icon={MapPin}
            options={availableStates.map((st) => ({ label: st, value: st }))}
            selectedValues={selectedStates}
            onToggle={(val) => toggleFilterItem(selectedStates, setSelectedStates, val)}
          />

          {/* 3. City Dropdown */}
          <MultiSelectDropdown
            label="City"
            icon={Building2}
            options={availableCities.map((ct) => ({ label: ct, value: ct }))}
            selectedValues={selectedCities}
            onToggle={(val) => toggleFilterItem(selectedCities, setSelectedCities, val)}
          />

          {/* 4. Region Dropdown */}
          <MultiSelectDropdown
            label="Region"
            icon={Navigation}
            options={regions.map((rg) => ({ label: rg.name, value: rg.id }))}
            selectedValues={selectedRegionIds}
            onToggle={(val) => toggleFilterItem(selectedRegionIds, setSelectedRegionIds, val)}
          />

          {/* 5. Zone Dropdown */}
          <MultiSelectDropdown
            label="Zone"
            icon={Users}
            options={zones.map((zn) => ({ label: zn.name, value: zn.id }))}
            selectedValues={selectedZoneIds}
            onToggle={(val) => toggleFilterItem(selectedZoneIds, setSelectedZoneIds, val)}
          />
        </div>

        {hasActiveLocationFilters && (
          <button
            onClick={resetAllLocationFilters}
            className="text-xs font-semibold text-gray-600 hover:text-red-600 flex items-center gap-1 bg-gray-50 hover:bg-red-50 px-3 py-1.5 rounded-xl border border-gray-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        )}
      </div>

      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-2">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search volunteers by name or phone..."
          value={mainSearchTerm}
          onChange={(e) => setMainSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm text-gray-800"
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Volunteers Cards */}
      {loading ? (
        <div className="flex justify-center p-8">
          <p className="text-muted-foreground">Loading Sathi Network...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVolunteers.length > 0 ? (
            filteredVolunteers.map((v) => {
            const activeCount = v.assignments?.length || 0;
            const maxVolLimit = maxBeneficiariesPerVolunteer;
            const isFull = activeCount >= maxVolLimit;

            return (
              <DataCard key={v.id} title={v.name} description={v.phone}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2">
                      {isFull ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          Full ({activeCount}/{maxVolLimit})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          {activeCount}/{maxVolLimit} Assigned
                        </span>
                      )}
                      <StatusChip status="Verified" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-blue-600" /> Show on Website
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={v.showOnWebsite || false} 
                        onChange={async (e) => {
                          try {
                            const updated = await volunteerApi.toggleWebsiteVisibility(v.id, e.target.checked);
                            setVolunteers(prev => prev.map(vol => vol.id === v.id ? { ...vol, showOnWebsite: updated.showOnWebsite } : vol));
                          } catch (err: any) {
                            alert(err.message || 'Failed to update website visibility.');
                          }
                        }}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-secondary rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase">Credits</p>
                      <p className="text-lg font-bold">{v.totalCreditPoints.toFixed(0)} pts</p>
                    </div>
                    <div className="p-2 bg-secondary rounded-lg">
                      <p className="text-[10px] text-muted-foreground uppercase">Hours</p>
                      <p className="text-lg font-bold">{v.totalCreditHours.toFixed(1)} hrs</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Assigned Beneficiaries ({activeCount}/{maxVolLimit})
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {v.assignments && v.assignments.length > 0 ? (
                        v.assignments.map((a) => (
                          <div key={a.id} className="flex justify-between items-center text-xs p-1.5 bg-secondary rounded">
                            <span className="truncate font-medium">{a.beneficiary.name}</span>
                            <button
                              onClick={() => {
                                setSelectedVolunteer(v);
                                handleRemoveAssignment(a.beneficiaryId);
                              }}
                              className="text-destructive hover:bg-destructive/10 p-0.5 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No beneficiaries assigned.</p>
                      )}
                    </div>
                  </div>

                  {v.interests.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Interests & Hobbies</p>
                      <div className="flex flex-wrap gap-1">
                        {v.interests.map((interest) => (
                          <span key={interest} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-border">
                    <button
                      onClick={() => handleOpenDetail(v)}
                      className="flex-1 text-xs py-2 bg-secondary hover:bg-secondary/80 font-medium rounded-lg text-center"
                    >
                      View History
                    </button>
                    <button
                      onClick={() => handleOpenAssign(v)}
                      disabled={isFull}
                      className={`flex-1 text-xs py-2 font-medium rounded-lg flex items-center justify-center gap-1 ${
                        isFull
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/95'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> {isFull ? `At Limit (${activeCount}/${maxVolLimit})` : 'Assign Senior'}
                    </button>
                  </div>
                </div>
              </DataCard>
            );
          })
        ) : (
          <div className="col-span-full py-12 bg-white rounded-2xl border border-gray-200 text-center space-y-2">
            <Filter className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-bold text-gray-800">No volunteers match the selected location filters</p>
            <p className="text-xs text-gray-500">Try unchecking some filters or resetting location criteria.</p>
            <button
              onClick={resetAllLocationFilters}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors inline-block mt-2"
            >
              Reset All Filters
            </button>
          </div>
        )}
        </div>
      )}

      {/* Modal: Assignment Manager with Smart Matching & Nearest Ranking */}
      {showAssignModal && selectedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Assign Senior to {selectedVolunteer.name}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  Showing nearest beneficiaries ranked by distance & match score
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* In-Modal Filter Controls */}
            <div className="space-y-2 bg-gray-50/70 p-3 rounded-xl border border-gray-200/80">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search senior by name..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setModalPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Gender Filter Pills */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200">
                  <span className="text-[11px] font-bold text-gray-500 px-1">Gender:</span>
                  {(['ALL', 'male', 'female'] as const).map((g) => {
                    const isActive = modalGenderFilter === g;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setModalGenderFilter(g);
                          setModalPage(1);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize transition-colors ${
                          isActive
                            ? 'bg-orange-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {g === 'ALL' ? 'All' : g}
                      </button>
                    );
                  })}
                </div>

                {/* Distance Filter Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-500">Radius:</span>
                  <select
                    value={modalMaxDistanceKm}
                    onChange={(e) => {
                      setModalMaxDistanceKm(Number(e.target.value));
                      setModalPage(1);
                    }}
                    className="bg-white border border-gray-200 text-xs rounded-lg px-2 py-1 font-semibold text-gray-800 focus:ring-orange-500 outline-none cursor-pointer"
                  >
                    <option value={0}>All Distances</option>
                    <option value={5}>Within 5 km</option>
                    <option value={10}>Within 10 km</option>
                    <option value={25}>Within 25 km</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Candidates List (Paginated) */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[250px]">
              {paginatedModalBeneficiaries.length > 0 ? (
                paginatedModalBeneficiaries.map((b) => {
                  const match = b.match;
                  const isHighMatch = match.total >= 70;
                  const isMedMatch = match.total >= 40 && match.total < 70;
                  const allocatedVolunteersCount = volunteers.filter((v) =>
                    v.assignments?.some((a) => a.beneficiaryId === b.id)
                  ).length;

                  return (
                    <div
                      key={b.id}
                      className="p-3 border border-gray-200 rounded-xl hover:bg-orange-50/40 transition-all flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-gray-900">{b.name}</p>

                          {/* Allocated Volunteers Count Badge */}
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-full flex items-center gap-1" title="Volunteers currently assigned to this senior">
                            <Users className="w-3 h-3 text-purple-600" />
                            {allocatedVolunteersCount}/{maxVolunteersPerBeneficiary} Volunteers
                          </span>

                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isHighMatch
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : isMedMatch
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                : 'bg-orange-100 text-orange-800 border border-orange-200'
                            }`}
                          >
                            {match.total}% Match
                          </span>

                          {/* Distance Badge */}
                          {match.distanceKm !== null ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-blue-600" />
                              {match.distanceKm} km away
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400">
                              (GPS n/a)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {b.gender && (
                            <span>
                              Gender:{' '}
                              <strong className="text-gray-700 capitalize">{b.gender}</strong>
                            </span>
                          )}
                          {b.city && (
                            <span>
                              Location:{' '}
                              <strong className="text-gray-700">
                                {b.city} ({b.pincode || 'N/A'})
                              </strong>
                            </span>
                          )}
                        </div>

                        {match.commonHobbies.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-orange-700 flex-wrap">
                            <span className="font-semibold">Shared Hobbies:</span>
                            {match.commonHobbies.map((h: string) => (
                              <span
                                key={h}
                                className="bg-orange-100 px-1.5 py-0.2 rounded font-medium capitalize"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleAssign(b.id)}
                        className="text-xs px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold whitespace-nowrap shadow-sm transition-transform active:scale-95"
                      >
                        Assign Senior
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10 italic">
                  No available seniors match the selected filter criteria.
                </p>
              )}
            </div>

            {/* Pagination Controls Footer (10 per page) */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">
                Showing{' '}
                {modalAvailableBeneficiaries.length > 0
                  ? (modalPage - 1) * MODAL_PAGE_SIZE + 1
                  : 0}{' '}
                –{' '}
                {Math.min(modalPage * MODAL_PAGE_SIZE, modalAvailableBeneficiaries.length)} of{' '}
                <strong>{modalAvailableBeneficiaries.length}</strong> seniors
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={modalPage <= 1}
                  onClick={() => setModalPage((prev) => Math.max(1, prev - 1))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    modalPage <= 1
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  &larr; Previous
                </button>

                <span className="font-bold text-gray-700 px-1">
                  Page {modalPage} of {totalModalPages}
                </span>

                <button
                  disabled={modalPage >= totalModalPages}
                  onClick={() => setModalPage((prev) => Math.min(totalModalPages, prev + 1))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    modalPage >= totalModalPages
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Volunteer History Log & Credit Transactions */}
      {showDetailModal && detailedVolunteer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-lg">{detailedVolunteer.name} — Activity Logs</h3>
                <p className="text-xs text-muted-foreground">{detailedVolunteer.phone} | Verified Volunteer</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Credit Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-secondary rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Credit Hours</p>
                  <p className="text-xl font-bold">{detailedVolunteer.totalCreditHours.toFixed(1)} hrs</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Credit Points</p>
                  <p className="text-xl font-bold text-primary">{detailedVolunteer.totalCreditPoints.toFixed(0)} pts</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Goal Progress</p>
                  <p className="text-xl font-bold">
                    {((detailedVolunteer.totalCreditHours / detailedVolunteer.monthlyGoalHours) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Assignments list */}
              <div>
                <h4 className="font-bold text-sm mb-2">Current Assignments</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detailedVolunteer.assignments?.length > 0 ? (
                    detailedVolunteer.assignments.map((a: any) => (
                      <div key={a.id} className="p-2 border border-border rounded-lg flex items-center justify-between bg-secondary/10">
                        <span className="text-sm font-medium">{a.beneficiary.name}</span>
                        <span className="text-[10px] text-muted-foreground">Since {new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No assignments.</p>
                  )}
                </div>
              </div>

              {/* Completed visits */}
              <div>
                <h4 className="font-bold text-sm mb-2">Visit History (Last 20)</h4>
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="max-h-[240px] overflow-y-auto">
                    <table className="w-full text-left text-sm relative">
                      <thead className="bg-secondary text-xs uppercase sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Senior</th>
                          <th className="p-3">Logged Date</th>
                          <th className="p-3">Duration</th>
                          <th className="p-3">Points</th>
                          <th className="p-3">Feedback</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                      {detailedVolunteer.visitLogs?.length > 0 ? (
                        detailedVolunteer.visitLogs.map((log: any) => (
                          <tr key={log.id}>
                            <td className="p-3 font-medium">{log.beneficiary?.name}</td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(log.checkInTime).toLocaleDateString()}
                            </td>
                            <td className="p-3">{log.hoursEarned?.toFixed(1) || '0.0'} hrs</td>
                            <td className="p-3 text-success font-semibold">+{log.creditPointsEarned?.toFixed(0) || '0'} pts</td>
                            <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate" title={log.feedback || 'no feedback'}>{log.feedback || 'no feedback'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground">No visits recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* Transactions logs */}
              <div>
                <h4 className="font-bold text-sm mb-2">Points Ledger Transaction History</h4>
                <div className="space-y-2">
                  {detailedVolunteer.creditTransactions?.length > 0 ? (
                    detailedVolunteer.creditTransactions.map((tx: any) => (
                      <div key={tx.id} className="p-3 bg-secondary/20 rounded-lg flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-sm">{tx.description || 'Points Transaction'}</p>
                          <p className="text-muted-foreground">{new Date(tx.createdAt).toLocaleString()} | Type: <span className="uppercase text-[10px] font-bold text-primary">{tx.type}</span></p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${tx.pointsDelta >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {tx.pointsDelta >= 0 ? '+' : ''}{tx.pointsDelta.toFixed(0)} pts
                          </p>
                          <p className="text-[10px] text-muted-foreground">Bal: {tx.balanceAfter.toFixed(0)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No point conversions found.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
