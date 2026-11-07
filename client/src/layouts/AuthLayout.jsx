import { Outlet } from 'react-router-dom';
import { Activity } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 py-12 sm:px-16">
        <div className="mb-10 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity size={20} />
          </div>
          <span className="text-lg font-semibold text-slate-800">MediQueue</span>
        </div>
        <Outlet />
      </div>
      <div className="hidden bg-gradient-to-br from-brand-700 to-brand-900 lg:flex lg:flex-col lg:justify-center lg:px-16 lg:text-white">
        <h2 className="text-3xl font-semibold leading-tight">
          Hospital Queue Management, done right.
        </h2>
        <p className="mt-4 max-w-md text-brand-100">
          Register patients, run live queues, and give every department a clear
          picture of who's next — all from one system.
        </p>
      </div>
    </div>
  );
}
