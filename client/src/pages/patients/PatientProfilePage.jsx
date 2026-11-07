import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import PatientForm from '../../components/patients/PatientForm';
import StatusBadge from '../../components/common/StatusBadge';
import * as patientService from '../../services/patientService';
import * as appointmentService from '../../services/appointmentService';
import * as queueService from '../../services/queueService';
import * as consultationService from '../../services/consultationService';
import * as prescriptionService from '../../services/prescriptionService';
import { useAuth } from '../../context/AuthContext';

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}

export default function PatientProfilePage({ basePath }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [queueHistory, setQueueHistory] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [consultations, setConsultations] = useState([]);
  const [consultationsLoading, setConsultationsLoading] = useState(true);
  const [prescriptionsByConsultation, setPrescriptionsByConsultation] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'receptionist';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await patientService.getPatient(id);
      setPatient(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patient.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    appointmentService
      .listAppointments({ patientId: id })
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setAppointmentsLoading(false));
    queueService
      .getPatientQueueHistory(id)
      .then(setQueueHistory)
      .catch(() => setQueueHistory([]))
      .finally(() => setQueueLoading(false));
    consultationService
      .listConsultations({ patientId: id })
      .then(async (list) => {
        setConsultations(list);
        try {
          const prescriptions = await prescriptionService.listPrescriptions({ patientId: id });
          const byConsultation = {};
          for (const rx of prescriptions) {
            byConsultation[rx.consultationId] = rx;
          }
          setPrescriptionsByConsultation(byConsultation);
        } catch {
          setPrescriptionsByConsultation({});
        }
      })
      .catch(() => setConsultations([]))
      .finally(() => setConsultationsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpdate(payload) {
    setSubmitting(true);
    try {
      const updated = await patientService.updatePatient(id, payload);
      setPatient(updated);
      setShowEdit(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update patient.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading patient..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!patient) return null;

  return (
    <div>
      <Link
        to={basePath}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back to patients
      </Link>

      <PageHeader
        title={patient.name}
        subtitle={`${patient.patientCode} · ${patient.age ?? '—'} yrs · ${patient.gender}`}
        actions={
          canEdit && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={15} />
              Edit
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Personal Information</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Date of birth" value={patient.dob} />
            <InfoRow label="Blood group" value={patient.bloodGroup} />
            <InfoRow label="Address" value={patient.address} />
            <InfoRow
              label="Emergency contact"
              value={
                patient.emergencyContact?.name || patient.emergencyContact?.phone
                  ? `${patient.emergencyContact?.name || ''} ${patient.emergencyContact?.phone || ''}`.trim()
                  : null
              }
            />
          </dl>
          {patient.medicalNotes && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Medical notes</dt>
              <dd className="mt-1 text-sm text-slate-700">{patient.medicalNotes}</dd>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Quick facts</h3>
          <dl className="space-y-3">
            <InfoRow label="Registered" value={new Date(patient.createdAt).toLocaleDateString()} />
            <InfoRow label="Last updated" value={new Date(patient.updatedAt).toLocaleDateString()} />
          </dl>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Appointments</h3>
          {appointmentsLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : appointments.length === 0 ? (
            <EmptyState message="No appointments booked yet for this patient." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {a.date} at {a.timeSlot}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.doctorName} · {a.departmentName}
                    </p>
                  </div>
                  <StatusBadge label={a.status.replace('_', ' ')} variant="neutral" />
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Queue History</h3>
          {queueLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : queueHistory.length === 0 ? (
            <EmptyState message="No queue tokens generated for this patient yet." />
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {queueHistory.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {e.token} · {e.doctorName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {e.date} · {e.departmentName}
                    </p>
                  </div>
                  <StatusBadge label={e.status.replace('_', ' ')} variant="neutral" />
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Consultations & Prescriptions</h3>
          {consultationsLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : consultations.length === 0 ? (
            <EmptyState message="No consultations recorded for this patient yet." />
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{c.doctorName}</p>
                    <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                  {c.chiefComplaint && (
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Complaint:</span> {c.chiefComplaint}
                    </p>
                  )}
                  {c.diagnosis && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Diagnosis:</span> {c.diagnosis}
                    </p>
                  )}
                  {c.notes && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Notes:</span> {c.notes}
                    </p>
                  )}
                  {c.followUpDate && (
                    <p className="mt-1 text-xs text-slate-400">Follow-up: {c.followUpDate}</p>
                  )}
                  {prescriptionsByConsultation[c.id]?.items?.length > 0 ? (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Prescription
                      </p>
                      <ul className="space-y-1">
                        {prescriptionsByConsultation[c.id].items.map((item) => (
                          <li key={item.id} className="text-sm text-slate-600">
                            <span className="font-medium text-slate-700">{item.medicineName}</span>
                            {' — '}
                            {item.dosage}
                            {item.frequency ? `, ${item.frequency}` : ''}
                            {item.duration ? `, ${item.duration}` : ''}
                            {item.instructions && (
                              <span className="block text-xs text-slate-400">{item.instructions}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400 italic">No prescription issued for this visit.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Billing</h3>
          <EmptyState message="Billing history will appear here once billing is implemented." />
        </section>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit patient" size="lg">
        <PatientForm
          defaultValues={{
            name: patient.name,
            gender: patient.gender,
            phone: patient.phone,
            dob: patient.dob || '',
            email: patient.email || '',
            address: patient.address || '',
            bloodGroup: patient.bloodGroup || '',
            emergencyContactName: patient.emergencyContact?.name || '',
            emergencyContactPhone: patient.emergencyContact?.phone || '',
            medicalNotes: patient.medicalNotes || '',
          }}
          onSubmit={handleUpdate}
          onCancel={() => setShowEdit(false)}
          submitting={submitting}
        />
      </Modal>
    </div>
  );
}
