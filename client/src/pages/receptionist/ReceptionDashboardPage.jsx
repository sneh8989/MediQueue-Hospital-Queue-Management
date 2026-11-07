import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock, Users, CheckCircle2, UserPlus, CalendarPlus, ListOrdered, Siren } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import TokenDisplay from '../../components/queue/TokenDisplay';
import QueueQRCode from '../../components/queue/QueueQRCode';
import DepartmentQueueSnapshot from '../../components/queue/DepartmentQueueSnapshot';
import useOperationsSummary from '../../hooks/useOperationsSummary';
import * as appointmentService from '../../services/appointmentService';
import * as queueService from '../../services/queueService';

const YET_TO_ARRIVE = new Set(['scheduled', 'confirmed']);
const APPOINTMENT_VARIANT = { scheduled: 'neutral', confirmed: 'info' };
const VISIBLE_ROWS = 8;

const actionClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const primaryActionClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700';

export default function ReceptionDashboardPage() {
  const { summary, loading, error, updatedAt, reload } = useOperationsSummary();
  const [appointments, setAppointments] = useState(null);
  const [appointmentsFailed, setAppointmentsFailed] = useState(false);
  const [newToken, setNewToken] = useState(null);

  // Piggy-back on the summary's refresh cycle (every ~15s) instead of running
  // a second timer: whenever the numbers refresh, so does the list.
  useEffect(() => {
    appointmentService
      .listTodayAppointments()
      .then((list) => {
        setAppointments(list);
        setAppointmentsFailed(false);
      })
      .catch(() => setAppointmentsFailed(true));
  }, [updatedAt]);

  async function handleCheckIn(appointment) {
    try {
      const entry = await queueService.generateToken({ appointmentId: appointment.id });
      setNewToken(entry);
      // Refresh list immediately
      const list = await appointmentService.listTodayAppointments();
      setAppointments(list);
      reload();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to check in appointment.');
    }
  }

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { totals, appointments: apptStats, departments } = summary;
  const yetToArrive = apptStats.byStatus.scheduled + apptStats.byStatus.confirmed;
  const upcoming = (appointments || []).filter((a) => YET_TO_ARRIVE.has(a.status));

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader
        title="Reception Dashboard"
        subtitle={`${today}${updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString()}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/reception/patients" className={actionClass}>
              <UserPlus size={16} /> Find / register patient
            </Link>
            <Link to="/reception/appointments" className={actionClass}>
              <CalendarPlus size={16} /> Book appointment
            </Link>
            <Link to="/reception/queue" className={primaryActionClass}>
              <ListOrdered size={16} /> Queue board
            </Link>
          </div>
        }
      />

      {totals.emergencyWaiting > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-red-700">
            <Siren size={16} />
            {totals.emergencyWaiting} emergency patient{totals.emergencyWaiting === 1 ? '' : 's'} waiting
          </p>
          <Link to="/reception/queue" className="text-sm font-medium text-red-700 hover:underline">
            Open queue board →
          </Link>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Appointments today" value={apptStats.total} />
        <StatCard icon={CalendarClock} label="Yet to arrive" value={yetToArrive} accent="violet" />
        <StatCard icon={Users} label="Waiting now" value={totals.waiting} accent="amber" />
        <StatCard icon={CheckCircle2} label="Completed today" value={totals.completed} accent="emerald" />
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Live queues</h3>
          <Link to="/reception/queue" className="text-sm font-medium text-brand-600 hover:underline">
            Open queue board →
          </Link>
        </div>
        <DepartmentQueueSnapshot departments={departments} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Yet to arrive today{appointments ? ` (${upcoming.length})` : ''}
          </h3>
          <Link to="/reception/appointments" className="text-sm font-medium text-brand-600 hover:underline">
            All appointments →
          </Link>
        </div>

        {appointments === null && !appointmentsFailed && <p className="text-sm text-slate-400">Loading appointments...</p>}
        {appointments === null && appointmentsFailed && (
          <p className="text-sm text-red-600">Couldn't load today's appointments. They'll retry automatically.</p>
        )}
        {appointments !== null && upcoming.length === 0 && (
          <p className="text-sm text-slate-400">Everyone booked for today has arrived.</p>
        )}
        {upcoming.length > 0 && (
          <div className="divide-y divide-slate-100">
            {upcoming.slice(0, VISIBLE_ROWS).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="w-14 shrink-0 font-medium tabular-nums text-slate-700">{a.timeSlot}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">{a.patientName}</span>
                <span className="hidden min-w-0 flex-1 truncate text-slate-400 sm:block">{a.doctorName}</span>
                <StatusBadge label={a.status.replace('_', ' ')} variant={APPOINTMENT_VARIANT[a.status]} />
                <button
                  type="button"
                  onClick={() => handleCheckIn(a)}
                  className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  Check In
                </button>
              </div>
            ))}
            {upcoming.length > VISIBLE_ROWS && (
              <p className="pt-3 text-xs text-slate-400">
                Showing the first {VISIBLE_ROWS} of {upcoming.length}.
              </p>
            )}
          </div>
        )}
      </div>

      <Modal open={!!newToken} onClose={() => setNewToken(null)} title="Appointment Checked In" size="sm">
        {newToken && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <TokenDisplay token={newToken.token} priority={newToken.priority} size="lg" />
            <div>
              <p className="font-medium text-slate-800">{newToken.patientName}</p>
              <p className="text-sm text-slate-500">{newToken.doctorName} · {newToken.departmentName}</p>
            </div>
            <QueueQRCode queueEntryId={newToken.id} />
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
