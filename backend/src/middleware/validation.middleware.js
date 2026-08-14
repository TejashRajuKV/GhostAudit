const { body, param, query, validationResult } = require('express-validator');

// Validation rules for login
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validation rules for case creation
const createCaseValidation = [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isInt()
    .withMessage('Transaction ID must be a number'),
  body('fraudType')
    .notEmpty()
    .withMessage('Fraud type is required')
    .isIn(['invoice_manipulation', 'ghost_vendor', 'price_inflation', 'duplicate_payment', 'kickback'])
    .withMessage('Invalid fraud type'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validation rules for case update
const updateCaseValidation = [
  param('id')
    .isInt()
    .withMessage('Case ID must be a number'),
  body('status')
    .optional()
    .isIn(['open', 'investigating', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('assignedTo')
    .optional()
    .isInt()
    .withMessage('Assigned user ID must be a number'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validation rules for vendor creation
const createVendorValidation = [
  body('name')
    .notEmpty()
    .withMessage('Vendor name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Vendor name must be between 2 and 200 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]{10,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

// Validation rules for transaction query params
const transactionQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be a positive number'),
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be a positive number'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

// Generic validation middleware factory
const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
];

module.exports = {
  loginValidation,
  createCaseValidation,
  updateCaseValidation,
  createVendorValidation,
  transactionQueryValidation,
  validate
};
