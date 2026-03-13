import express from 'express';

import { readStore } from '../data/store.js';

const router = express.Router();

const commonWords = new Set([
  'what',
  'is',
  'the',
  'price',
  'rate',
  'cost',
  'of',
  'for',
  'do',
  'you',
  'have',
  'available',
  'availability',
  'in',
  'stock',
  'tell',
  'me',
  'about',
  'product',
  'please',
  'kitna',
  'kitne',
  'hai',
  'ka',
  'ki',
  'ke',
  'show',
  'current',
]);

const normalizeText = (value = '') => String(value).toLowerCase().trim();

const tokenize = (value = '') =>
  normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const getAvailabilityText = (product) => {
  if (!product.available) {
    return 'currently unavailable';
  }

  if (product.stock <= 0) {
    return 'out of stock right now';
  }

  if (product.stock <= 5) {
    return `available in low stock with ${product.stock} unit(s) left`;
  }

  return `available with ${product.stock} unit(s) in stock`;
};

const getProductScore = (product, message) => {
  const text = normalizeText(message);
  const name = normalizeText(product.name);
  const tokens = tokenize(name).filter((token) => token.length > 2 && !commonWords.has(token));
  let score = 0;

  if (text.includes(name)) {
    score += 10;
  }

  tokens.forEach((token) => {
    if (text.includes(token)) {
      score += 2;
    }
  });

  if (text.includes(normalizeText(product.category))) {
    score += 1;
  }

  return score;
};

router.post('/chat', async (req, res, next) => {
  try {
    const { message = '' } = req.body;
    const normalizedMessage = normalizeText(message);

    if (!normalizedMessage) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const store = await readStore();
    const asksPrice = /price|rate|cost|rupee|₹|kitna|kitne/.test(normalizedMessage);
    const asksAvailability = /available|availability|stock|have|milega|milta/.test(normalizedMessage);

    const scoredProducts = store.products
      .map((product) => ({
        product,
        score: getProductScore(product, normalizedMessage),
      }))
      .sort((first, second) => second.score - first.score);

    const bestMatch = scoredProducts[0];

    if (bestMatch?.score >= 2) {
      const { product } = bestMatch;
      const availabilityText = getAvailabilityText(product);
      const priceText = `${product.name} is priced at ₹${product.sellingPrice} for ${product.unit}.`;
      const availabilityReply = `${product.name} is ${availabilityText}.`;

      let reply = `${priceText} ${availabilityReply}`;

      if (asksPrice && !asksAvailability) {
        reply = priceText;
      } else if (!asksPrice && asksAvailability) {
        reply = availabilityReply;
      }

      return res.json({
        reply,
        product: {
          id: product.id,
          name: product.name,
          sellingPrice: product.sellingPrice,
          available: product.available,
          stock: product.stock,
          unit: product.unit,
        },
      });
    }

    const categoryMatch = [...new Set(store.products.map((product) => product.category))].find((category) =>
      normalizedMessage.includes(normalizeText(category)),
    );

    if (categoryMatch) {
      const categoryProducts = store.products.filter(
        (product) => product.category === categoryMatch && product.available && product.stock > 0,
      );

      if (categoryProducts.length === 0) {
        return res.json({
          reply: `No, no ${categoryMatch.toLowerCase()} products are available right now.`,
        });
      }

      const listedProducts = categoryProducts
        .slice(0, 4)
        .map((product) => `${product.name} at ₹${product.sellingPrice}`)
        .join(', ');

      return res.json({
        reply: `${categoryMatch} products available right now are: ${listedProducts}.`,
      });
    }

    res.json({
      reply: 'No, I could not find that product or information right now.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
