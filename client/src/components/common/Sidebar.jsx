import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Activity, X } from 'lucide-react';
import { NAV_ITEMS } from '../../constants/navigation';
import { ROLE_LABELS } from '../../constants/roles';

export default function Sidebar({ role, mobileOpen, onClose }) {
  const items = NAV_ITEMS[role] || [];

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">MediQueue</p>
            <p className="text-xs text-slate-400 leading-tight">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
        {mobileOpen && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = Icons[item.icon] || Icons.Circle;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="print-hide hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden print-hide flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-64 flex-col bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
