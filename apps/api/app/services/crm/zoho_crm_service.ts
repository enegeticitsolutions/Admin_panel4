import { config } from '../../core/config';

export type ZohoFormType = 'partner' | 'contact' | 'saathi' | 'default';

export interface ZohoLeadData {
  formType?: ZohoFormType;
  firstName?: string;
  lastName: string; // Mandatory in Zoho
  email: string;
  phone: string;
  company?: string;
  pincode?: string;
  description?: string;
  leadSource?: string;
  gender?: string;
  dob?: string;
  city?: string;
  state?: string;
  area?: string;
  interests?: string[];
  customFields?: Record<string, any>;
}

export interface ZohoSaathiVolunteerData {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  gender?: string;
  dob?: string;
  age?: number | string;
  state: string;
  city: string;
  pincode?: string;
  area?: string;
  interests?: string[] | string;
  whyJoin?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

/**
 * Normalizes any common date string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO) to Zoho's required YYYY-MM-DD format.
 */
function formatToZohoDate(dateStr?: string): string | undefined {
  if (!dateStr || !dateStr.trim()) return undefined;
  const trimmed = dateStr.trim();

  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Parse DD/MM/YYYY or DD-MM-YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD or YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // DD-MM-YYYY or DD/MM/YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return undefined;
}

export class ZohoCrmService {
  private static readonly ZOHO_WEB_TO_LEAD_URL = 'https://crm.zoho.in/crm/WebToLeadForm';
  private static readonly ZOHO_WEB_FORM_URL = 'https://crm.zoho.in/crm/WebForm';

  // In-memory cache for OAuth access token
  private static cachedAccessToken: string | null = null;
  private static tokenExpiresAt: number | null = null;

