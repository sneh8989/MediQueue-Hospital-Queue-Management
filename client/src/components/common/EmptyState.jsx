import { Inbox } from 'lucide-react';

export default function EmptyState({ message = 'Nothing here yet.', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
      <Icon className="mb-3 text-slate-300" size={32} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
