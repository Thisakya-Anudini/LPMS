import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import {
  addDays,
  getRefreshTokenTtlDays,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyToken
} from '../utils/auth.js';
import { sendError } from '../utils/http.js';

const mapPrincipal = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  name: row.name,
  principalType: row.principal_type,
  mustChangePassword: row.must_change_password
});

const getPrincipalByEmail = async (email) => {
  const result = await query(
    `
      SELECT id, email, name, role, password_hash, principal_type, must_change_password
      FROM auth_principals
      WHERE email = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
};

const createRefreshSession = async (principal) => {
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken(principal, tokenId);
  const expiresAt = addDays(new Date(), getRefreshTokenTtlDays());

  await query(
    `
      INSERT INTO refresh_tokens (id, principal_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [tokenId, principal.id, hashToken(refreshToken), expiresAt]
  );

  return refreshToken;
};

const sanitizePrincipal = (principal) => ({
  id: principal.id,
  email: principal.email,
  role: principal.role,
  name: principal.name,
  principalType: principal.principalType,
  mustChangePassword: principal.mustChangePassword
});

export const login = async (req, res) => {
  const { email, password } = req.body;

  const principal = await getPrincipalByEmail(email);
  if (!principal) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const isValidPassword = await bcrypt.compare(password, principal.password_hash);
  if (!isValidPassword) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const normalizedPrincipal = mapPrincipal(principal);
  const accessToken = signAccessToken(normalizedPrincipal);
  const refreshToken = await createRefreshSession(normalizedPrincipal);

  return res.status(200).json({
    accessToken,
    refreshToken,
    user: sanitizePrincipal(normalizedPrincipal)
  });
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'refreshToken is required.');
  }

  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch {
    return sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
  }

  const stored = await query(
    `
      SELECT rt.id, rt.revoked_at, rt.expires_at, ap.id AS principal_id, ap.email, ap.name, ap.role, ap.principal_type, ap.must_change_password
      FROM refresh_tokens rt
      JOIN auth_principals ap ON ap.id = rt.principal_id
      WHERE rt.id = $1 AND rt.token_hash = $2
      LIMIT 1
    `,
    [decoded.tokenId, hashToken(refreshToken)]
  );

  const tokenRow = stored.rows[0];
  if (!tokenRow) {
    return sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
  }

  if (tokenRow.revoked_at || new Date(tokenRow.expires_at) < new Date()) {
    return sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token has expired or was revoked.');
  }

  const principal = {
    id: tokenRow.principal_id,
    email: tokenRow.email,
    name: tokenRow.name,
    role: tokenRow.role,
    principalType: tokenRow.principal_type,
    mustChangePassword: tokenRow.must_change_password
  };

  const accessToken = signAccessToken(principal);
  return res.status(200).json({ accessToken });
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'refreshToken is required.');
  }

  let decoded;
  try {
    decoded = verifyToken(refreshToken);
  } catch {
    return sendError(res, 200, 'OK', 'Already logged out.');
  }

  await query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1 AND token_hash = $2
    `,
    [decoded.tokenId, hashToken(refreshToken)]
  );

  return res.status(200).json({ success: true });
};

export const me = async (req, res) => {
  const result = await query(
    `
      SELECT id, email, name, role, principal_type, must_change_password
      FROM auth_principals
      WHERE id = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [req.user.id]
  );

  const principal = result.rows[0];
  if (!principal) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found.');
  }

  return res.status(200).json({
    user: {
      id: principal.id,
      email: principal.email,
      name: principal.name,
      role: principal.role,
      principalType: principal.principal_type,
      mustChangePassword: principal.must_change_password
    }
  });
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'newPassword must be at least 8 characters.');
  }

  const principalResult = await query(
    `
      SELECT id, email, name, role, principal_type, password_hash, must_change_password
      FROM auth_principals
      WHERE id = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [req.user.id]
  );
  const principal = principalResult.rows[0];
  if (!principal) {
    return sendError(res, 404, 'NOT_FOUND', 'User not found.');
  }

  const isOldPasswordValid = await bcrypt.compare(oldPassword, principal.password_hash);
  if (!isOldPasswordValid) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await query(
    `
      UPDATE auth_principals
      SET password_hash = $2, must_change_password = FALSE, updated_at = NOW()
      WHERE id = $1
    `,
    [principal.id, newPasswordHash]
  );

  await query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE principal_id = $1 AND revoked_at IS NULL
    `,
    [principal.id]
  );

  return res.status(200).json({
    user: {
      id: principal.id,
      email: principal.email,
      name: principal.name,
      role: principal.role,
      principalType: principal.principal_type,
      mustChangePassword: false
    }
  });
};
