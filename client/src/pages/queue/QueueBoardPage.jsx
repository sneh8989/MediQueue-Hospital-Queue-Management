import { useEffect, useState, useCallback } from 'react';
import { PhoneCall, Plus, RotateCw, Monitor } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SelectInput from '../../components/common/SelectInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import QueueCard from '../../components/queue/QueueCard';
import GenerateTokenForm from '../../components/queue/GenerateTokenForm';
import QueueQRCode from '../../components/queue/QueueQRCode';
import TokenDisplay from '../../components/queue/TokenDisplay';
import ConsultationForm from '../../components/consultations/ConsultationForm';
import * as queueService from '../../services/queueService';
import * as consultationService from '../../services/consultationService';
import * as prescriptionService from '../../services/prescriptionService';
import * as departmentService from '../../services/departmentService';
import * as doctorService from '../../services/doctorService';
import { useAuth } from '../../context/AuthContext';

const POLL_INTERVAL_MS = 5000;

export default function QueueBoardPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [consultEntry, setConsultEntry] = useState(null);
  const [existingConsultation, setExistingConsultation] = useState(null);
  const [existingPrescription, setExistingPrescription] = useState(null);
  const [consultSubmitting, setConsultSubmitting] = useState(null);
  const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);

  const isDoctor = user?.role === 'doctor';
  const [actionLoading, setActionLoading] = useState(null);

  const canManage = ['admin', 'receptionist', 'nurse', 'doctor'].includes(user?.role);

  useEffect(() => {
    departmentService
      .listDepartments()
      .then(async (list) => {
        setDepartments(list);
        if (list.length > 0) {
          if (user?.role === 'doctor') {
            try {
              const myDoc = await doctorService.getMyDoctorProfile();
              if (myDoc?.departmentId && list.some((d) => d.id === myDoc.departmentId)) {
                setDepartmentId(myDoc.departmentId);
                return;
              }
            } catch {
              // fallback to first department
            }
          }
          setDepartmentId(list[0].id);
        }
      })
      .catch(() => setDepartments([]));
  }, [user]);

  useEffect(() => {
    if (departmentId) {
      doctorService.listDoctors({ departmentId }).then(setDoctors).catch(() => setDoctors([]));
    }
  }, [departmentId]);

  const load = useCallback(async () => {
    if (!departmentId) return;
    setError('');
    try {
      const data = await queueService.getQueue(departmentId);
      setQueue(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleGenerate(payload) {
    setActionLoading('generate');
    try {
      const entry = await queueService.generateToken(payload);
      setShowGenerate(false);
      setNewToken(entry);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate token.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCallNext() {
    setActionLoading('call-next');
    try {
      await queueService.callNext(departmentId);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'No patients waiting.');
    } finally {
      setActionLoading(null);
    }
  }

  async function runAction(id, fn) {
    setActionLoading(id);
    try {
      await fn(id);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function openConsultation(entry) {
    setConsultEntry(entry);
    setExistingConsultation(null);
    setExistingPrescription(null);
    try {
      const existing = await consultationService.listConsultations({ queueEntryId: entry.id });
      if (existing.length > 0) {
        setExistingConsultation(existing[0]);
        const rx = await prescriptionService.listPrescriptions({ consultationId: existing[0].id });
        if (rx.length > 0) setExistingPrescription(rx[0]);
      }
    } catch {
      // No existing consultation/prescription is a normal case, not an error.
    }
  }

  async function handleSaveConsultation(fields, shouldComplete) {
    setConsultSubmitting(shouldComplete ? 'complete' : 'save');
    try {
      let consultation = existingConsultation;
      if (!consultation) {
        consultation = await consultationService.createConsultation({
          queueEntryId: consultEntry.id,
          ...fields,
        });
      } else {
        await consultationService.updateConsultation(consultation.id, fields);
      }
      if (shouldComplete) {
        await consultationService.updateConsultation(consultation.id, { completeConsultation: true });
        setConsultEntry(null);
        setExistingConsultation(null);
        setExistingPrescription(null);
      } else {
        // Keep the modal open so the doctor can now add a prescription -
        // it needs the consultation to exist first.
        setExistingConsultation(consultation);
      }
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save consultation.');
    } finally {
      setConsultSubmitting(null);
    }
  }

  async function handleSavePrescription(items) {
    setPrescriptionSubmitting(true);
    try {
      let prescription;
      if (existingPrescription) {
        prescription = await prescriptionService.updatePrescription(existingPrescription.id, { items });
      } else {
        prescription = await prescriptionService.createPrescription({
          consultationId: existingConsultation.id,
          items,
        });
      }
      setExistingPrescription(prescription);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save prescription.');
    } finally {
      setPrescriptionSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading queue..." />;

  return (
    <div>
      <PageHeader
        title="Queue"
        subtitle={queue ? `${queue.counts.waiting} waiting · ${queue.counts.inConsultation} in consultation` : ''}
        actions={
          <div className="flex items-center gap-2">
            <SelectInput
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-56"
            />
            {departmentId && (
              <a
                href={`/display/${departmentId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Monitor size={16} />
                Display Screen
              </a>
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={handleCallNext}
                  disabled={actionLoading === 'call-next' || !queue?.counts.waiting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <PhoneCall size={16} />
                  Call Next
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerate(true)}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Plus size={16} />
                  New Token
                </button>
              </>
            )}
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && queue && (
        <div className="space-y-8">
          {(queue.called.length > 0 || queue.inConsultation.length > 0) && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Being seen now</h3>
              <div className="space-y-3">
                {queue.called.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    actions={
                      canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => runAction(entry.id, queueService.start)}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            onClick={() => runAction(entry.id, queueService.skip)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Skip
                          </button>
                        </>
                      )
                    }
                  />
                ))}
                {queue.inConsultation.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    actions={
                      canManage &&
                      (isDoctor ? (
                        <button
                          type="button"
                          onClick={() => openConsultation(entry)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Consultation Notes
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => runAction(entry.id, queueService.complete)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Complete
                        </button>
                      ))
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Waiting ({queue.waiting.length})</h3>
            {queue.waiting.length === 0 ? (
              <EmptyState message="No one waiting right now." />
            ) : (
              <div className="space-y-3">
                {queue.waiting.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    actions={
                      canManage && (
                        <button
                          type="button"
                          onClick={() => runAction(entry.id, queueService.callSpecific)}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Call
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {queue.skipped.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Skipped</h3>
              <div className="space-y-3">
                {queue.skipped.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    actions={
                      canManage && (
                        <button
                          type="button"
                          onClick={() => runAction(entry.id, queueService.recall)}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <RotateCw size={13} /> Recall
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {queue.completed.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Completed today ({queue.completed.length})</h3>
              <div className="space-y-2 opacity-70">
                {queue.completed.map((entry) => (
                  <QueueCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate walk-in token">
        <GenerateTokenForm
          departmentId={departmentId}
          doctors={doctors}
          onSubmit={handleGenerate}
          onCancel={() => setShowGenerate(false)}
          submitting={actionLoading === 'generate'}
        />
      </Modal>

      <Modal open={!!newToken} onClose={() => setNewToken(null)} title="Token generated" size="sm">
        {newToken && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <TokenDisplay token={newToken.token} priority={newToken.priority} size="lg" />
            <div>
              <p className="font-medium text-slate-800">{newToken.patientName}</p>
              <p className="text-sm text-slate-500">{newToken.doctorName}</p>
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

      <Modal open={!!consultEntry} onClose={() => setConsultEntry(null)} title={`Token ${consultEntry?.token || ''}`} size="lg">
        {consultEntry && (
          <ConsultationForm
            patientName={consultEntry.patientName}
            defaultValues={existingConsultation}
            existingPrescription={existingPrescription}
            onSave={(fields) => handleSaveConsultation(fields, false)}
            onComplete={(fields) => handleSaveConsultation(fields, true)}
            onSavePrescription={existingConsultation ? handleSavePrescription : undefined}
            onCancel={() => setConsultEntry(null)}
            submitting={consultSubmitting}
            prescriptionSubmitting={prescriptionSubmitting}
          />
        )}
      </Modal>
    </div>
  );
}
