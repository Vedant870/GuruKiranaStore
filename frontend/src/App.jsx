import { useEffect, useMemo, useState } from 'react';

import { api, clearSession, loadStoredSession, saveSession } from './api';
import logo from './assets/guru-kirana-logo.svg';
import './App.css';

const shopDetails = {
  name: 'Guru Kirana Store',
  address: 'Guru Kirana Store, Patranga Mandi, Ayodhya, near Railway Station, 225408',
  locationShort: 'Patranga Mandi, Ayodhya',
  serviceRange: '15-20 km nearby delivery',
  proprietor: 'Mr. Kesri Nandan',
};

const heroFocusPoints = [
  {
    title: 'Current location',
    text: 'Patranga Mandi, Ayodhya, near Railway Station',
  },
  {
    title: 'Delivery area',
    text: 'Fast grocery support within 15-20 km',
  },
  {
    title: 'Live stock visibility',
    text: 'Customers see available, low stock, and out of stock items clearly',
  },
];

const steps = [
  'Browse products and offers from Guru Kirana Store.',
  'Login or register only when you want to place an order.',
  'Add products to cart, enter locality and address, and submit the order.',
  'Admin receives the order instantly and manages delivery status from dashboard.',
];

const orderStatuses = ['pending', 'accepted', 'packed', 'out for delivery', 'completed', 'cancelled'];

const emptyAuthForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
};

const emptyAdminAuthForm = {
  email: '',
  password: '',
};

const emptyCheckoutForm = {
  address: '',
  locality: '',
  notes: '',
  paymentMethod: 'Cash on Delivery',
};

const emptyProductForm = {
  name: '',
  category: 'Staples',
  price: '',
  unit: '',
  stock: '',
  description: '',
  icon: '🛒',
  badge: 'Fresh Pick',
  featured: false,
  available: true,
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatPrice = (value) => currencyFormatter.format(Number(value || 0));

const formatDate = (value) =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const getAvailabilityMeta = (product) => {
  if (!product.available) {
    return {
      label: 'Hidden by admin',
      className: 'availability availability--paused',
      canOrder: false,
      helper: 'This item is currently hidden from ordering by admin.',
    };
  }

  if (product.stock <= 0) {
    return {
      label: 'Out of stock',
      className: 'availability availability--out',
      canOrder: false,
      helper: 'Currently unavailable.',
    };
  }

  if (product.stock <= 5) {
    return {
      label: 'Low stock',
      className: 'availability availability--low',
      canOrder: true,
      helper: `Only ${product.stock} left in stock.`,
    };
  }

  return {
    label: 'Available',
    className: 'availability availability--in',
    canOrder: true,
    helper: `${product.stock} units available.`,
  };
};

const getAiAssistantState = (cart, products, subtotal) => {
  const cartIds = new Set(cart.map((item) => item.id));
  const cartNames = cart.map((item) => item.name.toLowerCase());
  const cartCategories = new Set(cart.map((item) => item.category));

  const suggestions = products
    .map((product) => {
      const availability = getAvailabilityMeta(product);

      if (!availability.canOrder || cartIds.has(product.id)) {
        return null;
      }

      let score = product.featured ? 2 : 0;
      let reason = 'Popular nearby grocery pick for repeat household orders.';

      if (cart.length === 0) {
        if (['Staples', 'Daily Essentials', 'Cooking'].includes(product.category)) {
          score += 4;
          reason = 'Strong starter product for most daily home grocery baskets.';
        }

        if (product.featured) {
          score += 1;
          reason = 'Fast-moving featured item customers often notice first.';
        }
      }

      if (cartCategories.has('Staples') && ['Cooking', 'Daily Essentials'].includes(product.category)) {
        score += 4;
        reason = 'Completes a practical ration basket for home cooking.';
      }

      if (cartCategories.has('Dairy') && product.category === 'Snacks') {
        score += 3;
        reason = 'Good breakfast and tea-time add-on with dairy purchases.';
      }

      if (cartCategories.has('Household') && product.category === 'Personal Care') {
        score += 2;
        reason = 'Common monthly home-restock pairing with household essentials.';
      }

      if (cartNames.some((name) => name.includes('atta') || name.includes('rice'))) {
        if (['Tata Salt', 'Good Life Refined Oil', 'Toor Dal Premium'].includes(product.name)) {
          score += 5;
          reason = 'Completes the basic kitchen combo people often order together.';
        }
      }

      if (cartNames.some((name) => name.includes('milk')) && product.name.includes('Parle-G')) {
        score += 5;
        reason = 'Milk and biscuits are a very common family add-on pair.';
      }

      if (cartNames.some((name) => name.includes('noddles') || name.includes('noodles')) && product.category === 'Beverages') {
        score += 2;
        reason = 'Snack-time baskets often include a chilled drink add-on.';
      }

      if (subtotal > 0 && subtotal < 399 && product.price <= 160) {
        score += 1;
        reason = 'Useful low-cost add-on that can improve basket value.';
      }

      return score > 0
        ? {
            ...product,
            score,
            reason,
          }
        : null;
    })
    .filter(Boolean)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);

  const insight =
    cart.length === 0
      ? `AI is highlighting daily essentials customers around ${shopDetails.locationShort} often buy first.`
      : subtotal < 399
        ? 'AI is suggesting useful add-ons based on your current basket and household grocery patterns.'
        : 'AI is suggesting complementary products based on the mix of items already in your cart.';

  return {
    insight,
    suggestions,
  };
};

