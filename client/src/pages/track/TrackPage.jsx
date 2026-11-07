import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Clock, Users } from 'lucide-react';
import TokenDisplay from '../../components/queue/TokenDisplay';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as publicQueueService from '../../services/publicQueueService';

const POLL_INTERVAL_MS = 5000;

const STATUS_VARIANT = {
  waiting: 'warning',
  called: 'info',
  in_consultation: 'purple',
  completed: 'success',
  skipped: 'neutral',
  cancelled: 'neutral',
  no_show: 'danger',
};

const STATUS_MESSAGE = {
  waiting: 'You are in the queue.',
  called: "You're being called now — please head to the room.",
  in_consultation: 'Your consultation is in progress.',
  completed: 'Your consultation is complete.',
  skipped: 'You were called but missed — ask reception to recall you.',
  cancelled: 'This token has been cancelled.',
  no_show: 'This token was marked as a no-show.',
};

/**
 * Patient-facing queue status page, reached via QR code or a direct link.
 * No login required - only the opaque queue entry id in the URL. Uses the
 * reduced public projection, which never includes patient name/code/phone.
 */
export default function TrackPage() {
  const { queueEntryId } = useParams();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await publicQueueService.getPublicQueueEntry(queueEntryId);
      setEntry(data);
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'This tracking link is invalid or has expired.' : 'Unable to load your status.');
    } finally {
      setLoading(false);
    }
  }, [queueEntryId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner label="Loading your status..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-lg font-medium text-slate-700">{error}</p>
      </div>
    );
  }

  const isWaiting = entry.status === 'waiting';

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-slate-500">
          <Activity size={18} className="text-brand-600" />
          <span className="text-sm font-medium">MediQueue</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Your token</p>
          <div className="mb-4 flex justify-center">
            <TokenDisplay token={entry.token} priority={entry.priority} size="lg" />
          </div>
          <StatusBadge label={entry.status.replace('_', ' ')} variant={STATUS_VARIANT[entry.status]} />
          <p className="mt-3 text-sm text-slate-600">{STATUS_MESSAGE[entry.status]}</p>

          {entry.currentToken && (
            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-400">Now serving</p>
              <p className="text-lg font-semibold text-slate-800">{entry.currentToken}</p>
            </div>
          )}

          {isWaiting && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <Users size={16} className="mx-auto mb-1 text-slate-400" />
                <p className="text-lg font-semibold text-slate-800">{entry.patientsAhead}</p>
                <p className="text-xs text-slate-400">ahead of you</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <Clock size={16} className="mx-auto mb-1 text-slate-400" />
                <p className="text-lg font-semibold text-slate-800">~{entry.estimatedWaitMinutes}</p>
                <p className="text-xs text-slate-400">min wait</p>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4 text-left text-sm text-slate-500">
            <p>{entry.doctorName}</p>
            <p>
              {entry.departmentName}
              {entry.roomNumber ? ` · Room ${entry.roomNumber}` : ''}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">This page updates automatically.</p>
      </div>
    </div>
  );
}
