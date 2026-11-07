import { useState } from 'react';
import FormInput from '../common/FormInput';

export default function DepartmentForm({ defaultValues, onSubmit, onCancel, submitting }) {
  const [name, setName] = useState(defaultValues?.name || '');
  const [description, setDescription] = useState(defaultValues?.description || '');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department name is required');
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() || null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput
        label="Department name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error}
        placeholder="e.g. Cardiology"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Optional"
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
          {submitting ? 'Saving...' : 'Save department'}
        </button>
      </div>
    </form>
  );
}
