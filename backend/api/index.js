import app from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';

export default async function handler(request, response) {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Unable to connect to database:', error);
    return response.status(503).json({ message: 'Database unavailable' });
  }

  return app(request, response);
}
