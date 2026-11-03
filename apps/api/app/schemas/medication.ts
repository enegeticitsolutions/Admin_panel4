import Joi from 'joi';

const ROUTE_ENUMS = [
  'oral',
  'sublingual',
  'topical',
  'inhaled',
  'injectable',
  'nasal',
  'ophthalmic',
  'otic',
  'rectal'
];

const CADENCE_ENUMS = [
  'daily',
  'alternate',
  'weekly',
  'monthly'
];

const FREQUENCY_ENUMS = [
  'once_daily',
  'daily',
  'twice_daily',
  'thrice_daily',
  'four_times_daily',
  'every_6_hours',
  'every_8_hours',
  'every_12_hours',
  'alternate',
  'alternate_days',
  'weekly',
  'fortnightly',
  'monthly',
  'as_needed'
];

export const createMedicationSchema = Joi.object({
  beneficiaryId: Joi.string().uuid().required(),
  name: Joi.string().required(),
  genericName: Joi.string().allow('', null).optional(),
  dosage: Joi.string().required(),
  route: Joi.string().valid(...ROUTE_ENUMS).default('oral'),
  cadence: Joi.string().valid(...CADENCE_ENUMS).default('daily'),
  frequency: Joi.string().valid(...FREQUENCY_ENUMS).default('once_daily'),
  timeSlots: Joi.array().items(Joi.string()).optional(),
  instructions: Joi.string().allow('', null).optional(),
  sideEffects: Joi.string().allow('', null).optional(),
  prescribedBy: Joi.string().allow('', null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().allow(null).optional(),
  totalDays: Joi.number().integer().positive().allow(null).optional(),
  refillReminderDays: Joi.number().integer().positive().allow(null).optional(),
  setReminders: Joi.boolean().default(true),
  isActive: Joi.boolean().default(true),
});

export const updateMedicationSchema = Joi.object({
  name: Joi.string().optional(),
  genericName: Joi.string().allow('', null).optional(),
  dosage: Joi.string().optional(),
  route: Joi.string().valid(...ROUTE_ENUMS).optional(),
  cadence: Joi.string().valid(...CADENCE_ENUMS).optional(),
  frequency: Joi.string().valid(...FREQUENCY_ENUMS).optional(),
  timeSlots: Joi.array().items(Joi.string()).optional(),
  instructions: Joi.string().allow('', null).optional(),
  sideEffects: Joi.string().allow('', null).optional(),
  prescribedBy: Joi.string().allow('', null).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().allow(null).optional(),
  totalDays: Joi.number().integer().positive().allow(null).optional(),
  refillReminderDays: Joi.number().integer().positive().allow(null).optional(),
  setReminders: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
});

export const createAdherenceSchema = Joi.object({
  beneficiaryId: Joi.string().uuid().required(),
  medicationId: Joi.string().uuid().required(),
  scheduledTime: Joi.date().required(),
  taken: Joi.boolean().default(false),
  takenTime: Joi.date().optional(),
  recordedBy: Joi.string().uuid().required(),
});
