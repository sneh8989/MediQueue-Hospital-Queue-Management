import { Link } from 'react-router-dom';
import { Users, PhoneCall, Stethoscope, CheckCircle2, Siren } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import DepartmentQueueSnapshot from '../../components/queue/DepartmentQueueSnapshot';
import useOperationsSummary from '../../hooks/useOperationsSummary';
import { useAuth } from '../../context/AuthContext';

export default function NurseDashboardPage() {
  const { user } = useAuth();
  const { summary, loading, error, updatedAt, reload } = useOperationsSummary();

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { totals, departments } = summary;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name || 'Nurse'}`}
        subtitle={`Live queue overview${updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString()}` : ''}`}
        actions={
          <Link
            to="/nurse/queue"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open queue board
          </Link>
        }
      />

      {totals.emergencyWaiting > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-red-700">
            <Siren size={16} />
            {totals.emergencyWaiting} emergency patient{totals.emergencyWaiting === 1 ? '' : 's'} waiting
          </p>
          <Link to="/nurse/queue" className="text-sm font-medium text-red-700 hover:underline">
            Open queue board →
          </Link>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Waiting now" value={totals.waiting} accent="amber" />
        <StatCard icon={PhoneCall} label="Called" value={totals.called} />
        <StatCard icon={Stethoscope} label="In consultation" value={totals.inConsultation} accent="violet" />
        <StatCard icon={CheckCircle2} label="Completed today" value={totals.completed} accent="emerald" />
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Queues by department</h3>
          <Link to="/nurse/queue" className="text-sm font-medium text-brand-600 hover:underline">
            Open queue board →
          </Link>
        </div>
        <DepartmentQueueSnapshot departments={departments} />
      </div>
    </div>
  );
}
