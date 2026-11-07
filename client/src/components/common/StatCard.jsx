export default function StatCard({ icon: Icon, label, value, accent = 'brand' }) {
  const accentClass =
    {
      brand: 'bg-brand-50 text-brand-600',
      red: 'bg-red-50 text-red-600',
      emerald: 'bg-emerald-50 text-emerald-600',
      amber: 'bg-amber-50 text-amber-600',
      violet: 'bg-violet-50 text-violet-600',
    }[accent] || 'bg-brand-50 text-brand-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {Icon && (
        <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon size={18} />
        </div>
      )}
      <p className="text-2xl font-semibold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
