import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/index.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

function tokenFor(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', asyncHandler(async (request, response) => {
  const { fullName, email, password, confirmPassword, phone } = request.body;
  if (!fullName || !email || !password) return response.status(400).json({ message: 'fullName, email and password are required' });
  if (confirmPassword !== undefined && password !== confirmPassword) return response.status(400).json({ message: 'Passwords do not match' });
  if (password.length < 8) return response.status(400).json({ message: 'Password must be at least 8 characters' });
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists) return response.status(409).json({ message: 'Email is already registered' });
  const user = await User.create({
    fullName, email, phone, passwordHash: await bcrypt.hash(password, 12),
    role: 'customer', accountType: 'customer', mustChangePassword: false
  });
  response.status(201).json({ data: { user, token: tokenFor(user) } });
}));

router.post('/forgot-password', asyncHandler(async (request, response) => {
  const user = await User.findOne({ email: request.body.email?.toLowerCase(), role: 'customer' }).select('+passwordResetToken +passwordResetExpires');
  if (user) {
    user.passwordResetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    return response.json({ message: 'If that email exists, reset instructions have been created', resetToken: user.passwordResetToken });
  }
  response.json({ message: 'If that email exists, reset instructions have been created' });
}));

router.post('/reset-password', asyncHandler(async (request, response) => {
  const { token, password, confirmPassword } = request.body;
  if (!token || !password || password !== confirmPassword || password.length < 8) return response.status(400).json({ message: 'Valid token and matching 8 character password are required' });
  const user = await User.findOne({ role: 'customer', passwordResetToken: token, passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return response.status(400).json({ message: 'Reset token is invalid or expired' });
  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetToken = undefined; user.passwordResetExpires = undefined; user.mustChangePassword = false;
  await user.save();
  response.json({ message: 'Password reset successfully' });
}));

router.post('/login', asyncHandler(async (request, response) => {
  const { email, password } = request.body;
  const user = await User.findOne({ email: email?.toLowerCase(), isActive: true }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }
  user.lastLoginAt = new Date();
  await user.save();
  response.json({ data: { user, token: tokenFor(user) } });
}));

router.get('/me', requireAuth, (request, response) => response.json({ data: request.user }));
export default router;
