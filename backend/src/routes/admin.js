import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { readStore, writeStore } from '../data/store.js';
import { adminOnly, authRequired } from '../middleware/auth.js';

const router = express.Router();
const orderStatuses = ['pending', 'accepted', 'packed', 'out for delivery', 'completed', 'cancelled'];

const validateProductPayload = (payload) => {
  const name = String(payload.name || '').trim();
  const category = String(payload.category || '').trim();
  const unit = String(payload.unit || '').trim();
  const description = String(payload.description || '').trim();
  const icon = String(payload.icon || '🛒').trim() || '🛒';
  const badge = String(payload.badge || 'Fresh Pick').trim() || 'Fresh Pick';
  const price = Number(payload.price);
  const stock = Number(payload.stock);
  const featured = Boolean(payload.featured);
  const available = payload.available === undefined ? true : Boolean(payload.available);

  if (!name || !category || !unit || !description || Number.isNaN(price) || Number.isNaN(stock)) {
    return {
      valid: false,
      message: 'Name, category, unit, description, price, and stock are required.',
    };
  }

  if (price < 0 || stock < 0) {
    return {
      valid: false,
      message: 'Price and stock must be zero or more.',
    };
  }

  return {
    valid: true,
    data: {
      name,
      category,
      unit,
      description,
      icon,
      badge,
      price,
      stock,
      featured,
      available,
    },
  };
};

router.use(authRequired, adminOnly);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const store = await readStore();
    const totalRevenue = store.orders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + order.totalAmount, 0);

    res.json({
      stats: {
        totalProducts: store.products.length,
        totalOrders: store.orders.length,
        pendingOrders: store.orders.filter((order) => order.status === 'pending').length,
        totalRevenue,
      },
      products: [...store.products].sort(
        (first, second) => new Date(second.updatedAt) - new Date(first.updatedAt),
      ),
      orders: [...store.orders].sort(
        (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const store = await readStore();
    res.json({
      orders: [...store.orders].sort(
        (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const validation = validateProductPayload(req.body);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const store = await readStore();
    const createdAt = new Date().toISOString();
    const product = {
      id: uuidv4(),
      ...validation.data,
      createdAt,
      updatedAt: createdAt,
    };

    store.products.unshift(product);
    await writeStore(store);

    res.status(201).json({ message: 'Product added successfully.', product });
  } catch (error) {
    next(error);
  }
});

router.put('/products/:productId', async (req, res, next) => {
  try {
    const validation = validateProductPayload(req.body);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const store = await readStore();
    const productIndex = store.products.findIndex((product) => product.id === req.params.productId);

    if (productIndex === -1) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    store.products[productIndex] = {
      ...store.products[productIndex],
      ...validation.data,
      updatedAt: new Date().toISOString(),
    };

    await writeStore(store);

    res.json({
      message: 'Product updated successfully.',
      product: store.products[productIndex],
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:productId', async (req, res, next) => {
  try {
    const store = await readStore();
    const existingProduct = store.products.find((product) => product.id === req.params.productId);

    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    store.products = store.products.filter((product) => product.id !== req.params.productId);
    await writeStore(store);

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:orderId/status', async (req, res, next) => {
  try {
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!orderStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status.' });
    }

    const store = await readStore();
    const orderIndex = store.orders.findIndex((order) => order.id === req.params.orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    store.orders[orderIndex] = {
      ...store.orders[orderIndex],
      status,
      updatedAt: new Date().toISOString(),
    };

    await writeStore(store);

    res.json({
      message: 'Order status updated successfully.',
      order: store.orders[orderIndex],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
