import React, { useMemo, useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate, Link } from 'react-router-dom';
import { ChevronDown, ShieldCheck, Truck, RotateCcw, MessageSquare } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ImageGallery from '../components/ImageGallery';
import CountdownTimer from '../components/CountdownTimer';
import ProductCard from '../components/ProductCard';
import SectionContainer from '../components/SectionContainer';
import Badge from '../components/Badge';
import Button from '../components/Button';
import ScrollReveal from '../components/ScrollReveal';
import { useRocketDrop } from '../hooks/useRocketDrop';
import { useWebSocket } from '../hooks/useWebSocket';

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, categories, reviews, wishlist, actions, currentUser } = useRocketDrop();
  const { subscribe, unsubscribe, send } = useWebSocket();
  const [queueMessage, setQueueMessage] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [queueState, setQueueState] = useState({ size: 0, queue: [] });
  const [openFaq, setOpenFaq] = useState(0);

  const product = useMemo(() => products.find((item) => String(item.id) === String(id)), [products, id]);
  const productId = String(id);
  const category = useMemo(() => categories.find((item) => String(item.id) === String(product?.categoryId)), [categories, product]);
  const productReviews = useMemo(() => reviews[product?.id] || [], [reviews, product]);
  const isWishlisted = wishlist.includes(product?.id);
  const hasDrop = Boolean(product?.dropTime);
  const similarProducts = useMemo(() => {
    if (!product) return [];
    return products.filter((p) => String(p.id) !== String(product.id) && String(p.categoryId) === String(product.categoryId)).slice(0, 4);
  }, [products, product]);

  const faqItems = useMemo(() => ([
    {
      q: 'How fast will this product be delivered?',
      a: 'Orders are typically dispatched within 24-48 hours after confirmation. Delivery timelines vary by location and carrier network.',
    },
    {
      q: 'Can I return or exchange this item?',
      a: 'Yes, eligible products can be returned within the platform policy window. Ensure the item is unused and in original condition.',
    },
    {
      q: 'How does drop availability work?',
      a: 'For scheduled drops, stock becomes purchasable at launch time. You can join queue or set reminders before the drop starts.',
    },
  ]), []);

  useEffect(() => {
    let isActive = true;
    let viewerSub;
    let queueSub;

    const attachSubscriptions = async () => {
      viewerSub = await subscribe(`/topic/viewers/${productId}`, (count) => {
        if (isActive) {
          setViewerCount(Number(count) || 0);
        }
      });

      queueSub = await subscribe(`/topic/queue/${productId}`, (payload) => {
        if (!isActive) return;

        if (payload?.queue) {
          setQueueState({ size: payload.size ?? payload.queue.length, queue: payload.queue });
        }

        if (payload?.position) {
          setQueueMessage(`Your queue position: ${payload.position}`);
        } else if (payload?.size !== undefined) {
          setQueueMessage(`Queue size: ${payload.size}`);
        }
      });
    };

    send(`/app/view/${productId}`, { action: 'enter' });
    attachSubscriptions();

    return () => {
      isActive = false;
      send(`/app/view/${productId}`, { action: 'leave' });
      if (viewerSub) unsubscribe(`/topic/viewers/${productId}`);
      if (queueSub) unsubscribe(`/topic/queue/${productId}`);
    };
  }, [productId, send, subscribe, unsubscribe]);

  const canAddToCart = product.stock > 0 && (!hasDrop || product.status === 'LIVE');

  const [reminderSet, setReminderSet] = useState(() => {
    const reminders = JSON.parse(localStorage.getItem('rocketdrop.reminders') || '[]');
    return reminders.includes(productId);
  });

  useEffect(() => {
    const viewed = JSON.parse(localStorage.getItem('rocketdrop.recentlyViewed') || '[]');
    const updated = [productId, ...viewed.filter((storedId) => String(storedId) !== productId)].slice(0, 10);
    localStorage.setItem('rocketdrop.recentlyViewed', JSON.stringify(updated));
  }, [productId]);

  const toggleReminder = () => {
    const reminders = JSON.parse(localStorage.getItem('rocketdrop.reminders') || '[]');
    if (!reminders.includes(productId)) {
      localStorage.setItem('rocketdrop.reminders', JSON.stringify([...reminders, productId]));
      setReminderSet(true);
      setQueueMessage('Reminder set for this drop');
    } else {
      setQueueMessage('Reminder is already set');
    }
  };

  if (!product) return <Navigate to="/products" replace />;

  return (
    <MainLayout>
      <ScrollReveal direction="up" duration={700}>
        <section className="bg-gradient-to-r from-[#FFF7ED] to-[#F8FAFC] text-[#1E1B6A] rounded-2xl border border-[#E5E7EB] mt-8">
          <div className="container py-10">
            <p className="text-slate-500 text-sm uppercase tracking-wide">{category?.name || 'Category'}</p>
            <h1 className="text-4xl md:text-5xl font-bold mt-2">{product.name}</h1>
          </div>
        </section>
      </ScrollReveal>

      <SectionContainer className="bg-white">
        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          <ScrollReveal direction="left">
            <ImageGallery images={product.images} alt={product.name} />
          </ScrollReveal>

          <ScrollReveal direction="right" delay={80}>
            <div className="rd-card p-6 space-y-5">
            <p className="text-slate-600 leading-7">{product.description}</p>

            <div className="flex justify-between items-center">
              <p className="text-3xl font-bold text-[#1E1B6A]">INR {product.price}</p>
              <Badge variant={product.status === 'LIVE' ? 'live' : product.status === 'SOLD_OUT' ? 'soldout' : 'upcoming'}>
                {hasDrop ? product.status.replace('_', ' ') : (product.stock > 0 ? 'IN STOCK' : 'SOLD OUT')}
              </Badge>
            </div>

            {hasDrop && (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#F2D3A3]/70">
                <p className="text-sm text-slate-500 mb-2">Release countdown</p>
                <CountdownTimer dropTime={product.dropTime} />
                <Button onClick={toggleReminder} variant={reminderSet ? 'secondary' : 'primary'} className="mt-3">
                  {reminderSet ? 'Reminder Set' : 'Notify Me'}
                </Button>
              </div>
            )}

            {hasDrop && product.status === 'LIVE' && (
              <p className="text-sm text-[#1E1B6A] font-semibold">Drop Active</p>
            )}

            <p className="text-sm text-slate-600">Stock: {product.stock}</p>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-2">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /> Secure checkout</div>
              <div className="flex items-center gap-2"><Truck size={16} className="text-indigo-600" /> Fast dispatch</div>
              <div className="flex items-center gap-2"><RotateCcw size={16} className="text-amber-600" /> Easy returns</div>
              <div className="flex items-center gap-2"><MessageSquare size={16} className="text-sky-600" /> Live support</div>
            </div>

            {hasDrop && (
              <>
                <p className="text-sm text-slate-600">Live viewers: {viewerCount}</p>
                <p className="text-sm text-slate-600">Queue length: {queueState.size}</p>
                {queueState.queue.length > 0 && currentUser && (
                  <p className="text-sm text-emerald-700">Your position: {queueState.queue.find((item) => item.user?.id === currentUser.id)?.position || 'N/A'}</p>
                )}
              </>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => actions.addToCart(product.id, 1)}
                  disabled={!canAddToCart}
                >
                  {canAddToCart ? 'Add to Cart' : (hasDrop ? 'Available at release time' : 'Out of Stock')}
                </Button>

                {hasDrop && (
                  <Button
                    onClick={async () => {
                      if (!canAddToCart) {
                        const queue = await actions.joinQueue(product.id);
                        setQueueState(queue);
                        setQueueMessage('Release not live yet, you were added to queue.');
                        return;
                      }

                      const queue = await actions.joinQueue(product.id);
                      setQueueState(queue);
                      setQueueMessage('Joined queue. Waiting for your turn...');
                    }}
                    variant="dark"
                  >
                    Quick Buy
                  </Button>
                )}

                <Button onClick={() => actions.toggleWishlist(product.id)} variant="secondary">
                  {isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={async () => {
                    await actions.addToCart(product.id, 1);
                    navigate('/checkout');
                  }}
                  disabled={!canAddToCart}
                  variant="secondary"
                >
                  Direct Checkout
                </Button>
                {hasDrop ? (
                  <Button onClick={toggleReminder} variant="secondary">
                    {reminderSet ? 'Reminder Set' : 'Notify Me'}
                  </Button>
                ) : (
                  <Button as={Link} to="/products" variant="secondary" className="text-center">
                    Continue Shopping
                  </Button>
                )}
              </div>
              {queueMessage && <p className="text-sm text-slate-600 mt-2">{queueMessage}</p>}
            </div>
          </div>
          </ScrollReveal>
        </div>
      </SectionContainer>

      <SectionContainer title="Reviews" className="bg-slate-50">
        <div className="rd-card p-6">
        {productReviews.length ? (
          <div className="space-y-4">
            {productReviews.map((review) => (
              <article key={review.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">{review.user}</p>
                  <p className="text-sm text-amber-600">{review.rating} / 5</p>
                </div>
                <p className="text-slate-600">{review.comment}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No reviews yet.</p>
        )}
        </div>
      </SectionContainer>

      <SectionContainer title="FAQ" subtitle="Everything you should know before placing your order" className="bg-white border-t border-slate-100">
        <div className="rd-card p-4 md:p-6">
          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <article key={item.q} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setOpenFaq((prev) => (prev === index ? -1 : index))}
                  >
                    <span className="text-sm font-semibold text-[#1E1B6A] md:text-base">{item.q}</span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <p className="px-4 pb-4 text-sm text-slate-600">{item.a}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </SectionContainer>

      {similarProducts.length > 0 && (
        <SectionContainer title="Related Products" subtitle="You might also like these picks from the same category" className="bg-[#F8FAFC] border-t border-[#F2D3A3]/30">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProducts.map((similar) => (
              <ProductCard key={similar.id} product={similar} />
            ))}
          </div>
        </SectionContainer>
      )}
    </MainLayout>
  );
};

export default ProductPage;
