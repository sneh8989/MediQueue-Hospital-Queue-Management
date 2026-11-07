export default function LoadingSpinner({ label = 'Loading...', full = false }) {
  return (
    <div
      className={
        full
          ? 'flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-3'
          : 'flex items-center justify-center gap-3 py-10'
      }
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}
