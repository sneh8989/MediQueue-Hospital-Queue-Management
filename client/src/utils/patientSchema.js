import { z } from 'zod';

export const patientSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Select a gender' }) }),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number looks too short')
    .max(20, 'Phone number looks too long'),
  dob: z.string().optional().or(z.literal('')),
  email: z.string().email('Email looks invalid').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  medicalNotes: z.string().optional().or(z.literal('')),
});
