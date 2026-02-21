// server/controllers/superAdminController.js
import bcrypt from 'bcryptjs';
import client from '../db.js';  // Ensure db.js exists and is correctly set up

// Define valid roles for users
const validRoles = ['supervisor', 'learning admin', 'super admin'];

// Create a new user (Super Admin only)
export const createUser = async (req, res) => {
  const { email, password, role } = req.body;

  // Check if the role is valid
  if (!validRoles.includes(role.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid role. Valid roles are: supervisor, learning admin, super admin.' });
  }

  // Only Super Admin can create users
  if (req.user.role !== 'Super Admin') {
    return res.status(403).json({ message: 'Permission denied. Only Super Admin can create users.' });
  }

  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const result = await client.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, role]
    );

    // Return the created user
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

// Get all users (Super Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM users');
    res.status(200).json(result.rows);  // Return all users
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving users' });
  }
};

// Delete a user (Super Admin only)
export const deleteUser = async (req, res) => {
  const { id } = req.params;  // Get the user ID from the URL parameter

  try {
    // Ensure only Super Admin can delete a user
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Permission denied. Only Super Admin can delete users.' });
    }

    // Delete the user from the database
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

    // If no user is found, return an error
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the deleted user data (optional, or just return a success message)
    res.status(200).json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting user' });
  }
};


// Create a new employee (Super Admin only)
export const createEmployee = async (req, res) => {
  const { employeeNumber, email, password, designation, gradeName } = req.body;

  // Validate required fields
  if (!employeeNumber || !email || !password || !designation || !gradeName) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Check if the employee number or email already exists in the database
    const existingEmployee = await client.query('SELECT * FROM employees WHERE employee_number = $1 OR email = $2', [employeeNumber, email]);

    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ message: 'Employee number or email already exists' });
    }

    // Hash the password before saving (using bcrypt for secure password storage)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the employee into the database
    const result = await client.query(
      'INSERT INTO employees (employee_number, email, password_hash, designation, grade_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employeeNumber, email, hashedPassword, designation, gradeName]
    );

    // Return the created employee
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Log the actual error message
    console.error('Error creating employee:', error);  // This will log the error to the console for debugging
    res.status(500).json({ message: 'Error creating employee', error: error.message });  // Include the error message in the response for better debugging
  }
};