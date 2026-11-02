import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB');
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'maison_bistro'
  });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
