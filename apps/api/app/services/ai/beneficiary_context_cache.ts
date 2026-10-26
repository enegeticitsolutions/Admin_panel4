import prisma from '../../core/database';
import { getRedisClient } from '@maihoonna/notifications';
import { config } from '../../core/config';

export interface CachedBeneficiarySoapContext {
  beneficiaryId: string;
  name: string;
  age: number | null;
  gender: string | null;
  segment: string;
  knownConditions: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  mobilityStatus: string | null;
  cognitiveStatus: string | null;
  cachedAt: string;
}

const CACHE_VERSION = 'v1';
const KEY_PREFIX = 'beneficiary:soap-context';

export function getBeneficiaryCacheKey(beneficiaryId: string): string {
  return `${KEY_PREFIX}:${beneficiaryId}:${CACHE_VERSION}`;
}

/**
 * Retrieve relatively stable beneficiary medical baseline context with Redis caching.
 * Gracefully falls back to direct database queries if Redis is unavailable or disconnected.
 */
export async function getOrFetchBeneficiarySoapContext(
  beneficiaryId: string
): Promise<CachedBeneficiarySoapContext> {
  const cacheKey = getBeneficiaryCacheKey(beneficiaryId);
  const ttl = config.cache?.beneficiarySoapTtlSeconds || 86400; // 24 hours default

  // 1. Attempt cache lookup from Redis
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData) as CachedBeneficiarySoapContext;
        // Verify key integrity to ensure no cross-beneficiary data leakage
        if (parsed.beneficiaryId === beneficiaryId) {
          return parsed;
        }
      }
    }
  } catch (err: any) {
    // Non-blocking fallback: never fail request due to Redis error
    console.warn(`[SoapCache] Redis read fallback to DB: ${err.message || 'Cache unreachable'}`);
  }

  // 2. Database Fetch on Cache Miss or Redis Inactivity
  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      allergies: true,
      dietaryRestrictions: true,
      mobilityStatus: true,
      cognitiveStatus: true,
      conditions: {
        where: { isActive: true },
        select: {
          condition: {
            select: { name: true },
          },
          severity: true,
          notes: true,
        },
      },
    },
  });

  if (!beneficiary) {
    throw new Error('Beneficiary not found for SOAP context extraction');
  }

  const knownConditions: string[] = [];
  if (beneficiary.mobilityStatus) {
    knownConditions.push(`Mobility: ${beneficiary.mobilityStatus}`);
  }
  if (beneficiary.cognitiveStatus) {
    knownConditions.push(`Cognitive: ${beneficiary.cognitiveStatus}`);
  }
  if (beneficiary.conditions && beneficiary.conditions.length > 0) {
    beneficiary.conditions.forEach((c) => {
      const condName = c.condition?.name;
      if (condName) {
        knownConditions.push(c.severity ? `${condName} (${c.severity})` : condName);
      }
    });
  }

  const contextData: CachedBeneficiarySoapContext = {
    beneficiaryId: beneficiary.id,
    name: beneficiary.name || 'Beneficiary',
    age: beneficiary.age || null,
    gender: beneficiary.gender || null,
    segment: 'S2, Saathi Plus',
    knownConditions,
    allergies: beneficiary.allergies || [],
    dietaryRestrictions: beneficiary.dietaryRestrictions || [],
    mobilityStatus: beneficiary.mobilityStatus || null,
    cognitiveStatus: beneficiary.cognitiveStatus || null,
    cachedAt: new Date().toISOString(),
  };

  // 3. Populate Redis Cache asynchronously (Best-effort)
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.setex(cacheKey, ttl, JSON.stringify(contextData));
    }
  } catch (err: any) {
    console.warn(`[SoapCache] Redis write skipped: ${err.message || 'Write failed'}`);
  }

  return contextData;
}

/**
 * Invalidate cached SOAP context for a beneficiary when their medical profile,
 * conditions, allergies, or vitals target baseline change.
 */
export async function invalidateBeneficiarySoapContext(beneficiaryId: string): Promise<void> {
  const cacheKey = getBeneficiaryCacheKey(beneficiaryId);
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.del(cacheKey);
      console.log(`[SoapCache] Invalidated cache for beneficiary: ${beneficiaryId}`);
    }
  } catch (err: any) {
    console.warn(`[SoapCache] Redis invalidation skipped: ${err.message || 'Delete failed'}`);
  }
}
