import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { env } from '../env.js';
import { requireAdmin } from '../middleware/auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

authRouter.post('/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const row = db
    .prepare('SELECT email, password_hash FROM admin_users WHERE email = ?')
    .get(email.toLowerCase().trim()) as { email: string; password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const token = jwt.sign({ sub: row.email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.json({ token, email: row.email });
});

authRouter.get('/auth/me', requireAdmin, (req, res) => {
  res.json({ email: req.admin!.sub });
});
