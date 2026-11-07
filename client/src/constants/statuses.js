export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  WAITING: 'waiting',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

export const QUEUE_STATUS = {
  WAITING: 'waiting',
  CALLED: 'called',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

export const QUEUE_TYPE = {
  NORMAL: 'normal',
  APPOINTMENT: 'appointment',
  EMERGENCY: 'emergency',
};

// Lower number = served first. Used by the priority queue engine.
export const PRIORITY_LEVELS = {
  EMERGENCY: { key: 'emergency', label: 'Emergency', weight: 0 },
  SENIOR_CITIZEN: { key: 'senior_citizen', label: 'Senior Citizen', weight: 1 },
  PREGNANT: { key: 'pregnant', label: 'Pregnant Patient', weight: 1 },
  SPECIAL_NEEDS: { key: 'special_needs', label: 'Disabled / Special Requirement', weight: 1 },
  NORMAL: { key: 'normal', label: 'Normal', weight: 2 },
};

export const STATUS_COLOR = {
  [QUEUE_STATUS.WAITING]: 'var(--color-status-waiting)',
  [QUEUE_STATUS.CALLED]: 'var(--color-status-called)',
  [QUEUE_STATUS.IN_CONSULTATION]: 'var(--color-status-progress)',
  [QUEUE_STATUS.COMPLETED]: 'var(--color-status-completed)',
  [QUEUE_STATUS.SKIPPED]: 'var(--color-status-skipped)',
  [QUEUE_STATUS.CANCELLED]: 'var(--color-status-cancelled)',
  [QUEUE_STATUS.NO_SHOW]: 'var(--color-status-noshow)',
};
