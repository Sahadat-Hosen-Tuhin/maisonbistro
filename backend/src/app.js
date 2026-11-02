import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { uploadDirectory } from './config/uploads.js';
import routes from './routes/index.js';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.resolve('uploads')));
if (uploadDirectory !== path.resolve('uploads')) {
  app.use('/uploads', express.static(uploadDirectory));
}
app.use('/api/v1', routes);
app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'maison-bistro-api' });
});

app.use((error, _request, response, _next) => {
  if (error.name === 'ValidationError') {
    const errors = Object.fromEntries(
      Object.entries(error.errors).map(([field, detail]) => [field, detail.message])
    );
    return response.status(400).json({ message: 'Validation failed', errors });
  }
  if (error.code === 11000) {
    return response.status(409).json({ message: 'A resource with this value already exists', fields: error.keyValue });
  }
  if (error instanceof Error && (error.message.includes('image') || error.message.includes('Image') || error.code === 'LIMIT_FILE_SIZE')) {
    return response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller' : error.message });
  }
  console.error(error);
  response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Internal server error' });
});

export default app;