import TokenDisplay from './TokenDisplay';
import { PRIORITY_LEVELS } from '../../constants/statuses';

const PRIORITY_LABELS = Object.fromEntries(Object.values(PRIORITY_LEVELS).map((p) => [p.key, p.label]));

export default function QueueCard({ entry, actions }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <TokenDisplay token={entry.token} priority={entry.priority} />
        <div>
          <p className="font-medium text-slate-800">{entry.patientName}</p>
          <p className="text-xs text-slate-400">
            {entry.patientCode} · {entry.doctorName}
            {entry.priority !== 'normal' && (
              <span className="ml-1 font-medium text-slate-500">· {PRIORITY_LABELS[entry.priority]}</span>
            )}
          </p>
          {entry.status === 'waiting' && entry.patientsAhead !== null && (
            <p className="mt-0.5 text-xs text-slate-400">
              {entry.patientsAhead} ahead · ~{entry.estimatedWaitMinutes} min wait
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
