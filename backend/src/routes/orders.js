import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { readStore, writeStore } from '../data/store.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();
const validPaymentMethods = ['Cash on Delivery', 'UPI on Delivery', 'Store Pickup'];

router.post('/', authRequired, async (req, res, next) => {
  try {
    const {
      items = [],
      address = '',
      locality = '',
      notes = '',
      paymentMethod = 'Cash on Delivery',
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Please add at least one product to the order.' });
    }

    if (!address.trim() || !locality.trim()) {
      return res.status(400).json({ message: 'Address and locality are required.' });
    }

    const store = await readStore();
    const orderItems = [];

    for (const item of items) {
      const product = store.products.find((entry) => entry.id === item.productId);
      const quantity = Number(item.quantity);

      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Invalid product or quantity in order.' });
      }

      if (!product.available || product.stock === 0) {
        return res.status(400).json({
          message: `${product.name} is currently unavailable for ordering.`,
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          message: `Only ${product.stock} unit(s) of ${product.name} are currently available.`,
        });
      }

      orderItems.push({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        icon: product.icon,
        price: product.price,
        quantity,
        lineTotal: product.price * quantity,
      });
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = subtotal >= 399 ? 0 : 25;
    const createdAt = new Date().toISOString();

    const order = {
      id: uuidv4(),
      userId: req.user.id,
      customer: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
      },
      items: orderItems,
      address: address.trim(),
      locality: locality.trim(),
      notes: notes.trim(),
      paymentMethod: validPaymentMethods.includes(paymentMethod)
        ? paymentMethod
        : 'Cash on Delivery',
      subtotal,
      deliveryFee,
      totalAmount: subtotal + deliveryFee,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
    };

    store.orders.unshift(order);
    store.products = store.products.map((product) => {
      const orderedProduct = orderItems.find((item) => item.productId === product.id);

      if (!orderedProduct) {
        return product;
      }

      return {
        ...product,
        stock: Math.max(0, product.stock - orderedProduct.quantity),
        updatedAt: createdAt,
      };
    });

    await writeStore(store);

    res.status(201).json({
      message: 'Order placed successfully.',
      order,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/mine', authRequired, async (req, res, next) => {
  try {
    const store = await readStore();
    const orders = store.orders.filter((order) => order.userId === req.user.id);

    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

export default router;
