import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientSchema } from '../../utils/patientSchema';
import FormInput from '../common/FormInput';
import SelectInput from '../common/SelectInput';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
  value: v,
  label: v,
}));

export default function PatientForm({ defaultValues, onSubmit, onCancel, submitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      gender: '',
      phone: '',
      dob: '',
      email: '',
      address: '',
      bloodGroup: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      medicalNotes: '',
      ...defaultValues,
    },
  });

  function handleFormSubmit(values) {
    const payload = {
      name: values.name,
      gender: values.gender,
      phone: values.phone,
      dob: values.dob || null,
      email: values.email || null,
      address: values.address || null,
      bloodGroup: values.bloodGroup || null,
      medicalNotes: values.medicalNotes || null,
      emergencyContact:
        values.emergencyContactName || values.emergencyContactPhone
          ? { name: values.emergencyContactName || '', phone: values.emergencyContactPhone || '' }
          : null,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput label="Full name" {...register('name')} error={errors.name?.message} />
        <SelectInput
          label="Gender"
          placeholder="Select gender"
          options={GENDER_OPTIONS}
          {...register('gender')}
          error={errors.gender?.message}
        />
        <FormInput label="Phone" {...register('phone')} error={errors.phone?.message} />
        <FormInput type="date" label="Date of birth" {...register('dob')} error={errors.dob?.message} />
        <FormInput type="email" label="Email" {...register('email')} error={errors.email?.message} />
        <SelectInput
          label="Blood group"
          placeholder="Unknown"
          options={BLOOD_GROUP_OPTIONS}
          {...register('bloodGroup')}
          error={errors.bloodGroup?.message}
        />
      </div>

      <FormInput label="Address" {...register('address')} error={errors.address?.message} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput label="Emergency contact name" {...register('emergencyContactName')} />
        <FormInput label="Emergency contact phone" {...register('emergencyContactPhone')} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Basic medical notes</label>
        <textarea
          {...register('medicalNotes')}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="Allergies, chronic conditions, etc. (optional)"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Save patient'}
        </button>
      </div>
    </form>
  );
}
