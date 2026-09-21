import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';

const router = Router();

// Get the current user's legacy circle profile
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        
        // Find the beneficiary linked to this user
        const beneficiary = await prisma.beneficiary.findFirst({
            where: { userId },
            include: { legacyCircleProfile: true }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        }

        res.json({
            success: true,
            data: beneficiary.legacyCircleProfile || null
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
            where: { userId }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary not found' });
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
                yearsOfExperience,
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
