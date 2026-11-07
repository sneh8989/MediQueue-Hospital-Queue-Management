import { AlertTriangle, Stethoscope } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import StatusBadge from '../common/StatusBadge';

function formatWait(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums text-slate-700">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

/**
 * One card per department showing the live queue at a glance. Presentational
 * only: the parent page fetches the data (GET /api/dashboard/operations) and
 * decides where the "open the queue board" link goes for its role.
 *
 * `departments` arrives already ordered by the server (emergencies first,
 * then longest queue), so the top of the grid is where attention is needed.
 */
export default function DepartmentQueueSnapshot({ departments }) {
  if (!departments || departments.length === 0) {
    return <EmptyState message="No department has an active doctor or any queue activity today." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {departments.map((d) => (
        <div
          key={d.departmentId}
          className={`rounded-xl border bg-white p-5 ${d.emergencyWaiting > 0 ? 'border-red-300' : 'border-slate-200'}`}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{d.departmentName}</h4>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <Stethoscope size={12} />
                {d.activeDoctors} doctor{d.activeDoctors === 1 ? '' : 's'}
              </p>
            </div>
            {d.emergencyWaiting > 0 && (
              <StatusBadge label={`${d.emergencyWaiting} emergency`} variant="danger" />
            )}
          </div>

          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-slate-900">{d.waiting}</span>
            <span className="text-sm text-slate-500">waiting</span>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
            <Metric label="called" value={d.called} />
            <Metric label="in consultation" value={d.inConsultation} />
            <Metric label="completed" value={d.completed} />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>
              Next: <span className="font-semibold tabular-nums text-slate-700">{d.nextToken ?? '—'}</span>
            </span>
            <span>
              Longest wait: <span className="font-semibold text-slate-700">{formatWait(d.longestWaitMinutes)}</span>
            </span>
          </div>

          {d.skipped > 0 && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={12} />
              {d.skipped} skipped — recall or mark as no-show
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
