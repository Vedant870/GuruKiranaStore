import jwt from 'jsonwebtoken';

import { readStore } from '../data/store.js';

const jwtSecret = process.env.JWT_SECRET || 'guru-kirana-super-secret-key';

export const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    },
  );

export const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, jwtSecret);
    const store = await readStore();
    const user = store.users.find((entry) => entry.id === decoded.sub);

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };

    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  next();
};
