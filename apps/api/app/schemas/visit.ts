import Joi from 'joi';

const vitalsSchema = Joi.object({
  bpSystolic: Joi.number().integer().optional(),
  bpDiastolic: Joi.number().integer().optional(),
  temperature: Joi.number().optional(),
  oxygenLevel: Joi.number().integer().optional(),
  weight: Joi.number().optional(),
  heartRate: Joi.number().integer().optional(),
});

export const createVisitSchema = Joi.object({
  beneficiaryId: Joi.string().uuid().required(),
  careCompanionId: Joi.string().uuid().required(),
  scheduledTime: Joi.date().required(),
  benefitId: Joi.string().uuid().optional().allow(null),
});

export const checkInSchema = Joi.object({
  visitId: Joi.string().uuid().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  manualCheckInReason: Joi.string().allow('', null).optional(),
});

export const saveDetailsSchema = Joi.object({
  visitId: Joi.string().uuid().required(),
  vitals: vitalsSchema.optional(),
  vitalsList: Joi.array().items(
    Joi.object({
      vitalDefinitionId: Joi.string().uuid().required(),
      valueNumeric: Joi.number().optional().allow(null),
      valueNumeric2: Joi.number().optional().allow(null),
      valueText: Joi.string().allow('', null).optional(),
    })
  ).optional(),
  mood: Joi.string().valid('happy', 'neutral', 'sad', 'anxious', 'depressed').optional(),
  medicationAdherence: Joi.boolean().default(false),
  medicationsList: Joi.array().items(
    Joi.object({
      medicationId: Joi.string().required(),
      taken: Joi.boolean().required(),
    })
  ).optional(),
  notes: Joi.string().allow('', null).optional(),
  visitSummary: Joi.string().allow('', null).optional(),
  escalateToManager: Joi.boolean().optional(),
  escalationReason: Joi.string().allow('', null).optional(),
});

export const checkOutSchema = saveDetailsSchema.append({
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  manualCheckOutReason: Joi.string().allow('', null).optional(),
});

export const rateVisitSchema = Joi.object({
  visitId: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  feedback: Joi.string().optional(),
});