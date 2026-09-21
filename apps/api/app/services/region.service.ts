import prisma from '../core/database';

export interface ServiceableRegionDTO {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  distanceKm: number;
}

export interface ServiceabilityResponseDTO {
  isServiceable: boolean;
  available: boolean; // Backward compatibility with existing UI expectations
  location?: string;
  region?: ServiceableRegionDTO;
  stats: {
    companions: number;
    centers: number;
  };
  message: string;
}

/**
 * RegionService — Object-Oriented Service for Region & Serviceability management.
 * Encapsulates geographic distance calculations, region matching, and capacity statistics.
 */
export class RegionService {
  private static instance: RegionService;

  // Earth radius in kilometers
  private readonly EARTH_RADIUS_KM = 6371;

  public static getInstance(): RegionService {
    if (!RegionService.instance) {
      RegionService.instance = new RegionService();
    }
    return RegionService.instance;
  }

  /**
   * Calculates the great-circle distance between two points on a sphere using the Haversine formula.
   */
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  // In-memory cache for active regions (refreshes every 5 mins)
  private cachedRegions: any[] | null = null;
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  /**
   * Returns active regions from memory cache or database.
   */
  public async getActiveRegions(): Promise<any[]> {
    const now = Date.now();
    if (this.cachedRegions && now < this.cacheExpiresAt) {
      return this.cachedRegions;
    }
    const regions = await prisma.region.findMany({
      where: { isActive: true },
    });
    this.cachedRegions = regions;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return regions;
  }

  public clearCache(): void {
    this.cachedRegions = null;
    this.cacheExpiresAt = 0;
  }

  /**
   * Finds all active regions in the database that cover the given GPS coordinates.
   */
  public async findMatchingRegions(latitude: number, longitude: number): Promise<ServiceableRegionDTO[]> {
    const activeRegions = await this.getActiveRegions();

    const matchingRegions: ServiceableRegionDTO[] = [];

    for (const region of activeRegions) {
      const distanceKm = this.calculateDistance(
        latitude,
        longitude,
        region.latitude,
        region.longitude
      );

      if (distanceKm <= region.radiusKm) {
        matchingRegions.push({
          id: region.id,
          name: region.name,
          city: region.city,
          state: region.state,
          latitude: region.latitude,
          longitude: region.longitude,
          radiusKm: region.radiusKm,
          distanceKm: parseFloat(distanceKm.toFixed(2)),
        });
      }
    }

    // Sort by closest region first
    return matchingRegions.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /**
   * Checks if a location is serviceable by GPS coordinates (primary) and/or Pincode (secondary).
   */
  public async checkServiceability(
    latitude?: number,
    longitude?: number,
    pincode?: string
  ): Promise<ServiceabilityResponseDTO> {
    // 1. Primary: Check by GPS coordinates against DB Regions
    if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
      const matchingRegions = await this.findMatchingRegions(latitude, longitude);

      if (matchingRegions.length > 0) {
        const closestRegion = matchingRegions[0];

        // Fetch companion and center counts in this region / city
        const [careCompanionCount, centersCount] = await Promise.all([
          prisma.careCompanion.count({
            where: {
              isAvailable: true,
              OR: [
                { zone: { contains: closestRegion.city } },
                { zone: { contains: closestRegion.name } },
              ],
            },
          }),
          prisma.zone.count({
            where: {
              isActive: true,
              OR: [
                { regionId: closestRegion.id },
                { city: closestRegion.city },
              ],
            },
          }),
        ]);

        return {
          isServiceable: true,
          available: true,
          location: `${closestRegion.name}, ${closestRegion.city}`,
          region: closestRegion,
          stats: {
            companions: careCompanionCount,
            centers: centersCount,
          },
          message: `Great! We serve ${closestRegion.name} (${closestRegion.city}).`,
        };
      }
    }

    // 2. Secondary: Check by Pincode against active Zones if provided
    if (pincode && pincode.trim().length >= 6) {
      const cleanPincode = pincode.trim();
      const zone = await prisma.zone.findFirst({
        where: {
          pincode: cleanPincode,
          isActive: true,
        },
        include: {
          region: true,
        },
      });

      if (zone) {
        const [careCompanionCount, centersCount] = await Promise.all([
          prisma.careCompanion.count({
            where: {
              zone: zone.name,
              isAvailable: true,
            },
          }),
          prisma.zone.count({
            where: {
              city: zone.city,
              isActive: true,
            },
          }),
        ]);

        const regionDto: ServiceableRegionDTO | undefined = zone.region
          ? {
              id: zone.region.id,
              name: zone.region.name,
              city: zone.region.city,
              state: zone.region.state,
              latitude: zone.region.latitude,
              longitude: zone.region.longitude,
              radiusKm: zone.region.radiusKm,
              distanceKm: 0,
            }
          : undefined;

        return {
          isServiceable: true,
          available: true,
          location: `${zone.city}, ${zone.state}`,
          region: regionDto,
          stats: {
            companions: careCompanionCount,
            centers: centersCount,
          },
          message: `Great! We serve ${zone.city}, ${zone.state}.`,
        };
      }
    }

    // 3. Not serviceable
    return {
      isServiceable: false,
      available: false,
      stats: {
        companions: 0,
        centers: 0,
      },
      message: 'We are not serving this area yet, but we are expanding fast!',
    };
  }
}

export const regionService = RegionService.getInstance();
