import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SearchBar from '../../components/common/SearchBar';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import PatientForm from '../../components/patients/PatientForm';
import * as patientService from '../../services/patientService';
import { useAuth } from '../../context/AuthContext';

export default function PatientListPage({ basePath }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'receptionist';

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    setError('');
    try {
      const data = await patientService.listPatients(searchTerm ? { search: searchTerm } : {});
      setPatients(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(search), 300);
    return () => clearTimeout(timeout);
  }, [search, load]);

  async function handleCreate(payload) {
    setSubmitting(true);
    try {
      await patientService.createPatient(payload);
      setShowCreate(false);
      load(search);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create patient.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={`${patients.length} patient${patients.length === 1 ? '' : 's'}`}
        actions={
          canEdit && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <UserPlus size={16} />
              New Patient
            </button>
          )
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID, or phone..." />
      </div>

      {loading && <LoadingSpinner label="Loading patients..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => load(search)} />}
      {!loading && !error && (
        <DataTable
          data={patients}
          onRowClick={(row) => navigate(`${basePath}/${row.id}`)}
          emptyMessage={
            search ? `No patients match "${search}".` : 'No patients registered yet.'
          }
          columns={[
            { key: 'patientCode', header: 'ID' },
            { key: 'name', header: 'Name' },
            { key: 'age', header: 'Age', render: (r) => r.age ?? '—' },
            { key: 'gender', header: 'Gender', render: (r) => <span className="capitalize">{r.gender}</span> },
            { key: 'phone', header: 'Phone' },
            { key: 'bloodGroup', header: 'Blood Group', render: (r) => r.bloodGroup || '—' },
          ]}
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Register new patient" size="lg">
        <PatientForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} submitting={submitting} />
      </Modal>
    </div>
  );
}
