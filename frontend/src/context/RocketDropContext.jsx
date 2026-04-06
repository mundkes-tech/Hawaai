import React, { useEffect, useReducer } from 'react';
import { rocketdropService } from '../services/rocketdropService';
import { websocketService } from '../services/websocketService';
import { RocketDropContext } from './RocketDropContextObject';

const initialState = {
  loading: true,
  error: null,
  currentUser: null,
  products: [],
  categories: [],
  reviews: {},
  orders: [],
  cart: [],
  wishlist: [],
  addresses: [],
  viewers: {},
  queue: {},
  serverTime: Date.now(),
};

const withComputed = (state) => {
  const now = state.serverTime || Date.now();
  const products = state.products.map((product) => {
    const dropTime = product.dropTime ? new Date(product.dropTime).getTime() : null;
    const isLive = dropTime ? dropTime <= now : product.stock > 0;
    const soldOut = Number(product.stock || 0) <= 0 || product.soldOut;
    const status = soldOut ? 'SOLD_OUT' : isLive ? 'LIVE' : 'UPCOMING';
    return { ...product, status, primaryImageUrl: product.images?.[0] || '' };
  });

  return { ...state, products };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'BOOTSTRAP_SUCCESS':
      return withComputed({ ...state, ...action.payload, loading: false, error: null });
    case 'BOOTSTRAP_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SERVER_TIME':
      return { ...state, serverTime: action.payload };
    case 'SET_VIEWER_COUNT':
      return {
        ...state,
        viewers: {
          ...state.viewers,
          [action.payload.productId]: action.payload.count,
        },
      };
    case 'SET_QUEUE_STATE':
      return {
        ...state,
        queue: {
          ...state.queue,
          [action.payload.productId]: action.payload.queue,
        },
      };
    case 'UPDATE_PRODUCT_STOCK':
      return withComputed({
        ...state,
        products: state.products.map((product) =>
          product.id === action.payload.productId ? { ...product, stock: action.payload.stock } : product
        ),
      });
    case 'SYNC_DB':
      return withComputed({ ...state, ...action.payload });
    default:
      return state;
  }
};

