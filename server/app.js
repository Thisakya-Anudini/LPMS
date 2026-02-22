import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import learningAdminRoutes from './routes/learningAdminRoutes.js';
import supervisorRoutes from './routes/supervisorRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import adminEmployeeRoutes from './routes/adminEmployeeRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

export const createApp = () => {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true
  }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', superAdminRoutes);
  app.use('/api/employees', adminEmployeeRoutes);
  app.use('/api', learningAdminRoutes);
  app.use('/api/supervisor', supervisorRoutes);
  app.use('/api/employee', employeeRoutes);
  app.use('/api/integrations', integrationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
