import { Role } from '../types';

export function getDefaultRouteForRole(role: Role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'LEARNING_ADMIN':
      return '/learning-admin';
    case 'SUPERVISOR':
      return '/supervisor';
    case 'EMPLOYEE':
      return '/employee';
    default:
      return '/login';
  }
}
