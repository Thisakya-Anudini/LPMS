// server/index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';  // Optional if you want cross-origin support
import authRoutes from './routes/authRoutes.js';  // Import the login routes
import superAdminRoutes from './routes/superAdminRoutes.js';  // Import the super admin routes

dotenv.config();  // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());  // Enable cross-origin requests (optional)
app.use(express.json());  // Middleware to parse JSON requests

// Use the authRoutes for login
app.use('/api/auth', authRoutes);  // All login-related routes will be under /api/auth

// Use Super Admin routes (protected routes for Super Admin)
app.use('/api/users', superAdminRoutes);



// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});