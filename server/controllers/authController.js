// server/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import client from '../db.js';  // Database connection

// Login function to authenticate user and generate JWT token
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in the database
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Compare the hashed password with the entered password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token if login is successful
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.SECRET_KEY,  // Use SECRET_KEY from .env file
      { expiresIn: '1h' }  // Set the token to expire in 1 hour
    );

    // Send the token back to the client
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};