import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();
const MINIMUM_LEGACY_AGE = 60;

// Helper to calculate exact age from dateOfBirth or age field
function resolveAge(age?: number | null, dob?: Date | string | null, fallbackAge?: number | null): number {
    if (dob && (dob instanceof Date || (typeof dob === 'string' && isNaN(Number(dob))))) {
        const birthDate = new Date(dob);
        if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--;
            }
            if (calculatedAge > 0 && calculatedAge < 150) return calculatedAge;
        }
    }
    if (typeof age === 'number' && age > 0) return age;
    if (typeof fallbackAge === 'number' && fallbackAge > 0) return fallbackAge;
    const parsedAge = parseInt(String(age || fallbackAge || 0), 10);
    return isNaN(parsedAge) ? 0 : parsedAge;
}

// ─── GET /api/beneficiary/legacy-circle/members ──────────────────────────────
// Returns all approved and active legacy circle members for the mobile directory
router.get('/members', authenticate, async (_req: AuthRequest, res: Response) => {
    try {
        const profiles = await prisma.legacyCircleProfile.findMany({
            where: { status: 'approved', isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
                beneficiary: {
                    select: {
                        id: true,
                        name: true,
                        photo: true,
                        city: true,
                        state: true,
                        age: true,
                        gender: true,
                    }
                }
            }
        });

        const members = await Promise.all(
            profiles.map(async (p) => {
                const b = p.beneficiary;
                const photoUrl = b.photo ? await resolveFileUrl(b.photo) : null;
                const expNum = parseInt(String(p.yearsOfExperience || '').replace(/\D/g, ''), 10) || 0;
                return {
                    id: p.id,
                    beneficiaryId: b.id,
                    name: b.name || p.title,
                    role: p.title,
                    headline: p.headline,
                    industry: p.industry,
                    yearsOfExperience: expNum || p.yearsOfExperience,
                    city: b.city,
                    state: b.state,
                    age: b.age,
                    photo: photoUrl,
                    email: p.email,
                    connectRequests: p.connectRequests,
                };
            })
        );

        res.json({
            success: true,
            data: members
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get the current user's legacy circle profile
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        
        // Find the beneficiary linked to this user
        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { userId },
                    { id: userId }
                ]
            },
            include: { legacyCircleProfile: true, user: true }
        });

        if (!beneficiary) {
            // Also check if User exists directly
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const userAge = resolveAge(user?.age, user?.dateOfBirth);
            return res.json({
                success: true,
                data: null,
                isEligible: userAge >= MINIMUM_LEGACY_AGE,
                age: userAge,
                minimumAge: MINIMUM_LEGACY_AGE,
            });
        }

        const userAge = resolveAge(
            beneficiary.age,
            beneficiary.dateOfBirth || beneficiary.user?.dateOfBirth,
            beneficiary.user?.age
        );
        const isEligible = userAge >= MINIMUM_LEGACY_AGE;

        res.json({
            success: true,
            data: beneficiary.legacyCircleProfile || null,
            isEligible,
            age: userAge,
            minimumAge: MINIMUM_LEGACY_AGE,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create a new legacy circle profile
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { title, yearsOfExperience, headline, industry, email, agreedToTerms } = req.body;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { userId },
                    { id: userId }
                ]
            },
            include: { user: true }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        }

        const userAge = resolveAge(
            beneficiary.age,
            beneficiary.dateOfBirth || beneficiary.user?.dateOfBirth,
            beneficiary.user?.age
        );

        if (userAge < MINIMUM_LEGACY_AGE) {
            return res.status(403).json({
                success: false,
                message: `Legacy Circle enrollment is exclusively available for seniors aged ${MINIMUM_LEGACY_AGE} and above.`
            });
        }

        const existingProfile = await prisma.legacyCircleProfile.findUnique({
            where: { beneficiaryId: beneficiary.id }
        });

        if (existingProfile) {
            return res.status(400).json({ success: false, message: 'Profile already exists' });
        }

        const newProfile = await prisma.legacyCircleProfile.create({
            data: {
                beneficiaryId: beneficiary.id,
                title,
                yearsOfExperience: String(yearsOfExperience),
                headline,
                industry,
                email,
                agreedToTerms,
                status: 'pending'
            }
        });

        res.status(201).json({
            success: true,
            data: newProfile
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update legacy circle profile
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const { title, yearsOfExperience, headline, industry, email } = req.body;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { userId },
                    { id: userId }
                ]
            },
            include: { user: true }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        }

        const userAge = resolveAge(
            beneficiary.age,
            beneficiary.dateOfBirth || beneficiary.user?.dateOfBirth,
            beneficiary.user?.age
        );

        if (userAge < MINIMUM_LEGACY_AGE) {
            return res.status(403).json({
                success: false,
                message: `Legacy Circle is exclusively available for seniors aged ${MINIMUM_LEGACY_AGE} and above.`
            });
        }

        const existingProfile = await prisma.legacyCircleProfile.findUnique({
            where: { beneficiaryId: beneficiary.id }
        });

        if (!existingProfile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const updatedProfile = await prisma.legacyCircleProfile.update({
            where: { beneficiaryId: beneficiary.id },
            data: {
                title,
                yearsOfExperience: String(yearsOfExperience),
                headline,
                industry,
                email,
                status: existingProfile.status
            }
        });

        res.json({
            success: true,
            data: updatedProfile
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Toggle legacy circle profile active status
router.patch('/active', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: { userId }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        }

        const existingProfile = await prisma.legacyCircleProfile.findUnique({
            where: { beneficiaryId: beneficiary.id }
        });

        if (!existingProfile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        if (existingProfile.status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Your profile has been suspended by the admin and cannot be reactivated.' });
        }

        const updatedProfile = await prisma.legacyCircleProfile.update({
            where: { beneficiaryId: beneficiary.id },
            data: {
                isActive: !existingProfile.isActive
            }
        });

        res.json({
            success: true,
            data: updatedProfile
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
