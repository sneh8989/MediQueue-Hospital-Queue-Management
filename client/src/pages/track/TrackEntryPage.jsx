import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, QrCode } from 'lucide-react';
import FormInput from '../../components/common/FormInput';

// Accepts either the full tracking link or just the code at the end of it,
// so a patient can paste whatever reception sent them.
function extractTrackingId(raw) {
  const path = raw.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  const last = path.split('/').pop();
  return last === 'track' ? '' : last;
}

/**
 * Public landing page for /track (no id). The normal way in is scanning the
 * QR code on a token slip, which goes straight to /track/:id - this page is
 * the fallback for someone who has the link/code but not the QR.
 */
export default function TrackEntryPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const id = extractTrackingId(value);
    if (!id) {
      setError('Paste your tracking link or code.');
      return;
    }
    navigate(`/track/${encodeURIComponent(id)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-slate-500">
          <Activity size={18} className="text-brand-600" />
          <span className="text-sm font-medium">MediQueue</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <QrCode size={24} />
            </div>
          </div>
          <h1 className="text-center text-lg font-semibold text-slate-800">Track your place in the queue</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Scan the QR code on your token slip. If you have a tracking link or code instead, paste it below.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <FormInput
              name="trackingLink"
              aria-label="Tracking link or code"
              placeholder="Tracking link or code"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              error={error}
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Track
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Can&apos;t find it? Ask at the reception desk.</p>
      </div>
    </div>
  );
}
