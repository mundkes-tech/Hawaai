import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Package, ShoppingBag, Tags, Percent, Menu, X } from 'lucide-react';
import MainLayout from './MainLayout';

const links = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin?tab=products', icon: Package, label: 'Products' },
  { to: '/admin?tab=orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/admin?tab=categories', icon: Tags, label: 'Categories' },
  { to: '/admin?tab=coupons', icon: Percent, label: 'Coupons' },
];

const SidebarContent = ({ activePath, closeMobileMenu }) => (
  <>
    <div className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Admin workspace</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">RocketDrop Console</h2>
    </div>

    <div className="space-y-2">
      {links.map((item) => {
        const isActive = item.to === activePath;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={closeMobileMenu}
            className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className={`rounded-xl p-2 transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-200/70 group-hover:bg-slate-300/70'}`}>
              <item.icon size={16} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>

    <div className="mt-8 border-t border-slate-200 pt-6">
      <Link
        to="/"
        onClick={closeMobileMenu}
        className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900"
      >
        <span className="rounded-xl bg-slate-200/70 p-2 transition-colors group-hover:bg-slate-300/70">
          <Home size={16} />
        </span>
        <span>Back to store</span>
      </Link>
    </div>
  </>
);

const AdminLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const activePath = useMemo(() => {
    const query = new URLSearchParams(location.search);
    const tab = query.get('tab');
    if (!tab) return '/admin';
    return `/admin?tab=${tab}`;
  }, [location.search]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-[calc(100vh-5rem)] py-6 md:py-10">
        <div className="mx-auto w-full max-w-[1920px] px-3 md:px-6 xl:px-8">
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={16} />
            Menu
          </button>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="sticky top-24 hidden h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:block">
              <SidebarContent activePath={activePath} closeMobileMenu={closeMobileMenu} />
            </aside>

            <section>{children}</section>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-950/30"
              onClick={closeMobileMenu}
            />
            <aside className="absolute left-0 top-0 h-full w-[85%] max-w-xs overflow-y-auto bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Navigation</p>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={closeMobileMenu}
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarContent activePath={activePath} closeMobileMenu={closeMobileMenu} />
            </aside>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminLayout;
