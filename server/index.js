import dotenv from 'dotenv';
import { createApp } from './app.js';

// 1. dotenv එක load කරන්න
dotenv.config();

console.log("Environment check:", { 
  PORT: process.env.PORT, 
  DB: process.env.DATABASE_URL ? "Defined" : "UNDEFINED" 
});

const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});