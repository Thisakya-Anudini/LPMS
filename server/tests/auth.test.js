import test from 'node:test';
import assert from 'node:assert/strict';
import { signAccessToken, verifyToken } from '../utils/auth.js';
import { protect, requireRole } from '../middlewares/authMiddleware.js';
import { ROLES } from '../constants/roles.js';

process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret';

const createMockRes = () => {
  const payload = {
    statusCode: 200,
    body: null
  };
  return {
    status(code) {
      payload.statusCode = code;
      return this;
    },
    json(body) {
      payload.body = body;
      return this;
    },
    payload
  };
};

test('signAccessToken and verifyToken return expected claims', () => {
  const principal = {
    id: 'principal-1',
    email: 'admin@lpms.com',
    role: ROLES.SUPER_ADMIN,
    principalType: 'USER'
  };
  const token = signAccessToken(principal);
  const decoded = verifyToken(token);

  assert.equal(decoded.sub, principal.id);
  assert.equal(decoded.email, principal.email);
  assert.equal(decoded.role, principal.role);
});

test('protect attaches req.user when valid bearer token exists', () => {
  const token = signAccessToken({
    id: 'principal-2',
    email: 'supervisor@lpms.com',
    role: ROLES.SUPERVISOR,
    principalType: 'USER'
  });

  const req = {
    header(name) {
      if (name === 'Authorization') {
        return `Bearer ${token}`;
      }
      return undefined;
    }
  };
  const res = createMockRes();
  let called = false;

  protect(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(req.user.role, ROLES.SUPERVISOR);
});

test('requireRole denies unauthorized role', () => {
  const middleware = requireRole([ROLES.SUPER_ADMIN]);
  const req = {
    user: {
      role: ROLES.EMPLOYEE
    }
  };
  const res = createMockRes();
  let called = false;

  middleware(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.payload.statusCode, 403);
  assert.equal(res.payload.body.error.code, 'FORBIDDEN');
});
