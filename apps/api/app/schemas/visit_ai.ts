import Joi from 'joi';

export const summarizeSoapSchema = Joi.object({
  visitId: Joi.string().uuid().required(),
  rawNotes: Joi.string().min(1).required(),
  mood: Joi.string().optional().allow('', null),
  vitalsList: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        unit: Joi.string().optional().allow('', null),
      })
    )
    .optional(),
  medicationsList: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        taken: Joi.boolean().required(),
        scheduledTime: Joi.string().optional().allow('', null),
      })
    )
    .optional(),
});
