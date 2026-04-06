import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { useRocketDrop } from '../hooks/useRocketDrop';
import { PRODUCT_CARD_PLACEHOLDER } from '../utils/imageFallbacks';

const isAdminUser = (user) => {
  const role = String(user?.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'ROLE_ADMIN';
};

const CountUpValue = ({ value, prefix = '', duration = 900 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();

    const frame = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      setDisplayValue(Math.round(target * progress));
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  }, [value, duration]);

  return <>{prefix}{displayValue.toLocaleString('en-IN')}</>;
};

const AdminPage = () => {
  const { products, categories, orders, actions, currentUser } = useRocketDrop();
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'dashboard';
  const [analyticsWindow, setAnalyticsWindow] = useState('30d');

  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', stock: '', categoryId: '', dropTime: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [productErrors, setProductErrors] = useState({});
  const [categoryErrors, setCategoryErrors] = useState({});
  const [productImageFile, setProductImageFile] = useState(null);
  const [categoryImageFile, setCategoryImageFile] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productImageKey, setProductImageKey] = useState(0);
  const [categoryImageKey, setCategoryImageKey] = useState(0);
  const [dropScheduleForm, setDropScheduleForm] = useState({ productId: '', dropTime: '' });
  const [dropScheduleErrors, setDropScheduleErrors] = useState({});
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountPercentage: '',
    active: true,
    validFrom: '',
    validTo: '',
  });
  const [couponErrors, setCouponErrors] = useState({});
  const [editingCouponId, setEditingCouponId] = useState(null);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const productFormRef = useRef(null);

  const filteredOrders = useMemo(() => {
    if (analyticsWindow === 'all') return orders;

    const now = Date.now();
    const days = analyticsWindow === '7d' ? 7 : analyticsWindow === '30d' ? 30 : 90;
    const threshold = now - days * 24 * 60 * 60 * 1000;

    return orders.filter((order) => {
      const time = new Date(order.createdAt || order.updatedAt || 0).getTime();
      return Number.isFinite(time) && time >= threshold;
    });
  }, [orders, analyticsWindow]);

  const revenue = useMemo(() => filteredOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0), [filteredOrders]);
  const recentOrders = useMemo(() => [...filteredOrders].slice(-6).reverse(), [filteredOrders]);
  const averageOrderValue = useMemo(() => {
    if (!filteredOrders.length) return 0;
    return Math.round(revenue / filteredOrders.length);
  }, [filteredOrders, revenue]);

  const fulfillmentRate = useMemo(() => {
    if (!filteredOrders.length) return 0;
    const delivered = filteredOrders.filter((order) => String(order.status).toUpperCase() === 'DELIVERED').length;
    return Math.round((delivered / filteredOrders.length) * 100);
  }, [filteredOrders]);

  const orderStatusBreakdown = useMemo(() => {
    const totals = filteredOrders.reduce((acc, order) => {
      const key = String(order.status || 'UNKNOWN').toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  const topSellingProducts = useMemo(() => {
    const bucket = new Map();

    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const id = item.productId || item.product?.id;
        if (!id) return;
        const prev = bucket.get(id) || {
          id,
          name: item.product?.name || `Product #${id}`,
          units: 0,
          revenue: 0,
        };

        prev.units += Number(item.quantity || 0);
        prev.revenue += Number(item.price || 0) * Number(item.quantity || 0);
        bucket.set(id, prev);
      });
    });

    return Array.from(bucket.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [filteredOrders]);

  const weeklyOrderSeries = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const base = Array.from({ length: 7 }, (_, index) => ({ label: days[index], value: 0 }));

    filteredOrders.forEach((order) => {
      const date = new Date(order.createdAt || order.updatedAt || '1970-01-01T00:00:00Z');
      const day = date.getDay();
      const normalized = day === 0 ? 6 : day - 1;
      base[normalized].value += 1;
    });

    return base;
  }, [filteredOrders]);

  const peakWeeklyValue = useMemo(() => {
    const max = Math.max(...weeklyOrderSeries.map((item) => item.value), 1);
    return max;
  }, [weeklyOrderSeries]);

  const isEditingProduct = editingProductId !== null;
  const isEditingCoupon = editingCouponId !== null;

  useEffect(() => {
    if (tab !== 'coupons') return;

    let isMounted = true;
    const loadCoupons = async () => {
      try {
        setLoadingCoupons(true);
        const result = await actions.adminGetCoupons();
        if (isMounted) {
          setCoupons(result || []);
        }
      } catch (error) {
        console.error(error?.response?.data?.message || 'Failed to load coupons');
      } finally {
        if (isMounted) {
          setLoadingCoupons(false);
        }
      }
    };

    loadCoupons();
    return () => {
      isMounted = false;
    };
  }, [tab, actions]);

  if (!isAdminUser(currentUser)) return <Navigate to="/" replace />;

  const validateProductForm = () => {
    const errors = {};
    if (!productForm.name.trim()) errors.name = 'Product name is required';
    if (!productForm.description.trim()) errors.description = 'Description is required';
    if (!productForm.price || isNaN(productForm.price) || Number(productForm.price) <= 0) errors.price = 'Enter a valid price';
    if (productForm.stock === '' || isNaN(productForm.stock) || Number(productForm.stock) < 0) errors.stock = 'Enter a valid stock quantity';
    if (!productForm.categoryId) errors.categoryId = 'Select a category';
    return errors;
  };

  const resetProductForm = () => {
    setProductForm({ name: '', description: '', price: '', stock: '', categoryId: '', dropTime: '' });
    setProductImageFile(null);
    setProductImageKey((prev) => prev + 1);
    setProductErrors({});
    setEditingProductId(null);
  };

  const toLocalDateTimeInput = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const offsetMs = parsed.getTimezoneOffset() * 60000;
    return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const editProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? ''),
      categoryId: String(product.categoryId ?? product.category?.id ?? ''),
      dropTime: toLocalDateTimeInput(product.dropTime),
    });
    setProductImageFile(null);
    setProductImageKey((prev) => prev + 1);
    setProductErrors({});
    requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    const errors = validateProductForm();
    setProductErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const existingProduct = isEditingProduct
      ? products.find((product) => String(product.id) === String(editingProductId))
      : null;

    try {
      let uploadedImageUrl = '';
      if (productImageFile) {
        uploadedImageUrl = await actions.adminUploadImage(productImageFile);
      }

      const payload = {
        name: productForm.name,
        description: productForm.description,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        categoryId: productForm.categoryId,
      };

      if (productForm.dropTime) {
        payload.dropTime = new Date(productForm.dropTime).toISOString();
      } else {
        payload.dropTime = null;
      }

      if (isEditingProduct && uploadedImageUrl) {
        payload.imageUrls = [...(existingProduct?.images || []), uploadedImageUrl];
      } else if (!isEditingProduct && uploadedImageUrl) {
        payload.imageUrls = [uploadedImageUrl];
      }

      if (isEditingProduct) {
        await actions.adminUpdateProduct(editingProductId, payload);
      } else {
        await actions.adminAddProduct(payload);
      }

      resetProductForm();
    } catch (error) {
      console.error(error?.response?.data?.message || (isEditingProduct ? 'Failed to update product' : 'Failed to save product'));
    }
  };

  const deleteProduct = async (productId) => {
    try {
      await actions.adminDeleteProduct(productId);
      if (String(editingProductId) === String(productId)) {
        resetProductForm();
      }
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to delete product');
    }
  };

  const validateDropScheduleForm = () => {
    const errors = {};
    if (!dropScheduleForm.productId) errors.productId = 'Choose a product to schedule';
    if (!dropScheduleForm.dropTime) errors.dropTime = 'Select a drop date and time';
    return errors;
  };

  const scheduleDrop = async (event) => {
    event.preventDefault();
    const errors = validateDropScheduleForm();
    setDropScheduleErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await actions.adminUpdateProduct(dropScheduleForm.productId, {
        dropTime: new Date(dropScheduleForm.dropTime).toISOString(),
      });
      setDropScheduleForm({ productId: '', dropTime: '' });
      setDropScheduleErrors({});
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to schedule drop');
    }
  };

  const formatDropTime = (dropTime) => {
    if (!dropTime) return 'Not scheduled';
    const parsed = new Date(dropTime);
    if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasProductImage = (product) => {
    return Boolean((product.images || []).length > 0 || product.primaryImageUrl);
  };

  const getProductThumbnail = (product) => {
    return product.images?.[0] || product.primaryImageUrl || PRODUCT_CARD_PLACEHOLDER;
  };

  const validateCategoryForm = () => {
    const errors = {};
    if (!categoryForm.name.trim()) errors.name = 'Category name is required';
    return errors;
  };

  const addCategory = async (event) => {
    event.preventDefault();
    const errors = validateCategoryForm();
    setCategoryErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      let uploadedImageUrl = '';
      if (categoryImageFile) {
        uploadedImageUrl = await actions.adminUploadImage(categoryImageFile);
      }

      await actions.adminAddCategory({
        ...categoryForm,
        imageUrl: uploadedImageUrl,
      });
      setCategoryForm({ name: '' });
      setCategoryImageFile(null);
      setCategoryImageKey((prev) => prev + 1);
      setCategoryErrors({});
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to save category');
    }
  };

  const validateCouponForm = () => {
    const errors = {};
    if (!couponForm.code.trim()) errors.code = 'Coupon code is required';
    if (!couponForm.discountPercentage || Number(couponForm.discountPercentage) < 1 || Number(couponForm.discountPercentage) > 80) {
      errors.discountPercentage = 'Discount must be between 1 and 80';
    }
    if (couponForm.validFrom && couponForm.validTo) {
      const from = new Date(couponForm.validFrom).getTime();
      const to = new Date(couponForm.validTo).getTime();
      if (Number.isFinite(from) && Number.isFinite(to) && to < from) {
        errors.validTo = 'Valid to must be after valid from';
      }
    }
    return errors;
  };

  const toUtcISOString = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const resetCouponForm = () => {
    setCouponForm({ code: '', discountPercentage: '', active: true, validFrom: '', validTo: '' });
    setCouponErrors({});
    setEditingCouponId(null);
  };

  const startEditCoupon = (coupon) => {
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code || '',
      discountPercentage: String(coupon.discountPercentage ?? ''),
      active: Boolean(coupon.active),
      validFrom: toLocalDateTimeInput(coupon.validFrom),
      validTo: toLocalDateTimeInput(coupon.validTo),
    });
    setCouponErrors({});
  };

  const submitCoupon = async (event) => {
    event.preventDefault();
    const errors = validateCouponForm();
    setCouponErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      code: couponForm.code.trim().toUpperCase(),
      discountPercentage: Number(couponForm.discountPercentage),
      active: Boolean(couponForm.active),
      validFrom: toUtcISOString(couponForm.validFrom),
      validTo: toUtcISOString(couponForm.validTo),
    };

    try {
      const updatedCoupons = isEditingCoupon
        ? await actions.adminUpdateCoupon(editingCouponId, payload)
        : await actions.adminCreateCoupon(payload);
      setCoupons(updatedCoupons || []);
      resetCouponForm();
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to save coupon');
    }
  };

  const toggleCouponStatus = async (coupon) => {
    try {
      const updatedCoupons = await actions.adminUpdateCoupon(coupon.id, {
        active: !coupon.active,
      });
      setCoupons(updatedCoupons || []);
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to update coupon status');
    }
  };

  const deleteCoupon = async (couponId) => {
    try {
      const updatedCoupons = await actions.adminDeleteCoupon(couponId);
      setCoupons(updatedCoupons || []);
      if (String(editingCouponId) === String(couponId)) {
        resetCouponForm();
      }
    } catch (error) {
      console.error(error?.response?.data?.message || 'Failed to delete coupon');
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      caption: 'Registered users',
      value: Math.max(1, orders.length),
      tint: 'from-indigo-50 to-indigo-100/70 border-indigo-200',
      iconWrap: 'bg-indigo-500/10 text-indigo-600',
      icon: Users,
    },
    {
      title: 'Total Orders',
      caption: 'Across all channels',
      value: filteredOrders.length,
      tint: 'from-sky-50 to-sky-100/70 border-sky-200',
      iconWrap: 'bg-sky-500/10 text-sky-600',
      icon: ShoppingCart,
    },
    {
      title: 'Total Products',
      caption: 'Live in catalog',
      value: products.length,
      tint: 'from-emerald-50 to-emerald-100/70 border-emerald-200',
      iconWrap: 'bg-emerald-500/10 text-emerald-600',
      icon: Boxes,
    },
    {
      title: 'Revenue',
      caption: `${analyticsWindow.toUpperCase()} gross sales`,
      value: Math.round(revenue),
      prefix: 'Rs ',
      tint: 'from-amber-50 to-amber-100/70 border-amber-200',
      iconWrap: 'bg-amber-500/10 text-amber-600',
      icon: CircleDollarSign,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8 md:space-y-10 text-slate-900 animate-fadeInUp">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50/70 p-6 shadow-sm md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Control Center</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Admin Dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
                Monitor orders, manage catalog updates, and keep your storefront operations running smoothly.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Signed in as</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {(currentUser?.name || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{currentUser?.name || 'Admin User'}</p>
                  <p className="text-xs text-slate-500">{currentUser?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {tab === 'dashboard' && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Analytics Window</h2>
                  <p className="text-sm text-slate-500">Choose the period for KPI calculations</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: '7d', label: 'Last 7 Days' },
                    { key: '30d', label: 'Last 30 Days' },
                    { key: '90d', label: 'Last 90 Days' },
                    { key: 'all', label: 'All Time' },
                  ].map((item) => (
                    <Button
                      key={item.key}
                      type="button"
                      variant={analyticsWindow === item.key ? 'dark' : 'secondary'}
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setAnalyticsWindow(item.key)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card, index) => {
                const CardIcon = card.icon;
                return (
                  <article
                    key={card.title}
                    className={`rounded-2xl border bg-gradient-to-br p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-md ${card.tint} animate-fadeInUp`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-600">{card.title}</p>
                      <span className={`rounded-full p-2.5 ${card.iconWrap}`}>
                        <CardIcon size={18} />
                      </span>
                    </div>
                    <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                      <CountUpValue value={card.value} prefix={card.prefix || ''} />
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{card.caption}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fadeInUp" style={{ animationDelay: '120ms' }}>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Orders Overview</h2>
                    <p className="text-sm text-slate-500">Weekly order trend snapshot</p>
                  </div>
                  <BarChart3 size={20} className="text-indigo-500" />
                </div>
                <div className="grid grid-cols-7 items-end gap-3 rounded-xl bg-slate-50 p-4">
                  {weeklyOrderSeries.map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-2">
                      <div className="h-28 w-full rounded-full bg-slate-200/80 p-[3px]">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-indigo-500 to-sky-400 transition-all duration-500"
                          style={{ height: `${Math.max((item.value / peakWeeklyValue) * 100, 10)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fadeInUp" style={{ animationDelay: '180ms' }}>
                <h2 className="text-lg font-semibold text-slate-900">Quick Insights</h2>
                <p className="mt-1 text-sm text-slate-500">Operational highlights</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-indigo-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Conversion Activity</p>
                    <p className="mt-2 text-lg font-semibold text-indigo-900">{orders.length} total purchases</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Catalog Health</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-900">{products.length} active products</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Revenue</p>
                    <p className="mt-2 text-lg font-semibold text-amber-900">Rs {Math.round(revenue).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-sky-600">Average Order Value</p>
                    <p className="mt-2 text-lg font-semibold text-sky-900">Rs {averageOrderValue.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Fulfillment Rate</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-900">{fulfillmentRate}% delivered</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Top Selling Products</h2>
                <p className="mt-1 text-sm text-slate-500">Based on units sold in selected window</p>

                <div className="mt-4 space-y-3">
                  {topSellingProducts.length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No product sales data in this period.</p>
                  )}
                  {topSellingProducts.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        <Badge variant="accent">{item.units} units</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Revenue: Rs {Math.round(item.revenue).toLocaleString('en-IN')}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Order Status Mix</h2>
                <p className="mt-1 text-sm text-slate-500">Distribution of order outcomes</p>

                <div className="mt-4 space-y-3">
                  {orderStatusBreakdown.length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No order status data available.</p>
                  )}
                  {orderStatusBreakdown.map((item) => (
                    <div key={item.status} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.status}</span>
                        <span className="font-semibold text-slate-900">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${Math.max((item.count / Math.max(filteredOrders.length, 1)) * 100, 6)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-fadeInUp" style={{ animationDelay: '240ms' }}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
                  <p className="text-sm text-slate-500">Latest transactions across your store</p>
                </div>
                <Badge variant="accent">{recentOrders.length} shown</Badge>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 hidden md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">No recent orders available.</td>
                      </tr>
                    )}
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100 text-sm text-slate-700">
                        <td className="px-4 py-3 font-mono">#{String(order.id).slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'SHIPPED' ? 'warning' : 'accent'}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold">Rs {Number(order.totalPrice || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {recentOrders.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No recent orders available.
                  </div>
                )}
                {recentOrders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm text-slate-600">#{String(order.id).slice(0, 8)}</p>
                      <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'SHIPPED' ? 'warning' : 'accent'}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      Rs {Number(order.totalPrice || 0).toLocaleString('en-IN')}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'products' && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Manage Products</h2>
                <p className="mt-2 text-sm text-slate-500">Create catalog products first, then schedule their drop window separately.</p>
              </div>

              <form ref={productFormRef} onSubmit={submitProduct} className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900">{isEditingProduct ? 'Edit Product' : 'Add New Product'}</h3>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Product Name</label>
                  <input
                    className={`rd-input w-full ${productErrors.name ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                    value={productForm.name}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter product name"
                  />
                  {productErrors.name && <p className="mt-1 text-xs text-red-600">{productErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    className={`rd-input min-h-24 w-full ${productErrors.description ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                    value={productForm.description}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Describe the product"
                  />
                  {productErrors.description && <p className="mt-1 text-xs text-red-600">{productErrors.description}</p>}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Price (INR)</label>
                    <input
                      className={`rd-input w-full ${productErrors.price ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      type="number"
                      value={productForm.price}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                      placeholder="0.00"
                    />
                    {productErrors.price && <p className="mt-1 text-xs text-red-600">{productErrors.price}</p>}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Stock Quantity</label>
                    <input
                      className={`rd-input w-full ${productErrors.stock ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      type="number"
                      value={productForm.stock}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                      placeholder="0"
                    />
                    {productErrors.stock && <p className="mt-1 text-xs text-red-600">{productErrors.stock}</p>}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Initial Drop Time (optional)</label>
                    <input
                      className={`rd-input w-full ${productErrors.dropTime ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      type="datetime-local"
                      value={productForm.dropTime}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, dropTime: event.target.value }))}
                    />
                    <p className="mt-1 text-xs text-slate-500">Leave empty to keep it as regular catalog listing without a scheduled drop.</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                  <select
                    className={`rd-input w-full ${productErrors.categoryId ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                    value={productForm.categoryId}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  {productErrors.categoryId && <p className="mt-1 text-xs text-red-600">{productErrors.categoryId}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Product Image</label>
                  <input
                    key={productImageKey}
                    className="rd-input w-full"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setProductImageFile(event.target.files?.[0] || null)}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {isEditingProduct
                      ? 'Upload one image to append to this product gallery. Leave empty to keep existing images.'
                      : 'JPG, PNG or GIF (max 2MB)'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="w-full md:w-auto">
                    {isEditingProduct ? 'Update Product' : 'Add Product'}
                  </Button>
                  {isEditingProduct && (
                    <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={resetProductForm}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarClock size={18} className="text-indigo-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Schedule Product Drop</h3>
                </div>

                <form onSubmit={scheduleDrop} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Product</label>
                    <select
                      className={`rd-input w-full ${dropScheduleErrors.productId ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      value={dropScheduleForm.productId}
                      onChange={(event) => setDropScheduleForm((prev) => ({ ...prev, productId: event.target.value }))}
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                    {dropScheduleErrors.productId && <p className="mt-1 text-xs text-red-600">{dropScheduleErrors.productId}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Drop Date & Time</label>
                    <input
                      type="datetime-local"
                      className={`rd-input w-full ${dropScheduleErrors.dropTime ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      value={dropScheduleForm.dropTime}
                      onChange={(event) => setDropScheduleForm((prev) => ({ ...prev, dropTime: event.target.value }))}
                    />
                    {dropScheduleErrors.dropTime && <p className="mt-1 text-xs text-red-600">{dropScheduleErrors.dropTime}</p>}
                  </div>

                  <div className="flex items-end">
                    <Button type="submit" className="w-full md:w-auto">Schedule Drop</Button>
                  </div>
                </form>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-slate-900">Product Inventory</h2>
                <Badge variant="accent">{products.length} total</Badge>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 hidden md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Product</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Image</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Image Uploaded</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Price</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Drop Status</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Drop Time</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Stock</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4 text-sm text-slate-700">{product.name}</td>
                        <td className="px-6 py-4 text-sm">
                          <img
                            src={getProductThumbnail(product)}
                            alt={product.name}
                            className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {hasProductImage(product) ? (
                            <Badge variant="success">TRUE</Badge>
                          ) : (
                            <Badge variant="danger">FALSE</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">Rs {product.price}</td>
                        <td className="px-6 py-4 text-sm">
                          <Badge variant={product.status === 'LIVE' ? 'success' : product.status === 'UPCOMING' ? 'warning' : 'danger'}>
                            {product.status || 'UNKNOWN'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDropTime(product.dropTime)}</td>
                        <td className="px-6 py-4 text-sm">
                          {product.stock > 0 ? (
                            <Badge variant="success">{product.stock} in stock</Badge>
                          ) : (
                            <Badge variant="danger">Out of stock</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => editProduct(product)}
                              className="px-3 py-1 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="dark"
                              onClick={() => deleteProduct(product.id)}
                              className="px-3 py-1 text-xs"
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {products.map((product) => (
                  <article key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <img
                        src={getProductThumbnail(product)}
                        alt={product.name}
                        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-600">Rs {product.price}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={hasProductImage(product) ? 'success' : 'danger'}>{hasProductImage(product) ? 'TRUE' : 'FALSE'}</Badge>
                          <Badge variant={product.status === 'LIVE' ? 'success' : product.status === 'UPCOMING' ? 'warning' : 'danger'}>
                            {product.status || 'UNKNOWN'}
                          </Badge>
                          {product.stock > 0 ? (
                            <Badge variant="success">{product.stock} in stock</Badge>
                          ) : (
                            <Badge variant="danger">Out of stock</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{formatDropTime(product.dropTime)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => editProduct(product)}
                        className="px-3 py-1 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="dark"
                        onClick={() => deleteProduct(product.id)}
                        className="px-3 py-1 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'orders' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">Manage Orders</h2>
              <Badge variant="accent">{orders.length} total</Badge>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Order ID</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Total Amount</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-mono text-sm text-slate-600">#{String(order.id).slice(0, 8)}</td>
                      <td className="px-6 py-4">
                        <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'SHIPPED' ? 'warning' : 'accent'}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">Rs {order.totalPrice}</td>
                      <td className="px-6 py-4 text-sm">
                        <select
                          value={order.status}
                          onChange={(event) => actions.adminUpdateOrderStatus(order.id, event.target.value)}
                          className="rd-input px-3 py-1 text-xs"
                        >
                          <option>PLACED</option>
                          <option>SHIPPED</option>
                          <option>DELIVERED</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {orders.map((order) => (
                <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm text-slate-600">#{String(order.id).slice(0, 8)}</p>
                    <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'SHIPPED' ? 'warning' : 'accent'}>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">Rs {order.totalPrice}</p>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Update Status</label>
                    <select
                      value={order.status}
                      onChange={(event) => actions.adminUpdateOrderStatus(order.id, event.target.value)}
                      className="rd-input px-3 py-2 text-xs"
                    >
                      <option>PLACED</option>
                      <option>SHIPPED</option>
                      <option>DELIVERED</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'categories' && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Manage Categories</h2>
                <p className="mt-2 text-sm text-slate-500">Create categories used for product organization.</p>
              </div>

              <form onSubmit={addCategory} className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900">Add New Category</h3>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
                  <input
                    className={`rd-input w-full ${categoryErrors.name ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter category name"
                  />
                  {categoryErrors.name && <p className="mt-1 text-xs text-red-600">{categoryErrors.name}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Category Image</label>
                  <input
                    key={categoryImageKey}
                    className="rd-input w-full"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setCategoryImageFile(event.target.files?.[0] || null)}
                  />
                  <p className="mt-2 text-xs text-slate-500">JPG, PNG or GIF (max 2MB)</p>
                </div>

                <Button type="submit" className="w-full md:w-auto">Add Category</Button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-slate-900">Category List</h2>
                <Badge variant="accent">{categories.length} total</Badge>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 hidden md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Category Name</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-6 py-4 text-sm text-slate-700">{category.name}</td>
                        <td className="px-6 py-4 text-sm">
                          <Button
                            variant="dark"
                            onClick={() => actions.adminDeleteCategory(category.id)}
                            className="px-3 py-1 text-xs"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {categories.map((category) => (
                  <article key={category.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-800">{category.name}</p>
                    <div className="mt-3">
                      <Button
                        variant="dark"
                        onClick={() => actions.adminDeleteCategory(category.id)}
                        className="px-3 py-1 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'coupons' && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Coupon Management</h2>
                <p className="mt-2 text-sm text-slate-500">Create and manage coupon discounts used in checkout.</p>
              </div>

              <form onSubmit={submitCoupon} className="space-y-5">
                <h3 className="text-lg font-semibold text-slate-900">{isEditingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Coupon Code</label>
                    <input
                      className={`rd-input w-full ${couponErrors.code ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      value={couponForm.code}
                      disabled={isEditingCoupon}
                      onChange={(event) => setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                      placeholder="e.g. DROP10"
                    />
                    {couponErrors.code && <p className="mt-1 text-xs text-red-600">{couponErrors.code}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Discount Percentage</label>
                    <input
                      type="number"
                      min="1"
                      max="80"
                      className={`rd-input w-full ${couponErrors.discountPercentage ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      value={couponForm.discountPercentage}
                      onChange={(event) => setCouponForm((prev) => ({ ...prev, discountPercentage: event.target.value }))}
                      placeholder="10"
                    />
                    {couponErrors.discountPercentage && <p className="mt-1 text-xs text-red-600">{couponErrors.discountPercentage}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Valid From (optional)</label>
                    <input
                      type="datetime-local"
                      className="rd-input w-full"
                      value={couponForm.validFrom}
                      onChange={(event) => setCouponForm((prev) => ({ ...prev, validFrom: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Valid To (optional)</label>
                    <input
                      type="datetime-local"
                      className={`rd-input w-full ${couponErrors.validTo ? 'border-red-500 focus:ring-1 focus:ring-red-500/30' : ''}`}
                      value={couponForm.validTo}
                      onChange={(event) => setCouponForm((prev) => ({ ...prev, validTo: event.target.value }))}
                    />
                    {couponErrors.validTo && <p className="mt-1 text-xs text-red-600">{couponErrors.validTo}</p>}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={couponForm.active}
                    onChange={(event) => setCouponForm((prev) => ({ ...prev, active: event.target.checked }))}
                  />
                  Coupon is active
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" className="w-full md:w-auto">
                    {isEditingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </Button>
                  {isEditingCoupon && (
                    <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={resetCouponForm}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-slate-900">Available Coupons</h2>
                <Badge variant="accent">{coupons.length} total</Badge>
              </div>

              {loadingCoupons ? (
                <p className="text-sm text-slate-500">Loading coupons...</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 hidden md:block">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Code</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Discount</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Active</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Usage</th>
                          <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map((coupon) => (
                          <tr key={coupon.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">{coupon.code}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{coupon.discountPercentage}%</td>
                            <td className="px-6 py-4 text-sm">
                              <Badge variant={coupon.active ? 'success' : 'danger'}>{coupon.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">{coupon.usageCount || 0}</td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => startEditCoupon(coupon)}>
                                  Edit
                                </Button>
                                <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => toggleCouponStatus(coupon)}>
                                  {coupon.active ? 'Disable' : 'Enable'}
                                </Button>
                                <Button variant="dark" className="px-3 py-1 text-xs" onClick={() => deleteCoupon(coupon.id)}>
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!coupons.length && (
                          <tr>
                            <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">No coupons found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {!coupons.length && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        No coupons found.
                      </div>
                    )}
                    {coupons.map((coupon) => (
                      <article key={coupon.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{coupon.code}</p>
                          <Badge variant={coupon.active ? 'success' : 'danger'}>{coupon.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">{coupon.discountPercentage}% OFF</p>
                        <p className="mt-1 text-xs text-slate-500">Used {coupon.usageCount || 0} times</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => startEditCoupon(coupon)}>
                            Edit
                          </Button>
                          <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => toggleCouponStatus(coupon)}>
                            {coupon.active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button variant="dark" className="px-3 py-1 text-xs" onClick={() => deleteCoupon(coupon.id)}>
                            Delete
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {tab !== 'dashboard' && tab !== 'products' && tab !== 'orders' && tab !== 'categories' && tab !== 'coupons' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Package className="mx-auto text-slate-400" size={32} />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Section Not Found</h2>
            <p className="mt-2 text-sm text-slate-500">Choose an option from the sidebar menu.</p>
          </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPage;
