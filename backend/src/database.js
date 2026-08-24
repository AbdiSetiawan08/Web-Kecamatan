import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';

export const databaseName = process.env.MONGODB_DB || 'kecamatan_db';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri, {
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 5)
});

let database;

export async function connectDatabase() {
  if (!database) {
    await client.connect();
    database = client.db(databaseName);
  }
  return database;
}

export async function initializeDatabase() {
  const db = await connectDatabase();
  await db.command({ ping: 1 });

  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('news').createIndex({ slug: 1 }, { unique: true });
  await db.collection('news').createIndex({ status: 1, publishedDate: -1, createdAt: -1 });
  await db.collection('news').createIndex({ category: 1 });
  await db.collection('public_documents').createIndex({ status: 1, year: -1, createdAt: -1 });
  await db.collection('public_documents').createIndex({ category: 1 });
  await db.collection('survey_responses').createIndex({ createdAt: -1 });
  await db.collection('survey_responses').createIndex({ serviceType: 1 });

  const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME;
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  if (defaultUsername && defaultPassword) {
    const existingAdmin = await db.collection('users').findOne({ username: defaultUsername });
    if (!existingAdmin) {
      await db.collection('users').insertOne({
        username: defaultUsername,
        passwordHash: await bcrypt.hash(defaultPassword, 12),
        fullName: process.env.DEFAULT_ADMIN_FULL_NAME || 'Admin Utama',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

export function collection(name) {
  if (!database) {
    throw new Error('Database belum terhubung. Jalankan initializeDatabase terlebih dahulu.');
  }
  return database.collection(name);
}

export function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
