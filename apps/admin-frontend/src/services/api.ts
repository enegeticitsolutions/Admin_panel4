/**
 * MaiHoonNa Senior Care Operations Portal - API Service Layer
 * This file contains all API interaction functions
 * Currently returns mock data - replace with actual API calls when backend is ready
 */

import {
  mockUsers,
  mockZones,
  mockOperationsManagers,
  mockCareCompanions,
  mockSubscribers,
  mockBeneficiaries,
  mockSupportTickets,
  mockActivityLogs,
  mockPartners,
  mockVolunteers,
  mockBenefits,
  mockSubscriptionPackages,
  mockTodayVisits,
  mockStaffOnboardingMetadata,
} from './mockData';

import type {
  User,
  Zone,
  OperationsManager,
  CareCompanion,
  Subscriber,
  Beneficiary,
  SupportTicket,
  ActivityLog,
  Partner,
  Volunteer,
  Benefit,
  SubscriptionPackage,
  VisitBlock,
  StaffOnboardingMetadata,
  StaffOnboardingPayload,
  CallbackRequest,
} from '../types';

// Simulate network delay for realistic behavior
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const savedAuth = localStorage.getItem('maihonna_user');
  let accessToken = '';
  
  if (savedAuth) {
    try {
      const authData = JSON.parse(savedAuth);
      accessToken = authData.accessToken || authData.token; // Fallback for transition
    } catch (e) {}
  }
  
  const headers = {
    ...options.headers,
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
  };
  
  return window.fetch(url, { ...options, headers });
};

export const apiJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers =
    options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers };

  const response = await apiFetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed with status ${response.status}`);
  }

  return result.data as T;
};

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const authApi = {
  /**
   * Login with phone and OTP
   * @param phone - User's phone number
   * @param otp - One-time password
   * @returns User object if credentials are valid
   */
  async login(phone: string, password: string): Promise<any> {
    const response = await window.fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Invalid credentials');
    
    // Return the new consolidated auth object { user, accessToken, refreshToken }
    return result.data;
  },

  /**
   * Login with biometric authentication
   * @param userId - User ID
   * @returns User object if biometric is valid
   */
  async biometricLogin(userId: string): Promise<User> {
    await delay();
    const user = mockUsers.find(u => u.id === userId && u.biometricEnabled);
    if (user) {
      return user;
    }
    throw new Error('Biometric authentication failed');
  },

  /**
   * Send OTP to phone number
   * @param phone - User's phone number
   */
  async sendOTP(phone: string): Promise<void> {
    await delay();
    // In production, trigger SMS/WhatsApp OTP
    console.log(`OTP sent to ${phone}: 123456`);
  },
};

// ============================================================================
// USER MANAGEMENT API
// ============================================================================

export const userApi = {
  /**
   * Get all users
   */
  async getAll(): Promise<User[]> {
    await delay();
    return [...mockUsers];
  },

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | undefined> {
    await delay();
    return mockUsers.find(u => u.id === id);
  },

  /**
   * Create new user
   */
  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    await delay();
    const newUser: User = {
      ...user,
      id: `U${String(mockUsers.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
    };
    mockUsers.push(newUser);
    return newUser;
  },

  /**
   * Update user
   */
  async update(id: string, updates: Partial<User>): Promise<User> {
    await delay();
    const index = mockUsers.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');
    mockUsers[index] = { ...mockUsers[index], ...updates };
    return mockUsers[index];
  },

  /**
   * Create staff member (User + Profile)
   */
  async createStaff(data: { name: string; phone: string; role: string; zoneId: string }): Promise<any> {
    return apiJson('/users/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const adminUserApi = {
  /**
   * Get all users with administrative roles
   */
  async getAll(): Promise<User[]> {
    return apiJson('/admin-users');
  },

  /**
   * Get staff eligible for admin portal access
   */
  async getEligibleStaff(): Promise<any[]> {
    return apiJson('/admin-users/eligible-staff');
  },

  /**
   * Create/Enable admin access for a user
   */
  async create(data: { userId: string; role: string; password?: string }): Promise<User> {
    return apiJson('/admin-users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Reset password for an admin user
   */
  async resetPassword(id: string, password: string): Promise<void> {
    return apiJson(`/admin-users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  },

  /**
   * Toggle user active status
   */
  async toggleStatus(id: string, isActive: boolean): Promise<void> {
    return apiJson(`/admin-users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
};

// ============================================================================
// ZONES API
// ============================================================================

export const zoneApi = {
  async getAll(): Promise<Zone[]> {
    return apiJson('/zones');
  },

  async getById(id: string): Promise<Zone | undefined> {
    return apiJson(`/zones/${id}`);
  },

  async create(zone: Omit<Zone, 'id' | 'createdAt'>): Promise<Zone> {
    return apiJson('/zones', {
      method: 'POST',
      body: JSON.stringify(zone),
    });
  },

  async update(id: string, updates: Partial<Zone>): Promise<Zone> {
    return apiJson(`/zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async assignOM(id: string, omId: string | null): Promise<any> {
    return apiJson(`/zones/${id}/assign-om`, {
      method: 'PUT',
      body: JSON.stringify({ operationsManagerId: omId }),
    });
  },
};

// ============================================================================
// OPERATIONS MANAGER API
// ============================================================================

export const operationsManagerApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/users/operations-managers');
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString()
    }).toString();
    return apiJson(`/users/operations-managers?${query}`);
  },

  async getById(id: string): Promise<any | undefined> {
    const managers = await this.getAll();
    return managers.find((manager: any) => manager.id === id);
  },
};

export const fieldManagerApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/users/field-managers');
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString()
    }).toString();
    return apiJson(`/users/field-managers?${query}`);
  },
  async getById(id: string): Promise<any | undefined> {
    const managers = await this.getAll();
    return managers.find((manager: any) => manager.id === id);
  },

  // ── Field Manager Portal ────────────────────────────────────────────────────
  /** Get all CCs in the FM's team (admin sees all). Optional fmId for drill-down. */
  async getMyTeam(fmId?: string): Promise<any[]> {
    const query = fmId ? `?fmId=${fmId}` : '';
    const data = await apiJson<any>(`/field-manager/my-team${query}`);
    return data?.data || data || [];
  },

  /** Get schedule for FM's team. date: 'YYYY-MM-DD' (defaults to today+7days) */
  async getTeamSchedule(date?: string): Promise<any[]> {
    const query = date ? `?date=${date}` : '';
    const data = await apiJson<any>(`/field-manager/my-team/schedule${query}`);
    return data?.data || data || [];
  },

  /** Get beneficiaries assigned to this FM (called by FM themselves — no filter param needed) */
  async getBeneficiaries(): Promise<any[]> {
    const data = await apiJson<any>('/field-manager/beneficiaries');
    return data?.data || data || [];
  },

  /** Get beneficiaries assigned to a specific FM by their userId (admin / ops-manager view) */
  async getBeneficiariesByFM(fmUserId: string): Promise<any[]> {
    const data = await apiJson<any>(`/field-manager/beneficiaries?fmId=${encodeURIComponent(fmUserId)}`);
    return data?.data || data || [];
  },

  /** Get individual benefit balances + hours log for a beneficiary */
  async getBenefitUsage(beneficiaryId: string): Promise<any> {
    return apiJson<any>(`/field-manager/beneficiaries/${beneficiaryId}/benefit-usage`);
  },

  /** Assign CC or Team to beneficiary */
  async assignCC(beneficiaryId: string, payload: { primaryCcId?: string | null; secondaryCcId?: string | null; teamId?: string | null }): Promise<any> {
    return apiJson<any>(`/beneficiaries/${beneficiaryId}/assign-staff`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /** Toggle CC availability (Online/Offline) */
  async toggleCCAvailability(ccId: string, isAvailable: boolean): Promise<any> {
    return apiJson<any>(`/field-manager/my-team/cc/${ccId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    });
  },
};

// ============================================================================
// CARE COMPANION API
// ============================================================================

export const careCompanionApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/users/care-companions');
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number; ccType?: string }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString(),
      ccType: params.ccType || 'all'
    }).toString();
    return apiJson(`/users/care-companions?${query}`);
  },

  async getById(id: string): Promise<CareCompanion | undefined> {
    await delay();
    return mockCareCompanions.find(cc => cc.id === id);
  },

  async getByZone(zoneId: string): Promise<CareCompanion[]> {
    await delay();
    return mockCareCompanions.filter(cc => cc.zoneId === zoneId);
  },
};

