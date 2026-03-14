import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const dataDirectory = isVercel
  ? path.join(os.tmpdir(), 'guru-kirana-store-data')
  : path.resolve(__dirname, '../../data');
const storeFilePath = path.join(dataDirectory, 'store.json');

const seedProducts = [
  {
    name: 'Aashirvaad Shudh Chakki Atta',
    category: 'Staples',
    price: 315,
    unit: '5 kg',
    stock: 22,
    icon: '🌾',
    badge: 'Best Seller',
    featured: true,
    description: 'Soft roti atta trusted by homes for daily meals.',
  },
  {
    name: 'Fortune Basmati Rice',
    category: 'Staples',
    price: 520,
    unit: '5 kg',
    stock: 16,
    icon: '🍚',
    badge: 'Premium',
    featured: true,
    description: 'Fragrant long-grain rice for family lunch and dinner.',
  },
  {
    name: 'Tata Salt',
    category: 'Daily Essentials',
    price: 30,
    unit: '1 kg',
    stock: 45,
    icon: '🧂',
    badge: 'Daily Need',
    featured: false,
    description: 'Iodized salt for pure daily cooking essentials.',
  },
  {
    name: 'Amul Gold Milk',
    category: 'Dairy',
    price: 34,
    unit: '500 ml',
    stock: 40,
    icon: '🥛',
    badge: 'Fresh',
    featured: true,
    description: 'Rich milk packet for tea, coffee, sweets, and breakfast.',
  },
  {
    name: 'Parle-G Family Pack',
    category: 'Snacks',
    price: 55,
    unit: '800 g',
    stock: 30,
    icon: '🍪',
    badge: 'Family Pack',
    featured: false,
    description: 'Tea-time favorite biscuit pack for every home.',
  },
  {
    name: 'Maggi Noodles Combo',
    category: 'Snacks',
    price: 72,
    unit: '6 packs',
    stock: 25,
    icon: '🍜',
    badge: 'Quick Meal',
    featured: true,
    description: 'Instant snack combo loved by students and families.',
  },
  {
    name: 'Surf Excel Easy Wash',
    category: 'Household',
    price: 125,
    unit: '1 kg',
    stock: 20,
    icon: '🧺',
    badge: 'Value',
    featured: false,
    description: 'Detergent powder for bright clothes and daily washing.',
  },
  {
    name: 'Lizol Floor Cleaner',
    category: 'Household',
    price: 185,
    unit: '1 L',
    stock: 18,
    icon: '🧴',
    badge: 'Clean Home',
    featured: false,
    description: 'Strong floor cleaning solution with hygienic freshness.',
  },
  {
    name: 'Good Life Refined Oil',
    category: 'Cooking',
    price: 168,
    unit: '1 L',
    stock: 28,
    icon: '🫗',
    badge: 'Healthy Choice',
    featured: false,
    description: 'Light cooking oil for routine kitchen use.',
  },
  {
    name: 'Toor Dal Premium',
    category: 'Staples',
    price: 165,
    unit: '1 kg',
    stock: 19,
    icon: '🫘',
    badge: 'Protein Rich',
    featured: true,
    description: 'Clean and premium dal for healthy family meals.',
  },
  {
    name: 'Colgate Strong Teeth',
    category: 'Personal Care',
    price: 98,
    unit: '2 x 150 g',
    stock: 24,
    icon: '🪥',
    badge: 'Combo',
    featured: false,
    description: 'Family toothpaste combo for everyday oral care.',
  },
  {
    name: 'Cold Drink Party Bottle',
    category: 'Beverages',
    price: 95,
    unit: '2.25 L',
    stock: 14,
    icon: '🥤',
    badge: 'Party Pick',
    featured: true,
    description: 'Chilled refreshment for guests and celebrations.',
  },
];

const nowIso = () => new Date().toISOString();

