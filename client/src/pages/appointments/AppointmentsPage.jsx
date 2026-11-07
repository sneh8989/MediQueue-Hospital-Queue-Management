import { useEffect, useState, useCallback } from 'react';
import { CalendarPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import SelectInput from '../../components/common/SelectInput';
import FormInput from '../../components/common/FormInput';
import AppointmentForm from '../../components/appointments/AppointmentForm';
import TokenDisplay from '../../components/queue/TokenDisplay';
import QueueQRCode from '../../components/queue/QueueQRCode';
import * as appointmentService from '../../services/appointmentService';
import * as queueService from '../../services/queueService';
import { useAuth } from '../../context/AuthContext';

const STATUS_VARIANT = {
  scheduled: 'info',
  confirmed: 'info',
  waiting: 'warning',
  in_consultation: 'purple',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'in_consultation', label: 'In Consultation' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newToken, setNewToken] = useState(null);

  const canManage = user?.role === 'admin' || user?.role === 'receptionist';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await appointmentService.listAppointments(params);
      setAppointments(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBook(payload) {
    setSubmitting(true);
    try {
      await appointmentService.createAppointment(payload);
      setShowBook(false);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to book appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(appointment, status) {
    if (status === 'cancelled' && !confirm(`Cancel the appointment for ${appointment.patientName}?`)) {
      return;
    }
    try {
      await appointmentService.updateAppointment(appointment.id, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update appointment.');
    }
  }

  async function handleCheckIn(appointment) {
    try {
      const entry = await queueService.generateToken({ appointmentId: appointment.id });
      setNewToken(entry);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to check in appointment.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} appointment${appointments.length === 1 ? '' : 's'}`}
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowBook(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <CalendarPlus size={16} />
              Book Appointment
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <FormInput type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-44" />
        <SelectInput
          options={STATUS_OPTIONS.slice(1)}
          placeholder="All statuses"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
        />
        {(dateFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setDateFilter('');
              setStatusFilter('');
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <LoadingSpinner label="Loading appointments..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          data={appointments}
          emptyMessage="No appointments match these filters."
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'timeSlot', header: 'Time' },
            { key: 'patientName', header: 'Patient', render: (r) => `${r.patientName} (${r.patientCode})` },
            { key: 'doctorName', header: 'Doctor' },
            { key: 'departmentName', header: 'Department' },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge label={r.status.replace('_', ' ')} variant={STATUS_VARIANT[r.status]} />,
            },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                canManage && !['completed', 'cancelled', 'no_show', 'waiting', 'in_consultation'].includes(r.status) ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCheckIn(r)}
                      className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Check In
                    </button>
                    {r.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(r, 'confirmed')}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Confirm
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(r, 'cancelled')}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}

      <Modal open={showBook} onClose={() => setShowBook(false)} title="Book appointment" size="lg">
        <AppointmentForm onSubmit={handleBook} onCancel={() => setShowBook(false)} submitting={submitting} />
      </Modal>

      <Modal open={!!newToken} onClose={() => setNewToken(null)} title="Appointment Checked In" size="sm">
        {newToken && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <TokenDisplay token={newToken.token} priority={newToken.priority} size="lg" />
            <div>
              <p className="font-medium text-slate-800">{newToken.patientName}</p>
              <p className="text-sm text-slate-500">{newToken.doctorName} · {newToken.departmentName}</p>
            </div>
            <QueueQRCode queueEntryId={newToken.id} />
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
