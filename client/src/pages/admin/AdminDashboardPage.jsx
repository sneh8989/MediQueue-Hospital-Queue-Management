import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Users, CalendarClock, Clock, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import * as dashboardService from '../../services/dashboardService';

// Pulled from the CSS design tokens in index.css so charts stay visually
// consistent with the rest of the app rather than inventing new colors.
const CHART_COLORS = ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#dc2626', '#64748b'];

function ChartCard({ title, children, empty }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      {empty ? <EmptyState message="No data for today yet." /> : <div className="h-64">{children}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const summary = await dashboardService.getDashboardSummary();
        setData(summary);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { stats, charts } = data;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle={`Overview for ${data.date}`} />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Patients today" value={stats.totalPatientsToday} />
        <StatCard icon={CalendarClock} label="Appointments today" value={stats.totalAppointmentsToday} />
        <StatCard icon={Clock} label="Waiting" value={stats.waitingPatients} accent="amber" />
        <StatCard icon={Activity} label="In consultation" value={stats.patientsInConsultation} accent="violet" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completedConsultations} accent="emerald" />
        <StatCard icon={AlertTriangle} label="Emergency patients" value={stats.emergencyPatients} accent="red" />
        <StatCard icon={Clock} label="Avg. waiting time" value={`${stats.averageWaitingMinutes} min`} />
        <StatCard icon={Clock} label="Avg. consultation time" value={`${stats.averageConsultationMinutes} min`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Patients by department" empty={charts.patientsByDepartment.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.patientsByDepartment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="department" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patients by hour" empty={charts.patientsByHour.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.patientsByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(h) => `${h}:00`} />
              <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Appointment status" empty={charts.appointmentsByStatus.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.appointmentsByStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.status} (${entry.count})`}
              >
                {charts.appointmentsByStatus.map((entry, index) => (
                  <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Queue status" empty={charts.queueByStatus.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.queueByStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.status} (${entry.count})`}
              >
                {charts.queueByStatus.map((entry, index) => (
                  <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Doctor workload (completed today)" empty={charts.doctorWorkload.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.doctorWorkload} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="doctor" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
