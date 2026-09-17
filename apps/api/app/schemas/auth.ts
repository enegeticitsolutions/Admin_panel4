import Joi from 'joi';

export const sendOtpSchema = Joi.object({
  phone: Joi.string().required(),
  turnstileToken: Joi.string().allow(null, '').optional(),
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().required(),
  otp: Joi.string().min(4).max(6).pattern(/^\d+$/).required(),
});

export const checkLocationSchema = Joi.object({
  location: Joi.string().required(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
});

export const registerPasswordSchema = Joi.object({
  phone: Joi.string().required(),
  name: Joi.string().trim().min(2).required(),
  age: Joi.number().min(18).max(120).required(),
  password: Joi.string().min(6).required(),
  email: Joi.string().email().required(),
  pincode: Joi.string().allow(null, '').optional(),
  location: Joi.string().allow(null, '').optional(),
  latitude: Joi.number().allow(null).optional(),
  longitude: Joi.number().allow(null).optional(),
  turnstileToken: Joi.string().allow(null, '').optional(),
});

export const loginPasswordSchema = Joi.object({
  phone: Joi.string().required(),
  password: Joi.string().required(),
  turnstileToken: Joi.string().allow(null, '').optional(),
});