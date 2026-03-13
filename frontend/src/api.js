const TOKEN_KEY = 'guru-kirana-token';
const USER_KEY = 'guru-kirana-user';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const loadStoredSession = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);

    return {
      token,
      user: user ? JSON.parse(user) : null,
    };
  } catch {
    return {
      token: null,
      user: null,
    };
  }
};

export const saveSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }

  return payload;
};

export const api = {
  getProducts: (params) => request(`/products${buildQueryString(params)}`),
  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminLogin: (payload) =>
    request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  askAssistant: (payload) =>
    request('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request('/auth/me'),
  changePassword: (payload) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  placeOrder: (payload) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMyOrders: () => request('/orders/mine'),
  getAdminDashboard: () => request('/admin/dashboard'),
  getAdminOrders: () => request('/admin/orders'),
  createProduct: (payload) =>
    request('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProduct: (productId, payload) =>
    request(`/admin/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (productId) =>
    request(`/admin/products/${productId}`, {
      method: 'DELETE',
    }),
  updateOrderStatus: (orderId, status) =>
    request(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
