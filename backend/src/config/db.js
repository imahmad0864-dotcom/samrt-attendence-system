import mongoose from "mongoose";

const cache = global._mongo || (global._mongo = { conn: null, promise: null });

export default async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is missing");
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  cache.conn = await cache.promise;
  return cache.conn;
}