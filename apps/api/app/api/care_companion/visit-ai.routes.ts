import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, validate } from '../shared/deps';
import prisma from '../../core/database';
import { geminiAiService } from '../../services/ai/GeminiAiAdapter';
import { summarizeSoapSchema } from '../../schemas/visit_ai';

const router = Router();

// Allowed audio MIME types for voice recording
const ALLOWED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
  'audio/x-m4a',
  'audio/caf',
  'audio/3gpp',
];

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max limit (well above 2-3 min voice note)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Please record in a standard audio format.`));
    }
  },
});

/**
 * Helper to verify Care Companion / Admin access to the specified visit.
 */
async function verifyVisitAccess(visitId: string, userId: string, userRole?: string) {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      beneficiary: {
        include: {
          user: true,
        },
      },
      careCompanion: true,
    },
  });

  if (!visit) {
    return { authorized: false, status: 404, message: 'Visit not found' };
  }

  const isAdmin = [
    'admin',
    'master_admin',
    'super_admin',
    'field_manager',
    'operations_manager',
    'customer_service',
  ].includes(userRole || '');

  const isAssignedCc = visit.careCompanion && visit.careCompanion.userId === userId;

  if (!isAdmin && !isAssignedCc) {
    return {
      authorized: false,
      status: 403,
      message: 'Access denied: You are not authorized to manage this visit.',
    };
  }

  return { authorized: true, visit };
}

/**
 * POST /care-companion/visits/:visitId/ai/transcribe-voice
 * Accepts recorded voice file and returns text transcribed by Gemini Multimodal Audio.
 */
router.post(
  '/:visitId/ai/transcribe-voice',
  authenticate,
  audioUpload.single('audio') as any,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as any;
      const visitId = req.params.visitId as string;
      const userId = authReq.userId;
      const userRole = authReq.userRole;

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'No audio file provided in request. Please record voice before submitting.',
        });
      }

      const access = await verifyVisitAccess(visitId, userId, userRole);
      if (!access.authorized) {
        return res.status(access.status || 403).json({ success: false, message: access.message });
      }

      const transcript = await geminiAiService.transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );

      return res.json({
        success: true,
        data: {
          transcript,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('❌ [Voice Transcription Error]:', error);
      const isFetchError =
        error.message?.includes('fetch failed') ||
        error.name === 'TypeError' ||
        error.name === 'TimeoutError';
      const userMessage = isFetchError
        ? 'AI transcription service is temporarily experiencing network delays. Please try again.'
        : (error.message || 'Failed to transcribe audio. Please try again or type manually.');

      return res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  }
);

/**
 * POST /care-companion/visits/:visitId/ai/summarize-soap
 * Analyzes raw visit notes + vitals + medications + mood and generates structured SOAP note
 * according to MHN-TPL-SOAP-001 with automated red-flag escalations.
 */
router.post(
  '/:visitId/ai/summarize-soap',
  authenticate,
  validate(summarizeSoapSchema),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as any;
      const visitId = req.params.visitId as string;
      const userId = authReq.userId;
      const userRole = authReq.userRole;

      const access = await verifyVisitAccess(visitId, userId, userRole);
      if (!access.authorized || !access.visit) {
        return res.status(access.status || 403).json({ success: false, message: access.message });
      }

      const visit = access.visit;
      const beneficiary = visit.beneficiary;

      // Fetch previous visit for flag carry-over (e.g. knee pain 16 Oct)
      const previousVisit = await prisma.visit.findFirst({
        where: {
          beneficiaryId: beneficiary.id,
          id: { not: visitId },
          status: 'completed',
        },
        orderBy: { scheduledTime: 'desc' },
        select: { notes: true, visitSummary: true, scheduledTime: true },
      });

      // Assemble known conditions / statuses from beneficiary profile
      const knownConditions: string[] = [
        beneficiary.mobilityStatus ? `Mobility: ${beneficiary.mobilityStatus}` : '',
        beneficiary.cognitiveStatus ? `Cognitive: ${beneficiary.cognitiveStatus}` : '',
      ].filter(Boolean);

      // Fetch active medications for scheduled medicines list
      const activeMeds = await prisma.medication.findMany({
        where: { beneficiaryId: beneficiary.id, isActive: true },
        select: { name: true, dosage: true, frequency: true },
      });

      const scheduledMedicines = activeMeds.map(
        (m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`.trim()
      );

      const soapContext = {
        beneficiaryName: beneficiary.name || 'Beneficiary',
        beneficiaryAge: beneficiary.age || null,
        beneficiaryGender: beneficiary.gender || null,
        segment: 'S2, Saathi Plus',
        knownConditions,
        allergies: beneficiary.allergies || [],
        scheduledMedicines,
        previousVisitFlags: previousVisit?.notes || previousVisit?.visitSummary || undefined,
        rawNotes: req.body.rawNotes,
        mood: req.body.mood || visit.mood || undefined,
        vitalsList: req.body.vitalsList || [],
        medicationsList: req.body.medicationsList || [],
      };

      const result = await geminiAiService.generateSoapSummary(soapContext);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('❌ [SOAP Summarization Error]:', error);
      const isFetchError =
        error.message?.includes('fetch failed') ||
        error.name === 'TypeError' ||
        error.name === 'TimeoutError';
      const userMessage = isFetchError
        ? 'AI service is temporarily experiencing network delays. Please try again in a few moments.'
        : (error.message || 'Failed to generate AI SOAP notes. Please try again.');

      return res.status(500).json({
        success: false,
        message: userMessage,
      });
    }
  }
);

export default router;
