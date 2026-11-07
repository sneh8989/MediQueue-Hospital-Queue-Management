import { useEffect, useState, useCallback } from 'react';
import { Clock, ListOrdered } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import FormInput from '../../components/common/FormInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import * as settingsService from '../../services/settingsService';
import { PRIORITY_LEVELS } from '../../constants/statuses';

const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

// Fixed by the queue engine (server/models/queueEntryModel.js) - shown for
// reference only, deliberately not editable: a control that changed nothing
// would be worse than no control.
const TOKEN_FORMATS = [
  { prefix: 'A', label: 'Normal walk-in' },
  { prefix: 'B', label: 'Appointment' },
  { prefix: 'E', label: 'Emergency' },
];

// Group the client's PRIORITY_LEVELS by weight into ordered tiers
// (lower weight = served first), e.g. [[Emergency], [Senior, Pregnant, ...], [Normal]].
function priorityTiers() {
  const byWeight = new Map();
  for (const level of Object.values(PRIORITY_LEVELS)) {
    if (!byWeight.has(level.weight)) byWeight.set(level.weight, []);
    byWeight.get(level.weight).push(level.label);
  }
  return [...byWeight.entries()].sort((a, b) => a[0] - b[0]).map(([, labels]) => labels);
}

function validate(text) {
  if (text.trim() === '') return 'Enter a number of minutes.';
  const n = Number(text);
  if (!Number.isInteger(n) || n < MIN_MINUTES || n > MAX_MINUTES) {
    return `Must be a whole number between ${MIN_MINUTES} and ${MAX_MINUTES}.`;
  }
  return '';
}

export default function SettingsPage() {
  const [savedMinutes, setSavedMinutes] = useState(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const settings = await settingsService.getSettings();
      setSavedMinutes(settings.averageConsultationMinutes);
      setValue(String(settings.averageConsultationMinutes));
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    setJustSaved(false);
    const problem = validate(value);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setSaving(true);
    try {
      const updated = await settingsService.updateSettings({ averageConsultationMinutes: Number(value) });
      setSavedMinutes(updated.averageConsultationMinutes);
      setValue(String(updated.averageConsultationMinutes));
      setJustSaved(true);
    } catch (err) {
      setFieldError(err.response?.data?.details?.[0]?.msg || err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading settings..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  const dirty = String(savedMinutes) !== value.trim();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Hospital-wide configuration" />

      {/* noValidate: min/max/step stay on the input for the spinner + mobile keypad, but validation is
          done in handleSubmit so the message always matches the app's other forms (the browser's native
          tooltip would otherwise intercept the submit and never reach it). */}
      <form onSubmit={handleSubmit} noValidate className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <Clock size={18} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">Default consultation time</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Estimated wait = patients ahead × a doctor&apos;s average consultation time. When a doctor has no average of
          their own, this hospital-wide default is used instead. Doctors with their own average (set when adding or
          editing a doctor) are not affected.
        </p>

        <div className="flex flex-wrap items-start gap-3">
          <div className="w-40">
            <FormInput
              name="averageConsultationMinutes"
              aria-label="Default consultation time in minutes"
              type="number"
              inputMode="numeric"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              step={1}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setFieldError('');
                setJustSaved(false);
              }}
              error={fieldError}
            />
          </div>
          <span className="pt-2 text-sm text-slate-500">minutes</span>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {justSaved && (
          <p role="status" className="mt-3 text-sm font-medium text-emerald-600">
            Saved. New wait estimates use {savedMinutes} minutes.
          </p>
        )}
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <ListOrdered size={18} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">How the queue works</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Read-only</span>
        </div>
        <p className="mb-5 text-sm text-slate-500">
          These rules are built into the queue engine and can&apos;t be changed from here.
        </p>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Token format</h4>
        <p className="mb-2 text-sm text-slate-600">
          Tokens look like <span className="font-semibold tabular-nums">A-027</span>: a prefix and a number that restarts
          each day, per department.
        </p>
        <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {TOKEN_FORMATS.map((t) => (
            <li key={t.prefix} className="flex items-center gap-3 px-4 py-2">
              <span className="w-6 font-semibold tabular-nums text-slate-800">{t.prefix}</span>
              <span className="text-slate-600">{t.label}</span>
            </li>
          ))}
        </ul>

        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Serving order</h4>
        <p className="mb-2 text-sm text-slate-600">
          Tier 1 is always served before tier 2, and tier 2 before tier 3. Within a tier, patients are served in the order
          they checked in.
        </p>
        <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {priorityTiers().map((labels, i) => (
            <li key={labels.join('|')} className="flex items-center gap-3 px-4 py-2">
              <span className="w-6 font-semibold tabular-nums text-slate-800">{i + 1}</span>
              <span className="text-slate-600">{labels.join(', ')}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
