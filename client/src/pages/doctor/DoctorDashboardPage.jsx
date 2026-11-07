import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Users, Clock, ListOrdered } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import * as doctorService from '../../services/doctorService';
import * as appointmentService from '../../services/appointmentService';
import * as queueService from '../../services/queueService';

export default function DoctorDashboardPage() {
  const [doctor, setDoctor] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [queueCounts, setQueueCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [myDoctor, appts] = await Promise.all([
          doctorService.getMyDoctorProfile(),
          appointmentService.listTodayAppointments(),
        ]);
        setDoctor(myDoctor);
        setTodayAppointments(appts);
        if (myDoctor?.departmentId) {
          const queue = await queueService.getQueue(myDoctor.departmentId);
          setQueueCounts(queue.counts);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title={`Welcome, ${doctor?.name || 'Doctor'}`} subtitle={doctor?.specialization || ''} />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Today's appointments" value={todayAppointments.length} />
        <StatCard icon={Users} label="Waiting now" value={queueCounts?.waiting ?? '—'} />
        <StatCard icon={Clock} label="In consultation" value={queueCounts?.inConsultation ?? '—'} />
        <StatCard icon={ListOrdered} label="Completed today" value={queueCounts?.completed ?? '—'} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Today's appointments</h3>
          <Link to="/doctor/queue" className="text-sm font-medium text-brand-600 hover:underline">
            Open queue board →
          </Link>
        </div>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-slate-400">No appointments scheduled for today.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-slate-700">{a.timeSlot}</span>
                <span className="text-slate-600">{a.patientName}</span>
                <span className="capitalize text-slate-400">{a.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