const normalizeProduct = (product) => {
  const sellingPrice = Number(product.sellingPrice ?? product.price ?? 0);
  const derivedBuyPrice = Math.max(0, Math.round(sellingPrice * 0.8));
  const buyPrice = Number(product.buyPrice ?? derivedBuyPrice);

  return {
    ...product,
    price: sellingPrice,
    sellingPrice,
    buyPrice,
    available:
      typeof product.available === 'boolean'
        ? product.available
        : Number(product.stock || 0) > 0,
  };
};

const normalizeOrderItem = (item) => {
  const quantity = Number(item.quantity || 0);
  const sellingPrice = Number(item.sellingPrice ?? item.price ?? 0);
  const derivedBuyPrice = Math.max(0, Math.round(sellingPrice * 0.8));
  const buyPrice = Number(item.buyPrice ?? derivedBuyPrice);
  const lineTotal = Number(item.lineTotal ?? sellingPrice * quantity);
  const lineCost = Number(item.lineCost ?? buyPrice * quantity);
  const lineProfit = Number(item.lineProfit ?? lineTotal - lineCost);

  return {
    ...item,
    price: sellingPrice,
    sellingPrice,
    buyPrice,
    lineTotal,
    lineCost,
    lineProfit,
  };
};

const normalizeOrder = (order) => {
  const items = Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [];
  const subtotal = Number(order.subtotal ?? items.reduce((sum, item) => sum + item.lineTotal, 0));
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const totalCost = Number(order.totalCost ?? items.reduce((sum, item) => sum + item.lineCost, 0));
  const profitAmount = Number(order.profitAmount ?? items.reduce((sum, item) => sum + item.lineProfit, 0));

  return {
    ...order,
    items,
    subtotal,
    deliveryFee,
    totalAmount: Number(order.totalAmount ?? subtotal + deliveryFee),
    totalCost,
    profitAmount,
  };
};

const normalizeStore = (store) => ({
  ...store,
  products: Array.isArray(store.products)
    ? store.products.map(normalizeProduct)
    : [],
  orders: Array.isArray(store.orders) ? store.orders.map(normalizeOrder) : [],
});

const createInitialStore = async () => {
  const createdAt = nowIso();
  const adminPasswordHash = await bcrypt.hash('GuruAdmin@123', 10);

  return {
    users: [
      {
        id: uuidv4(),
        name: 'Mr. Kesri Nandan',
        email: 'admin@gurukiranastore.in',
        phone: '9999999999',
        role: 'admin',
        passwordHash: adminPasswordHash,
        createdAt,
      },
    ],
    products: seedProducts.map((product) => ({
      id: uuidv4(),
      createdAt,
      updatedAt: createdAt,
      ...product,
      sellingPrice: product.price,
      buyPrice: Math.max(0, Math.round(product.price * 0.8)),
      available: true,
    })),
    orders: [],
  };
};

export const ensureStore = async () => {
  try {
    const fileContent = await fs.readFile(storeFilePath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    const normalizedStore = normalizeStore(parsed);

    if (!normalizedStore.users || !normalizedStore.products || !normalizedStore.orders) {
      throw new Error('Invalid store file format.');
    }

    if (JSON.stringify(parsed) !== JSON.stringify(normalizedStore)) {
      await fs.writeFile(storeFilePath, JSON.stringify(normalizedStore, null, 2), 'utf-8');
    }
  } catch {
    await fs.mkdir(dataDirectory, { recursive: true });
    const initialStore = await createInitialStore();
    await fs.writeFile(storeFilePath, JSON.stringify(initialStore, null, 2), 'utf-8');
  }
};

export const readStore = async () => {
  await ensureStore();
  const fileContent = await fs.readFile(storeFilePath, 'utf-8');
  return normalizeStore(JSON.parse(fileContent));
};

export const writeStore = async (store) => {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(storeFilePath, JSON.stringify(store, null, 2), 'utf-8');
  return store;
};
