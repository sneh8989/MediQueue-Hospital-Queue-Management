import { useCallback, useEffect, useState } from 'react';
import * as dashboardService from '../services/dashboardService';

/**
 * Loads the live operations snapshot (GET /api/dashboard/operations) and
 * keeps it fresh. Shared by the Reception and Nurse dashboards, which show
 * different slices of the same data.
 *
 * - Polls quietly in the background: a refresh never flashes the loading
 *   spinner, and a failed background refresh keeps the last good numbers
 *   on screen (the "Updated" time reveals that they're stale).
 * - Skips polling while the browser tab is hidden.
 */
export default function useOperationsSummary(intervalMs = 15000) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await dashboardService.getOperationsSummary();
      setSummary(data);
      setUpdatedAt(new Date());
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'Failed to load dashboard.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load({ silent: true });
    }, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  const reload = useCallback(() => load(), [load]);

  return { summary, loading, error, updatedAt, reload };
}
