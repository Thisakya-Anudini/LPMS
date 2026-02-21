// db.js
import { Client } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// PostgreSQL client setup
const client = new Client({
  connectionString: process.env.DATABASE_URL, // This is where your DB connection string will go
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL', err.stack));

export default client;