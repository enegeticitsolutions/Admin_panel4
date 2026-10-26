import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, validate } from '../shared/deps';
import prisma from '../../core/database';
import { geminiAiService } from '../../services/ai/GeminiAiAdapter';
import { getStorageService } from '../../services/storage';
import { getOrFetchBeneficiarySoapContext } from '../../services/ai/beneficiary_context_cache';
import { evaluateRedFlags } from '../../services/care_companion/soap_rules_engine';
import {
  summarizeSoapSchema,
  presignedAudioUploadSchema,
  evaluateVitalsSchema,
} from '../../schemas/visit_ai';

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
 * POST /care-companion/visits/:visitId/ai/presigned-audio-upload
 * Generates an authorized pre-signed S3/storage PUT URL for direct client-to-cloud audio uploads.
 * Bypasses backend memory bottleneck and sets up streaming audio pipeline.
 */
router.post(
  '/:visitId/ai/presigned-audio-upload',
  authenticate,
  validate(presignedAudioUploadSchema),
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

      const mimeType = req.body.mimeType || 'audio/m4a';
      const extMap: Record<string, string> = {
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/aac': 'aac',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/x-wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/webm': 'webm',
        'audio/caf': 'caf',
      };
      const ext = extMap[mimeType] || 'm4a';
      const fileId = uuidv4();
      const storageKey = `visits/${visitId}/audio/${fileId}.${ext}`;

      const storage = getStorageService();
      const expiresInSeconds = 900; // 15 minutes
      const uploadUrl = await storage.getPresignedUploadUrl(storageKey, mimeType, expiresInSeconds);

      return res.json({
        success: true,
        data: {
          uploadUrl,
          storageKey,
          mimeType,
          expiresInSeconds,
          maxSizeBytes: 15 * 1024 * 1024,
        },
      });
    } catch (error: any) {
      console.error('❌ [Presigned Audio Upload Error]:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate pre-signed upload URL.',
      });
    }
  }
);

/**
 * POST /care-companion/visits/:visitId/ai/evaluate-vitals
 * Instant deterministic safety evaluation (<5ms).
 * Evaluates vital readings against MHN clinical thresholds without waiting for LLM completion.
 */
router.post(
  '/:visitId/ai/evaluate-vitals',
  authenticate,
  validate(evaluateVitalsSchema),
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

      const evalResult = evaluateRedFlags({
        vitalsList: req.body.vitalsList || [],
        rawNotes: req.body.rawNotes || '',
      } as any);

      return res.json({
        success: true,
        data: {
          escalationLevel: evalResult.escalationLevel,
          reasons: evalResult.reasons,
          isEmergency: evalResult.escalationLevel === 'ERC now',
          evaluatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('❌ [Evaluate Vitals Error]:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to evaluate vitals safety.',
      });
    }
  }
);

/**
 * POST /care-companion/visits/:visitId/ai/transcribe-voice
 * Accepts:
 *   1) storageKey (Direct cloud S3 uploaded file via pre-signed URL)
 *   2) req.file buffer (Multipart fallback)
 * Returns text transcribed by Gemini Multimodal Audio.
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

      const access = await verifyVisitAccess(visitId, userId, userRole);
      if (!access.authorized) {
        return res.status(access.status || 403).json({ success: false, message: access.message });
      }

      let audioBuffer: Buffer;
      let mimeType: string = 'audio/m4a';
      let method: 'direct_s3' | 'multipart_fallback' = 'multipart_fallback';

      const storageKey = req.body?.storageKey;

      if (storageKey) {
        // Enforce storage key sandboxing: must reside under this visit's directory
        if (!storageKey.startsWith(`visits/${visitId}/`)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid storageKey: key does not belong to this visit.',
          });
        }

        const storage = getStorageService();
        audioBuffer = await storage.getFileBuffer(storageKey);
        mimeType = req.body?.mimeType || 'audio/m4a';
        method = 'direct_s3';
      } else if (req.file && req.file.buffer) {
        audioBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
        method = 'multipart_fallback';
      } else {
        return res.status(400).json({
          success: false,
          message: 'No audio provided. Provide either storageKey from pre-signed upload or audio file in multipart.',
        });
      }

      const transcript = await geminiAiService.transcribeAudio(audioBuffer, mimeType);

      return res.json({
        success: true,
        data: {
          transcript,
          fileSize: audioBuffer.length,
          mimeType,
          method,
          storageKey: storageKey || null,
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
 * Leverages Redis-cached beneficiary baseline context with DB fallback.
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

      // 1. Fetch static beneficiary baseline context from Redis (or fallback to DB)
      const cachedBaseline = await getOrFetchBeneficiarySoapContext(beneficiary.id);

      // 2. Fetch previous visit for flag carry-over (e.g. knee pain 16 Oct)
      const previousVisit = await prisma.visit.findFirst({
        where: {
          beneficiaryId: beneficiary.id,
          id: { not: visitId },
          status: 'completed',
        },
        orderBy: { scheduledTime: 'desc' },
        select: { notes: true, visitSummary: true, scheduledTime: true },
      });

      // 3. Fetch active medications for scheduled medicines list
      const activeMeds = await prisma.medication.findMany({
        where: { beneficiaryId: beneficiary.id, isActive: true },
        select: { name: true, dosage: true, frequency: true },
      });

      const scheduledMedicines = activeMeds.map(
        (m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`.trim()
      );

      // 4. Assemble complete SOAP context separating static baseline from dynamic visit inputs
      const soapContext = {
        beneficiaryName: cachedBaseline.name || beneficiary.name || 'Beneficiary',
        beneficiaryAge: cachedBaseline.age || beneficiary.age || null,
        beneficiaryGender: cachedBaseline.gender || beneficiary.gender || null,
        segment: cachedBaseline.segment || 'S2, Saathi Plus',
        knownConditions: cachedBaseline.knownConditions,
        allergies: cachedBaseline.allergies,
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
        data: {
          ...result,
          sessionId: req.body.sessionId || null,
          idempotencyKey: req.body.idempotencyKey || null,
        },
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
