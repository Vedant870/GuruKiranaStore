import express from 'express';

import { readStore } from '../data/store.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { search = '', category = 'All' } = req.query;
    const store = await readStore();

    const normalizedSearch = String(search).trim().toLowerCase();
    const normalizedCategory = String(category).trim();

    const products = store.products
      .filter((product) => {
        const matchesSearch =
          !normalizedSearch ||
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.description.toLowerCase().includes(normalizedSearch) ||
          product.category.toLowerCase().includes(normalizedSearch);

        const matchesCategory =
          normalizedCategory === 'All' || product.category === normalizedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((first, second) => Number(second.featured) - Number(first.featured));

    const categories = ['All', ...new Set(store.products.map((product) => product.category))];

    res.json({ products, categories });
  } catch (error) {
    next(error);
  }
});

export default router;
