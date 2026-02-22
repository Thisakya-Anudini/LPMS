import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const TOKEN_ISSUER = process.env.TOKEN_ISSUER || 'lpms';

const getSecret = () => {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('SECRET_KEY is not configured.');
  }
  return secret;
};

export const signAccessToken = (principal) => jwt.sign(
  {
    sub: principal.id,
    email: principal.email,
    role: principal.role,
    principalType: principal.principalType
  },
  getSecret(),
  { expiresIn: ACCESS_TTL, issuer: TOKEN_ISSUER }
);

export const signRefreshToken = (principal, tokenId) => jwt.sign(
  {
    sub: principal.id,
    role: principal.role,
    principalType: principal.principalType,
    tokenId
  },
  getSecret(),
  { expiresIn: `${REFRESH_TTL_DAYS}d`, issuer: TOKEN_ISSUER }
);

export const verifyToken = (token) => jwt.verify(token, getSecret(), { issuer: TOKEN_ISSUER });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getRefreshTokenTtlDays = () => REFRESH_TTL_DAYS;
