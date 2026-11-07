import { useEffect, useState } from 'react';
import PatientPicker from './PatientPicker';
import FormInput from '../common/FormInput';
import SelectInput from '../common/SelectInput';
import * as departmentService from '../../services/departmentService';
import * as doctorService from '../../services/doctorService';

export default function AppointmentForm({ defaultPatient, onSubmit, onCancel, submitting }) {
  const [patient, setPatient] = useState(defaultPatient || null);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    departmentService.listDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setDoctors([]);
      setDoctorId('');
      return;
    }
    doctorService
      .listDoctors({ departmentId })
      .then((list) => {
        setDoctors(list);
        setDoctorId((prev) => (list.some((d) => d.id === prev) ? prev : ''));
      })
      .catch(() => setDoctors([]));
  }, [departmentId]);

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!patient) nextErrors.patient = 'Select a patient';
    if (!departmentId) nextErrors.departmentId = 'Select a department';
    if (!doctorId) nextErrors.doctorId = 'Select a doctor';
    if (!date) nextErrors.date = 'Select a date';
    if (!timeSlot) nextErrors.timeSlot = 'Select a time';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      patientId: patient.id,
      departmentId,
      doctorId,
      date,
      timeSlot,
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PatientPicker value={patient} onChange={setPatient} error={errors.patient} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectInput
          label="Department"
          placeholder="Select department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          error={errors.departmentId}
        />
        <SelectInput
          label="Doctor"
          placeholder={departmentId ? 'Select doctor' : 'Select a department first'}
          disabled={!departmentId}
          options={doctors.map((d) => ({ value: d.id, label: `${d.name}${d.roomNumber ? ` · Room ${d.roomNumber}` : ''}` }))}
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          error={errors.doctorId}
        />
        <FormInput type="date" label="Date" min={today} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <FormInput type="time" label="Time slot" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} error={errors.timeSlot} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Booking...' : 'Book appointment'}
        </button>
      </div>
    </form>
  );
}
