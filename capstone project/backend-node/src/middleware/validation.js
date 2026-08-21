const { body, query, validationResult } = require('express-validator');

const validateSignup = [
  body('firstName').trim().notEmpty().withMessage('firstName is required'),
  body('lastName').trim().notEmpty().withMessage('lastName is required'),
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
  body('role').optional().isIn(['patient', 'provider', 'admin']).withMessage('role must be patient, provider, or admin')
];

const validateLogin = [
  body('email').trim().isEmail().withMessage('a valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required')
];

const validateAvailability = [
  query('clinic_id').optional().isUUID().withMessage('clinic_id must be a valid UUID'),
  query('provider_id').optional().isUUID().withMessage('provider_id must be a valid UUID'),
  query('start').optional().isISO8601().withMessage('start must be ISO8601 date/time'),
  query('end').optional().isISO8601().withMessage('end must be ISO8601 date/time')
];

const validateAppointment = [
  body('timeslot_id').isUUID().withMessage('timeslot_id must be a valid UUID'),
  body('patient').exists().withMessage('patient object is required'),
  body('patient.first_name').trim().notEmpty().withMessage('patient.first_name is required'),
  body('patient.last_name').trim().notEmpty().withMessage('patient.last_name is required'),
  body('patient.email').optional().isEmail().withMessage('patient.email must be valid'),
  body('patient.phone').optional().isMobilePhone('any').withMessage('patient.phone must be valid')
];

const validateAppointmentQuery = [
  query('clinic_id').optional().isUUID().withMessage('clinic_id must be a valid UUID'),
  query('provider_id').optional().isUUID().withMessage('provider_id must be a valid UUID'),
  query('status').optional().isIn(['confirmed', 'waiting', 'checked_in', 'completed', 'cancelled']).withMessage('status must be a valid appointment state'),
  query('start').optional().isISO8601().withMessage('start must be ISO8601 date/time'),
  query('end').optional().isISO8601().withMessage('end must be ISO8601 date/time')
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = {
  validateSignup,
  validateLogin,
  validateAvailability,
  validateAppointment,
  validateAppointmentQuery,
  handleValidation
};
