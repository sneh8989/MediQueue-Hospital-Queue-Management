import { useState } from 'react';
import FormInput from '../common/FormInput';
import SelectInput from '../common/SelectInput';

export default function DoctorForm({ departments, rooms, defaultValues, mode, onSubmit, onCancel, submitting }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(defaultValues?.name || '');
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [password, setPassword] = useState('');
  const [specialization, setSpecialization] = useState(defaultValues?.specialization || '');
  const [departmentId, setDepartmentId] = useState(defaultValues?.departmentId || '');
  const [roomId, setRoomId] = useState(defaultValues?.roomId || '');
  const [phone, setPhone] = useState(defaultValues?.phone || '');
  const [avgConsultationMinutes, setAvgConsultationMinutes] = useState(defaultValues?.avgConsultationMinutes ?? 5);
  const [errors, setErrors] = useState({});

  // Rooms available for selection: unassigned rooms, plus the doctor's own
  // current room when editing (so it still shows up as selectable).
  const availableRooms = rooms.filter((r) => !r.doctorId || r.id === defaultValues?.roomId);

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (!departmentId) nextErrors.departmentId = 'Select a department';
    if (!isEdit) {
      if (!email.trim()) nextErrors.email = 'Email is required';
      if (!password || password.length < 6) nextErrors.password = 'Password must be at least 6 characters';
    }
    if (avgConsultationMinutes && (avgConsultationMinutes < 1 || avgConsultationMinutes > 180)) {
      nextErrors.avgConsultationMinutes = 'Must be between 1 and 180 minutes';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      specialization: specialization.trim() || null,
      departmentId,
      roomId: roomId || null,
      phone: phone.trim() || null,
      avgConsultationMinutes: Number(avgConsultationMinutes) || 5,
    };
    if (!isEdit) {
      payload.email = email.trim();
      payload.password = password;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <FormInput label="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. Cardiologist" />
      </div>

      {!isEdit && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="mb-3 text-xs font-medium text-slate-500">
            Creating a doctor also creates their staff login.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              type="email"
              label="Login email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <FormInput
              type="password"
              label="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
          </div>
        </div>
      )}

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
          label="Room"
          placeholder="Unassigned"
          options={availableRooms.map((r) => ({ value: r.id, label: `${r.number}` }))}
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <FormInput label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <FormInput
          type="number"
          min={1}
          max={180}
          label="Avg. consultation (minutes)"
          value={avgConsultationMinutes}
          onChange={(e) => setAvgConsultationMinutes(e.target.value)}
          error={errors.avgConsultationMinutes}
        />
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
          {submitting ? 'Saving...' : 'Save doctor'}
        </button>
      </div>
    </form>
  );
}
