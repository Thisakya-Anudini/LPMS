import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { ROLES } from '../constants/roles.js';
import {
  addDays,
  getRefreshTokenTtlDays,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyToken
} from '../utils/auth.js';
import { sendError } from '../utils/http.js';
import { fetchEmployeeDetailsForServiceNo, fetchEmployeeSubordinates } from '../utils/erpClient.js';
import { findMockLearnerByIdentifier, isValidMockLearnerPassword } from '../users/learner.js';

const mapPrincipal = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role === ROLES.SUPERVISOR ? ROLES.EMPLOYEE : row.role,
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
  mustChangePassword: principal.mustChangePassword,
  authSource: principal.authSource || 'SYSTEM',
  employeeNo: principal.employeeNo || null,
  isSupervisor: typeof principal.isSupervisor === 'boolean' ? principal.isSupervisor : false
});

const mapLearnerName = (detailsResponse, fallbackName) => {
  const row = detailsResponse?.data?.[0];
  if (!row) {
    return fallbackName;
  }

  if (row.employeeName && String(row.employeeName).trim()) {
    return String(row.employeeName).trim();
  }

  const initials = row.employeeInitials ? String(row.employeeInitials).trim() : '';
  const surname = row.employeeSurname ? String(row.employeeSurname).trim() : '';
  const merged = `${initials} ${surname}`.trim();
  return merged || fallbackName;
};

const resolveEmployeeContext = async (principalId) => {
  const employeeRow = await query(
    `
      SELECT employee_number
      FROM employees
      WHERE principal_id = $1
      LIMIT 1
    `,
    [principalId]
  );

  const employeeNo = employeeRow.rows[0]?.employee_number
    ? String(employeeRow.rows[0].employee_number).trim()
    : null;
  if (!employeeNo) {
    return { employeeNo: null, isSupervisor: false };
  }

  try {
    const subordinates = await fetchEmployeeSubordinates(employeeNo);
    return {
      employeeNo,
      isSupervisor: Boolean(Array.isArray(subordinates?.data) && subordinates.data.length > 0)
    };
  } catch {
    return { employeeNo, isSupervisor: false };
  }
};

export const login = async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = String(username || email || '').trim();

  const principal = await getPrincipalByEmail(identifier.toLowerCase());
  if (!principal) {
    const mockLearner = findMockLearnerByIdentifier(identifier);
    if (!mockLearner || !isValidMockLearnerPassword(mockLearner, password)) {
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    let detailsResponse = null;
    let subordinatesResponse = null;
    try {
      detailsResponse = await fetchEmployeeDetailsForServiceNo(mockLearner.employeeNo);
      subordinatesResponse = await fetchEmployeeSubordinates(mockLearner.employeeNo);
    } catch {
      // keep login available even if ERP temporarily fails
    }

    const normalizedPrincipal = {
      id: mockLearner.id,
      email: mockLearner.email,
      role: ROLES.EMPLOYEE,
      name: mapLearnerName(detailsResponse, mockLearner.email.split('@')[0]),
      principalType: 'EMPLOYEE',
      mustChangePassword: false,
      authSource: 'MOCK_LEARNER',
      employeeNo: mockLearner.employeeNo,
      isSupervisor:
        Boolean(Array.isArray(subordinatesResponse?.data) && subordinatesResponse.data.length > 0)
    };

    const accessToken = signAccessToken(normalizedPrincipal);
    const refreshToken = signRefreshToken(normalizedPrincipal, crypto.randomUUID());

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: sanitizePrincipal(normalizedPrincipal)
    });
  }

  const isValidPassword = await bcrypt.compare(password, principal.password_hash);
  if (!isValidPassword) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  const normalizedPrincipal = mapPrincipal(principal);
  if (normalizedPrincipal.role === ROLES.EMPLOYEE) {
    const employeeContext = await resolveEmployeeContext(normalizedPrincipal.id);
    normalizedPrincipal.employeeNo = employeeContext.employeeNo;
    normalizedPrincipal.isSupervisor = employeeContext.isSupervisor;
  }
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

  if (decoded.authSource === 'MOCK_LEARNER') {
    const principal = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      principalType: decoded.principalType,
      mustChangePassword: false,
      authSource: decoded.authSource,
      employeeNo: decoded.employeeNo,
      isSupervisor: Boolean(decoded.isSupervisor)
    };

    const accessToken = signAccessToken(principal);
    return res.status(200).json({ accessToken });
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

  if (decoded.authSource === 'MOCK_LEARNER') {
    return res.status(200).json({ success: true });
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
  if (req.user.authSource === 'MOCK_LEARNER') {
    return res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        principalType: req.user.principalType,
        mustChangePassword: false,
        authSource: req.user.authSource,
        employeeNo: req.user.employeeNo || null,
        isSupervisor: Boolean(req.user.isSupervisor)
      }
    });
  }

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
  if (req.user.authSource === 'MOCK_LEARNER') {
    return sendError(
      res,
      400,
      'NOT_SUPPORTED',
      'Password change is not enabled for mock learner authentication.'
    );
  }

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
