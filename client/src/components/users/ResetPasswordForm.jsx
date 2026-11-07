import { useState } from 'react';
import FormInput from '../common/FormInput';

export default function ResetPasswordForm({ userName, onSubmit, onCancel, submitting }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    onSubmit(password);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Set a new temporary password for <span className="font-medium text-slate-700">{userName}</span>.
      </p>
      <FormInput
        type="password"
        label="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </div>
    </form>
  );
}
