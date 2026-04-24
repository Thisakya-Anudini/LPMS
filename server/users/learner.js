import { ERP_MOCK_EMPLOYEE_NUMBERS } from '../mock/erpMockData.js';

const mockLearners = ERP_MOCK_EMPLOYEE_NUMBERS.map((employeeNo) => ({
  id: `mock-learner-${employeeNo}`,
  email: `${employeeNo}@mock.slt.com.lk`,
  password: employeeNo,
  employeeNo,
  username: employeeNo
}));

export const findMockLearnerByIdentifier = (identifier) => {
  if (!identifier) {
    return null;
  }

  const raw = String(identifier).trim();
  const normalized = raw.toLowerCase();

  return (
    mockLearners.find(
      (learner) =>
        learner.email.toLowerCase() === normalized ||
        learner.employeeNo === raw ||
        learner.username === raw
    ) || null
  );
};

export const isValidMockLearnerPassword = (learner, password) =>
  Boolean(learner && typeof password === 'string' && password === learner.employeeNo);
