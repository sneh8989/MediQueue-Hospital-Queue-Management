import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE } from '../../constants/roles';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const home = (user && ROLE_HOME_ROUTE[user.role]) || '/login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <ShieldAlert className="mb-4 text-slate-300" size={48} />
      <h1 className="text-xl font-semibold text-slate-800">Not authorized</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">Your account doesn&apos;t have access to this page.</p>
      <Link
        to={home}
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {user ? 'Back to my dashboard' : 'Go to login'}
      </Link>
    </div>
  );
}
