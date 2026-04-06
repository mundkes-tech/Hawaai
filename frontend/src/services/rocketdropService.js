import Cookies from 'js-cookie';
import api from '../utils/api';

const API_BASE_URL = api.defaults.baseURL || 'http://localhost:8080/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const STORAGE_KEYS = {
  token: 'rocketdrop.token',
  currentUser: 'rocketdrop.currentUser',
};

const readJSON = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeId = (value) => (value === null || value === undefined ? value : Number(value));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toAbsoluteAssetUrl = (value) => {
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${API_ORIGIN}${normalized}`;
};

const normalizeImageUrl = (image) => {
  if (!image) return '';
  if (typeof image === 'string') return toAbsoluteAssetUrl(image);
  return toAbsoluteAssetUrl(image.imageUrl || image.image_url || image.url || image.path || '');
};

const normalizeProduct = (product = {}) => {
  const images = (product.images || []).map(normalizeImageUrl).filter(Boolean);
  const dropTime = product.dropTime || product.drop_time || null;
  const stock = toNumber(product.stock, 0);
  const soldOut = Boolean(product.soldOut) || stock <= 0;
  const isLive = dropTime ? new Date(dropTime).getTime() <= Date.now() : stock > 0;

  return {
    ...product,
    id: normalizeId(product.id),
    categoryId: normalizeId(product.category?.id ?? product.categoryId),
    categoryName: product.category?.name || product.categoryName || '',
    price: toNumber(product.price, 0),
    stock,
    soldOut,
    dropTime,
    rating: toNumber(product.rating, 0),
    images,
    primaryImageUrl: images[0] || toAbsoluteAssetUrl(product.primaryImageUrl || product.primary_image_url || ''),
    status: soldOut ? 'SOLD_OUT' : isLive ? 'LIVE' : 'UPCOMING',
  };
};

const normalizeCategory = (category = {}) => ({
  ...category,
  id: normalizeId(category.id),
  imageUrl: toAbsoluteAssetUrl(category.imageUrl || category.image_url || ''),
});

const normalizeCartItem = (item = {}) => ({
  ...item,
  id: normalizeId(item.id),
  productId: normalizeId(item.product?.id ?? item.productId),
  quantity: toNumber(item.quantity, 1),
  product: item.product ? normalizeProduct(item.product) : item.product,
});

const normalizeOrderItem = (item = {}) => ({
  ...item,
  id: normalizeId(item.id),
  productId: normalizeId(item.product?.id ?? item.productId),
  quantity: toNumber(item.quantity, 1),
  price: toNumber(item.price, 0),
  product: item.product ? normalizeProduct(item.product) : item.product,
});

const normalizeOrder = (order = {}) => ({
  ...order,
  id: normalizeId(order.id),
  totalPrice: toNumber(order.totalPrice, 0),
  items: (order.items || []).map(normalizeOrderItem),
  address: order.address ? { ...order.address, id: normalizeId(order.address.id) } : order.address,
  user: order.user ? { ...order.user, id: normalizeId(order.user.id) } : order.user,
});

const normalizeAddress = (address = {}) => {
  if (!address) return null;

  return {
    ...address,
    id: normalizeId(address.id),
  };
};

const normalizeCoupon = (coupon = {}) => ({
  ...coupon,
  id: normalizeId(coupon.id),
  code: String(coupon.code || '').toUpperCase(),
  discountPercentage: toNumber(coupon.discountPercentage, 0),
  active: Boolean(coupon.active),
  usageCount: toNumber(coupon.usageCount, 0),
  validFrom: coupon.validFrom || null,
  validTo: coupon.validTo || null,
});

const normalizeUser = (user = {}) => {
  if (!user) return null;

  return {
    ...user,
    id: normalizeId(user.id),
    role: user.role || 'CUSTOMER',
    addresses: (user.addresses || []).map(normalizeAddress).filter(Boolean),
    password: undefined,
  };
};

const persistAuth = (token, user) => {
  if (token) {
    Cookies.set('accessToken', token, { expires: 1 });
    localStorage.setItem(STORAGE_KEYS.token, token);
  }

  if (user) {
    const safeUser = normalizeUser(user);
    Cookies.set('user', JSON.stringify(safeUser), { expires: 7 });
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(safeUser));
    return safeUser;
  }

  return null;
};

const clearAuth = () => {
  Cookies.remove('accessToken');
  Cookies.remove('refreshToken');
  Cookies.remove('user');
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.currentUser);
};

const getStoredUser = () => {
  try {
    const cookieUser = Cookies.get('user');
    if (cookieUser) {
      return normalizeUser(JSON.parse(cookieUser));
    }
  } catch {
    // ignore cookie parse issues
  }

  const persistedUser = readJSON(STORAGE_KEYS.currentUser, null);
  return persistedUser ? normalizeUser(persistedUser) : null;
};

const getStoredToken = () => Cookies.get('accessToken') || localStorage.getItem(STORAGE_KEYS.token) || null;

export const rocketdropService = {
  async getBootstrapData() {
    const [categories, products, serverTime] = await Promise.all([
      this.getCategories(),
      this.getProducts(),
      this.getServerTime().catch(() => Date.now()),
    ]);

    const token = getStoredToken();
    const currentUser = token ? getStoredUser() : null;
    let cart = [];
    let orders = [];
    let wishlist = [];
    let addresses = [];

    // Prevent stale persisted user data from triggering protected requests without auth.
    if (!token) {
      Cookies.remove('user');
      localStorage.removeItem(STORAGE_KEYS.currentUser);
    }

    if (currentUser) {
      [cart, orders, wishlist, addresses] = await Promise.all([
        this.getCart().catch(() => []),
        this.getOrders().catch(() => []),
        this.getWishlist().catch(() => []),
        this.getAddresses().catch(() => []),
      ]);
    }

    const normalizedAddresses = (addresses || []).map(normalizeAddress).filter(Boolean);

    if (currentUser) {
      currentUser.addresses = normalizedAddresses;
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
      Cookies.set('user', JSON.stringify(currentUser), { expires: 7 });
    }

    return {
      categories,
      products,
      cart,
      orders,
      wishlist,
      addresses,
      currentUser,
      reviews: {},
      viewers: {},
      queue: {},
      serverTime,
    };
  },

  async register(payload) {
    const response = await api.post('/auth/register', payload);
    const { user } = response.data || {};
    clearAuth();
    return normalizeUser(user);
  },

  async login(payload) {
    const response = await api.post('/auth/login', payload);
    const { token, user } = response.data;
    return persistAuth(token, user);
  },

  logout() {
    clearAuth();
  },

  async updateProfile(userId, patch) {
    const response = await api.put('/users/me', patch);
    const currentUser = getStoredUser() || {};
    const updatedUser = normalizeUser({
      ...currentUser,
      ...response.data,
      id: response.data?.id ?? userId ?? currentUser.id,
    });
    persistAuth(Cookies.get('accessToken'), updatedUser);
    return updatedUser;
  },

  async changePassword(userId, oldPassword, newPassword) {
    await api.put('/users/me/password', { oldPassword, newPassword });
    return true;
  },

  async addAddress(address) {
    const response = await api.post('/addresses', address);
    return normalizeAddress(response.data);
  },

  async getProducts(params = {}) {
    const response = await api.get('/products', { params });
    return (response.data || []).map(normalizeProduct);
  },

  async searchProducts(params = {}) {
    const response = await api.get('/products/search', { params });
    const data = response.data || {};

    return {
      products: (data.products || []).map(normalizeProduct),
      page: toNumber(data.page, 0),
      size: toNumber(data.size, params.size || 8),
      totalPages: Math.max(1, toNumber(data.totalPages, 1)),
      totalElements: toNumber(data.totalElements, 0),
    };
  },

  async getProduct(id) {
    const response = await api.get(`/products/${id}`);
    return normalizeProduct(response.data);
  },

  async getCategories() {
    const response = await api.get('/categories');
    return (response.data || []).map(normalizeCategory);
  },

  async getCart() {
    const response = await api.get('/cart');
    return (response.data || []).map(normalizeCartItem);
  },

  async addToCart(productId, quantity = 1) {
    await api.post('/cart', { productId, quantity });
    return this.getCart();
  },

  async updateCartItem(productId, quantity) {
    await api.put(`/cart/${productId}`, { quantity });
    return this.getCart();
  },

  async removeFromCart(productId) {
    await api.delete(`/cart/${productId}`);
    return this.getCart();
  },

  async clearCart() {
    await api.delete('/cart');
    return [];
  },

  async getWishlist() {
    const response = await api.get('/wishlist');
    return (response.data || []).map(normalizeId).filter((id) => id !== null && id !== undefined);
  },

  async addToWishlist(productId) {
    const response = await api.post('/wishlist', { productId });
    return { productId: normalizeId(response.data?.productId ?? productId) };
  },

  async removeFromWishlist(productId) {
    await api.delete(`/wishlist/${productId}`);
    return normalizeId(productId);
  },

  async getOrders() {
    const response = await api.get('/orders');
    return (response.data || []).map(normalizeOrder);
  },

  async placeOrder(orderData) {
    const response = await api.post('/orders', {
      addressId: orderData.addressId,
      ...(orderData.couponCode ? { couponCode: orderData.couponCode } : {}),
    });
    return normalizeOrder(response.data);
  },

  async getActiveCoupons() {
    const response = await api.get('/coupons');
    return (response.data || []).map(normalizeCoupon);
  },

  async validateCoupon(code, subtotal) {
    const response = await api.get('/coupons/validate', {
      params: { code, subtotal },
    });
    return response.data || {};
  },

  async getSimilarProducts(productId) {
    const response = await api.get(`/products/${productId}/similar`);
    return (response.data || []).map(normalizeProduct);
  },

  async getRecommendations(productId) {
    return this.getSimilarProducts(productId);
  },

  async getServerTime() {
    const response = await api.get('/products/server-time');
    return toNumber(response.data, Date.now());
  },

  async getQueuePosition(productId) {
    const response = await api.get(`/queue/${productId}/position`);
    return toNumber(response.data, 0);
  },

  async getQueue(productId) {
    const response = await api.get(`/queue/${productId}`);
    const queue = (response.data || []).map((entry) => ({
      ...entry,
      id: normalizeId(entry.id),
      user: normalizeUser(entry.user),
      product: normalizeProduct(entry.product),
      position: toNumber(entry.position, 0),
    }));

    return {
      productId: normalizeId(productId),
      queue,
      size: queue.length,
    };
  },

  async joinQueue(productId) {
    await api.post(`/queue/${productId}/join`);
    return this.getQueue(productId);
  },

  async leaveQueue(productId) {
    await api.post(`/queue/${productId}/leave`);
    return this.getQueue(productId);
  },

  async trackViewer() {
    return true;
  },

  async untrackViewer() {
    return true;
  },

  async addReminder(productId) {
    return { productId: normalizeId(productId) };
  },

  async removeReminder(productId) {
    return normalizeId(productId);
  },

  async getReviews() {
    return [];
  },

  async addReview() {
    return null;
  },

  async getAddresses() {
    const response = await api.get('/addresses');
    return (response.data || []).map(normalizeAddress).filter(Boolean);
  },

  async updateAddress(id, address) {
    const response = await api.put(`/addresses/${id}`, address);
    return normalizeAddress(response.data);
  },

  async deleteAddress(id) {
    await api.delete(`/addresses/${id}`);
    return true;
  },

  async getOrderDetails(orderId) {
    const response = await api.get(`/orders/${orderId}`);
    return normalizeOrder(response.data);
  },

  async adminGetProducts() {
    const response = await api.get('/admin/products');
    return (response.data || []).map(normalizeProduct);
  },

  async adminAddProduct(product) {
    const response = await api.post('/admin/products', {
      ...product,
      imageUrls: product.imageUrls || product.images || [],
    });
    return normalizeProduct(response.data);
  },

  async adminUpdateProduct(id, product) {
    const response = await api.put(`/admin/products/${id}`, product);
    return normalizeProduct(response.data);
  },

  async adminDeleteProduct(id) {
    await api.delete(`/admin/products/${id}`);
    return true;
  },

  async adminUploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    console.debug('Admin image upload response', response.data);
    return toAbsoluteAssetUrl(response.data?.url || '');
  },

  async adminGetCategories() {
    const response = await api.get('/admin/categories');
    return (response.data || []).map(normalizeCategory);
  },

  async adminAddCategory(category) {
    const response = await api.post('/admin/categories', category);
    return normalizeCategory(response.data);
  },

  async adminUpdateCategory(id, category) {
    const response = await api.put(`/admin/categories/${id}`, category);
    return normalizeCategory(response.data);
  },

  async adminDeleteCategory(id) {
    await api.delete(`/admin/categories/${id}`);
    return true;
  },

  async adminGetOrders() {
    const response = await api.get('/orders/admin');
    return (response.data || []).map(normalizeOrder);
  },

  async adminUpdateOrderStatus(id, status) {
    const response = await api.put(`/orders/${id}/status`, { status });
    return normalizeOrder(response.data);
  },

  async adminGetCoupons() {
    const response = await api.get('/admin/coupons');
    return (response.data || []).map(normalizeCoupon);
  },

  async adminCreateCoupon(payload) {
    const response = await api.post('/admin/coupons', payload);
    return normalizeCoupon(response.data);
  },

  async adminUpdateCoupon(couponId, payload) {
    const response = await api.put(`/admin/coupons/${couponId}`, payload);
    return normalizeCoupon(response.data);
  },

  async adminDeleteCoupon(couponId) {
    await api.delete(`/admin/coupons/${couponId}`);
    return true;
  },

  async saveDb(db) {
    return db;
  },
};