  /**
   * Submit a lead or entity directly to Zoho CRM endpoint with dedicated formType credentials.
   * Handles both standard Leads (WebToLeadForm) and Custom Modules like:
   * - Partner Registration (CustomModule3 via WebForm)
   * - Saathi Network Volunteers (CustomModule2 via WebForm)
   * @param leadData The lead details including optional formType
   * @returns true if successful, false otherwise
   */
  public static async createLead(leadData: ZohoLeadData): Promise<boolean> {
    try {
      const formType = leadData.formType || 'default';

      // Resolve form-specific credentials strictly without fallback
      const credentials = (config.zohoCrm as any)[formType];

      const xnQsjsdp = credentials?.xnQsjsdp;
      const xmIwtLD = credentials?.xmIwtLD;
      const actionType = credentials?.actionType || 'TGVhZHM=';
      const returnURL = credentials?.returnURL || 'null';

      if (!xnQsjsdp || !xmIwtLD) {
        console.warn(`⚠️ [Zoho CRM] Missing Zoho credentials for formType="${formType}". Lead sync skipped.`);
        return false;
      }

      // Check if target is a Custom Module
      const isPartnerModule = actionType === 'Q3VzdG9tTW9kdWxlMw==' || formType === 'partner';
      const isSaathiModule = actionType === 'Q3VzdG9tTW9kdWxlMg==' || formType === 'saathi';
      const isCustomModule = isPartnerModule || isSaathiModule;
      const targetUrl = isCustomModule ? ZohoCrmService.ZOHO_WEB_FORM_URL : ZohoCrmService.ZOHO_WEB_TO_LEAD_URL;

      // Prepare form data using URLSearchParams
      const formData = new URLSearchParams();
      formData.append('xnQsjsdp', xnQsjsdp);
      formData.append('zc_gad', '');
      formData.append('xmIwtLD', xmIwtLD);
      formData.append('actionType', actionType);
      formData.append('returnURL', returnURL);

      // ─── 1. Saathi Network Volunteers (CustomModule2) ─────────────────────────
      if (isSaathiModule) {
        const volunteerName = `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Saathi Volunteer';
        formData.append('NAME', volunteerName);
        formData.append('COBJ2CF5', leadData.firstName || 'Saathi');
        formData.append('COBJ2CF6', leadData.lastName || leadData.firstName || 'Volunteer');
        formData.append('Email', leadData.email);
        formData.append('COBJ2CF7', leadData.phone);

        // Gender mapping (Male / Female)
        let genderVal = 'Male';
        if (leadData.gender) {
          const g = leadData.gender.trim().toLowerCase();
          if (g === 'female' || g === 'f') genderVal = 'Female';
          else if (g === 'male' || g === 'm') genderVal = 'Male';
        }
        formData.append('COBJ2CF8', genderVal);

        // Date of Birth mapping (DD/MM/YYYY)
        let formattedDob = '01/01/1995'; // safe default fallback
        if (leadData.dob) {
          const cleanDob = leadData.dob.trim();
          const isoMatch = cleanDob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (isoMatch) {
            const [, y, m, d] = isoMatch;
            formattedDob = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
          } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDob)) {
            const [d, m, y] = cleanDob.split('/');
            formattedDob = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
          } else {
            formattedDob = cleanDob;
          }
        }
        formData.append('COBJ2CF52', formattedDob);

        // Pincode
        if (leadData.pincode) {
          formData.append('COBJ2CF51', leadData.pincode);
        }

        // Area / Sector
        const area = leadData.area || leadData.customFields?.area || '';
        if (area) {
          formData.append('COBJ2CF2', area);
        }

        // City
        const city = leadData.city || leadData.customFields?.city || '';
        if (city) {
          formData.append('COBJ2CF1', city);
        }

        // State
        const state = leadData.state || leadData.customFields?.state || '';
        if (state) {
          formData.append('COBJ2CF4', state);
        }

        // Interests (multi-select)
        const validInterests = [
          'Cooking',
          'Music',
          'Yoga/Excersise',
          'Movies',
          'Gardening',
          'Technology',
          'Art',
          'Sports',
          'Reading',
          'Traveling',
        ];
        const rawInterests =
          leadData.interests ||
          (Array.isArray(leadData.customFields?.interests) ? leadData.customFields?.interests : []);
        if (Array.isArray(rawInterests)) {
          for (const item of rawInterests) {
            const trimmed = String(item).trim();
            const matched = validInterests.find(
              (vi) =>
                vi.toLowerCase() === trimmed.toLowerCase() ||
                (vi === 'Yoga/Excersise' && trimmed.toLowerCase().includes('yoga'))
            );
            if (matched) {
              formData.append('COBJ2CF3', matched);
            } else if (trimmed) {
              formData.append('COBJ2CF3', trimmed);
            }
          }
        }

        if (leadData.description) {
          formData.append('Description', leadData.description);
        }
      }

      // ─── 2. Standard Leads or Partner Module ──────────────────────────────────
      if (!isSaathiModule) {
        if (leadData.firstName) formData.append('First Name', leadData.firstName);
        formData.append('Last Name', leadData.lastName);
        formData.append('Email', leadData.email);
        formData.append('Phone', leadData.phone);

        // Company field (fallback based on formType)
        const company =
          leadData.company ||
          (formType === 'partner'
            ? 'Partner Lead'
            : formType === 'contact'
            ? 'Custom Care Plan Lead'
            : 'MaiHoonna Website Lead');
        formData.append('Company', company);

        if (leadData.pincode) {
          formData.append('Address - Zip / Postal Code', leadData.pincode);
          formData.append('Zip Code', leadData.pincode);
        }

        if (leadData.description) {
          formData.append('Description', leadData.description);
        }

        // Specific field mapping for CustomModule3 (Partner Registration)
        if (isPartnerModule) {
          formData.append('NAME', company);
          formData.append('COBJ3CF1', `${leadData.firstName || ''} ${leadData.lastName}`.trim());
          formData.append('COBJ3CF2', leadData.phone);
          formData.append('COBJ3CF3', leadData.customFields?.state || '');
          formData.append('COBJ3CF4', leadData.customFields?.city || '');
          formData.append('COBJ3CF5', leadData.customFields?.category || '-None-');
          formData.append('COBJ3CF7', leadData.description || '');
        }

        // Lead Source
        const leadSource =
          leadData.leadSource ||
          (formType === 'contact'
            ? 'Web Research'
            : formType === 'partner'
            ? 'Website Partner Application'
            : 'Website Waitlist');
        formData.append('Lead Source', leadSource);
      }

      // Additional custom fields if provided (that haven't been added yet)
      if (leadData.customFields) {
        for (const [key, value] of Object.entries(leadData.customFields)) {
          if (!formData.has(key) && value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        }
      }

      // Honeypot field (should always be empty)
      formData.append('aG9uZXlwb3Q', '');

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: formData.toString(),
      });

      const moduleName = isPartnerModule
        ? 'Partner Registration (CustomModule3)'
        : isSaathiModule
        ? 'Saathi Network Volunteers (CustomModule2)'
        : 'Leads';

      if (!response.ok) {
        console.error(`❌ [Zoho CRM] Failed to submit for [${formType}] to ${targetUrl} (${moduleName}). Status: ${response.status}`);
        return false;
      }

      const responseText = await response.text();
      console.log(`✅ [Zoho CRM] Successfully created record for [${formType}] (${leadData.email || leadData.phone}) in ${moduleName}. Status: ${response.status}`);
      return true;
    } catch (error: any) {
      console.error('❌ [Zoho CRM] Exception while submitting lead:', error.message);
      return false;
    }
  }

  /**
   * Retrieves a valid Zoho CRM OAuth 2.0 access token using refresh_token flow.
   * Caches token in-memory until near expiry.
   */
  public static async getAccessToken(): Promise<string | null> {
    const { clientId, clientSecret, refreshToken, accountsDomain } = config.zohoOAuth;

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    const now = Date.now();
    if (ZohoCrmService.cachedAccessToken && ZohoCrmService.tokenExpiresAt && now < ZohoCrmService.tokenExpiresAt) {
      return ZohoCrmService.cachedAccessToken;
    }

    try {
      const tokenUrl = `${accountsDomain}/oauth/v2/token`;
      const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      });

      const response = await fetch(`${tokenUrl}?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Zoho CRM OAuth] Token refresh failed (HTTP ${response.status}):`, errorText);
        return null;
      }

      const data: any = await response.json();
      if (!data.access_token) {
        console.error('❌ [Zoho CRM OAuth] Access token not present in response:', data);
        return null;
      }

      ZohoCrmService.cachedAccessToken = data.access_token;
      // Buffer by 120 seconds for safe expiration
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
      ZohoCrmService.tokenExpiresAt = now + Math.max(60, expiresInSec - 120) * 1000;

      console.log('✅ [Zoho CRM OAuth] Successfully obtained fresh access token.');
      return ZohoCrmService.cachedAccessToken;
    } catch (err: any) {
      console.error('❌ [Zoho CRM OAuth] Exception during token refresh:', err.message);
      return null;
    }
  }

  /**
   * Pushes a Saathi Volunteer Enrollment application to Zoho CRM's custom module:
   * Saathi_Network_Volunteers via Zoho CRM REST API v8 (with fallback to v3).
   * Uses OAuth access token retrieved via refresh_token flow.
   * Fully non-blocking and logs comprehensive error/response info.
   */
  public static async pushSaathiToZohoCRM(
    data: ZohoSaathiVolunteerData
  ): Promise<{ success: boolean; recordId?: string; error?: string }> {
    try {
      const accessToken = await ZohoCrmService.getAccessToken();

      if (!accessToken) {
        console.warn('⚠️ [Zoho CRM Saathi] No OAuth access token available. Falling back to web-to-lead if configured.');
        const webLeadSuccess = await ZohoCrmService.createLead({
          formType: 'saathi',
          firstName: data.firstName,
          lastName: data.lastName || data.firstName || 'Volunteer',
          email: data.email || '',
          phone: data.phone,
          pincode: data.pincode,
          description: `Saathi Volunteer Application | City: ${data.city}, State: ${data.state} | Area: ${data.area || 'N/A'}\nWhy Join: ${data.whyJoin || 'N/A'}`,
          company: 'Saathi Volunteer Lead',
        });
        return { success: webLeadSuccess, error: 'OAuth credentials not configured' };
      }

      const { apiDomain } = config.zohoOAuth;
      const targetUrl = `${apiDomain}/crm/v8/Saathi_Network_Volunteers`;

      const formattedDob = formatToZohoDate(data.dob);
      const interestList = Array.isArray(data.interests)
        ? data.interests
        : data.interests
          ? [data.interests]
          : [];
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.firstName || 'Saathi Volunteer';
      const cleanPhone = String(data.phone || '').replace(/\D/g, '').slice(-10);

      // Map fields strictly to confirmed Zoho CRM Saathi_Network_Volunteers custom module fields
      const recordPayload: Record<string, any> = {
        // Primary identification
        Name: fullName,
        First_Name: data.firstName || undefined,
        Last_Name: data.lastName || data.firstName || 'Volunteer',

        // Contact info
        Email: data.email || undefined,
        Phone: cleanPhone || data.phone,

        // Demographics
        Gender: data.gender || undefined,
        Date_of_Birth: formattedDob,

        // Address & Geography
        Pincode: data.pincode || undefined,
        Area_Sector: data.area || undefined,
        City: data.city,
        State: data.state,

        // Volunteer interests (multi-select picklist)
        Interests: interestList.length > 0 ? interestList : undefined,

        // Comprehensive summary description including whyJoin & additional context
        Description: [
          `Saathi Volunteer Enrollment Application`,
          `Applicant: ${fullName}`,
          `Mobile: ${data.phone}`,
          `Email: ${data.email || 'N/A'}`,
          `Area / Sector: ${data.area || 'N/A'}`,
          `City: ${data.city}, State: ${data.state}, Pincode: ${data.pincode || 'N/A'}`,
          data.dob ? `DOB: ${data.dob}${data.age ? ` (${data.age} yrs)` : ''}` : (data.age ? `Age: ${data.age} yrs` : null),
          interestList.length > 0 ? `Interests: ${interestList.join(', ')}` : null,
          data.whyJoin ? `Why Join: ${data.whyJoin}` : null,
          (data.latitude && data.longitude) ? `GPS Coordinates: ${data.latitude}, ${data.longitude}` : null,
        ].filter(Boolean).join('\n'),
      };

      // Strip undefined keys from payload
      Object.keys(recordPayload).forEach((key) => {
        if (recordPayload[key] === undefined) {
          delete recordPayload[key];
        }
      });

      console.log(`📤 [Zoho CRM Saathi] Posting to ${targetUrl} for applicant "${fullName}" (${cleanPhone})`);

      let response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [recordPayload],
          trigger: ['approval', 'workflow', 'blueprint'],
        }),
      });

      // If v8 endpoint returns 404, fallback to v3 endpoint
      if (response.status === 404) {
        const fallbackUrl = `${apiDomain}/crm/v3/Saathi_Network_Volunteers`;
        console.warn(`⚠️ [Zoho CRM Saathi] v8 endpoint returned 404, trying fallback ${fallbackUrl}...`);
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: [recordPayload],
            trigger: ['approval', 'workflow', 'blueprint'],
          }),
        });
      }

      const responseBody = await response.text();
      let responseJson: any;
      try {
        responseJson = JSON.parse(responseBody);
      } catch {
        responseJson = null;
      }

      if (!response.ok) {
        console.error(`❌ [Zoho CRM Saathi] API request failed (HTTP ${response.status}):`, responseBody);
        return {
          success: false,
          error: `HTTP ${response.status}: ${responseBody}`,
        };
      }

      const result = responseJson?.data?.[0];
      if (result?.status === 'success' || result?.code === 'SUCCESS') {
        const recordId = result?.details?.id;
        console.log(`✅ [Zoho CRM Saathi] Successfully created record in Saathi_Network_Volunteers (ID: ${recordId}) for ${fullName}`);
        return {
          success: true,
          recordId: recordId ? String(recordId) : undefined,
        };
      } else {
        console.warn(`⚠️ [Zoho CRM Saathi] API responded with non-success status:`, responseJson || responseBody);
        return {
          success: false,
          error: result?.message || responseBody,
        };
      }
    } catch (err: any) {
      console.error('❌ [Zoho CRM Saathi] Exception during pushSaathiToZohoCRM:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Searches Zoho CRM Leads by phone or mobile number using Zoho CRM v3 REST API.
   * @param phone 10-digit phone number or normalized mobile
   * @returns Lead ID string if found, null otherwise
   */
  public static async findLeadByPhone(phone: string): Promise<string | null> {
    const accessToken = await ZohoCrmService.getAccessToken();
    if (!accessToken) return null;

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const { apiDomain } = config.zohoOAuth;

    try {
      // 1. Direct phone search
      const searchUrl = `${apiDomain}/crm/v3/Leads/search?phone=${encodeURIComponent(cleanPhone)}`;
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      });

      if (response.status === 200) {
        const json: any = await response.json();
        const lead = json?.data?.[0];
        if (lead?.id) return String(lead.id);
      }

      // 2. Criteria search fallback (matches Phone or Mobile containing clean 10 digits)
      const criteria = `((Phone:equals:${cleanPhone})or(Mobile:equals:${cleanPhone})or(Phone:equals:91${cleanPhone})or(Mobile:equals:91${cleanPhone}))`;
      const criteriaUrl = `${apiDomain}/crm/v3/Leads/search?criteria=${encodeURIComponent(criteria)}`;
      const criteriaRes = await fetch(criteriaUrl, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      });

      if (criteriaRes.status === 200) {
        const json: any = await response.json();
        const lead = json?.data?.[0];
        if (lead?.id) return String(lead.id);
      }

      return null;
    } catch (err: any) {
      console.error('❌ [Zoho CRM API] Error searching Lead by phone:', err.message);
      return null;
    }
  }

  /**
   * Creates a Lead in Zoho CRM via REST API v3.
   * @returns Newly created lead ID string, or null on failure.
   */
  public static async createLeadViaApi(leadData: ZohoLeadData): Promise<string | null> {
    const accessToken = await ZohoCrmService.getAccessToken();
    if (!accessToken) return null;

    const { apiDomain } = config.zohoOAuth;

    try {
      const payload = {
        data: [
          {
            First_Name: leadData.firstName || undefined,
            Last_Name: leadData.lastName || 'WhatsApp User',
            Phone: leadData.phone,
            Mobile: leadData.phone,
            Email: leadData.email || undefined,
            Lead_Source: leadData.leadSource || 'Chat',
            Description: leadData.description || 'WhatsApp Inbound Message',
          },
        ],
      };

      const response = await fetch(`${apiDomain}/crm/v3/Leads`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json: any = await response.json();
      const createdRecord = json?.data?.[0]?.details;
      if (createdRecord?.id) {
        console.log(`✅ [Zoho CRM API] Created Lead ${createdRecord.id} for phone ${leadData.phone}`);
        return String(createdRecord.id);
      }

      console.warn('⚠️ [Zoho CRM API] Failed to create Lead via REST API:', json);
      return null;
    } catch (err: any) {
      console.error('❌ [Zoho CRM API] Exception creating Lead via API:', err.message);
      return null;
    }
  }

  /**
   * Attaches a Note directly to a Lead record using Zoho CRM REST API v3:
   * POST /crm/v3/Leads/{leadId}/Notes (and fallback POST /crm/v3/Notes).
   * @param leadId Zoho CRM Lead ID
   * @param noteTitle Title of the note
   * @param noteContent Content/body of the note
   * @returns true if note was added successfully
   */
  public static async addNoteToLead(leadId: string, noteTitle: string, noteContent: string): Promise<boolean> {
    const accessToken = await ZohoCrmService.getAccessToken();
    if (!accessToken) {
      console.warn('⚠️ [Zoho CRM Notes] Missing OAuth access token. Cannot call POST /crm/v3/Leads/{leadId}/Notes.');
      return false;
    }

    const { apiDomain } = config.zohoOAuth;

    try {
      // 1. Primary endpoint: POST /crm/v3/Leads/{leadId}/Notes
      const primaryUrl = `${apiDomain}/crm/v3/Leads/${leadId}/Notes`;
      const primaryPayload = {
        data: [
          {
            Note_Title: noteTitle,
            Note_Content: noteContent,
          },
        ],
      };

      let response = await fetch(primaryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(primaryPayload),
      });

      if (response.ok) {
        const json: any = await response.json();
        console.log(`✅ [Zoho CRM Notes] Note added to Lead ${leadId} via POST /crm/v3/Leads/{id}/Notes:`, json?.data?.[0]?.message || 'SUCCESS');
        return true;
      }

      // 2. Fallback endpoint: POST /crm/v3/Notes with Parent_Id
      const fallbackUrl = `${apiDomain}/crm/v3/Notes`;
      const fallbackPayload = {
        data: [
          {
            Note_Title: noteTitle,
            Note_Content: noteContent,
            Parent_Id: { id: leadId },
            se_module: 'Leads',
          },
        ],
      };

      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      });

      if (response.ok) {
        const json: any = await response.json();
        console.log(`✅ [Zoho CRM Notes] Note added to Lead ${leadId} via fallback POST /crm/v3/Notes:`, json?.data?.[0]?.message || 'SUCCESS');
        return true;
      }

      const errText = await response.text();
      console.error(`❌ [Zoho CRM Notes] Failed to add Note to Lead ${leadId} (HTTP ${response.status}):`, errText);
      return false;
    } catch (err: any) {
      console.error(`❌ [Zoho CRM Notes] Exception adding note to Lead ${leadId}:`, err.message);
      return false;
    }
  }

  /**
   * Orchestrates synchronization of an inbound WhatsApp user message to Zoho CRM:
   * 1. Finds existing Lead by phone or creates a new Lead.
   * 2. Automatically posts the inbound WhatsApp message text to that Lead's Notes section (POST /crm/v3/Leads/{leadId}/Notes).
   * 3. Falls back gracefully to WebToLeadForm with Description if OAuth is not configured.
   */
  public static async syncInboundWhatsAppMessage(params: {
    senderPhone: string;
    senderName?: string;
    messageText: string;
    timestamp?: string | number;
  }): Promise<{ success: boolean; leadId?: string; noteCreated: boolean }> {
    const { senderPhone, senderName, messageText, timestamp } = params;
    const cleanPhone = String(senderPhone || '').replace(/\D/g, '').slice(-10);

    if (!cleanPhone || cleanPhone.length !== 10) {
      console.warn('⚠️ [Zoho CRM Sync] Inbound message missing valid 10-digit senderPhone. Skipped.');
      return { success: false, noteCreated: false };
    }

    if (!messageText || !messageText.trim()) {
      console.log('ℹ️ [Zoho CRM Sync] Inbound WhatsApp event has no text message content. Skipped note creation.');
      return { success: true, noteCreated: false };
    }

    const formattedTime = timestamp ? new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const displayName = senderName?.trim() || `WhatsApp User (+91 ${cleanPhone})`;
    const noteTitle = `WhatsApp Message: ${displayName}`;
    const noteContent = `Received via WhatsApp at ${formattedTime}:\n\n"${messageText.trim()}"\n\nSender: ${displayName}\nMobile: +91 ${cleanPhone}`;

    // ── Flow A: Full Zoho CRM REST API v3 (Search / Create Lead + Post Note) ────
    const accessToken = await ZohoCrmService.getAccessToken();

    if (accessToken) {
      let leadId = await ZohoCrmService.findLeadByPhone(cleanPhone);

      if (!leadId) {
        console.log(`ℹ️ [Zoho CRM Sync] Lead not found for phone ${cleanPhone}. Creating new Lead via REST API...`);
        leadId = await ZohoCrmService.createLeadViaApi({
          lastName: displayName,
          phone: cleanPhone,
          email: '',
          leadSource: 'Chat',
          description: messageText.trim(),
        });
      }

      if (leadId) {
        const noteCreated = await ZohoCrmService.addNoteToLead(leadId, noteTitle, noteContent);
        return { success: true, leadId, noteCreated };
      }
    } else {
      console.warn(
        '⚠️ [Zoho CRM Sync] Zoho OAuth credentials (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN) not configured in environment. ' +
        'Falling back to WebToLeadForm. To enable direct POST /crm/v3/Leads/{leadId}/Notes, configure Zoho OAuth in .env.'
      );
    }

    // ── Flow B: Fallback via WebToLeadForm (Creates/Updates Lead with Description) ──
    const webLeadSuccess = await ZohoCrmService.createLead({
      lastName: displayName,
      phone: cleanPhone,
      email: '',
      leadSource: 'Chat',
      description: `[WhatsApp ${formattedTime}] ${messageText.trim()}`,
    });

    return {
      success: webLeadSuccess,
      noteCreated: false,
    };
  }
}
