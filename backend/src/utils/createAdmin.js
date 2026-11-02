import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database.js';
import { Admin } from '../models/index.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME || 'Restaurant Admin';

if (!email || !password) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
}

await connectDatabase();
const passwordHash = await bcrypt.hash(password, 12);
const admin = await Admin.findOneAndUpdate(
  { email: email.toLowerCase() },
  {
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin',
    accountType: 'admin',
    isActive: true,
    mustChangePassword: false
  },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
);
console.log(`Admin account ready: ${admin.email}`);
await Admin.db.close();
