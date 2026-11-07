import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME_ROUTE } from '../../constants/roles';

export default function NotFoundPage() {
  const { user } = useAuth();
  const home = (user && ROLE_HOME_ROUTE[user.role]) || '/login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <FileQuestion className="mb-4 text-slate-300" size={48} />
      <h1 className="text-xl font-semibold text-slate-800">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link
        to={home}
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {user ? 'Back to my dashboard' : 'Go to login'}
      </Link>
    </div>
  );
}
