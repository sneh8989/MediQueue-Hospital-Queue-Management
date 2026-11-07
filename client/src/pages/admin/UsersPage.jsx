import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, KeyRound, Ban, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import UserForm from '../../components/users/UserForm';
import ResetPasswordForm from '../../components/users/ResetPasswordForm';
import * as userService from '../../services/userService';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'reset', user? }
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await userService.listUsers());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      if (modal.mode === 'edit') {
        await userService.updateUser(modal.user.id, payload);
      } else {
        await userService.createUser(payload);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(password) {
    setSubmitting(true);
    try {
      await userService.resetPassword(modal.user.id, password);
      setModal(null);
      alert('Password reset successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user) {
    const verb = user.isActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${verb} ${user.name}?`)) return;
    try {
      await userService.updateUser(user.id, { isActive: !user.isActive });
      load();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${verb} user.`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & Staff"
        subtitle={`${users.length} account${users.length === 1 ? '' : 's'}`}
        actions={
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            New User
          </button>
        }
      />

      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
        This page manages admin, receptionist, and nurse accounts. Doctor accounts are created and managed from the{' '}
        <span className="font-medium text-slate-700">Doctors</span> page.
      </div>

      {loading && <LoadingSpinner label="Loading users..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={users}
          emptyMessage="No staff accounts yet."
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role', render: (r) => <span className="capitalize">{r.role}</span> },
            {
              key: 'isActive',
              header: 'Status',
              render: (r) => <StatusBadge label={r.isActive ? 'Active' : 'Inactive'} variant={r.isActive ? 'success' : 'neutral'} />,
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex items-center gap-3">
                  {r.role !== 'doctor' && (
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', user: r })}
                      className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'reset', user: r })}
                    className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline"
                  >
                    <KeyRound size={13} /> Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(r)}
                    className={`flex items-center gap-1 text-xs font-medium hover:underline ${
                      r.isActive ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {r.isActive ? (
                      <>
                        <Ban size={13} /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle size={13} /> Reactivate
                      </>
                    )}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={modal?.mode === 'create' || modal?.mode === 'edit'} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? `Edit ${modal.user?.name}` : 'New user'}>
        {modal && (modal.mode === 'create' || modal.mode === 'edit') && (
          <UserForm mode={modal.mode} defaultValues={modal.user} onSubmit={handleSubmit} onCancel={() => setModal(null)} submitting={submitting} />
        )}
      </Modal>

      <Modal open={modal?.mode === 'reset'} onClose={() => setModal(null)} title="Reset password" size="sm">
        {modal?.mode === 'reset' && (
          <ResetPasswordForm userName={modal.user.name} onSubmit={handleResetPassword} onCancel={() => setModal(null)} submitting={submitting} />
        )}
      </Modal>
    </div>
  );
}
