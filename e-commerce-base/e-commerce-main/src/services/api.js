const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('ammazone-token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth API
export const authApi = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login:  (body) => request('/auth/login',  { method: 'POST', body: JSON.stringify(body) }),
  profile: ()    => request('/auth/profile'),
};

// Catalog API
export const catalogApi = {
  list:       (params = '') => request(`/products${params ? `?${params}` : ''}`),
  get:        (id)          => request(`/products/${id}`),
  categories: ()            => request('/products/categories'),
};

// Cart API
export const cartApi = {
  get:    (userId) => request(`/cart/${userId}`),
  add:    (userId, product, quantity = 1) => request(`/cart/${userId}/items`, { method: 'POST', body: JSON.stringify({ product, quantity }) }),
  update: (userId, productId, quantity)   => request(`/cart/${userId}/items/${productId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  remove: (userId, productId)             => request(`/cart/${userId}/items/${productId}`, { method: 'DELETE' }),
  clear:  (userId)                        => request(`/cart/${userId}`, { method: 'DELETE' }),
};

// Order API
export const orderApi = {
  create: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  list:   (userId) => request(`/orders/user/${userId}`),
  get:    (id) => request(`/orders/${id}`),
};

// Payment API
export const paymentApi = {
  transactions: (userId) => request(`/payments/transactions/${userId}`),
};
