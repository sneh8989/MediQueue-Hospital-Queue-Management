import { ROLES } from './roles';

// Icon names reference lucide-react components, resolved in Sidebar.jsx
export const NAV_ITEMS = {
  [ROLES.ADMIN]: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard' },
    { label: 'Patients', path: '/admin/patients', icon: 'Users' },
    { label: 'Appointments', path: '/admin/appointments', icon: 'CalendarClock' },
    { label: 'Queues', path: '/admin/queues', icon: 'ListOrdered' },
    { label: 'Departments', path: '/admin/departments', icon: 'Building2' },
    { label: 'Doctors', path: '/admin/doctors', icon: 'Stethoscope' },
    { label: 'Rooms', path: '/admin/rooms', icon: 'DoorOpen' },
    { label: 'Users & Staff', path: '/admin/users', icon: 'UserCog' },
    { label: 'Reports', path: '/admin/reports', icon: 'FileBarChart' },
    { label: 'Audit Log', path: '/admin/audit-log', icon: 'ScrollText' },
    { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
  ],
  [ROLES.RECEPTIONIST]: [
    { label: 'Dashboard', path: '/reception/dashboard', icon: 'LayoutDashboard' },
    { label: 'Patients', path: '/reception/patients', icon: 'Users' },
    { label: 'Appointments', path: '/reception/appointments', icon: 'CalendarClock' },
    { label: 'Queue', path: '/reception/queue', icon: 'ListOrdered' },
  ],
  [ROLES.DOCTOR]: [
    { label: 'Dashboard', path: '/doctor/dashboard', icon: 'LayoutDashboard' },
    { label: "Today's Queue", path: '/doctor/queue', icon: 'ListOrdered' },
    { label: 'Patients', path: '/doctor/patients', icon: 'Users' },
  ],
  [ROLES.NURSE]: [
    { label: 'Dashboard', path: '/nurse/dashboard', icon: 'LayoutDashboard' },
    { label: 'Queue', path: '/nurse/queue', icon: 'ListOrdered' },
  ],
};
