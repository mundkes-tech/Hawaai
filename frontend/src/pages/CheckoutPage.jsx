import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, MapPin, Receipt, Tag } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useRocketDrop } from '../hooks/useRocketDrop';
import SectionContainer from '../components/SectionContainer';
import Button from '../components/Button';

const CHECKOUT_STEPS = [
  { id: 1, title: 'Address', icon: MapPin },
  { id: 2, title: 'Payment', icon: CreditCard },
  { id: 3, title: 'Review', icon: Receipt },
];

const CheckoutPage = () => {
  const { cart, products, addresses, actions } = useRocketDrop();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || '');
  const [paymentMode, setPaymentMode] = useState('COD');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return sum;
      return sum + product.price * item.quantity;
    }, 0);
  }, [cart, products]);

  const shipping = subtotal > 2999 ? 0 : 99;
  const [couponDiscountPercentage, setCouponDiscountPercentage] = useState(0);
  const couponDiscount = Math.round((subtotal * couponDiscountPercentage) / 100);
  const total = Math.max(0, subtotal + shipping - couponDiscount);

  const canProceedAddress = Boolean(selectedAddressId);

  const handleApplyCoupon = async () => {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) {
      setCouponError('Enter a coupon code');
      return;
    }

    try {
      const response = await actions.validateCoupon(normalized, subtotal);
      if (!response?.valid) {
        setCouponError('Invalid coupon code');
        setAppliedCoupon('');
        setCouponDiscountPercentage(0);
        return;
      }

      setAppliedCoupon(response.code || normalized);
      setCouponDiscountPercentage(Number(response.discountPercentage || 0));
      setCouponError('');
    } catch (error) {
      setCouponError(error?.response?.data?.message || 'Invalid coupon code');
      setAppliedCoupon('');
      setCouponDiscountPercentage(0);
      return;
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId || !cart.length) return;

    try {
      setPlacingOrder(true);
      await actions.placeOrder({
        addressId: selectedAddressId,
        couponCode: appliedCoupon || undefined,
      });
      navigate('/orders');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <MainLayout>
      <section className="mt-8 rounded-2xl border border-[#E5E7EB] bg-gradient-to-r from-[#FFF7ED] to-[#F8FAFC] text-[#1E1B6A]">
        <div className="container py-10">
          <h1 className="text-4xl font-bold md:text-5xl">Checkout</h1>
          <p className="mt-2 text-slate-600">Complete your order in three quick steps.</p>
        </div>
      </section>

      <SectionContainer className="bg-white">
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          {CHECKOUT_STEPS.map((item) => {
            const Icon = item.icon;
            const active = step === item.id;
            const completed = step > item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  active
                    ? 'border-[#1E1B6A] bg-indigo-50 text-[#1E1B6A]'
                    : completed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {completed ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  Step {item.id}: {item.title}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rd-card p-6">
            {step === 1 && (
              <>
                <h2 className="mb-4 text-2xl font-semibold text-[#1E1B6A]">Select Delivery Address</h2>
                {addresses.length ? (
                  <div className="space-y-3">
                    {addresses.map((address) => (
                      <label key={address.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#1E1B6A]/40">
                        <input
                          type="radio"
                          checked={selectedAddressId === address.id}
                          onChange={() => setSelectedAddressId(address.id)}
                        />
                        <span className="text-sm text-slate-700">
                          <strong>{address.label || 'Address'}:</strong> {address.line1}, {address.city}, {address.state}, {address.zip}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Add an address in your profile before checkout.</p>
                )}

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!canProceedAddress}>Continue to Payment</Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="mb-4 text-2xl font-semibold text-[#1E1B6A]">Payment Method</h2>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <input type="radio" checked={paymentMode === 'COD'} onChange={() => setPaymentMode('COD')} />
                    <span className="text-sm font-medium text-slate-700">Cash on Delivery</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 opacity-70">
                    <span className="text-sm font-medium text-slate-600">Razorpay (Coming Soon)</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Disabled</span>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 opacity-70">
                    <span className="text-sm font-medium text-slate-600">Stripe (Coming Soon)</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Disabled</span>
                  </label>
                </div>

                <p className="mt-3 text-xs text-slate-500">Online payment gateways are intentionally disabled for now. COD is enabled by default.</p>

                <div className="mt-6 flex flex-wrap justify-between gap-3">
                  <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={() => setStep(3)}>Continue to Review</Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="mb-4 text-2xl font-semibold text-[#1E1B6A]">Review and Confirm</h2>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p><strong>Payment:</strong> {paymentMode}</p>
                  <p className="mt-1"><strong>Address ID:</strong> {selectedAddressId || 'Not selected'}</p>
                  <p className="mt-1"><strong>Items:</strong> {cart.length}</p>
                  {appliedCoupon && <p className="mt-1"><strong>Coupon:</strong> {appliedCoupon} ({couponDiscountPercentage}% OFF)</p>}
                </div>

                <div className="mt-6 flex flex-wrap justify-between gap-3">
                  <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handlePlaceOrder} disabled={!cart.length || !selectedAddressId || placingOrder}>
                    {placingOrder ? 'Placing Order...' : 'Place Order'}
                  </Button>
                </div>
              </>
            )}
          </section>

          <aside className="rd-card sticky top-24 h-fit p-5">
            <h3 className="mb-4 text-xl font-semibold text-[#1E1B6A]">Order Summary</h3>
            <p className="mb-2 text-sm text-slate-500">Items: {cart.length}</p>

            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>INR {subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : `INR ${shipping}`}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Coupon Discount</span>
                  <span>- INR {couponDiscount}</span>
                </div>
              )}
            </div>

            <div className="my-4 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-lg font-bold text-[#1E1B6A]">
                <span>Total</span>
                <span>INR {total}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Tag size={14} />
                Apply Coupon
              </p>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  placeholder="e.g. DROP10"
                  className="rd-input"
                />
                <Button variant="secondary" onClick={handleApplyCoupon}>Apply</Button>
              </div>
              {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
              {!couponError && appliedCoupon && (
                <p className="mt-2 text-xs text-emerald-700">Coupon {appliedCoupon} applied successfully.</p>
              )}
            </div>
          </aside>
        </div>
      </SectionContainer>
    </MainLayout>
  );
};

export default CheckoutPage;
