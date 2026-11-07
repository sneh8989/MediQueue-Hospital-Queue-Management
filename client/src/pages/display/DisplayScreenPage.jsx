import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import * as publicQueueService from '../../services/publicQueueService';

const POLL_INTERVAL_MS = 4000;

/**
 * Large-format, unattended TV display. Intentionally its own standalone
 * layout - no sidebar/navbar/DashboardLayout - and reads only from the
 * unauthenticated /api/public/queue endpoints, since this page runs on a
 * screen in the waiting room with no one logged in.
 */
export default function DisplayScreenPage() {
  const { departmentId } = useParams();
  const [board, setBoard] = useState(null);
  const [departmentName, setDepartmentName] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const data = await publicQueueService.getPublicQueueBoard(departmentId);
      setBoard(data);
      setDepartmentName(data.departmentName);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load queue.');
    }
  }, [departmentId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white">
        <p className="text-2xl">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-10 py-6">
        <div className="flex items-center gap-3">
          <Activity size={28} className="text-brand-400" />
          <div>
            <p className="text-2xl font-semibold">{departmentName || 'Loading...'}</p>
            <p className="text-sm text-slate-400">MediQueue Live Display</p>
          </div>
        </div>
        <p className="text-xl tabular-nums text-slate-300">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center gap-16 px-10">
        <div className="text-center">
          <p className="mb-4 text-2xl uppercase tracking-widest text-slate-400">Now Serving</p>
          {board?.currentToken ? (
            <>
              <p className="text-[10rem] font-bold leading-none tabular-nums text-brand-400">
                {board.currentToken.token}
              </p>
              <div className="mt-6 flex justify-center gap-10 text-2xl text-slate-200">
                {board.currentToken.doctorName && <span>{board.currentToken.doctorName}</span>}
                {board.currentToken.roomNumber && <span>Room {board.currentToken.roomNumber}</span>}
              </div>
            </>
          ) : (
            <p className="text-6xl text-slate-600">—</p>
          )}
        </div>

        <div className="h-64 w-px bg-slate-800" />

        <div className="text-center">
          <p className="mb-4 text-xl uppercase tracking-widest text-slate-500">Next</p>
          {board?.nextToken ? (
            <p className="text-6xl font-semibold tabular-nums text-slate-300">{board.nextToken.token}</p>
          ) : (
            <p className="text-4xl text-slate-700">—</p>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800 px-10 py-6 text-center">
        <p className="text-xl text-slate-400">
          {board?.waitingCount ?? 0} patient{board?.waitingCount === 1 ? '' : 's'} waiting
        </p>
      </footer>
    </div>
  );
}
