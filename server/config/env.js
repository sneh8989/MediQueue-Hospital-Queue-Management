import 'dotenv/config';

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  // If a real MongoDB connection string is provided later, the model layer
  // can be swapped from the lowdb fallback to Mongoose using this.
  MONGODB_URI: process.env.MONGODB_URI || '',
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-only-secret-change-me') {
  console.warn('[env] WARNING: using default JWT_SECRET in production. Set JWT_SECRET in .env.');
}
