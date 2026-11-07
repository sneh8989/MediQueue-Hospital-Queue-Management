const VARIANTS = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
  purple: 'bg-violet-50 text-violet-700',
};

export default function StatusBadge({ label, variant = 'neutral' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${VARIANTS[variant]}`}>
      {label}
    </span>
  );
}
