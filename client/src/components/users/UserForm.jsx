import { useState } from 'react';
import FormInput from '../common/FormInput';
import SelectInput from '../common/SelectInput';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'nurse', label: 'Nurse' },
];

export default function UserForm({ mode, defaultValues, onSubmit, onCancel, submitting }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(defaultValues?.name || '');
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(defaultValues?.role || 'receptionist');
  const [errors, setErrors] = useState({});

  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (!isEdit) {
      if (!email.trim()) nextErrors.email = 'Email is required';
      if (!password || password.length < 6) nextErrors.password = 'Password must be at least 6 characters';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const payload = isEdit ? { name: name.trim(), role } : { name: name.trim(), email: email.trim(), password, role };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      {!isEdit && (
        <>
          <FormInput type="email" label="Login email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <FormInput
            type="password"
            label="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        </>
      )}
      <SelectInput label="Role" options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value)} />
      {isEdit && (
        <p className="text-xs text-slate-400">
          Doctor accounts are managed from the Doctors page. Email cannot be changed here.
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
          {submitting ? 'Saving...' : 'Save user'}
        </button>
      </div>
    </form>
  );
}
