/**
 * PartnerService - Service Model for Healthcare & Eldercare Partner Applications
 */
import { API_BASE } from './api';

export class PartnerService {
  constructor() {
    this.apiBaseUrl = API_BASE;
  }

  /**
   * Validate partner form fields
   */
  validate(formData) {
    if (!formData.organizationName?.trim()) {
      return { isValid: false, error: 'Organization / Brand name is required.' };
    }
    if (!formData.category?.trim()) {
      return { isValid: false, error: 'Please select a partner category.' };
    }
    if (!formData.contactName?.trim()) {
      return { isValid: false, error: 'Contact person name is required.' };
    }
    if (!formData.phone?.trim()) {
      return { isValid: false, error: 'Mobile / WhatsApp number is required.' };
    }
    if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return { isValid: false, error: 'Please enter a valid email address.' };
    }
    if (!formData.operatingCity?.trim()) {
      return { isValid: false, error: 'Operating city / area is required.' };
    }
    return { isValid: true, error: null };
  }

  /**
   * Submit partner application data to backend
   */
  async submitApplication(formData) {
    const validation = this.validate(formData);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const payload = {
      organizationName: formData.organizationName.trim(),
      category: formData.category.trim(),
      contactName: formData.contactName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      operatingCity: formData.operatingCity.trim(),
      serviceDetails: formData.serviceDetails ? formData.serviceDetails.trim() : '',
    };

    const response = await fetch(`${this.apiBaseUrl}/website/partner-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Something went wrong. Please try again.');
    }

    return data;
  }

  /**
   * Fetch approved and published partners & categories for public website display
   */
  async getPublishedPartners() {
    const urls = [
      `${this.apiBaseUrl}/website/partners`,
      '/api/website/partners',
      '/api/partners/public',
      '/admin-api/api/partners/public',
    ];

    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      urls.push('http://localhost:3001/api/partners/public', 'http://127.0.0.1:3001/api/partners/public');
    }

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && data.success && data.data) {
            return data.data;
          }
        }
      } catch (err) {}
    }

    return { categories: [], partners: [] };
  }
}

export default new PartnerService();



