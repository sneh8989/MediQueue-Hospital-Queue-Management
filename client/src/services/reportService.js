import api from './api';

export async function listReportTypes() {
  const { data } = await api.get('/reports/types');
  return data.reportTypes;
}

export async function getReport(type, params = {}) {
  const { data } = await api.get(`/reports/${type}`, { params });
  return data;
}

/**
 * Builds a CSV string from a report's columns/rows and triggers a browser
 * download. Done client-side rather than a server CSV endpoint, since
 * report result sets here are small (a day's worth of hospital activity),
 * so there's no need for the server to stream a file - see
 * docs/ARCHITECTURE.md "Reports architecture".
 */
export function downloadReportCSV(report, filename) {
  const escape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [report.columns.map(escape).join(',')];
  for (const row of report.rows) {
    lines.push(row.map(escape).join(','));
  }
  const csv = lines.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${report.reportType}-${report.filters.date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
