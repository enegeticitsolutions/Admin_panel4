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
  customFields?: Record<string, string>;
}

export class ZohoCrmService {
  private static readonly ZOHO_WEB_TO_LEAD_URL = 'https://crm.zoho.in/crm/WebToLeadForm';

  /**
   * Submit a lead directly to Zoho CRM Web-to-Lead endpoint with dedicated formType credentials.
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

      // Prepare form data using URLSearchParams
      const formData = new URLSearchParams();
      formData.append('xnQsjsdp', xnQsjsdp);
      formData.append('zc_gad', '');
      formData.append('xmIwtLD', xmIwtLD);
      formData.append('actionType', actionType);
      formData.append('returnURL', returnURL);

      // Zoho form fields matching WebToLeadForm
      if (leadData.firstName) formData.append('First Name', leadData.firstName);
      formData.append('Last Name', leadData.lastName);
      formData.append('Email', leadData.email);
      formData.append('Phone', leadData.phone);

      // Company field (fallback based on formType)
      const company = leadData.company || (
        formType === 'partner' ? 'Partner Lead' :
        formType === 'contact' ? 'Custom Care Plan Lead' :
        formType === 'saathi' ? 'Saathi Volunteer Lead' :
        'MaiHoonna Website Lead'
      );
      formData.append('Company', company);

      if (leadData.pincode) {
        formData.append('Address - Zip / Postal Code', leadData.pincode);
      }

      if (leadData.description) {
        formData.append('Description', leadData.description);
      }

      // Lead Source
      const leadSource = leadData.leadSource || (
        formType === 'contact' ? 'Web Research' :
        formType === 'partner' ? 'Website Partner Application' :
        formType === 'saathi' ? 'Website Volunteer' :
        'Website Waitlist'
      );
      formData.append('Lead Source', leadSource);

      // Additional custom fields if provided
      if (leadData.customFields) {
        for (const [key, value] of Object.entries(leadData.customFields)) {
          formData.append(key, value);
        }
      }

      // Honeypot field (should be empty)
      formData.append('aG9uZXlwb3Q', '');

      // Retry up to 3 times on transient failure
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(ZohoCrmService.ZOHO_WEB_TO_LEAD_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            body: formData.toString(),
          });

          if (response.ok) {
            const responseText = await response.text();
            console.log(`✅ [Zoho CRM] Successfully created lead for [${formType}] on attempt ${attempt} (${leadData.email || leadData.phone}). Snippet: ${responseText.slice(0, 100)}`);
            return true;
          }

          lastError = new Error(`HTTP ${response.status}`);
        } catch (fetchErr: any) {
          lastError = fetchErr;
        }

        if (attempt < 3) {
          console.warn(`⚠️ [Zoho CRM] Attempt ${attempt} failed for [${formType}] (${lastError?.message}), retrying in ${attempt}s...`);
          await new Promise(res => setTimeout(res, 1000 * attempt));
        }
      }

      console.error(`❌ [Zoho CRM] Failed to submit lead for [${formType}] after 3 attempts:`, lastError?.message);
      return false;

    } catch (error: any) {
      console.error('❌ [Zoho CRM] Exception while submitting lead:', error.message);
      return false;
    }
  }
}
