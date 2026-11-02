import mongoose from 'mongoose';

let connectionPromise;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB');
  }

  if (mongoose.connection.readyState !== 2) {
    connectionPromise = undefined;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'maison_bistro'
    }).then((connection) => {
      console.log(`MongoDB connected: ${connection.connection.name}`);
      return connection.connection;
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  return connectionPromise;
}
