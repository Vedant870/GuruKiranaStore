import bcrypt from 'bcryptjs';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { readStore, writeStore } from '../data/store.js';
import { authRequired, signToken } from '../middleware/auth.js';

const router = express.Router();

const sanitizeUser = ({ passwordHash, ...user }) => user;
const normalizeEmail = (email = '') => email.trim().toLowerCase();

router.post('/register', async (req, res, next) => {
  try {
    const { name = '', phone = '', email = '', password = '' } = req.body;

    if (!name.trim() || !phone.trim() || !email.trim() || password.trim().length < 6) {
      return res.status(400).json({
        message: 'Name, phone, email, and a 6+ character password are required.',
      });
    }

    const store = await readStore();
    const normalizedEmail = normalizeEmail(email);

    if (store.users.some((user) => user.email === normalizedEmail)) {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }

    const createdAt = new Date().toISOString();
    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password.trim(), 10),
      role: 'customer',
      createdAt,
    };

    store.users.push(newUser);
    await writeStore(store);

    res.status(201).json({
      token: signToken(newUser),
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email = '', password = '' } = req.body;
    const store = await readStore();
    const normalizedEmail = normalizeEmail(email);
    const user = store.users.find((entry) => entry.email === normalizedEmail);

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password.trim(), user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    res.json({
      token: signToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
