const PRIORITY_COLOR = {
  emergency: 'bg-red-600 text-white',
  senior_citizen: 'bg-amber-500 text-white',
  pregnant: 'bg-pink-500 text-white',
  special_needs: 'bg-violet-500 text-white',
  normal: 'bg-slate-700 text-white',
};

export default function TokenDisplay({ token, priority = 'normal', size = 'md' }) {
  const sizeClass = { sm: 'px-2.5 py-1 text-sm', md: 'px-3.5 py-1.5 text-base', lg: 'px-6 py-3 text-4xl' }[size];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-bold tabular-nums ${sizeClass} ${
        PRIORITY_COLOR[priority] || PRIORITY_COLOR.normal
      }`}
    >
      {token}
    </span>
  );
}
