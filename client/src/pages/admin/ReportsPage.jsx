import { useEffect, useState, useCallback } from 'react';
import { Download, Printer } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SelectInput from '../../components/common/SelectInput';
import FormInput from '../../components/common/FormInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import * as reportService from '../../services/reportService';
import * as departmentService from '../../services/departmentService';
import * as doctorService from '../../services/doctorService';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'in_consultation', label: 'In Consultation' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [reportTypes, setReportTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [reportType, setReportType] = useState('daily-patient');
  const [date, setDate] = useState(todayISO());
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    reportService.listReportTypes().then(setReportTypes).catch(() => setReportTypes([]));
    departmentService.listDepartments().then(setDepartments).catch(() => setDepartments([]));
    doctorService.listDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, []);

  const usesStatus = reportType === 'appointment';

  const runReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { date };
      if (departmentId) params.departmentId = departmentId;
      if (doctorId) params.doctorId = doctorId;
      if (usesStatus && status) params.status = status;
      const data = await reportService.getReport(reportType, params);
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [reportType, date, departmentId, doctorId, status, usesStatus]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily hospital activity, filterable and exportable" />

      <div className="print-hide mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <SelectInput
          label="Report"
          options={reportTypes.map((r) => ({ value: r.key, label: r.label }))}
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-56"
        />
        <FormInput type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <SelectInput
          label="Department"
          placeholder="All departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className="w-48"
        />
        <SelectInput
          label="Doctor"
          placeholder="All doctors"
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          className="w-48"
        />
        {usesStatus && (
          <SelectInput
            label="Status"
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-44"
          />
        )}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => report && reportService.downloadReportCSV(report)}
            disabled={!report || report.rows.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report || report.rows.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner label="Generating report..." />}
      {!loading && error && <ErrorState message={error} onRetry={runReport} />}
      {!loading && !error && report && (
        <div>
          <h2 className="mb-3 hidden text-lg font-semibold text-slate-800 print:block">
            {reportTypes.find((r) => r.key === reportType)?.label} — {report.filters.date}
          </h2>
          {report.rows.length === 0 ? (
            <EmptyState message="No data for this report and filter combination." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 print:bg-white">
                  <tr>
                    {report.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
