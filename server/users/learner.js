export const ERP_LEARNER_AUTH_SOURCE = 'ERP_LEARNER';

const normalizeIdentifier = (identifier) => String(identifier || '').trim();

export const buildTemporaryErpLearner = (identifier) => {
  const employeeNo = normalizeIdentifier(identifier);
  if (!employeeNo) {
    return null;
  }

  const fallbackDomain = process.env.ERP_FALLBACK_EMAIL_DOMAIN || 'erp.local';
  const normalizedEmail = employeeNo.includes('@')
    ? employeeNo.toLowerCase()
    : `${employeeNo}@${fallbackDomain}`;

  return {
    id: `erp-learner-${employeeNo}`,
    employeeNo,
    email: normalizedEmail
  };
};

export const isValidTemporaryErpLearnerPassword = (identifier, password) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  return Boolean(
    normalizedIdentifier &&
      typeof password === 'string' &&
      normalizedIdentifier === password.trim()
  );
};

export const isTemporaryErpLearnerAuth = (value) => {
  const authSource =
    typeof value === 'string' ? value : value?.authSource;
  return authSource === ERP_LEARNER_AUTH_SOURCE;
};
