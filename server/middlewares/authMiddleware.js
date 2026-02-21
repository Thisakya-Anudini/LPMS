// server/middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';

const protect = (req, res, next) => {
  let token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  token = token.split(' ')[1]; // Extract token

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY); // Verify the token
    req.user = decoded; // Attach the user to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'Super Admin') {
    next(); // If user is Super Admin, proceed to the next step
  } else {
    res.status(403).json({ message: 'Permission denied' }); // If not, deny access
  }
};

export { protect, admin };