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
  private static readonly ZOHO_WEB_FORM_URL = 'https://crm.zoho.in/crm/WebForm';

  /**
   * Submit a lead or entity directly to Zoho CRM endpoint with dedicated formType credentials.
   * Handles both standard Leads (WebToLeadForm) and Custom Modules like Partner Registration (WebForm).
   * @param leadData The lead details including optional formType
   * @returns true if successful, false otherwise
   */
  public static async createLead(leadData: ZohoLeadData): Promise<boolean> {
    try {
      const formType = leadData.formType || 'default';

      // Resolve form-specific credentials with fallback to default
      const credentials = (config.zohoCrm as any)[formType] || config.zohoCrm;

      const xnQsjsdp = credentials?.xnQsjsdp || config.zohoCrm.xnQsjsdp;
      const xmIwtLD = credentials?.xmIwtLD || config.zohoCrm.xmIwtLD;
      const actionType = credentials?.actionType || config.zohoCrm.actionType || 'TGVhZHM=';
      const returnURL = credentials?.returnURL || config.zohoCrm.returnURL || 'null';

      if (!xnQsjsdp || !xmIwtLD) {
        console.warn(`⚠️ [Zoho CRM] Missing Zoho credentials for formType="${formType}". Lead sync skipped.`);
        return false;
      }

      // Check if target is a Custom Module (e.g. Q3VzdG9tTW9kdWxlMw== for Partner Registration)
      const isCustomModule = actionType === 'Q3VzdG9tTW9kdWxlMw==' || formType === 'partner';
      const targetUrl = isCustomModule ? ZohoCrmService.ZOHO_WEB_FORM_URL : ZohoCrmService.ZOHO_WEB_TO_LEAD_URL;

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
        formData.append('Zip Code', leadData.pincode);
      }

      if (leadData.description) {
        formData.append('Description', leadData.description);
      }

      // Specific field mapping for CustomModule3 (Partner Registration)
      if (isCustomModule) {
        formData.append('NAME', company);
        formData.append('COBJ3CF1', `${leadData.firstName || ''} ${leadData.lastName}`.trim());
        formData.append('COBJ3CF2', leadData.phone);
        formData.append('COBJ3CF3', leadData.customFields?.state || '');
        formData.append('COBJ3CF4', leadData.customFields?.city || '');
        formData.append('COBJ3CF5', leadData.customFields?.category || '-None-');
        formData.append('COBJ3CF7', leadData.description || '');
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
          if (!formData.has(key)) {
            formData.append(key, value);
          }
        }
      }

      // Honeypot field (should be empty)
      formData.append('aG9uZXlwb3Q', '');

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        console.error(`❌ [Zoho CRM] Failed to submit for [${formType}] to ${targetUrl}. Status: ${response.status}`);
        return false;
      }

      const responseText = await response.text();
      console.log(`✅ [Zoho CRM] Successfully created record for [${formType}] (${leadData.email || leadData.phone}) in ${isCustomModule ? 'Partner Registration' : 'Leads'}. Snippet: ${responseText.slice(0, 100)}`);
      return true;

    } catch (error: any) {
      console.error('❌ [Zoho CRM] Exception while submitting lead:', error.message);
      return false;
    }
  }
}
