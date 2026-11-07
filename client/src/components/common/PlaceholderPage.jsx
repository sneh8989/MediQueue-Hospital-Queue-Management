import { Construction } from 'lucide-react';

/**
 * Temporary placeholder for modules not yet implemented in the current
 * development phase. Replaced with real functionality phase by phase —
 * see PROJECT_STATE.md for what's built vs. pending.
 */
export default function PlaceholderPage({ title, phase }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center">
      <Construction className="mb-3 text-slate-300" size={40} />
      <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        This module is scheduled for {phase}. It isn't wired to the backend
        yet, so nothing here is fake functionality — it's simply not built
        yet.
      </p>
    </div>
  );
}
