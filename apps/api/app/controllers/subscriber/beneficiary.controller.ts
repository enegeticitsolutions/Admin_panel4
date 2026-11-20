import { Request, Response } from 'express';
import * as beneficiaryService from '../../services/subscriber/beneficiary_service';
import { getStorageService } from '../../services/storage';
import prisma from '../../core/database';
import { v4 as uuidv4 } from 'uuid';
import { getProfileAccess } from '../../services/access/profile_access_service';
import { HealthSummaryService } from '../../services/shared/health_summary_service';

async function verifyBeneficiaryAccess(userId?: string, userRole?: string, beneficiaryId?: string): Promise<boolean> {
  const access = await getProfileAccess(userId, beneficiaryId, userRole);
  return access.canView;
}

async function verifyBeneficiaryWriteAccess(
  userId?: string,
  userRole?: string,
  beneficiaryId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const access = await getProfileAccess(userId, beneficiaryId, userRole);
  if (!access.hasAccess) {
    return { allowed: false, reason: 'Access denied: You do not have permission to access this Care Profile.' };
  }
  if (!access.canEdit) {
    return {
      allowed: false,
      reason: 'Access denied: You have View-Only access to this profile. Contact the profile owner or Care Manager for edit permissions.',
    };
  }
  return { allowed: true };
}

export const getBeneficiaryProfile = async (req: Request, res: Response) => {
  try {
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    // Single indexed lookup resolves BOTH view & edit permissions (replaces 2 separate auth queries)
    const access = await getProfileAccess(authReq.userId, beneficiaryId, authReq.userRole);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view this beneficiary.' });
    }
    const profile = await beneficiaryService.getBeneficiaryProfile(beneficiaryId);
    const isSelf = profile?.userId === authReq.userId || access.accessRole === 'SELF';
    const isOwnerSubscriber = profile?.subscriberId === authReq.userId;
    let resolvedRelationship: string | null = null;
    if (isSelf) {
      resolvedRelationship = 'Self';
    } else if (isOwnerSubscriber) {
      resolvedRelationship = profile?.relationship || null;
    } else {
      const memberRecord = await prisma.careCircleMember.findUnique({
        where: { beneficiaryId_userId: { beneficiaryId, userId: authReq.userId } },
        select: { relationship: true }
      });
      resolvedRelationship = memberRecord?.relationship || null;
    }

    res.json({
      success: true,
      data: {
        ...profile,
        relationship: resolvedRelationship,
        subscriberRelationship: profile?.relationship,
        accessRole: access.accessRole,
        canEditDetails: access.canEdit,
        canManageAccess: access.canManageAccess,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBeneficiary = async (req: Request, res: Response) => {
  try {
    const data = await beneficiaryService.createBeneficiary(req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getSubscriberBeneficiaries = async (req: Request, res: Response) => {
  try {
    const subscriberId = req.params.subscriberId as string;
    const authReq = req as any;
    if (authReq.userId !== subscriberId && authReq.userRole !== 'admin' && authReq.userRole !== 'super_admin' && authReq.userRole !== 'field_manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const list = await beneficiaryService.getSubscriberBeneficiaries(subscriberId);
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSathiEligibleBeneficiaries = async (req: Request, res: Response) => {
  try {
    const authReq = req as any;
    const subscriberId = authReq.userId;
    const list = await beneficiaryService.getSathiEligibleBeneficiaries(subscriberId);
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBeneficiary = async (req: Request, res: Response) => {
  try {
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    const writeCheck = await verifyBeneficiaryWriteAccess(authReq.userId, authReq.userRole, beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    const data = await beneficiaryService.updateBeneficiary(beneficiaryId, req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error(`[updateBeneficiary Error] beneficiaryId: ${req.params.beneficiaryId}:`, error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteBeneficiary = async (req: Request, res: Response) => {
  try {
    const subscriberId = (req as any).userId;
    const beneficiaryId = req.params.beneficiaryId as string;
    if (!subscriberId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await beneficiaryService.deleteBeneficiary(subscriberId, beneficiaryId);
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
export const updateMedicalRecord = async (req: Request, res: Response) => {
  try {
    const recordId = req.params.recordId as string;
    const authReq = req as any;
    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { beneficiaryId: true }
    });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }
    const writeCheck = await verifyBeneficiaryWriteAccess(authReq.userId, authReq.userRole, record.beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    const data = await beneficiaryService.updateMedicalRecord(recordId, req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteMedicalRecord = async (req: Request, res: Response) => {
  try {
    const recordId = req.params.recordId as string;
    const authReq = req as any;
    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { beneficiaryId: true }
    });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Medical record not found' });
    }
    const writeCheck = await verifyBeneficiaryWriteAccess(authReq.userId, authReq.userRole, record.beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    await beneficiaryService.deleteMedicalRecord(recordId);
    res.json({ success: true, message: 'Medical record deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const uploadMedicalRecord = async (req: Request, res: Response) => {
  try {
    const subscriberId = (req as any).userId;
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    const writeCheck = await verifyBeneficiaryWriteAccess(subscriberId, authReq.userRole, beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const storage = getStorageService();
    const ext = file.originalname.split('.').pop() || 'pdf';
    const fileKey = `medical_records/${beneficiaryId}/${Date.now()}_${uuidv4().split('-')[0]}.${ext}`;

    // Upload the file and get back the storage path
    const { path: storedKey } = await storage.upload(file.buffer, fileKey, file.mimetype);

    // Generate a presigned URL for immediate display after upload
    const fileUrl = await storage.getPresignedUrl(storedKey, 900);

    const record = await beneficiaryService.createMedicalRecord(subscriberId, beneficiaryId, {
      title: req.body.title || file.originalname,
      fileKey: storedKey,  // stored for future presigned URL generation
      fileUrl,             // short-lived URL returned to client immediately after upload
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });

    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error uploading medical record:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getBeneficiaryPendingDetails = async (req: Request, res: Response) => {
  try {
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    const hasAccess = await verifyBeneficiaryAccess(authReq.userId, authReq.userRole, beneficiaryId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to access this beneficiary details.' });
    }
    const data = await beneficiaryService.getBeneficiaryPendingDetails(beneficiaryId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addMedication = async (req: Request, res: Response) => {
  try {
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    const writeCheck = await verifyBeneficiaryWriteAccess(authReq.userId, authReq.userRole, beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    const data = await beneficiaryService.addMedication(beneficiaryId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteMedication = async (req: Request, res: Response) => {
  try {
    const medicationId = req.params.medicationId as string;
    const authReq = req as any;
    const med = await prisma.medication.findUnique({
      where: { id: medicationId },
      select: { beneficiaryId: true }
    });
    if (!med) {
      return res.status(404).json({ success: false, message: 'Medication not found' });
    }
    const writeCheck = await verifyBeneficiaryWriteAccess(authReq.userId, authReq.userRole, med.beneficiaryId);
    if (!writeCheck.allowed) {
      return res.status(403).json({ success: false, message: writeCheck.reason || 'Access denied' });
    }
    await beneficiaryService.deleteMedication(medicationId);
    res.json({ success: true, message: 'Medication removed successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getBeneficiaryHealthSummary = async (req: Request, res: Response) => {
  try {
    const beneficiaryId = req.params.beneficiaryId as string;
    const authReq = req as any;
    const access = await getProfileAccess(authReq.userId, beneficiaryId, authReq.userRole);
    if (!access.canView) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view this beneficiary.' });
    }
    const summary = await HealthSummaryService.getBeneficiaryHealthSummary(beneficiaryId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

