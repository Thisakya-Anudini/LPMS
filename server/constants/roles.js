export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  LEARNING_ADMIN: 'LEARNING_ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  EMPLOYEE: 'EMPLOYEE'
});

export const ALL_ROLES = Object.values(ROLES);

export const isValidRole = (role) => ALL_ROLES.includes(role);
