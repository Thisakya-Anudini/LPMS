// server/users/superAdmin.js
export const isValidRole = (role) => {
  const validRoles = ['Super Admin', 'Supervisor', 'Learning Admin'];
  return validRoles.includes(role);
};

// Example of usage in the controller
import { isValidRole } from './superAdmin.js';

const createUser = async (req, res) => {
  const { email, password, role } = req.body;

  if (!isValidRole(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // Proceed with user creation logic...
};