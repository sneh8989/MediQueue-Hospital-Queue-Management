import { useState } from 'react';
import PatientPicker from '../appointments/PatientPicker';
import SelectInput from '../common/SelectInput';
import { PRIORITY_LEVELS } from '../../constants/statuses';

const PRIORITY_OPTIONS = Object.values(PRIORITY_LEVELS).map((p) => ({ value: p.key, label: p.label }));

export default function GenerateTokenForm({ departmentId, doctors, onSubmit, onCancel, submitting }) {
  const [patient, setPatient] = useState(null);
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [errors, setErrors] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!patient) nextErrors.patient = 'Select a patient';
    if (!doctorId) nextErrors.doctorId = 'Select a doctor';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({ patientId: patient.id, departmentId, doctorId, priority });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PatientPicker value={patient} onChange={setPatient} error={errors.patient} />
      <SelectInput
        label="Doctor"
        placeholder="Select doctor"
        options={doctors.map((d) => ({ value: d.id, label: `${d.name}${d.roomNumber ? ` · Room ${d.roomNumber}` : ''}` }))}
        value={doctorId}
        onChange={(e) => setDoctorId(e.target.value)}
        error={errors.doctorId}
      />
      <SelectInput
        label="Priority"
        options={PRIORITY_OPTIONS}
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      />
      {priority !== 'normal' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This patient will be placed ahead of normal walk-ins in the queue.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Generating...' : 'Generate token'}
        </button>
      </div>
    </form>
  );
}
