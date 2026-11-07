export const ROLES = {
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.NURSE]: 'Nurse',
};

// Where each role lands after login
export const ROLE_HOME_ROUTE = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.RECEPTIONIST]: '/reception/dashboard',
  [ROLES.DOCTOR]: '/doctor/dashboard',
  [ROLES.NURSE]: '/nurse/dashboard',
};
