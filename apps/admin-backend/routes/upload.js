const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const storageService = require('../services/storage');
const { generateDocumentPath, generateProfilePath } = require('../utils/fileHelper');
const { prisma } = require('../lib/prisma');

/**
 * POST /api/upload-document
 * Upload a staff document (Aadhaar, PAN, etc.)
 * Body: staffProfileId, documentType, file
 */
router.post('/', upload.single('file'), async (req, res) => {
  const { staffProfileId, documentType } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (!staffProfileId || !documentType) {
    return res.status(400).json({
      success: false,
      message: 'staffProfileId and documentType are required fields',
    });
  }

  try {
    const fileKey = generateDocumentPath(staffProfileId, documentType, file.originalname);
    const { url: fileUrl } = await storageService.upload(file.buffer, fileKey, file.mimetype);

    const documentRecord = await prisma.staffDocument.upsert({
      where: {
        staffProfileId_documentType: {
          staffProfileId: staffProfileId,
          documentType: documentType,
        },
      },
      update: {
        fileName: file.originalname,
        fileKey: fileKey,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        updatedAt: new Date(),
      },
      create: {
        staffProfileId: staffProfileId,
        documentType: documentType,
        fileName: file.originalname,
        fileKey: fileKey,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        isRequired: true,
      },
    });

    res.status(200).json({ success: true, data: documentRecord });
  } catch (error) {
    console.error('File upload flow failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during file upload',
    });
  }
});

/**
 * POST /api/upload-document/profile-photo
 *
 * Upload or update a profile photo for ANY entity type.
 *
 * Supported targetType values:
 *   - 'subscriber'         → updates User.profilePhoto
 *   - 'care_companion'     → updates CareCompanion.photo
 *   - 'field_manager'      → updates FieldManager.photo
 *   - 'operations_manager' → updates OperationsManager.photo
 *   - 'beneficiary'        → updates Beneficiary.photo
 *
 * Body (multipart/form-data):
 *   - targetId   : string  — the ID of the entity (userId for staff/subscriber, beneficiaryId for beneficiary)
 *   - targetType : string  — one of the values above
 *   - file       : File    — the image file
 */
router.post('/profile-photo', upload.single('file'), async (req, res) => {
  const { targetId, targetType } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (!targetId || !targetType) {
    return res.status(400).json({ success: false, message: 'targetId and targetType are required' });
  }

  const VALID_TYPES = ['subscriber', 'care_companion', 'field_manager', 'operations_manager', 'beneficiary'];
  if (!VALID_TYPES.includes(targetType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid targetType. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  try {
    // Generate a unique file path in storage
    const fileKey = generateProfilePath(targetId, targetType, file.originalname);
    const { url: fileUrl } = await storageService.upload(file.buffer, fileKey, file.mimetype);

    let updatedRecord = null;

    switch (targetType) {
      case 'subscriber': {
        // Subscriber is a User — update User.profilePhoto
        updatedRecord = await prisma.user.update({
          where: { id: targetId },
          data: { profilePhoto: fileUrl },
          select: { id: true, name: true, profilePhoto: true },
        });
        break;
      }

      case 'care_companion': {
        // targetId can be either userId or careCompanionId
        // Try by userId first (most common from mobile), then by CC id
        const user = await prisma.user.findUnique({
          where: { id: targetId },
          include: { careCompanionProfile: true },
        });

        if (user?.careCompanionProfile) {
          // Update both User and CC profile
          await prisma.user.update({
            where: { id: user.id },
            data: { profilePhoto: fileUrl },
          });
          updatedRecord = await prisma.careCompanion.update({
            where: { id: user.careCompanionProfile.id },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        } else {
          // targetId might be the CareCompanion.id directly (admin panel usage)
          const cc = await prisma.careCompanion.findUnique({
            where: { id: targetId },
            select: { userId: true },
          });
          if (cc) {
            await prisma.user.update({
              where: { id: cc.userId },
              data: { profilePhoto: fileUrl },
            });
          }
          updatedRecord = await prisma.careCompanion.update({
            where: { id: targetId },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        }
        break;
      }

      case 'field_manager': {
        const user = await prisma.user.findUnique({
          where: { id: targetId },
          include: { fieldManagerProfile: true },
        });

        if (user?.fieldManagerProfile) {
          await prisma.user.update({
            where: { id: user.id },
            data: { profilePhoto: fileUrl },
          });
          updatedRecord = await prisma.fieldManager.update({
            where: { id: user.fieldManagerProfile.id },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        } else {
          const fm = await prisma.fieldManager.findUnique({
            where: { id: targetId },
            select: { userId: true },
          });
          if (fm) {
            await prisma.user.update({
              where: { id: fm.userId },
              data: { profilePhoto: fileUrl },
            });
          }
          updatedRecord = await prisma.fieldManager.update({
            where: { id: targetId },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        }
        break;
      }

      case 'operations_manager': {
        const user = await prisma.user.findUnique({
          where: { id: targetId },
          include: { operationsManagerProfile: true },
        });

        if (user?.operationsManagerProfile) {
          await prisma.user.update({
            where: { id: user.id },
            data: { profilePhoto: fileUrl },
          });
          updatedRecord = await prisma.operationsManager.update({
            where: { id: user.operationsManagerProfile.id },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        } else {
          const om = await prisma.operationsManager.findUnique({
            where: { id: targetId },
            select: { userId: true },
          });
          if (om) {
            await prisma.user.update({
              where: { id: om.userId },
              data: { profilePhoto: fileUrl },
            });
          }
          updatedRecord = await prisma.operationsManager.update({
            where: { id: targetId },
            data: { photo: fileUrl },
            select: { id: true, name: true, photo: true },
          });
        }
        break;
      }

      case 'beneficiary': {
        updatedRecord = await prisma.beneficiary.update({
          where: { id: targetId },
          data: { photo: fileUrl },
          select: { id: true, name: true, photo: true },
        });
        break;
      }
    }

    res.status(200).json({
      success: true,
      url: fileUrl,
      data: updatedRecord,
      entityType: targetType,
      targetId: targetId,
    });
  } catch (error) {
    console.error('Profile photo upload failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/general', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const fileKey = `general/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const { url } = await storageService.upload(file.buffer, fileKey, file.mimetype);
    
    // Generate a presigned URL so the frontend can preview it immediately
    const { resolveFileUrl } = require('../services/storage/urlResolver');
    const previewUrl = await resolveFileUrl(url);

    res.json({ success: true, url, previewUrl });
  } catch (error) {
    console.error('General upload failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
