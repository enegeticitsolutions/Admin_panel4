import { Router, Response } from 'express';
import prisma from '../../core/database';
import { authenticate, AuthRequest } from '../shared/deps';
import { UserAccountService } from '../../services/shared/user_account.service';
import { resolveFileUrl } from '../../services/storage/urlResolver';

const router = Router();
const userAccountService = UserAccountService.getInstance();

// Fetch beneficiary profile information
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: userId },
                    { userId: userId }
                ]
            },
            include: {
                user: true,
                conditions: {
                    include: {
                        condition: true
                    }
                },
                emergencyContacts: true
            }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        const rawPhoto = beneficiary.photo || beneficiary.user?.profilePhoto;
        const resolvedPhoto = rawPhoto ? await resolveFileUrl(rawPhoto) : null;

        res.json({
            success: true,
            data: {
                ...beneficiary,
                photo: resolvedPhoto,
                profilePhoto: resolvedPhoto,
                user: beneficiary.user ? {
                    ...beneficiary.user,
                    profilePhoto: resolvedPhoto,
                } : undefined,
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update profile contact information
router.post('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const { name, phone, email, address, age, gender, latitude, longitude, city, state, pincode } = req.body;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: userId },
                    { userId: userId }
                ]
            }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        // Update User account if details provided
        if (phone || email || name) {
            await prisma.user.update({
                where: { id: beneficiary.userId },
                data: {
                    ...(phone && { phone }),
                    ...(email && { email }),
                    ...(name && { name })
                }
            });
        }

        // Update Beneficiary table
        const updatedBeneficiary = await prisma.beneficiary.update({
            where: { id: beneficiary.id },
            data: {
                ...(name && { name }),
                ...(address && { address }),
                ...(age && { age: parseInt(age, 10) }),
                ...(gender && { gender }),
                ...(latitude && { latitude: parseFloat(latitude) }),
                ...(longitude && { longitude: parseFloat(longitude) }),
                ...(city && { city }),
                ...(state && { state }),
                ...(pincode && { pincode }),
            }
        });

        res.json({ success: true, data: updatedBeneficiary });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Health Information (Blood group, allergies, conditions)
router.post('/health-info', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const { bloodGroup, allergies, conditions } = req.body;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: userId },
                    { userId: userId }
                ]
            }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        // Update bloodGroup and allergies arrays
        await prisma.beneficiary.update({
            where: { id: beneficiary.id },
            data: {
                ...(bloodGroup && { bloodGroup }),
                ...(allergies && { allergies })
            }
        });

        // Sync conditions if provided
        // NOTE: Chronic Conditions represent the core "Medical Information" entity for the Beneficiary.
        // They are linked via the BeneficiaryCondition junction table to the MedicalCondition catalog.
        if (conditions && Array.isArray(conditions)) {
            // Delete existing relations
            await prisma.beneficiaryCondition.deleteMany({
                where: { beneficiaryId: beneficiary.id }
            });

            // Create new relations
            for (const condName of conditions) {
                // Find or create medical condition dynamically so that it works seamlessly without failing!
                let medCondition = await prisma.medicalCondition.findFirst({
                    where: { name: { equals: condName, mode: 'insensitive' } }
                });

                if (!medCondition) {
                    const slug = condName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                    medCondition = await prisma.medicalCondition.create({
                        data: {
                            name: condName,
                            slug: `${slug}-${Date.now()}`,
                            category: 'chronic',
                            description: `Chronic condition: ${condName}`
                        }
                    });
                }

                await prisma.beneficiaryCondition.create({
                    data: {
                        beneficiaryId: beneficiary.id,
                        conditionId: medCondition.id,
                        severity: 'moderate',
                        isActive: true
                    }
                }).catch(e => console.error("Error creating beneficiary condition link:", e));
            }
        }

        res.json({ success: true, message: 'Health information updated successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Sync/Save emergency contacts
router.post('/emergency-contacts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const { contacts } = req.body;

        const beneficiary = await prisma.beneficiary.findFirst({
            where: {
                OR: [
                    { id: userId },
                    { userId: userId }
                ]
            }
        });

        if (!beneficiary) {
            return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
        }

        if (contacts && Array.isArray(contacts)) {
            // Remove existing emergency contacts
            await prisma.emergencyContact.deleteMany({
                where: { beneficiaryId: beneficiary.id }
            });

            // Insert new ones
            for (const c of contacts) {
                await prisma.emergencyContact.create({
                    data: {
                        beneficiaryId: beneficiary.id,
                        name: c.name,
                        phone: c.phone,
                        email: c.email || null,
                        relationship: c.relationship,
                        isPrimary: !!c.isPrimary,
                        notifyOnEmergency: true
                    }
                });
            }
        }

        res.json({ success: true, message: 'Emergency contacts synced successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete beneficiary user account
router.delete('/account', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId as string;
        const result = await userAccountService.deleteAccount(userId);
        res.json(result);
    } catch (error: any) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
});

export default router;