export const customerServiceAgentApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/users/customer-service-agents');
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString()
    }).toString();
    return apiJson(`/users/customer-service-agents?${query}`);
  },
  async getById(id: string): Promise<any | undefined> {
    const agents = await this.getAll();
    return agents.find((agent: any) => agent.id === id);
  },
};

// ============================================================================
// SUBSCRIBER API
// ============================================================================

export const subscriberApi = {
  async getAll(): Promise<any[]> {
    try {
      return await apiJson('/subscribers');
    } catch (err) {
      console.error('subscriberApi.getAll failed, falling back to mock:', err);
      return [...mockSubscribers];
    }
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString()
    }).toString();
    return apiJson(`/subscribers?${query}`);
  },

  async getById(id: string): Promise<any | undefined> {
    try {
      return await apiJson(`/subscribers/${id}`);
    } catch {
      return mockSubscribers.find(s => s.id === id);
    }
  },

  async update(id: string, updates: Partial<Subscriber>): Promise<Subscriber> {
    return apiJson(`/subscribers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /** Get utilization summary for all beneficiaries under this subscriber */
  async getUtilizationSummary(subscriberId: string): Promise<Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    age: number;
    photo: string | null;
    primaryCCName: string | null;
    activePackage: string | null;
    subscriptionId: string | null;
    subscriptionEndDate: string | null;
    benefits: any[];
    overallUsagePercent: number;
    hasLowBalance: boolean;
    hasExhausted: boolean;
  }>> {
    return apiJson(`/subscribers/${subscriberId}/utilization-summary`);
  },
};

// ============================================================================
// BENEFICIARY API
// ============================================================================

export const beneficiaryApi = {
  async getAll(): Promise<any[]> {
    try {
      const res = await apiJson<any>('/beneficiaries?statusFilter=active&limit=5000');
      const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.data?.data || []));
      
      // Normalize to match expected shape
      return data.map((b: any) => {
        const emContacts = Array.isArray(b.emergencyContacts) ? b.emergencyContacts : [];
        const firstEmContact = emContacts[0] || {};
        return {
          ...b,
          medicalHistory: b.medicalConditions
            ? (typeof b.medicalConditions === 'string'
                ? b.medicalConditions.split(',').map((s: string) => s.trim()).filter(Boolean)
                : b.medicalConditions)
            : [],
          medications: b.medications || [],
          emergencyContact: { 
            name: firstEmContact.name || b.subscriberName || 'N/A', 
            relation: firstEmContact.relation || 'Subscriber', 
            phone: firstEmContact.phone || b.subscriberPhone || '' 
          },
          careCompanion: b.careCompanion,
          secondaryCareCompanion: b.secondaryCareCompanion,
          fieldManager: b.fieldManager,
          emotionalScore: b.emotionalScore,
          clinicalConfiguration: {
            bloodPressure: { enabled: true, frequency: 'daily', alertThresholds: { min: 80, max: 140 } },
            spO2: { enabled: true, frequency: 'daily', alertThresholds: { min: 94, max: null } },
            temperature: { enabled: false, frequency: 'weekly', alertThresholds: null },
            heartRate: { enabled: true, frequency: 'daily', alertThresholds: { min: 55, max: 100 } },
            bloodSugar: { enabled: false, frequency: 'weekly', alertThresholds: null },
            weight: { enabled: false, frequency: 'monthly', alertThresholds: null },
          }
        };
      });
    } catch (err) {
      console.error('beneficiaryApi.getAll failed, falling back to mock:', err);
      return [...mockBeneficiaries];
    }
  },
  async getAllPaginated(params: { search: string; searchBy?: string; page: number; limit: number; sortBy?: string; filterBy?: string; statusFilter?: string }): Promise<any> {
    const queryParams: any = {
      search: params.search,
      searchBy: params.searchBy || '',
      page: params.page.toString(),
      limit: params.limit.toString()
    };
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.filterBy) queryParams.filterBy = params.filterBy;
    if (params.statusFilter) queryParams.statusFilter = params.statusFilter;
    
    const query = new URLSearchParams(queryParams).toString();
    const res = await apiJson<any>(`/beneficiaries?${query}`);
    
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map((b: any) => {
        const emContacts = Array.isArray(b.emergencyContacts) ? b.emergencyContacts : [];
        const firstEmContact = emContacts[0] || {};
        return {
          ...b,
          medicalHistory: b.medicalConditions
            ? (typeof b.medicalConditions === 'string'
                ? b.medicalConditions.split(',').map((s: string) => s.trim()).filter(Boolean)
                : b.medicalConditions)
            : [],
          medications: b.medications || [],
          emergencyContact: { 
            name: firstEmContact.name || b.subscriberName || 'N/A', 
            relation: firstEmContact.relation || 'Subscriber', 
            phone: firstEmContact.phone || b.subscriberPhone || '' 
          },
          careCompanion: b.careCompanion,
          secondaryCareCompanion: b.secondaryCareCompanion,
          fieldManager: b.fieldManager,
          emotionalScore: b.emotionalScore,
        };
      });
    }
    return res;
  },

  async getById(id: string): Promise<any | undefined> {
    try {
      return await apiJson(`/beneficiaries/${id}`);
    } catch {
      return mockBeneficiaries.find(b => b.id === id);
    }
  },

  async getBySubscriber(subscriberId: string): Promise<any[]> {
    await delay();
    return mockBeneficiaries.filter(b => b.subscriberId === subscriberId);
  },

  async update(id: string, updates: Partial<Beneficiary>): Promise<Beneficiary> {
    return apiJson(`/beneficiaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async addMedication(id: string, data: any): Promise<any> {
    return apiJson(`/beneficiaries/${id}/medications`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async addCondition(id: string, data: { name: string }): Promise<any> {
    return apiJson(`/beneficiaries/${id}/conditions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async stopMedication(beneficiaryId: string, medicationId: string): Promise<any> {
    return apiJson(`/beneficiaries/${beneficiaryId}/medications/${medicationId}`, {
      method: 'DELETE',
    });
  },

  async removeCondition(beneficiaryId: string, conditionId: string): Promise<any> {
    return apiJson(`/beneficiaries/${beneficiaryId}/conditions/${conditionId}`, {
      method: 'DELETE',
    });
  },

  async updateClinicalConfig(id: string, config: Partial<Beneficiary['clinicalConfiguration']>): Promise<Beneficiary> {
    await delay();
    const index = mockBeneficiaries.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Beneficiary not found');
    mockBeneficiaries[index].clinicalConfiguration = {
      ...mockBeneficiaries[index].clinicalConfiguration,
      ...config,
    };
    return mockBeneficiaries[index];
  },

  async getAvailableStaff(pincode: string, teamId?: string | null): Promise<{ careCompanions: any[]; fieldManagers: any[]; zones: any[] }> {
    try {
      let url = `/beneficiaries/available-staff?pincode=${encodeURIComponent(pincode)}`;
      if (teamId) url += `&teamId=${encodeURIComponent(teamId)}`;
      return await apiJson(url);
    } catch (err) {
      console.error('beneficiaryApi.getAvailableStaff failed:', err);
      return { careCompanions: [], fieldManagers: [], zones: [] };
    }
  },

  async assignStaff(beneficiaryId: string, payload: { primaryCcId?: string | null; secondaryCcId?: string | null; teamId?: string | null }): Promise<any> {
    return apiJson(`/beneficiaries/${beneficiaryId}/assign-staff`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getUnreadServiceRequests(fmUserId?: string): Promise<any[]> {
    try {
      const query = fmUserId ? `?fmId=${encodeURIComponent(fmUserId)}` : '';
      const res = await apiJson<any>(`/beneficiaries/service-requests/unread${query}`);
      return Array.isArray(res) ? res : (res?.data || []);
    } catch (err) {
      console.error('beneficiaryApi.getUnreadServiceRequests failed:', err);
      return [];
    }
  },

  async getServiceRequests(beneficiaryId: string): Promise<any[]> {
    try {
      const res = await apiJson<any>(`/beneficiaries/${beneficiaryId}/service-requests`);
      return Array.isArray(res) ? res : (res?.data || []);
    } catch (err) {
      console.error('beneficiaryApi.getServiceRequests failed:', err);
      return [];
    }
  },

  async markServiceRequestRead(requestId: string): Promise<any> {
    return apiJson(`/beneficiaries/service-requests/${requestId}/read`, {
      method: 'POST',
    });
  },
};



// ============================================================================
// SCHEDULE / VISITS API
// ============================================================================

export const scheduleApi = {
  async getTodayVisits(): Promise<VisitBlock[]> {
    try {
      const data = await apiJson<any>('/field-manager/my-team/schedule');
      return (data?.data || []).map((v: any) => ({
        id: v.id,
        beneficiaryName: v.beneficiaryName,
        visitType: 'Home Visit',
        careCompanionId: v.careCompanionId,
        timeSlot: new Date(v.scheduledTime).getHours() < 12 ? 'morning' :
                  new Date(v.scheduledTime).getHours() < 17 ? 'afternoon' : 'evening',
        startTime: new Date(v.scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        endTime: '',
        status: v.status as VisitBlock['status'],
      }));
    } catch {
      return [...mockTodayVisits];
    }
  },

  async assignCareCompanion(visitId: string, careCompanionId: string): Promise<VisitBlock> {
    await delay();
    const index = mockTodayVisits.findIndex(v => v.id === visitId);
    if (index === -1) throw new Error('Visit not found');
    mockTodayVisits[index].careCompanionId = careCompanionId;
    return mockTodayVisits[index];
  },

  async updateVisitStatus(visitId: string, status: VisitBlock['status']): Promise<VisitBlock> {
    await delay();
    const index = mockTodayVisits.findIndex(v => v.id === visitId);
    if (index === -1) throw new Error('Visit not found');
    mockTodayVisits[index].status = status;
    return mockTodayVisits[index];
  },

  async createVisit(data: {
    beneficiaryId: string;
    careCompanionId: string;
    scheduledTime: string;
    durationMinutes: number;
    benefitId?: string;
  }): Promise<any> {
    return apiJson<any>('/visits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// SUPPORT TICKETS API
// ============================================================================

export const supportApi = {
  async getAll(): Promise<SupportTicket[]> {
    await delay();
    return [...mockSupportTickets];
  },

  async getById(id: string): Promise<SupportTicket | undefined> {
    await delay();
    return mockSupportTickets.find(t => t.id === id);
  },

  async updateStatus(id: string, status: SupportTicket['status']): Promise<SupportTicket> {
    await delay();
    const index = mockSupportTickets.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Ticket not found');
    mockSupportTickets[index].status = status;
    mockSupportTickets[index].updatedAt = new Date().toISOString();
    if (status === 'resolved' || status === 'closed') {
      mockSupportTickets[index].resolvedAt = new Date().toISOString();
    }
    return mockSupportTickets[index];
  },
};

// ============================================================================
// ACTIVITY LOG API
// ============================================================================

export const activityLogApi = {
  async getAll(limit?: number): Promise<ActivityLog[]> {
    const query = limit ? `?limit=${limit}` : '';
    return apiJson(`/activity-logs${query}`);
  },

  async logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog> {
    return apiJson('/activity-logs', {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  },
};

// ============================================================================
// PARTNER API
// ============================================================================

export const partnerApi = {
  async getAll(): Promise<Partner[]> {
    await delay();
    return [...mockPartners];
  },

  async getById(id: string): Promise<Partner | undefined> {
    await delay();
    return mockPartners.find(p => p.id === id);
  },
};

// ============================================================================
// VOLUNTEER API
// ============================================================================

export const volunteerApi = {
  async getAll(status?: string): Promise<Volunteer[]> {
    const query = status ? `?status=${status}` : '';
    return apiJson<Volunteer[]>(`/volunteers${query}`);
  },

  async getById(id: string): Promise<Volunteer> {
    return apiJson<Volunteer>(`/volunteers/${id}`);
  },

  async verify(id: string): Promise<Volunteer> {
    return apiJson<Volunteer>(`/volunteers/${id}/verify`, {
      method: 'PATCH',
    });
  },

  async reject(id: string, rejectionReason: string): Promise<Volunteer> {
    return apiJson<Volunteer>(`/volunteers/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ rejectionReason }),
    });
  },

  async assignBeneficiary(volunteerId: string, beneficiaryId: string): Promise<any> {
    return apiJson(`/volunteers/${volunteerId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ beneficiaryId }),
    });
  },

  async getMatchCandidates(beneficiaryId: string): Promise<any> {
    return apiJson(`/volunteers/match-candidates/${beneficiaryId}`);
  },

  async removeAssignment(id: string, beneficiaryId: string): Promise<any> {
    return apiJson<any>(`/volunteers/${id}/assignments/${beneficiaryId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// PRODUCT FACTORY API (Benefits & Packages & Vitals) — real backend
// ============================================================================

export const vitalApi = {
  async getAll(options?: { activeOnly?: boolean }): Promise<any[]> {
    const query = options?.activeOnly ? '?activeOnly=true' : '';
    return apiJson(`/vitals${query}`);
  },
  async create(data: any): Promise<any> {
    return apiJson('/vitals', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: any): Promise<any> {
    return apiJson(`/vitals/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async remove(id: string): Promise<void> {
    return apiJson(`/vitals/${id}`, { method: 'DELETE' });
  },
  
  // Templates
  async getTemplates(): Promise<any[]> {
    return apiJson('/vitals/templates');
  },
  async createTemplate(data: any): Promise<any> {
    return apiJson('/vitals/templates', { method: 'POST', body: JSON.stringify(data) });
  },
  
  // Beneficiary Config
  async getBeneficiaryConfigs(params?: { zoneId?: string; templateId?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as any).toString();
    return apiJson(`/vitals/beneficiary-configs?${query}`);
  },
  async updateBeneficiaryConfig(beneficiaryId: string, data: any): Promise<any> {
    return apiJson(`/vitals/beneficiary-configs/${beneficiaryId}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  
  // Readings / Capture Log
  async getReadings(params?: { beneficiaryId?: string; date?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as any).toString();
    return apiJson(`/vitals/readings?${query}`);
  },
};

export const hobbyApi = {
  async getAll(options?: { activeOnly?: boolean }): Promise<any[]> {
    const query = options?.activeOnly ? '?activeOnly=true' : '';
    return apiJson(`/hobbies${query}`);
  },
};

export const benefitTypeApi = {
  async getAll(): Promise<any[]> { return apiJson('/benefit-types'); },
  async create(data: { name: string; description?: string; iconCode?: string; displayOrder?: number }): Promise<any> {
    return apiJson('/benefit-types', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: any): Promise<any> {
    return apiJson(`/benefit-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async remove(id: string): Promise<void> { return apiJson(`/benefit-types/${id}`, { method: 'DELETE' }); },
};

export const benefitApi = {
  async getAll(options?: { activeOnly?: boolean }): Promise<any[]> { 
    const query = options?.activeOnly ? '?activeOnly=true' : '';
    return apiJson(`/benefits${query}`); 
  },
  async create(data: { benefitTypeId: string; name: string; description?: string; isChargeable?: boolean; unitCost?: number; unitLabel?: string; defaultUnits?: number; displayOrder?: number }): Promise<any> {
    return apiJson('/benefits', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: any): Promise<any> {
    return apiJson(`/benefits/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async remove(id: string): Promise<void> { return apiJson(`/benefits/${id}`, { method: 'DELETE' }); },
};

export const taxCategoryApi = {
  async getAll(): Promise<any[]> { return apiJson('/tax-categories'); },
  async create(data: { name: string; gstRate: number; hsnSacCode?: string; isExempt?: boolean; description?: string }): Promise<any> {
    return apiJson('/tax-categories', { method: 'POST', body: JSON.stringify(data) });
  },
  async remove(id: string): Promise<void> { return apiJson(`/tax-categories/${id}`, { method: 'DELETE' }); },
};

export const packageApi = {
  async getAll(params?: { all?: boolean }): Promise<any[]> { 
    return apiJson(params?.all ? '/packages?all=true' : '/packages'); 
  },
  async getOne(id: string): Promise<any> { return apiJson(`/packages/${id}`); },
  async create(data: { name: string; packageCost: number; mrp: number; discountPercentage: number; activeFrom: string; benefits?: any[]; [key: string]: any }): Promise<any> {
    return apiJson('/packages', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: { name?: string; packageCost?: number; mrp?: number; discountPercentage?: number; activeFrom?: string; benefits?: any[]; [key: string]: any }): Promise<any> {
    return apiJson(`/packages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async toggleStatus(id: string, isActive: boolean): Promise<any> {
    return apiJson(`/packages/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  },
  async delete(id: string): Promise<void> { return apiJson(`/packages/${id}`, { method: 'DELETE' }); },
  async updateBenefits(id: string, benefits: { benefitId: string; unitsIncluded: number; unitsPeriod?: string; isUnlimited?: boolean }[]): Promise<any> {
    return apiJson(`/packages/${id}/benefits`, { method: 'POST', body: JSON.stringify({ benefits }) });
  },
};
// ============================================================================
// TEAM MANAGEMENT & ONBOARDING API
// ============================================================================

export const couponApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/coupons');
  },
  async getOne(id: string): Promise<any> {
    return apiJson(`/coupons/${id}`);
  },
  async create(data: any): Promise<any> {
    return apiJson('/coupons', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: any): Promise<any> {
    return apiJson(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async delete(id: string): Promise<void> {
    return apiJson(`/coupons/${id}`, { method: 'DELETE' });
  },
  async getStats(): Promise<any> {
    return apiJson('/coupons/analytics/stats');
  }
};

export const subscriptionApi = {
  async getBalances(subscriptionId: string): Promise<any> {
    return apiJson(`/subscriptions/${subscriptionId}/balances`);
  },
  async consume(subscriptionId: string, data: { benefitId: string; units: number; notes?: string }): Promise<any> {
    return apiJson(`/subscriptions/${subscriptionId}/consume`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async enroll(data: { subscriberId: string; beneficiaryId: string; packageId: string; duration: string }): Promise<any> {
    return apiJson('/subscriptions/enroll', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** Get rich utilization data for a beneficiary's active subscription */
  async getBeneficiaryUtilization(beneficiaryId: string): Promise<{
    subscription: any | null;
    benefits: Array<{
      benefitId: string;
      benefitName: string;
      unitLabel: string;
      benefitTypeName: string | null;
      totalUnits: number;
      usedUnits: number;
      remainingUnits: number;
      usagePercent: number;
      isLowBalance: boolean;
      isExhausted: boolean;
    }>;
    recentLogs: any[];
  }> {
    return apiJson(`/subscriptions/beneficiary/${beneficiaryId}/utilization`);
  },
  /** Initialize/backfill missing benefit balances for a subscription */
  async initializeBalances(subscriptionId: string): Promise<{ created: number; message: string; benefits: any[] }> {
    return apiJson(`/subscriptions/${subscriptionId}/initialize-balances`, { method: 'POST' });
  },
  /** Get expiring subscriptions for worklist */
  async getExpiringSubscriptions(days: number = 30): Promise<any[]> {
    return apiJson(`/subscriptions/expiring?days=${days}`);
  },
  /** Get terminated subscriptions with cancellation notes */
  async getTerminatedSubscriptions(): Promise<any[]> {
    return apiJson('/subscriptions/terminated');
  },
  /** Terminate a subscription early */
  async terminateSubscription(id: string, reason: string): Promise<any> {
    return apiJson(`/subscriptions/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  /** Fetch complete renewal information context */
  async getRenewalData(subscriptionId: string): Promise<{
    subscription: any;
    subscriber: any;
    beneficiary: any;
    medicalConditions: any[];
    medications: any[];
    emergencyContacts: any[];
    vitalsToTrack?: any;
    currentPackage: any;
    paymentHistory: any[];
    subscriptionHistory: any[];
    availablePackages: any[];
    auditLogs: any[];
  }> {
    return apiJson(`/subscriptions/${subscriptionId}/renewal`);
  },
  /** Execute renewal creation */
  async renewSubscription(subscriptionId: string, payload: {
    changedFields?: any;
    vitalsToTrack?: any;
    packageId?: string;
    duration?: string;
    renewalMode?: 'from_expiry' | 'today';
    customStartDate?: string;
    payment?: {
      amountPaid?: number;
      paymentMethod?: string;
      transactionId?: string;
      paymentNote?: string;
    };
  }): Promise<{
    newSubscription: any;
    invoiceNumber: string;
    payment: any;
    package: any;
    subscriber: any;
    beneficiary: any;
    startDate: string;
    endDate: string;
  }> {
    return apiJson(`/subscriptions/${subscriptionId}/renew`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  /** Allocate add-on benefit units to subscription */
  async allocateAddon(subscriptionId: string, payload: {
    benefitId: string;
    units?: number;
    amountPaid?: number;
    paymentMethod?: string;
    transactionId?: string;
    paymentNote?: string;
  }): Promise<any> {
    return apiJson(`/subscriptions/${subscriptionId}/addons/allocate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  /** Calculate authoritative pricing & GST from backend */
  async calculatePrice(payload: {
    packageId: string;
    duration: string;
    addons?: Array<{ benefitId: string; units?: number; totalAmount?: number }>;
    customerState?: string;
  }): Promise<{
    packageId: string;
    packageName: string;
    duration: string;
    months: number;
    baseMonthlyRate: number;
    undiscountedPackageTotal: number;
    packageBasePrice: number;
    packageDiscount: number;
    addonsBasePrice: number;
    addonsTax: number;
    addonsBreakdown: any[];
    totalBaseAmount: number;
    isInterState: boolean;
    customerState: string;
    gstRate: number;
    taxLabel: string;
    packageTax: number;
    totalTaxAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    finalTotalAmount: number;
  }> {
    return apiJson('/subscriptions/calculate-price', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const visitApi = {
  async getAll(params: { beneficiaryId?: string; careCompanionId?: string; date?: string; fmUserId?: string; visitCode?: string }): Promise<any[]> {
    // Filter out empty string params to avoid sending ?visitCode= to the backend
    const clean = Object.fromEntries(Object.entries(params as any).filter(([, v]) => v !== '' && v != null));
    const query = new URLSearchParams(clean as any).toString();
    return apiJson(`/visits?${query}`);
  },
  async getById(id: string): Promise<any> {
    return apiJson(`/visits/${id}`);
  },
  async editVisit(id: string, data: { notes?: string; visitSummary?: string; followUpRequired?: boolean; followUpNotes?: string; followUpDate?: string | null; escalateToManager?: boolean; escalationReason?: string; actorName?: string; imageUrls?: string[]; checkInTime?: string | null; checkOutTime?: string | null }): Promise<any> {
    return apiJson(`/visits/${id}/edit`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  async resolveChangeRequest(id: string, status: 'accepted' | 'rejected', reason?: string): Promise<any> {
    return apiJson(`/visits/${id}/resolve-change`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason })
    });
  },
  async uploadVisitImage(id: string, file: File): Promise<{ url: string; imageUrls: string[] }> {
    const form = new FormData();
    form.append('image', file);
    return apiJson(`/visits/${id}/upload-image`, { method: 'POST', body: form });
  },
  async create(data: { beneficiaryId: string; careCompanionId?: string | null; is3rdParty?: boolean; thirdPartyNotes?: string; scheduledTime: string; durationMinutes: number; benefitId?: string }): Promise<any> {
    return apiJson('/visits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateStatus(id: string, status: 'completed' | 'missed' | 'cancelled', note?: string, hoursConsumed?: number): Promise<any> {
    return apiJson(`/visits/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, hoursConsumed })
    });
  },
  async cancel(id: string): Promise<any> {
    return apiJson(`/visits/${id}`, { method: 'DELETE' });
  },
  async update(id: string, data: { careCompanionId: string; scheduledTime: string; durationMinutes: number }): Promise<any> {
    return apiJson(`/visits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async checkAvailability(careCompanionId: string, scheduledTime: string, durationMinutes: number): Promise<{ isAvailable: boolean; reason: string | null }> {
    const query = new URLSearchParams({ careCompanionId, scheduledTime, durationMinutes: durationMinutes.toString() }).toString();
    return apiJson(`/visits/check-availability?${query}`);
  },
  /** Mark a visit as completed, triggers hours deduction for hour-based benefits */
  async complete(id: string, data: { checkInTime: string; checkOutTime: string; benefitId?: string; notes?: string; visitSummary?: string }): Promise<any> {
    return apiJson(`/visits/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  async approveRoster(data: { date: string; periodType: 'daily' | 'weekly'; zoneId: string }): Promise<any> {
    return apiJson('/visits/roster/approve', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getRosterApprovals(params: { date?: string; periodType?: 'daily' | 'weekly'; zoneId?: string }): Promise<any> {
    const clean = Object.fromEntries(Object.entries(params as any).filter(([, v]) => v !== '' && v != null));
    const query = new URLSearchParams(clean as any).toString();
    return apiJson(`/visits/roster/approvals?${query}`);
  },
  async submitRosterFeedback(data: { date: string; zoneId?: string; ccId?: string; feedback: string }): Promise<any> {
    return apiJson('/visits/roster/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getRosterFeedbacks(params: { date?: string; zoneId?: string }): Promise<any> {
    const clean = Object.fromEntries(Object.entries(params as any).filter(([, v]) => v !== '' && v != null));
    const query = new URLSearchParams(clean as any).toString();
    return apiJson(`/visits/roster/feedbacks?${query}`);
  },
};

export const teamApi = {
  async getAll(): Promise<any[]> {
    return apiJson('/teams');
  },
  async getAllPaginated(params: { search: string; page: number; limit: number }): Promise<any> {
    const query = new URLSearchParams({
      search: params.search,
      page: params.page.toString(),
      limit: params.limit.toString()
    }).toString();
    return apiJson(`/teams?${query}`);
  },
  async getById(id: string): Promise<any | undefined> {
    const teams = await this.getAll();
    return teams.find((team: any) => team.id === id);
  },
  async getTeams(): Promise<any[]> {
    return apiJson('/teams');
  },

  async createTeam(data: { name: string; fieldManagerId?: string | null; zone: string; zoneId?: string | null; careCompanionIds: string[] }): Promise<any> {
    return apiJson('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAvailableCompanions(includeTeamId?: string): Promise<CareCompanion[]> {
    const query = includeTeamId ? `?includeTeamId=${includeTeamId}` : '';
    return apiJson(`/teams/available-companions${query}`);
  },

  async getTeamById(id: string): Promise<any> {
    return apiJson(`/teams/${id}`);
  },

  async updateTeam(id: string, data: { name?: string; fieldManagerId?: string | null; zone?: string; zoneId?: string | null; careCompanionIds?: string[] }): Promise<any> {
    return apiJson(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getAvailableManagers(): Promise<any[]> {
    return apiJson('/teams/available-managers');
  },

  async onboardCC(data: { userId: string; bio: string; specialization: string[]; zone: string }): Promise<any> {
    return apiJson('/teams/onboard-cc', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async onboardFM(data: { userId: string; zone: string }): Promise<any> {
    return apiJson('/teams/onboard-fm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getZones(): Promise<any[]> {
    return apiJson('/zones');
  }
};

export const staffOnboardingApi = {
  async getMetadata(): Promise<StaffOnboardingMetadata> {
    try {
      return await apiJson('/users/staff/onboarding-metadata');
    } catch (err: any) {
      // Only fall back to mock if the backend is genuinely unreachable (network error)
      // 403/500 from a live server should NOT silently fallback – it means backend is there but failing
      if (err instanceof TypeError && err.message.includes('fetch')) {
        console.warn('Network unavailable, falling back to mock metadata');
        await delay(500);
        return mockStaffOnboardingMetadata;
      }
      // Re-throw real HTTP errors (e.g. 403 unauthorized, 500 server error)
      throw err;
    }
  },

  async onboard(payload: StaffOnboardingPayload): Promise<any> {
    try {
      return await apiJson('/users/staff/onboard', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      // Only fall back to mock if it's a genuine network failure (no connection)
      // Real HTTP errors (400, 500 etc.) from a live backend must be re-thrown
      if (err instanceof TypeError && err.message.includes('fetch')) {
        console.warn('Network unavailable, simulating successful onboarding');
        await delay(1000);
        return { success: true, message: 'Mock onboarding successful' };
      }
      // Re-throw real backend errors so UI can display them
      throw err;
    }
  },

  /**
   * Upload a single document file to backend storage (Supabase).
   * Must be called after the staff profile is created, so we have a staffProfileId.
   */
  async uploadDocument(staffProfileId: string, documentType: string, file: File): Promise<{ fileUrl: string; fileKey: string }> {
    const formData = new FormData();
    formData.append('staffProfileId', staffProfileId);
    formData.append('documentType', documentType);
    formData.append('file', file);

    // Use apiFetch directly since apiJson would set Content-Type: application/json
    const response = await apiFetch(`${API_BASE}/upload-document`, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    const result = text ? JSON.parse(text) : {};

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `File upload failed with status ${response.status}`);
    }

    return result.data;
  },

  /**
   * General upload of a file for temporary usage or before linking to an entity.
   */
  async uploadFile(file: File): Promise<{ success: boolean; url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiFetch(`${API_BASE}/upload-document/general`, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    const result = text ? JSON.parse(text) : {};

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `File upload failed with status ${response.status}`);
    }

    return result;
  },

  async getStaffDetails(userId: string): Promise<any> {
    return apiJson(`/users/staff/${userId}`);
  },

  async updateStaff(userId: string, data: any): Promise<any> {
    return apiJson(`/users/staff/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async deactivateStaff(userId: string): Promise<any> {
    return apiJson(`/users/staff/${userId}/deactivate`, {
      method: 'PUT',
    });
  },
};

// ============================================================================
// ENROLLMENT API — Admin-side subscriber + beneficiary enrollment
// ============================================================================

export const enrollmentApi = {
  /** Check if a phone number already exists in DB and fetch their beneficiaries */
  async checkPhone(phone: string): Promise<{
    exists: boolean;
    id?: string;
    name?: string;
    role?: string;
    isActive?: boolean;
    beneficiaries?: any[];
  }> {
    return apiJson(`/subscriptions/check-phone?phone=${encodeURIComponent(phone)}`);
  },

  /** Full admin enrollment: creates subscriber + beneficiary + subscription + payment in one shot */
  async adminEnroll(payload: {
    subscriberPhone: string;
    subscriberName: string;
    subscriberEmail?: string;
    subscriberAddress?: string;
    subscriberPincode?: string;
    subscriberCity?: string;
    subscriberState?: string;
    sameAsSubscriber: boolean;
    beneficiaryPhone?: string;
    beneficiaryName?: string;
    beneficiaryAge?: number;
    beneficiaryDob?: string;
    beneficiaryGender?: string;
    maritalStatus?: string;
    profilePhoto?: string;
    beneficiaryAddress?: string;
    beneficiaryPincode?: string;
    beneficiaryCity?: string;
    beneficiaryState?: string;
    relationship?: string;
    medicalConditions?: any[];
    medications?: any[];
    vitalsToTrack?: any;
    primaryPhysicianName?: string;
    primaryPhysicianPhone?: string;
    hobbiesInterests?: string[];
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    emergencyContactEmail?: string;
    secondaryContactName?: string;
    secondaryContactPhone?: string;
    secondaryContactRelationship?: string;
    secondaryContactEmail?: string;
    preferredSlot?: string;
    packageId: string;
    duration: string;
    startDate: string;
    amountPaid: number;
    paymentMethod: string;
    paymentNote?: string;
    csaMode?: boolean;
    subscriberPassword?: string;
  }): Promise<{
    subscription: any;
    subscriber: { id: string; name: string; phone: string };
    beneficiary: { id: string; name: string };
    package: { name: string; type: string; basePrice: number };
    invoiceNumber: string;
  }> {
    return apiJson('/subscriptions/admin-enroll', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Check if a pincode is serviceable by any active zone */
  async checkPincode(pincode: string): Promise<{
    success: boolean;
    serviceable: boolean;
    zone: { id: string; name: string; city: string; state: string } | null;
  }> {
    return apiJson(`/zones/check-pincode/${encodeURIComponent(pincode)}`);
  },
};

// ============================================================================
// UPLOAD API — Profile photos & documents
// ============================================================================

export const uploadApi = {
  /**
   * Upload or update a profile photo for any entity.
   *
   * @param targetType - 'subscriber' | 'care_companion' | 'field_manager' | 'operations_manager' | 'beneficiary'
   * @param targetId   - User.id for subscriber/staff, Beneficiary.id for beneficiary
   * @param file       - The image File object from the file input
   * @returns          - { url, data, entityType, targetId }
   */
  async uploadProfilePhoto(
    targetType: 'subscriber' | 'care_companion' | 'field_manager' | 'operations_manager' | 'beneficiary',
    targetId: string,
    file: File
  ): Promise<{ url: string; data: any; entityType: string; targetId: string }> {
    const formData = new FormData();
    formData.append('targetType', targetType);
    formData.append('targetId', targetId);
    formData.append('file', file);

    const response = await apiFetch(`${API_BASE}/upload-document/profile-photo`, {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    const result = text ? JSON.parse(text) : {};

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `Photo upload failed with status ${response.status}`);
    }

    return {
      url: result.url,
      data: result.data,
      entityType: result.entityType,
      targetId: result.targetId,
    };
  },
};

// ============================================================================
// CALLBACK REQUESTS API
// ============================================================================

export const callbacksApi = {
  async getAll(): Promise<CallbackRequest[]> {
    return apiJson<CallbackRequest[]>('/callbacks');
  },
  async updateStatus(id: string, status: string): Promise<CallbackRequest> {
    return apiJson<CallbackRequest>(`/callbacks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ============================================================================
// REGIONS API
// ============================================================================

export const regionApi = {
  async getAll(): Promise<any[]> {
    return apiJson<any[]>('/regions');
  },
  async create(data: any): Promise<any> {
    return apiJson<any>('/regions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async update(id: string, data: any): Promise<any> {
    return apiJson<any>(`/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async delete(id: string): Promise<any> {
    return apiJson<any>(`/regions/${id}`, {
      method: 'DELETE',
    });
  },
  async detect(lat: number, lng: number): Promise<any[]> {
    return apiJson<any[]>(`/regions/detect?lat=${lat}&lng=${lng}`);
  },
};

// ============================================================================
// CONFIGURATION API
// ============================================================================

export const configApi = {
  async getAll(): Promise<any[]> {
    return apiJson<any[]>('/config');
  },
  async update(key: string, data: { value: string; description?: string; group?: string }): Promise<any> {
    return apiJson<any>(`/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// PAYMENT API
// ============================================================================

export const paymentApi = {
  async generateLink(data: {
    subscriberId: string;
    beneficiaryId?: string;
    subscriptionId?: string;
    packageType?: string;
    packageName?: string;
    amount: number;
    subscriberPhone?: string;
    subscriberEmail?: string;
    subscriberName?: string;
    duration?: string;
  }): Promise<any> {
    return apiJson<any>('/payments/generate-link', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async getStatus(orderId: string): Promise<any> {
    return apiJson<any>(`/payments/status/${orderId}`);
  },
  async markOffline(id: string, data: { method?: string; note?: string }): Promise<any> {
    return apiJson<any>(`/payments/${id}/mark-offline`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async simulatePay(orderId: string, data?: { paymentMethod?: string; paymentId?: string }): Promise<any> {
    return apiJson<any>(`/payments/simulate-pay/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },
};

// ============================================================================
// SAATHI GUIDE API
// ============================================================================

export const saathiGuideApi = {
  // Best Practices
  async getBestPractices(): Promise<any[]> {
    return apiJson<any[]>('/saathi-guide/best-practices');
  },
  async createBestPractice(data: any): Promise<any> {
    return apiJson<any>('/saathi-guide/best-practices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateBestPractice(id: string, data: any): Promise<any> {
    return apiJson<any>(`/saathi-guide/best-practices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async deleteBestPractice(id: string): Promise<any> {
    return apiJson<any>(`/saathi-guide/best-practices/${id}`, {
      method: 'DELETE',
    });
  },

  // Activities
  async getActivities(): Promise<any[]> {
    return apiJson<any[]>('/saathi-guide/activities');
  },
  async createActivity(data: any): Promise<any> {
    return apiJson<any>('/saathi-guide/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateActivity(id: string, data: any): Promise<any> {
    return apiJson<any>(`/saathi-guide/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async deleteActivity(id: string): Promise<any> {
    return apiJson<any>(`/saathi-guide/activities/${id}`, {
      method: 'DELETE',
    });
  },

  // FAQs
  async getFaqs(): Promise<any[]> {
    return apiJson<any[]>('/saathi-guide/faqs');
  },
  async createFaq(data: any): Promise<any> {
    return apiJson<any>('/saathi-guide/faqs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateFaq(id: string, data: any): Promise<any> {
    return apiJson<any>(`/saathi-guide/faqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async deleteFaq(id: string): Promise<any> {
    return apiJson<any>(`/saathi-guide/faqs/${id}`, {
      method: 'DELETE',
    });
  },
};

export const emergencyApi = {
  async getRequests(status?: string): Promise<any[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiJson<any[]>(`/emergency/requests${query}`);
  },
  async updateStatus(id: string, status: string, resolutionNotes?: string): Promise<any> {
    return apiJson<any>(`/emergency/requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  },
  async addNote(id: string, note: string, author?: string): Promise<any> {
    return apiJson<any>(`/emergency/requests/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, author }),
    });
  },
};

export const visitRequestApi = {
  getAll: async (params?: {
    beneficiaryIds?: string[];
    careCompanionIds?: string[];
    teamIds?: string[];
    zoneIds?: string[];
    isRead?: boolean;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> => {
    const query = new URLSearchParams();
    if (params?.beneficiaryIds && params.beneficiaryIds.length > 0) {
      query.append('beneficiaryIds', params.beneficiaryIds.join(','));
    }
    if (params?.careCompanionIds && params.careCompanionIds.length > 0) {
      query.append('careCompanionIds', params.careCompanionIds.join(','));
    }
    if (params?.teamIds && params.teamIds.length > 0) {
      query.append('teamIds', params.teamIds.join(','));
    }
    if (params?.zoneIds && params.zoneIds.length > 0) {
      query.append('zoneIds', params.zoneIds.join(','));
    }
    if (params?.isRead !== undefined) {
      query.append('isRead', String(params.isRead));
    }
    if (params?.search) {
      query.append('search', params.search);
    }
    if (params?.startDate) {
      query.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      query.append('endDate', params.endDate);
    }
    const qStr = query.toString();
    return apiJson<any[]>(`/visits/service-requests${qStr ? `?${qStr}` : ''}`);
  },

  markAsRead: async (requestId: string): Promise<any> => {
    return apiJson(`/beneficiaries/service-requests/${requestId}/read`, { method: 'POST' });
  }
};

export const fileAccessApi = {
  getPresignedUrl: async (type: string, id: string): Promise<string> => {
    const res = await apiFetch(`${API_BASE}/files/presigned?type=${type}&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.success && data.url) {
      return data.url;
    }
    throw new Error(data.message || 'Failed to get presigned URL');
  }
};