const getStatusTone = (status) => {
  if (status === 'completed') {
    return 'status--success';
  }

  if (status === 'cancelled') {
    return 'status--danger';
  }

  if (['accepted', 'packed', 'out for delivery'].includes(status)) {
    return 'status--warning';
  }

  return 'status--neutral';
};

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="section-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  const availability = getAvailabilityMeta(product);

  return (
    <article className="product-card">
      <div className="product-card__top">
        <span className="product-card__icon">{product.icon}</span>
        <div className="product-card__badges">
          <span className="tag">{product.badge}</span>
          <span className={availability.className}>{availability.label}</span>
        </div>
      </div>
      <div className="product-card__body">
        <div>
          <p className="product-card__category">{product.category}</p>
          <h3>{product.name}</h3>
          <p className="product-card__description">{product.description}</p>
        </div>
        <div className="product-card__footer">
          <div>
            <strong>{formatPrice(product.price)}</strong>
            <span>{product.unit}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAdd(product)}
            disabled={!availability.canOrder}
          >
            {availability.canOrder ? 'Add to cart' : 'Unavailable'}
          </button>
        </div>
        <p className="inventory-text">{availability.helper}</p>
      </div>
    </article>
  );
}

function OrderCard({ order, adminMode = false, onStatusChange }) {
  return (
    <article className="order-card">
      <div className="order-card__header">
        <div>
          <p className="order-card__id">Order #{order.id.slice(0, 8).toUpperCase()}</p>
          <h3>{adminMode ? order.customer?.name || 'Customer Order' : 'Your grocery order'}</h3>
          <p className="order-card__meta">{formatDate(order.createdAt)}</p>
        </div>
        <span className={`status ${getStatusTone(order.status)}`}>{order.status}</span>
      </div>

      <div className="order-card__details">
        <div className="meta-list">
          <span>{order.locality}</span>
          <span>{order.paymentMethod}</span>
          {adminMode && order.customer?.phone ? <span>{order.customer.phone}</span> : null}
        </div>

        <div className="order-lines">
          {order.items.map((item) => (
            <div key={`${order.id}-${item.productId}`} className="order-line">
              <div>
                <strong>
                  {item.icon} {item.name}
                </strong>
                <p>
                  {item.quantity} × {formatPrice(item.price)} · {item.unit}
                </p>
              </div>
              <span>{formatPrice(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="order-total-block">
          <div>
            <span>Subtotal</span>
            <strong>{formatPrice(order.subtotal)}</strong>
          </div>
          <div>
            <span>Delivery</span>
            <strong>{formatPrice(order.deliveryFee)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatPrice(order.totalAmount)}</strong>
          </div>
        </div>

        <p className="address-text">{order.address}</p>
        {order.notes ? <p className="notes-text">Note: {order.notes}</p> : null}

        {adminMode && onStatusChange ? (
          <label className="select-label">
            Update order status
            <select value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value)}>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </article>
  );
}

function App() {
  const storedSession = loadStoredSession();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(storedSession.user);
  const [token, setToken] = useState(storedSession.token);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [adminAuthForm, setAdminAuthForm] = useState(emptyAdminAuthForm);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckoutForm);
  const [userOrders, setUserOrders] = useState([]);
  const [adminData, setAdminData] = useState({
    stats: null,
    products: [],
    orders: [],
  });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState(null);
  const [busy, setBusy] = useState({
    auth: false,
    adminLogin: false,
    checkout: false,
    adminProduct: false,
  });
  const [alert, setAlert] = useState({ type: '', text: '' });

  const showAlert = (text, type = 'success') => {
    setAlert({ text, type });
  };

  useEffect(() => {
    if (!alert.text) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAlert({ type: '', text: '' });
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    const revealElements = document.querySelectorAll('[data-reveal]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const data = await api.getProducts();
      setProducts(data.products || []);
      setCategories(data.categories || ['All']);
    } catch (error) {
      showAlert(error.message || 'Unable to load products.', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadProfile = async () => {
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const data = await api.me();
      setUser(data.user);
      saveSession(token, data.user);
    } catch {
      clearSession();
      setUser(null);
      setToken(null);
    }
  };

  const loadUserOrders = async () => {
    if (!token) {
      setUserOrders([]);
      return;
    }

    try {
      const data = await api.getMyOrders();
      setUserOrders(data.orders || []);
    } catch (error) {
      showAlert(error.message || 'Unable to load your orders.', 'error');
    }
  };

  const loadAdminDashboard = async () => {
    if (user?.role !== 'admin') {
      setAdminData({ stats: null, products: [], orders: [] });
      return;
    }

    try {
      const data = await api.getAdminDashboard();
      setAdminData({
        stats: data.stats,
        products: data.products || [],
        orders: data.orders || [],
      });
    } catch (error) {
      showAlert(error.message || 'Unable to load admin dashboard.', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadProfile();
  }, [token]);

  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      setAdminData({ stats: null, products: [], orders: [] });
      return;
    }

    loadUserOrders();

    if (user.role === 'admin') {
      loadAdminDashboard();
    }
  }, [user]);

  const featuredProducts = useMemo(
    () => products.filter((product) => product.featured).slice(0, 3),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, searchText]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const deliveryFee = cartSubtotal >= 399 || cartSubtotal === 0 ? 0 : 25;
  const cartTotal = cartSubtotal + deliveryFee;
  const aiAssistantState = useMemo(
    () => getAiAssistantState(cart, products, cartSubtotal),
    [cart, products, cartSubtotal],
  );

  const addToCart = (product) => {
    const availability = getAvailabilityMeta(product);

    if (!availability.canOrder) {
      showAlert('This item is currently unavailable for ordering.', 'error');
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (!existingItem) {
        return [...currentCart, { ...product, quantity: 1 }];
      }

      const nextQuantity = Math.min(existingItem.quantity + 1, product.stock);

      return currentCart.map((item) =>
        item.id === product.id
          ? {
              ...item,
              quantity: nextQuantity,
            }
          : item,
      );
    });

    showAlert(`${product.name} added to cart.`, 'success');
  };

  const updateCartQuantity = (productId, nextQuantity) => {
    const product = products.find((entry) => entry.id === productId);
    const safeMax = product?.available ? product.stock : 0;

    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id !== productId) {
          return [item];
        }

        const safeQuantity = Math.max(0, Math.min(nextQuantity, safeMax));

        if (safeQuantity === 0) {
          return [];
        }

        return [{ ...item, quantity: safeQuantity }];
      }),
    );
  };

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAdminAuthChange = (event) => {
    const { name, value } = event.target;
    setAdminAuthForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCheckoutChange = (event) => {
    const { name, value } = event.target;
    setCheckoutForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleProductChange = (event) => {
    const { name, type, value, checked } = event.target;
    setProductForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    try {
      setBusy((current) => ({ ...current, auth: true }));
      const response =
        authMode === 'login'
          ? await api.login({
              email: authForm.email,
              password: authForm.password,
            })
          : await api.register(authForm);

      saveSession(response.token, response.user);
      setToken(response.token);
      setUser(response.user);
      setAuthForm(emptyAuthForm);
      showAlert(
        authMode === 'login'
          ? 'Login successful. You can now place your order.'
          : 'Account created successfully. Start ordering now.',
        'success',
      );
    } catch (error) {
      showAlert(error.message || 'Unable to continue.', 'error');
    } finally {
      setBusy((current) => ({ ...current, auth: false }));
    }
  };

  const handleAdminLoginSubmit = async (event) => {
    event.preventDefault();

    try {
      setBusy((current) => ({ ...current, adminLogin: true }));
      const response = await api.login(adminAuthForm);

      if (response.user.role !== 'admin') {
        setAdminAuthForm(emptyAdminAuthForm);
        showAlert('This private section is only for admin login.', 'error');
        return;
      }

      saveSession(response.token, response.user);
      setToken(response.token);
      setUser(response.user);
      setAdminAuthForm(emptyAdminAuthForm);
      showAlert('Private admin access granted successfully.', 'success');
    } catch (error) {
      showAlert(error.message || 'Unable to open admin access.', 'error');
    } finally {
      setBusy((current) => ({ ...current, adminLogin: false }));
    }
  };

  const handleLogout = () => {
    clearSession();
    setToken(null);
    setUser(null);
    setCart([]);
    setUserOrders([]);
    setAdminData({ stats: null, products: [], orders: [] });
    showAlert('You have been logged out.', 'success');
  };

  const handleCheckout = async (event) => {
    event.preventDefault();

    if (!user) {
      showAlert('Please login or register before placing an order.', 'error');
      return;
    }

    if (cart.length === 0) {
      showAlert('Your cart is empty.', 'error');
      return;
    }

    try {
      setBusy((current) => ({ ...current, checkout: true }));

      const response = await api.placeOrder({
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        ...checkoutForm,
      });

      setCart([]);
      setCheckoutForm(emptyCheckoutForm);
      showAlert(
        `Order placed successfully. Order ID: ${response.order.id.slice(0, 8).toUpperCase()}`,
        'success',
      );

      await Promise.all([
        loadProducts(),
        loadUserOrders(),
        user.role === 'admin' ? loadAdminDashboard() : Promise.resolve(),
      ]);
    } catch (error) {
      showAlert(error.message || 'Unable to place the order.', 'error');
    } finally {
      setBusy((current) => ({ ...current, checkout: false }));
    }
  };

  const handleAdminProductSubmit = async (event) => {
    event.preventDefault();

    try {
      setBusy((current) => ({ ...current, adminProduct: true }));
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
      };

      if (editingProductId) {
        await api.updateProduct(editingProductId, payload);
        showAlert('Product updated successfully.', 'success');
      } else {
        await api.createProduct(payload);
        showAlert('Product created successfully.', 'success');
      }

      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await Promise.all([loadProducts(), loadAdminDashboard()]);
    } catch (error) {
      showAlert(error.message || 'Unable to save the product.', 'error');
    } finally {
      setBusy((current) => ({ ...current, adminProduct: false }));
    }
  };

  const beginEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      stock: String(product.stock),
      description: product.description,
      icon: product.icon,
      badge: product.badge,
      featured: product.featured,
      available: product.available ?? product.stock > 0,
    });
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  };

  const handleDeleteProduct = async (productId) => {
    const shouldDelete = window.confirm('Delete this product from the store?');

    if (!shouldDelete) {
      return;
    }

    try {
      await api.deleteProduct(productId);
      showAlert('Product deleted successfully.', 'success');
      await Promise.all([loadProducts(), loadAdminDashboard()]);
    } catch (error) {
      showAlert(error.message || 'Unable to delete the product.', 'error');
    }
  };

  const handleOrderStatusChange = async (orderId, status) => {
    try {
      await api.updateOrderStatus(orderId, status);
      showAlert('Order status updated.', 'success');
      await Promise.all([loadAdminDashboard(), loadUserOrders()]);
    } catch (error) {
      showAlert(error.message || 'Unable to update order status.', 'error');
    }
  };

  const adminStats = adminData.stats || {
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
  };

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb--one" />
      <div className="bg-orb bg-orb--two" />

      {alert.text ? <div className={`alert alert--${alert.type || 'success'}`}>{alert.text}</div> : null}

      <header className="topbar">
        <a href="#top" className="brand">
          <img src={logo} alt="Guru Kirana Store logo" />
          <div>
            <strong>Guru Kirana Store</strong>
            <span>Trusted local grocery by Mr. Kesri Nandan</span>
          </div>
        </a>

        <nav className="topbar__nav">
          <a href="#products">Products</a>
          {user ? <a href="#orders">Orders</a> : null}
          {user?.role === 'admin' ? <a href="#admin">Admin</a> : <a href="#admin-access">Admin Access</a>}
        </nav>

        <div className="topbar__actions">
          <div className="mini-badge">15-20 km nearby delivery</div>
          {user ? (
            <div className="user-quick-actions">
              <span className="user-pill">{user.role === 'admin' ? 'Admin' : 'Customer'} · {user.name}</span>
              <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <a className="btn btn-primary" href="#auth-panel">
              Login / Register
            </a>
          )}
        </div>
      </header>

      <main id="top" className="page-content">
        <section className="hero">
          <div className="hero__content reveal reveal--left is-visible" data-reveal>
            <span className="hero-pill">Trusted local grocery store</span>
            <h1>
              Main daily grocery items, clear prices, and quick local ordering from <span>Guru Kirana Store</span>.
            </h1>
            <p className="hero-copy">
              Customers should see only the important things first: your shop name, current
              location, delivery area, product availability, and a direct way to order.
            </p>

            <div className="hero-location-line">
              <span>Current shop location</span>
              <strong>{shopDetails.address}</strong>
            </div>

            <div className="hero__actions">
              <a className="btn btn-primary" href="#products">
                See products
              </a>
              <a className="btn btn-secondary" href="#shop-location">
                Shop location
              </a>
            </div>

            <div className="hero__grid">
              {heroFocusPoints.map((item) => (
                <div key={item.title} className="hero-stat-card">
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero__panel">
            <div id="shop-location" className="hero__panel-card hero__panel-card--location reveal reveal--right is-visible" data-reveal>
              <p className="eyebrow">Shop location</p>
              <h3>{shopDetails.name}</h3>
              <p className="hero__panel-address">{shopDetails.address}</p>

              <div className="hero-location-grid">
                <div className="hero-location-item">
                  <span>Service area</span>
                  <strong>{shopDetails.serviceRange}</strong>
                </div>
                <div className="hero-location-item">
                  <span>Managed by</span>
                  <strong>{shopDetails.proprietor}</strong>
                </div>
                <div className="hero-location-item">
                  <span>Ordering flow</span>
                  <strong>Browse first, login only when placing order</strong>
                </div>
                <div className="hero-location-item">
                  <span>Main focus</span>
                  <strong>Items, rates, stock, and fast ordering</strong>
                </div>
              </div>
            </div>

            <div className="hero__panel-card hero__panel-card--soft reveal reveal--right is-visible" data-reveal>
              <p className="eyebrow">Main products on homepage</p>
              <h3>Important items customers notice first</h3>
              <div className="hero-product-list">
                {featuredProducts.map((product) => (
                  <div key={product.id} className="hero-product-item">
                    <span>{product.icon}</span>
                    <div>
                      <strong>{product.name}</strong>
                      <p>
                        {product.unit} · {formatPrice(product.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="hero-panel-note">
                The homepage is now more focused on products, location, stock visibility, and quick
                ordering instead of extra decorative content.
              </p>
            </div>
          </div>
        </section>

        <section id="products" className="catalog-layout">
          <div className="catalog-panel card reveal reveal--up" data-reveal>
            <SectionHeader
              eyebrow="Product showcase"
              title="Daily essentials, staples, snacks, beverages, and household items"
              description="Customers can search, browse categories, and add items easily from a clean modern shopping interface."
            />

            <div className="catalog-toolbar">
              <input
                type="text"
                placeholder="Search products, categories, or daily essentials"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              <div className="category-pills">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={activeCategory === category ? 'category-pill active' : 'category-pill'}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {loadingProducts ? (
              <div className="empty-state">Loading products...</div>
            ) : visibleProducts.length === 0 ? (
              <div className="empty-state">No products match your current search.</div>
            ) : (
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>

          <aside className="sidebar-stack">
            <div className="card cart-card reveal reveal--up" data-reveal>
              <div className="card-header-inline">
                <div>
                  <p className="eyebrow">Cart summary</p>
                  <h3>{cartCount} item(s) selected</h3>
                </div>
                <span className="mini-badge">Free delivery over ₹399</span>
              </div>

              {cart.length === 0 ? (
                <div className="empty-state">Add products to build your grocery order.</div>
              ) : (
                <div className="cart-list">
                  {cart.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item__info">
                        <span className="cart-item__icon">{item.icon}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <p>
                            {formatPrice(item.price)} · {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="quantity-stepper">
                        <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity - 1)}>
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="total-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(cartSubtotal)}</strong>
                </div>
                <div>
                  <span>Delivery fee</span>
                  <strong>{formatPrice(deliveryFee)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatPrice(cartTotal)}</strong>
                </div>
              </div>

              <form className="checkout-form" onSubmit={handleCheckout}>
                <label>
                  Delivery address
                  <textarea
                    name="address"
                    value={checkoutForm.address}
                    onChange={handleCheckoutChange}
                    placeholder="House number, street, landmark"
                    rows="3"
                  />
                </label>

                <label>
                  Area / locality
                  <input
                    type="text"
                    name="locality"
                    value={checkoutForm.locality}
                    onChange={handleCheckoutChange}
                    placeholder="Nearby area within 15-20 km"
                  />
                </label>

                <label>
                  Payment method
                  <select
                    name="paymentMethod"
                    value={checkoutForm.paymentMethod}
                    onChange={handleCheckoutChange}
                  >
                    <option>Cash on Delivery</option>
                    <option>UPI on Delivery</option>
                    <option>Store Pickup</option>
                  </select>
                </label>

                <label>
                  Extra note
                  <textarea
                    name="notes"
                    value={checkoutForm.notes}
                    onChange={handleCheckoutChange}
                    placeholder="Special request, urgent delivery note, landmark"
                    rows="2"
                  />
                </label>

                <button type="submit" className="btn btn-primary btn-block" disabled={busy.checkout}>
                  {busy.checkout
                    ? 'Placing order...'
                    : user
                      ? 'Place order now'
                      : 'Login to place order'}
                </button>
              </form>
            </div>

            <div className="card ai-card reveal reveal--up" data-reveal>
              <div className="card-header-inline">
                <div>
                  <p className="eyebrow">AI smart basket assistant</p>
                  <h3>Better grocery suggestions for growing business</h3>
                </div>
                <span className="mini-badge">AI-based</span>
              </div>

              <p className="ai-card__intro">{aiAssistantState.insight}</p>

              <div className="ai-suggestion-list">
                {aiAssistantState.suggestions.map((product) => (
                  <div key={`ai-${product.id}`} className="ai-suggestion">
                    <div className="ai-suggestion__top">
                      <div className="ai-suggestion__name">
                        <span className="ai-suggestion__icon">{product.icon}</span>
                        <div>
                          <strong>{product.name}</strong>
                          <p>
                            {product.category} · {product.unit} · {formatPrice(product.price)}
                          </p>
                        </div>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={() => addToCart(product)}>
                        Add
                      </button>
                    </div>
                    <p className="ai-suggestion__reason">{product.reason}</p>
                  </div>
                ))}
              </div>

              <p className="ai-note">
                This AI assistant uses basket behavior, stock visibility, and local grocery purchase
                patterns to recommend useful add-on items.
              </p>
            </div>

            <div id="auth-panel" className="card auth-card reveal reveal--up" data-reveal>
              <div className="card-header-inline">
                <div>
                  <p className="eyebrow">Customer access</p>
                  <h3>{user ? 'Your account' : 'Login or create customer account'}</h3>
                </div>
              </div>

              {user ? (
                <div className="profile-box">
                  <div className="profile-avatar">{user.name?.charAt(0)?.toUpperCase() || 'G'}</div>
                  <div>
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                    <span className="role-chip">
                      {user.role === 'admin' ? 'Admin access enabled' : 'Customer account active'}
                    </span>
                  </div>
                  <div className="profile-actions">
                    {user.role === 'admin' ? (
                      <a className="btn btn-secondary btn-block" href="#admin">
                        Open private admin dashboard
                      </a>
                    ) : null}
                    <a className="btn btn-secondary btn-block" href="#orders">
                      View orders
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <p className="helper-text">
                    Customers use this section for ordering. Admin has a separate private login space below.
                  </p>

                  <div className="auth-toggle">
                    <button
                      type="button"
                      className={authMode === 'login' ? 'auth-toggle__btn active' : 'auth-toggle__btn'}
                      onClick={() => setAuthMode('login')}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={authMode === 'register' ? 'auth-toggle__btn active' : 'auth-toggle__btn'}
                      onClick={() => setAuthMode('register')}
                    >
                      Register
                    </button>
                  </div>

                  <form className="auth-form" onSubmit={handleAuthSubmit}>
                    {authMode === 'register' ? (
                      <>
                        <label>
                          Full name
                          <input
                            type="text"
                            name="name"
                            value={authForm.name}
                            onChange={handleAuthChange}
                            placeholder="Enter your name"
                          />
                        </label>
                        <label>
                          Phone number
                          <input
                            type="text"
                            name="phone"
                            value={authForm.phone}
                            onChange={handleAuthChange}
                            placeholder="Enter phone number"
                          />
                        </label>
                      </>
                    ) : null}

                    <label>
                      Email address
                      <input
                        type="email"
                        name="email"
                        value={authForm.email}
                        onChange={handleAuthChange}
                        placeholder="Enter email"
                      />
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        name="password"
                        value={authForm.password}
                        onChange={handleAuthChange}
                        placeholder="Enter password"
                      />
                    </label>

                    <button type="submit" className="btn btn-primary btn-block" disabled={busy.auth}>
                      {busy.auth
                        ? 'Please wait...'
                        : authMode === 'login'
                          ? 'Login and order'
                          : 'Create account'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </aside>
        </section>

        <section className="steps-panel card reveal reveal--up" data-reveal>
          <SectionHeader
            eyebrow="How it works"
            title="A simple order flow for customers and a practical control panel for the owner"
            description="The website is built to feel natural for users while keeping product and order management easy for the admin."
          />
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div key={step} className="step-card">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        {user?.role !== 'admin' ? (
          <section id="admin-access" className="admin-access-section">
            <div className="card admin-access-card reveal reveal--up" data-reveal>
              <SectionHeader
                eyebrow="Private admin access"
                title="A separate secure space for Guru Kirana Store management"
                description="Only admin credentials can open the dashboard. From there, admin can add products, set rates, control stock, and hide or show items for customers."
              />

              <div className="admin-access-grid">
                <div className="admin-access-copy">
                  <div className="admin-access-note">
                    <span className="mini-badge">Secure control</span>
                    <h3>What admin can control here</h3>
                    <ul className="info-list">
                      <li>Add new grocery items with category, unit, rate, stock, and badge.</li>
                      <li>Edit any item and set whether it is available to customers or hidden.</li>
                      <li>See incoming customer orders and update their delivery status.</li>
                      <li>Keep the public catalog updated without exposing admin tools to customers.</li>
                    </ul>
                  </div>

                  <div className="admin-access-note admin-access-note--soft">
                    <p className="eyebrow">Default admin email</p>
                    <strong>admin@gurukiranastore.in</strong>
                    <p>Use the admin password from the setup guide in the project documentation.</p>
                  </div>
                </div>

                <form className="admin-access-form" onSubmit={handleAdminLoginSubmit}>
                  <label>
                    Admin email
                    <input
                      type="email"
                      name="email"
                      value={adminAuthForm.email}
                      onChange={handleAdminAuthChange}
                      placeholder="Enter admin email"
                    />
                  </label>

                  <label>
                    Admin password
                    <input
                      type="password"
                      name="password"
                      value={adminAuthForm.password}
                      onChange={handleAdminAuthChange}
                      placeholder="Enter admin password"
                    />
                  </label>

                  <button type="submit" className="btn btn-primary btn-block" disabled={busy.adminLogin}>
                    {busy.adminLogin ? 'Checking access...' : 'Open private admin panel'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {user ? (
          <section id="orders" className="orders-section reveal reveal--up" data-reveal>
            <SectionHeader
              eyebrow="Order history"
              title="Track customer orders with live status"
              description="Users can revisit their recent grocery orders and see how each order is progressing."
            />

            {userOrders.length === 0 ? (
              <div className="empty-state card">No orders yet. Place your first order from the catalog.</div>
            ) : (
              <div className="orders-grid">
                {userOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {user?.role === 'admin' ? (
          <section id="admin" className="admin-section reveal reveal--up" data-reveal>
            <SectionHeader
              eyebrow="Admin dashboard"
              title="Manage inventory, pricing, and customer orders from one place"
              description="This panel gives Guru Kirana Store full control over products and order execution."
            />

            <div className="stats-grid">
              <div className="stat-card">
                <span>Total products</span>
                <strong>{adminStats.totalProducts}</strong>
              </div>
              <div className="stat-card">
                <span>Total orders</span>
                <strong>{adminStats.totalOrders}</strong>
              </div>
              <div className="stat-card">
                <span>Pending orders</span>
                <strong>{adminStats.pendingOrders}</strong>
              </div>
              <div className="stat-card">
                <span>Total revenue</span>
                <strong>{formatPrice(adminStats.totalRevenue)}</strong>
              </div>
            </div>

            <div className="admin-layout">
              <div className="card">
                <div className="card-header-inline">
                  <div>
                    <p className="eyebrow">Product editor</p>
                    <h3>{editingProductId ? 'Update product' : 'Add new product'}</h3>
                  </div>
                </div>

                <form className="admin-form" onSubmit={handleAdminProductSubmit}>
                  <div className="admin-form__grid">
                    <label>
                      Product name
                      <input name="name" value={productForm.name} onChange={handleProductChange} />
                    </label>
                    <label>
                      Category
                      <input name="category" value={productForm.category} onChange={handleProductChange} />
                    </label>
                    <label>
                      Price
                      <input name="price" type="number" value={productForm.price} onChange={handleProductChange} />
                    </label>
                    <label>
                      Unit
                      <input name="unit" value={productForm.unit} onChange={handleProductChange} />
                    </label>
                    <label>
                      Stock
                      <input name="stock" type="number" value={productForm.stock} onChange={handleProductChange} />
                    </label>
                    <label>
                      Icon / emoji
                      <input name="icon" value={productForm.icon} onChange={handleProductChange} />
                    </label>
                    <label>
                      Badge
                      <input name="badge" value={productForm.badge} onChange={handleProductChange} />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="featured"
                        checked={productForm.featured}
                        onChange={handleProductChange}
                      />
                      Featured product
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="available"
                        checked={productForm.available}
                        onChange={handleProductChange}
                      />
                      Available for customers to order
                    </label>
                  </div>

                  <label>
                    Description
                    <textarea
                      name="description"
                      rows="3"
                      value={productForm.description}
                      onChange={handleProductChange}
                    />
                  </label>

                  <div className="button-row">
                    <button type="submit" className="btn btn-primary" disabled={busy.adminProduct}>
                      {busy.adminProduct
                        ? 'Saving...'
                        : editingProductId
                          ? 'Update product'
                          : 'Add product'}
                    </button>
                    {editingProductId ? (
                      <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="card">
                <div className="card-header-inline">
                  <div>
                    <p className="eyebrow">Inventory list</p>
                    <h3>Current products</h3>
                  </div>
                </div>

                <div className="inventory-list">
                  {adminData.products.map((product) => {
                    const availability = getAvailabilityMeta(product);

                    return (
                      <div key={product.id} className="inventory-item">
                        <div className="inventory-item__info">
                          <span className="inventory-item__icon">{product.icon}</span>
                          <div>
                            <strong>{product.name}</strong>
                            <p>
                              {product.category} · {product.unit} · {formatPrice(product.price)}
                            </p>
                            <div className="inventory-item__meta">
                              <span className={availability.className}>{availability.label}</span>
                              <span>{product.stock} in stock</span>
                            </div>
                          </div>
                        </div>
                        <div className="button-row">
                          <button type="button" className="btn btn-secondary" onClick={() => beginEditProduct(product)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-danger"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card admin-orders-card">
              <div className="card-header-inline">
                <div>
                  <p className="eyebrow">Incoming orders</p>
                  <h3>Review and process customer orders</h3>
                </div>
              </div>

              {adminData.orders.length === 0 ? (
                <div className="empty-state">No customer orders received yet.</div>
              ) : (
                <div className="orders-grid">
                  {adminData.orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      adminMode
                      onStatusChange={handleOrderStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
