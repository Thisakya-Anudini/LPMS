// server/routes/authRoutes.js
import express from 'express';
import { login } from '../controllers/authController.js';  // Import the login function from the controller

const router = express.Router();

// Define the login route
router.post('/login', login);  // Use the login function from the controller

export default router;