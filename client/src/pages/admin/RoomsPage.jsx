import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import RoomForm from '../../components/rooms/RoomForm';
import * as roomService from '../../services/roomService';
import * as departmentService from '../../services/departmentService';

const STATUS_VARIANT = { available: 'success', occupied: 'info', maintenance: 'warning' };

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [roomList, deptList] = await Promise.all([roomService.listRooms(), departmentService.listDepartments()]);
      setRooms(roomList);
      setDepartments(deptList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rooms.');
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
        await roomService.updateRoom(modal.room.id, payload);
      } else {
        await roomService.createRoom(payload);
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save room.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(room) {
    if (room.doctorId) {
      alert('This room has a doctor assigned. Unassign the doctor first.');
      return;
    }
    if (!confirm(`Delete room ${room.number}?`)) return;
    try {
      await roomService.deleteRoom(room.id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete room.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`}
        actions={
          departments.length > 0 && (
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              New Room
            </button>
          )
        }
      />

      {!loading && !error && departments.length === 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create a department first before adding rooms.
        </div>
      )}

      {loading && <LoadingSpinner label="Loading rooms..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={rooms}
          emptyMessage="No rooms yet."
          columns={[
            { key: 'number', header: 'Room' },
            { key: 'departmentName', header: 'Department', render: (r) => r.departmentName || '—' },
            { key: 'doctorName', header: 'Assigned Doctor', render: (r) => r.doctorName || '—' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge label={r.status.replace('_', ' ')} variant={STATUS_VARIANT[r.status]} />,
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'edit', room: r })}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit room' : 'New room'}>
        {modal && (
          <RoomForm
            departments={departments}
            defaultValues={modal.room}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>
    </div>
  );
}
