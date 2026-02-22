import { sendError } from '../utils/http.js';

const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);

const authAttempts = new Map();

export const authRateLimit = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const existing = authAttempts.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    authAttempts.set(key, { count: 1, windowStart: now });
    return next();
  }

  if (existing.count >= MAX_REQUESTS) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many authentication attempts. Please try again later.');
  }

  existing.count += 1;
  return next();
};
