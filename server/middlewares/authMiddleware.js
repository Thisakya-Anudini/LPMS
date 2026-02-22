import { verifyToken } from '../utils/auth.js';
import { sendError } from '../utils/http.js';

const parseBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

export const protect = (req, res, next) => {
  const rawAuthorization = req.header('Authorization');
  const token = parseBearerToken(rawAuthorization);

  if (!token) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authorization token is required.');
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      principalType: decoded.principalType
    };
    return next();
  } catch {
    return sendError(res, 401, 'INVALID_TOKEN', 'Token is invalid or expired.');
  }
};

export const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
  }

  if (!roles.includes(req.user.role)) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource.');
  }

  return next();
};
