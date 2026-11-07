import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Ban } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import DoctorForm from '../../components/doctors/DoctorForm';
import * as doctorService from '../../services/doctorService';
import * as departmentService from '../../services/departmentService';
import * as roomService from '../../services/roomService';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [doctorList, deptList, roomList] = await Promise.all([
        doctorService.listDoctors(),
        departmentService.listDepartments(),
        roomService.listRooms(),
      ]);
      setDoctors(doctorList);
      setDepartments(deptList);
      setRooms(roomList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load doctors.');
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
        await doctorService.updateDoctor(modal.doctor.id, payload);
      } else {
        await doctorService.createDoctor(payload);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save doctor.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(doctor) {
    if (!confirm(`Deactivate Dr. ${doctor.name}? Their login will remain but they'll be hidden from active lists.`)) return;
    try {
      await doctorService.deactivateDoctor(doctor.id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate doctor.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle={`${doctors.length} active doctor${doctors.length === 1 ? '' : 's'}`}
        actions={
          departments.length > 0 && (
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New Doctor
            </button>
          )
        }
      />

      {!loading && !error && departments.length === 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create a department first before adding doctors.
        </div>
      )}

      {loading && <LoadingSpinner label="Loading doctors..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={doctors}
          emptyMessage="No doctors yet."
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'specialization', header: 'Specialization', render: (r) => r.specialization || '—' },
            { key: 'departmentName', header: 'Department', render: (r) => r.departmentName || '—' },
            { key: 'roomNumber', header: 'Room', render: (r) => r.roomNumber || '—' },
            { key: 'avgConsultationMinutes', header: 'Avg. Consult', render: (r) => `${r.avgConsultationMinutes} min` },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'edit', doctor: r })}
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
        title={modal?.mode === 'edit' ? `Edit Dr. ${modal.doctor?.name}` : 'New doctor'}
        size="lg"
      >
        {modal && (
          <DoctorForm
            mode={modal.mode}
            departments={departments}
            rooms={rooms}
            defaultValues={modal.doctor}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>
    </div>
  );
}
