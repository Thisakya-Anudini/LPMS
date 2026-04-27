import { sendError } from '../utils/http.js';

export const notFoundHandler = (req, res) =>
  sendError(res, 404, 'NOT_FOUND', `Route ${req.originalUrl} was not found.`);

export const errorHandler = (error, req, res, next) => {
  console.error('Unhandled API error:', error);

  if (res.headersSent) {
    return next(error);
  }

  return sendError(
    res,
    typeof error?.status === 'number' ? error.status : 500,
    error?.code || 'INTERNAL_SERVER_ERROR',
    error?.message || 'An unexpected error occurred.',
    error?.details
  );
};
