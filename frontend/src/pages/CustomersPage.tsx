import { useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TextField, TextAreaField } from '../components/common/FormField';
import { StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { Customer } from '../types';

interface CustomerForm {
  name: string; mobile: string; email: string; gstin: string;
  address: string; city: string; state: string; pincode: string; notes: string;
}
const EMPTY_FORM: CustomerForm = { name: '', mobile: '', email: '', gstin: '', address: '', city: '', state: '', pincode: '', notes: '' };

export function CustomersPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<Customer>({ endpoint: '/customers', filters: { search: debouncedSearch, status }, defaultSortBy: 'created_at' });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name, mobile: c.mobile, email: c.email || '', gstin: c.gstin || '',
      address: c.address || '', city: c.city || '', state: c.state || '', pincode: c.pincode || '', notes: c.notes || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit mobile number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, form);
        showToast('Customer updated successfully', 'success');
      } else {
        await api.post('/customers', form);
        showToast('Customer created successfully', 'success');
      }
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      showToast('Customer deleted', 'success');
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Customer', sortable: true, render: (c) => (
      <div>
        <div style={{ fontWeight: 600 }}>{c.name}</div>
        <div className="text-muted mono" style={{ fontSize: 11.5 }}>{c.customer_code}</div>
      </div>
    ) },
    { key: 'mobile', header: 'Mobile', render: (c) => <span className="mono">{c.mobile}</span> },
    { key: 'email', header: 'Email', render: (c) => c.email || <span className="text-muted">—</span> },
    { key: 'subscription_status', header: 'Plan', render: (c) => c.subscription_status ? <StatusBadge status={c.subscription_status} /> : <span className="text-muted">None</span> },
    { key: 'invoice_count', header: 'Invoices', align: 'center', render: (c) => <span className="mono">{c.invoice_count ?? 0}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (c) => <StatusBadge status={c.status} /> },
    { key: 'actions', header: '', align: 'right', render: (c) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteTarget(c)}>Delete</button>
      </div>
    ) },
  ];

  return (
    <div className="card">
      <div className="table-toolbar">
        <div className="flex gap-2" style={{ flex: 1, maxWidth: 480 }}>
          <div className="input-group" style={{ flex: 1 }}>
            <span className="input-icon">🔍</span>
            <input className="input" placeholder="Search by name, mobile, email, or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Customer</button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={setPage}
        emptyIcon="◈"
        emptyTitle="No customers yet"
        emptyMessage="Add your first customer to get started."
      />

      {modalOpen && (
        <Modal
          title={editing ? 'Edit Customer' : 'New Customer'}
          onClose={() => setModalOpen(false)}
          width={600}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Create Customer'}
              </button>
            </>
          }
        >
          <div className="form-grid-2">
            <TextField label="Full Name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
            <TextField label="Mobile Number" required value={form.mobile} error={errors.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="98765 43210" />
          </div>
          <div className="form-grid-2">
            <TextField label="Email Address" type="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
            <TextField label="GSTIN (optional)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" />
          </div>
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area" />
          <div className="form-grid-2">
            <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <TextField label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          <TextAreaField label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional internal notes" />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete customer?"
          message={`This will permanently remove ${deleteTarget.name} and cannot be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
