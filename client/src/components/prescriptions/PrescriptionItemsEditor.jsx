import { Plus, Trash2 } from 'lucide-react';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

let localIdCounter = 0;
function nextLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

export function emptyItem() {
  return { _localId: nextLocalId(), medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' };
}

/**
 * Repeatable medicine-entry rows: add/remove, each with name, dosage,
 * frequency, duration, instructions. Kept as plain local component state
 * (an array of item objects) rather than react-hook-form field arrays,
 * since this is the first dynamic-length form in the app and there's no
 * existing field-array pattern elsewhere to stay consistent with.
 */
export default function PrescriptionItemsEditor({ items, onChange, errors }) {
  function updateItem(index, field, value) {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  }

  function addItem() {
    onChange([...items, emptyItem()]);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">Medicines</label>
      {items.map((item, index) => (
        <div key={item._localId} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Medicine {index + 1}</span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="flex items-center gap-1 text-xs text-red-600 hover:underline"
              >
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              value={item.medicineName}
              onChange={(e) => updateItem(index, 'medicineName', e.target.value)}
              placeholder="Medicine name"
              className={`col-span-2 sm:col-span-1 ${FIELD_CLASS}`}
            />
            <input
              value={item.dosage}
              onChange={(e) => updateItem(index, 'dosage', e.target.value)}
              placeholder="Dosage (e.g. 500mg)"
              className={FIELD_CLASS}
            />
            <input
              value={item.frequency}
              onChange={(e) => updateItem(index, 'frequency', e.target.value)}
              placeholder="Frequency (e.g. 3x daily)"
              className={FIELD_CLASS}
            />
            <input
              value={item.duration}
              onChange={(e) => updateItem(index, 'duration', e.target.value)}
              placeholder="Duration (e.g. 7 days)"
              className={FIELD_CLASS}
            />
            <input
              value={item.instructions}
              onChange={(e) => updateItem(index, 'instructions', e.target.value)}
              placeholder="Instructions (optional)"
              className={`col-span-2 sm:col-span-1 ${FIELD_CLASS}`}
            />
          </div>
          {errors?.[index] && <p className="mt-1 text-xs text-red-600">{errors[index]}</p>}
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus size={14} /> Add another medicine
      </button>
    </div>
  );
}
