import { useEffect, useState, useCallback } from 'react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import SelectInput from '../../components/common/SelectInput';
import FormInput from '../../components/common/FormInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import * as auditLogService from '../../services/auditLogService';

function formatAction(action) {
  return action.replace(/_/g, ' ');
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    auditLogService
      .getFilterOptions()
      .then(({ actions, entities }) => {
        setActions(actions);
        setEntities(entities);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (action) params.action = action;
      if (entity) params.entity = entity;
      if (date) params.date = date;
      setLogs(await auditLogService.listAuditLogs(params));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }, [action, entity, date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}`} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SelectInput
          label="Action"
          placeholder="All actions"
          options={actions.map((a) => ({ value: a, label: formatAction(a) }))}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-56"
        />
        <SelectInput
          label="Entity"
          placeholder="All entities"
          options={entities.map((e) => ({ value: e, label: e }))}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="w-44"
        />
        <FormInput type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        {(action || entity || date) && (
          <button
            type="button"
            onClick={() => {
              setAction('');
              setEntity('');
              setDate('');
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <LoadingSpinner label="Loading audit log..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={logs}
          emptyMessage="No audit log entries match these filters."
          columns={[
            { key: 'createdAt', header: 'Timestamp', render: (r) => new Date(r.createdAt).toLocaleString() },
            { key: 'userName', header: 'User' },
            { key: 'action', header: 'Action', render: (r) => <span className="capitalize">{formatAction(r.action)}</span> },
            { key: 'entity', header: 'Entity', render: (r) => r.entity || '—' },
            { key: 'description', header: 'Description' },
          ]}
        />
      )}
    </div>
  );
}
