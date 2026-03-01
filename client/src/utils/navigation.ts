import { Role } from '../types';

export function getDefaultRouteForRole(role: Role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/learners';
    case 'LEARNING_ADMIN':
      return '/learning-admin';
    case 'SUPERVISOR':
      return '/learner/my-progress';
    case 'EMPLOYEE':
      return '/learner/my-progress';
    default:
      return '/login';
  }
}
