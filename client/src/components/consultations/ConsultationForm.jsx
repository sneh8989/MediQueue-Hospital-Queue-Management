import { useState } from 'react';
import FormInput from '../common/FormInput';
import PrescriptionItemsEditor, { emptyItem } from '../prescriptions/PrescriptionItemsEditor';

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export default function ConsultationForm({
  patientName,
  defaultValues,
  existingPrescription,
  onSave,
  onComplete,
  onSavePrescription,
  onCancel,
  submitting,
  prescriptionSubmitting,
}) {
  const [chiefComplaint, setChiefComplaint] = useState(defaultValues?.chiefComplaint || '');
  const [symptoms, setSymptoms] = useState(defaultValues?.symptoms || '');
  const [diagnosis, setDiagnosis] = useState(defaultValues?.diagnosis || '');
  const [notes, setNotes] = useState(defaultValues?.notes || '');
  const [followUpDate, setFollowUpDate] = useState(defaultValues?.followUpDate || '');
  const [items, setItems] = useState(
    existingPrescription?.items?.length
      ? existingPrescription.items.map((i) => ({ ...i, _localId: i.id }))
      : [emptyItem()]
  );

  function fields() {
    return {
      chiefComplaint: chiefComplaint || null,
      symptoms: symptoms || null,
      diagnosis: diagnosis || null,
      notes: notes || null,
      followUpDate: followUpDate || null,
    };
  }

  function handleSavePrescription() {
    const cleanItems = items
      .filter((i) => i.medicineName.trim() && i.dosage.trim())
      .map(({ medicineName, dosage, frequency, duration, instructions }) => ({
        medicineName: medicineName.trim(),
        dosage: dosage.trim(),
        frequency: frequency?.trim() || null,
        duration: duration?.trim() || null,
        instructions: instructions?.trim() || null,
      }));
    if (cleanItems.length === 0) {
      alert('Add at least one medicine with a name and dosage.');
      return;
    }
    onSavePrescription(cleanItems);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Consultation for <span className="font-medium text-slate-700">{patientName}</span>
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Chief complaint</label>
        <input
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          className={FIELD_CLASS}
          placeholder="What brought the patient in today?"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Symptoms</label>
        <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={2} className={FIELD_CLASS} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Diagnosis</label>
        <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} className={FIELD_CLASS} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Doctor's notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={FIELD_CLASS} />
      </div>

      <FormInput
        type="date"
        label="Follow-up date"
        value={followUpDate}
        onChange={(e) => setFollowUpDate(e.target.value)}
      />

      <div className="flex flex-col-reverse gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Close
        </button>
        <button
          type="button"
          onClick={() => onSave(fields())}
          disabled={!!submitting}
          className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
        >
          {submitting === 'save' ? 'Saving...' : 'Save notes'}
        </button>
        <button
          type="button"
          onClick={() => onComplete(fields())}
          disabled={!!submitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting === 'complete' ? 'Completing...' : 'Save & Complete Consultation'}
        </button>
      </div>

      {onSavePrescription ? (
        <div>
          <PrescriptionItemsEditor items={items} onChange={setItems} />
          <button
            type="button"
            onClick={handleSavePrescription}
            disabled={prescriptionSubmitting}
            className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {prescriptionSubmitting ? 'Saving...' : existingPrescription ? 'Update prescription' : 'Save prescription'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Save your consultation notes first, then you can add a prescription.
        </p>
      )}
    </div>
  );
}