export const RocketDropProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const bootstrapData = await rocketdropService.getBootstrapData();
        dispatch({ type: 'BOOTSTRAP_SUCCESS', payload: bootstrapData });

        websocketService.connect(
          () => {
            websocketService.subscribe('/topic/stock', (stockUpdate) => {
              if (stockUpdate?.productId === undefined) return;
              dispatch({
                type: 'UPDATE_PRODUCT_STOCK',
                payload: {
                  productId: stockUpdate.productId,
                  stock: stockUpdate.stock,
                },
              });
            });

            websocketService.subscribe('/topic/queue', (queueUpdate) => {
              if (queueUpdate.productId) {
                dispatch({ type: 'SET_QUEUE_STATE', payload: queueUpdate });
              }
            });
          },
          (error) => {
            console.error('WebSocket connection error', error);
          }
        );
      } catch (error) {
        dispatch({ type: 'BOOTSTRAP_ERROR', payload: error.message || 'Failed to bootstrap app' });
      }
    };
    bootstrap();

    const timer = setInterval(async () => {
      try {
        const serverTime = await rocketdropService.getServerTime();
        dispatch({ type: 'SET_SERVER_TIME', payload: serverTime });
      } catch {
        // ignore polling errors
      }
    }, 30000);

    return () => {
      clearInterval(timer);
      websocketService.disconnect();
    };
  }, []);

  const actions = {
      async login(values) {
        const user = await rocketdropService.login(values);

        const role = String(user?.role || '').toUpperCase();
        const isAdmin = role === 'ADMIN' || role === 'ROLE_ADMIN';

        let cart = [];
        let wishlist = [];
        let orders = [];
        let addresses = [];

        // Admin accounts are blocked from customer-only endpoints.
        if (!isAdmin) {
          const [cartResult, wishlistResult, ordersResult, addressesResult] = await Promise.allSettled([
            rocketdropService.getCart(),
            rocketdropService.getWishlist(),
            rocketdropService.getOrders(),
            rocketdropService.getAddresses(),
          ]);

          cart = cartResult.status === 'fulfilled' ? cartResult.value : [];
          wishlist = wishlistResult.status === 'fulfilled' ? wishlistResult.value : [];
          orders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
          addresses = addressesResult.status === 'fulfilled' ? addressesResult.value : [];
        }

        dispatch({ type: 'SET_USER', payload: user });
        dispatch({ type: 'SYNC_DB', payload: { cart, wishlist, orders, addresses } });
        return user;
      },

      async register(values) {
        await rocketdropService.register(values);
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SYNC_DB', payload: { cart: [], wishlist: [], orders: [], addresses: [] } });
        return true;
      },

      logout() {
        rocketdropService.logout();
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SYNC_DB', payload: { cart: [], wishlist: [], orders: [], addresses: [] } });
      },

      async updateProfile(patch) {
        if (!state.currentUser) return;
        const user = await rocketdropService.updateProfile(state.currentUser.id, patch);
        dispatch({ type: 'SET_USER', payload: user });
      },

      async changePassword(oldPassword, newPassword) {
        if (!state.currentUser) return;
        await rocketdropService.changePassword(state.currentUser.id, oldPassword, newPassword);
      },

      async addAddress(address) {
        const newAddress = await rocketdropService.addAddress(address);
        dispatch({ type: 'SYNC_DB', payload: { addresses: [...state.addresses, newAddress] } });
      },

      async addToCart(productId, quantity = 1) {
        const cart = await rocketdropService.addToCart(productId, quantity);
        dispatch({ type: 'SYNC_DB', payload: { cart } });
      },

      async updateCartItem(productId, quantity) {
        const cart = await rocketdropService.updateCartItem(productId, quantity);
        dispatch({ type: 'SYNC_DB', payload: { cart } });
      },

      async removeCartItem(productId) {
        const cart = await rocketdropService.removeFromCart(productId);
        dispatch({ type: 'SYNC_DB', payload: { cart } });
      },

      async clearCart() {
        const cart = await rocketdropService.clearCart();
        dispatch({ type: 'SYNC_DB', payload: { cart } });
      },

      async toggleWishlist(productId) {
        const exists = state.wishlist.includes(productId);
        if (exists) {
          await rocketdropService.removeFromWishlist(productId);
        } else {
          await rocketdropService.addToWishlist(productId);
        }
        const wishlist = await rocketdropService.getWishlist();
        dispatch({ type: 'SYNC_DB', payload: { wishlist } });
      },

      async placeOrder(payload) {
        const orderData = typeof payload === 'object' && payload !== null
          ? payload
          : { addressId: payload };
        await rocketdropService.placeOrder(orderData);
        const orders = await rocketdropService.getOrders();
        const cart = await rocketdropService.getCart();
        dispatch({ type: 'SYNC_DB', payload: { orders, cart } });
      },

      async validateCoupon(code, subtotal) {
        return rocketdropService.validateCoupon(code, subtotal);
      },

      async adminAddProduct(payload) {
        await rocketdropService.adminAddProduct(payload);
        const products = await rocketdropService.adminGetProducts();
        dispatch({ type: 'SYNC_DB', payload: { products } });
      },

      async adminUpdateProduct(productId, patch) {
        await rocketdropService.adminUpdateProduct(productId, patch);
        const products = await rocketdropService.adminGetProducts();
        dispatch({ type: 'SYNC_DB', payload: { products } });
      },

      async adminDeleteProduct(productId) {
        await rocketdropService.adminDeleteProduct(productId);
        const products = await rocketdropService.adminGetProducts();
        dispatch({ type: 'SYNC_DB', payload: { products } });
      },

      async adminUploadImage(file) {
        return rocketdropService.adminUploadImage(file);
      },

      async adminAddCategory(payload) {
        await rocketdropService.adminAddCategory(payload);
        const categories = await rocketdropService.adminGetCategories();
        dispatch({ type: 'SYNC_DB', payload: { categories } });
      },

      async adminUpdateCategory(categoryId, patch) {
        await rocketdropService.adminUpdateCategory(categoryId, patch);
        const categories = await rocketdropService.adminGetCategories();
        dispatch({ type: 'SYNC_DB', payload: { categories } });
      },

      async adminDeleteCategory(categoryId) {
        await rocketdropService.adminDeleteCategory(categoryId);
        const categories = await rocketdropService.adminGetCategories();
        dispatch({ type: 'SYNC_DB', payload: { categories } });
      },

      async joinQueue(productId) {
        if (!state.currentUser) throw new Error('Login required');
        const queue = await rocketdropService.joinQueue(productId);
        dispatch({ type: 'SET_QUEUE_STATE', payload: { productId, queue } });
      },

      async leaveQueue(productId) {
        if (!state.currentUser) throw new Error('Login required');
        const queue = await rocketdropService.leaveQueue(productId);
        dispatch({ type: 'SET_QUEUE_STATE', payload: { productId, queue } });
      },

      async adminUpdateOrderStatus(orderId, status) {
        await rocketdropService.adminUpdateOrderStatus(orderId, status);
        const orders = await rocketdropService.adminGetOrders();
        dispatch({ type: 'SYNC_DB', payload: { orders } });
      },

      async adminGetCoupons() {
        return rocketdropService.adminGetCoupons();
      },

      async adminCreateCoupon(payload) {
        await rocketdropService.adminCreateCoupon(payload);
        return rocketdropService.adminGetCoupons();
      },

      async adminUpdateCoupon(couponId, payload) {
        await rocketdropService.adminUpdateCoupon(couponId, payload);
        return rocketdropService.adminGetCoupons();
      },

      async adminDeleteCoupon(couponId) {
        await rocketdropService.adminDeleteCoupon(couponId);
        return rocketdropService.adminGetCoupons();
      },
    };

  const value = { ...state, actions };

  return <RocketDropContext.Provider value={value}>{children}</RocketDropContext.Provider>;
};
