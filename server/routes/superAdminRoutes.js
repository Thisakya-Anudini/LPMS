// server/routes/superAdminRoutes.js
import express from 'express';
import { createUser, getAllUsers, deleteUser, createEmployee } from '../controllers/superAdminController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';  // Middleware to protect routes

const router = express.Router();

// Route to create a new user (Super Admin only)
router.post('/', protect, admin, createUser);

// Route to get all users (Super Admin only)
router.get('/', protect, admin, getAllUsers);

// Route to delete a user (Super Admin only)
router.delete('/:id', protect, admin, deleteUser); 

// Route to create an employee (Super Admin only)
router.post('/employees', protect, admin, createEmployee);

export default router;