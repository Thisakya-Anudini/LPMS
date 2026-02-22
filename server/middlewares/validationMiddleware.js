import { sendError } from '../utils/http.js';

export const requireFields = (fields) => (req, res, next) => {
  const missing = fields.filter((field) => {
    const value = req.body?.[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Missing required fields.',
      { missing }
    );
  }

  return next();
};
