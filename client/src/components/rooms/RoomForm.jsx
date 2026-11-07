import { useState } from 'react';
import FormInput from '../common/FormInput';
import SelectInput from '../common/SelectInput';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function RoomForm({ departments, defaultValues, onSubmit, onCancel, submitting }) {
  const [number, setNumber] = useState(defaultValues?.number || '');
  const [departmentId, setDepartmentId] = useState(defaultValues?.departmentId || '');
  const [status, setStatus] = useState(defaultValues?.status || 'available');
  const [errors, setErrors] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!number.trim()) nextErrors.number = 'Room number is required';
    if (!departmentId) nextErrors.departmentId = 'Select a department';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({ number: number.trim(), departmentId, status });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput label="Room number" value={number} onChange={(e) => setNumber(e.target.value)} error={errors.number} placeholder="e.g. 204" />
      <SelectInput
        label="Department"
        placeholder="Select department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        error={errors.departmentId}
      />
      <SelectInput label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Save room'}
        </button>
      </div>
    </form>
  );
}
