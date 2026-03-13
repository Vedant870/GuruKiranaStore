import bcrypt from 'bcryptjs';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { readStore, writeStore } from '../data/store.js';
import { authRequired, signToken } from '../middleware/auth.js';

const router = express.Router();

const sanitizeUser = ({ passwordHash, ...user }) => user;
const normalizeEmail = (email = '') => email.trim().toLowerCase();

const authenticateUser = async ({ email = '', password = '' }) => {
  const store = await readStore();
  const normalizedEmail = normalizeEmail(email);
  const user = store.users.find((entry) => entry.email === normalizedEmail);

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password.trim(), user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return user;
};

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
    const user = await authenticateUser(req.body);

    if (!user) {
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

router.post('/admin-login', async (req, res, next) => {
  try {
    const user = await authenticateUser(req.body);

    if (!user) {
      return res.status(401).json({ message: 'Invalid admin email or password.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'This login is only for admin access.' });
    }

    res.json({
      token: signToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const { currentPassword = '', newPassword = '' } = req.body;

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const store = await readStore();
    const userIndex = store.users.findIndex((entry) => entry.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword.trim(),
      store.users[userIndex].passwordHash,
    );

    if (!passwordMatches) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    store.users[userIndex] = {
      ...store.users[userIndex],
      passwordHash: await bcrypt.hash(newPassword.trim(), 10),
    };

    await writeStore(store);

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
