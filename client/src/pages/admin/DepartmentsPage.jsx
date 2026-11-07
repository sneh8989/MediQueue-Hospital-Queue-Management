import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Ban } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import DepartmentForm from '../../components/departments/DepartmentForm';
import * as departmentService from '../../services/departmentService';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', department? }
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDepartments(await departmentService.listDepartments());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments.');
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
        await departmentService.updateDepartment(modal.department.id, payload);
      } else {
        await departmentService.createDepartment(payload);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save department.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(department) {
    if (!confirm(`Deactivate "${department.name}"? Doctors and rooms already assigned to it will keep their history.`)) return;
    try {
      await departmentService.deactivateDepartment(department.id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate department.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} active department${departments.length === 1 ? '' : 's'}`}
        actions={
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            New Department
          </button>
        }
      />

      {loading && <LoadingSpinner label="Loading departments..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={departments}
          emptyMessage="No departments yet. Create one to start assigning doctors and rooms."
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'description', header: 'Description', render: (r) => r.description || '—' },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'edit', department: r })}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(r)}
                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <Ban size={13} /> Deactivate
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit department' : 'New department'}
      >
        {modal && (
          <DepartmentForm
            defaultValues={modal.department}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>
    </div>
  );
}
