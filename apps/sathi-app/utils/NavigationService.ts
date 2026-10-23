/**
 * NavigationService.ts
 *
 * OOP Singleton service class for 1-tap beneficiary address navigation in Saathi App.
 *
 * Implements a Singleton pattern — import `NavigationService.instance` anywhere
 * in the app and call its methods. No instantiation needed in consumers.
 *
 * No Google Maps SDK / billing / API key required for client-side navigation.
 * Uses native OS deep-link URL schemes: geo: (Android), maps:// (iOS), and
 * Google Maps Universal URL as cross-platform fallback.
 */

import { Linking, Platform, Alert } from 'react-native';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface BeneficiaryAddress {
  /** Free-form full address string for display and fallback map queries */
  address: string;
  flatPlot?: string | null;
  streetArea?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  /** GPS latitude (preferred for navigation accuracy) */
  latitude?: number | null;
  /** GPS longitude (preferred for navigation accuracy) */
  longitude?: number | null;
  /** Display label shown in Maps (usually beneficiary name) */
  label?: string | null;
}

export interface NavigationUrlResult {
  primary: string;
  fallback: string;
}

// ─── NavigationService Class ──────────────────────────────────────────────────

export class NavigationService {
  private static _instance: NavigationService;

  /** Singleton accessor — use this instead of `new NavigationService()` */
  static get instance(): NavigationService {
    if (!NavigationService._instance) {
      NavigationService._instance = new NavigationService();
    }
    return NavigationService._instance;
  }

  // Private constructor enforces Singleton
  private constructor() {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Formats a structured beneficiary address into a clean single-line string
   * suitable for display and map search queries.
   */
  formatAddress(opts: Omit<BeneficiaryAddress, 'address' | 'label'>): string {
    const { flatPlot, streetArea, landmark, city, state, pincode } = opts;

    const parts = [flatPlot, streetArea, landmark, city]
      .map(p => p?.trim())
      .filter(Boolean);

    let address = parts.join(', ');

    if (state || pincode) {
      const statePinParts = [state, pincode].filter(Boolean);
      address = address
        ? `${address} - ${statePinParts.join(' ')}`
        : statePinParts.join(' ');
    }

    return address || 'Address not specified';
  }

  /**
   * Builds the primary and fallback navigation URLs for a given destination.
   * Uses GPS coordinates when available; falls back to address text.
   */
  buildNavigationUrls(opts: BeneficiaryAddress): NavigationUrlResult {
    const { address, latitude, longitude, label } = opts;
    const hasCoords = latitude != null && longitude != null && !isNaN(Number(latitude)) && !isNaN(Number(longitude));
    const targetAddress = address?.trim() || 'Address not specified';
    const encodedAddress = encodeURIComponent(targetAddress);
    const encodedLabel = encodeURIComponent(label || targetAddress);

    if (hasCoords) {
      const lat = Number(latitude);
      const lng = Number(longitude);

      const primary =
        Platform.OS === 'android'
          ? `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`
          : `maps://?q=${encodedLabel}&ll=${lat},${lng}`;

      const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

      return { primary, fallback };
    }

    // Address-only fallback
    return {
      primary: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`,
      fallback: `https://maps.google.com/?q=${encodedAddress}`,
    };
  }

  /**
   * Opens Google Maps (or Apple Maps on iOS) with turn-by-turn navigation
   * to the given beneficiary address.
   *
   * @example
   * await NavigationService.instance.navigate({
   *   address: "Flat 502, Tower B, Gaur City, Noida",
   *   latitude: 28.5355,
   *   longitude: 77.3910,
   *   label: "Sourav Kapoor",
   * });
   */
  async navigate(opts: BeneficiaryAddress): Promise<void> {
    const destinationAddress = opts.address?.trim() || this.formatAddress(opts);
    const resolvedOpts = { ...opts, address: destinationAddress };
    const { primary, fallback } = this.buildNavigationUrls(resolvedOpts);

    try {
      const canOpen = await Linking.canOpenURL(primary);
      await Linking.openURL(canOpen ? primary : fallback);
    } catch {
      try {
        await Linking.openURL(fallback);
      } catch {
        Alert.alert(
          'Navigation Unavailable',
          `Unable to open Maps. Please navigate manually to:\n\n${destinationAddress}`,
          [{ text: 'OK' }],
        );
      }
    }
  }

  /**
   * Convenience method — navigate using a structured BeneficiaryAddress object
   * where `address` may be auto-formatted from structured fields if missing.
   */
  async navigateToBeneficiary(opts: Omit<BeneficiaryAddress, 'address'> & { address?: string }): Promise<void> {
    const formattedAddress =
      opts.address ||
      this.formatAddress({
        flatPlot: opts.flatPlot,
        streetArea: opts.streetArea,
        landmark: opts.landmark,
        city: opts.city,
        state: opts.state,
        pincode: opts.pincode,
      });

    await this.navigate({ ...opts, address: formattedAddress });
  }
}

// ─── Convenience Function-Style Re-exports ───────────────────────────────────

export function formatBeneficiaryAddress(
  opts: Omit<BeneficiaryAddress, 'address' | 'label'>,
): string {
  return NavigationService.instance.formatAddress(opts);
}

export async function openMapsNavigation(opts: BeneficiaryAddress): Promise<void> {
  return NavigationService.instance.navigate(opts);
}
