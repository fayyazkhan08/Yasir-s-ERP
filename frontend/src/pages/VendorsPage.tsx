import { useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TextField, TextAreaField, SelectField } from '../components/common/FormField';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { whatsappLink } from '../utils/format';
import { Vendor } from '../types';

interface VendorForm {
  name: string; contact_person: string; mobile: string; email: string; address: string; gstin: string; status: string;
}
const EMPTY_FORM: VendorForm = { name: '', contact_person: '', mobile: '', email: '', address: '', gstin: '', status: 'active' };

export function VendorsPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<Vendor>({
      endpoint: '/vendors',
      filters: { search: debouncedSearch, status },
      defaultSortBy: 'name',
      defaultSortDir: 'asc',
    });

  // ---- create / edit ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name, contact_person: v.contact_person || '', mobile: v.mobile || '', email: v.email || '',
      address: v.address || '', gstin: v.gstin || '', status: v.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Vendor name is required';
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit mobile number';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (form.gstin.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin.trim().toUpperCase())) e.gstin = 'Enter a valid GSTIN';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/vendors/${editing.id}`, form);
      else await api.post('/vendors', form);
      showToast(editing ? 'Vendor updated' : 'Vendor created', 'success');
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/vendors/${deleteTarget.id}`);
      showToast(`"${deleteTarget.name}" deleted`, 'success');
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setPage(page - 1); else refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ---- place order (opens WhatsApp chat with the vendor's saved mobile number) ----
  const [orderVendor, setOrderVendor] = useState<Vendor | null>(null);
  const [orderMessage, setOrderMessage] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);

  const openOrder = async (v: Vendor) => {
    setOrderVendor(v);
    setLoadingMsg(true);
    const greeting = `Hello${v.contact_person ? ' ' + v.contact_person : ''}, we would like to place an order.`;
    setOrderMessage(greeting);
    try {
      // Pre-fill with this vendor's items that are at/below reorder level — the user can edit before sending.
      const res = await api.get(`/vendors/${v.id}/low-stock`);
      const low: { name: string; unit: string; current_stock: number }[] = res.data.data;
      if (low.length) {
        const lines = low.map((i) => `• ${i.name} — qty: ____ ${i.unit} (stock left: ${i.current_stock})`).join('\n');
        setOrderMessage(`${greeting}\n\nItems required:\n${lines}\n\nPlease confirm rates and delivery time. Thank you.`);
      } else {
        setOrderMessage(`${greeting}\n\nItems required:\n• \n\nPlease confirm rates and delivery time. Thank you.`);
      }
    } catch {
      /* keep the plain greeting */
    } finally {
      setLoadingMsg(false);
    }
  };

  const sendOrder = () => {
    if (!orderVendor?.mobile) return;
    window.open(whatsappLink(orderVendor.mobile, orderMessage), '_blank', 'noopener,noreferrer');
  };

  const columns: Column<Vendor>[] = [
    { key: 'name', header: 'Vendor', sortable: true, render: (v) => (
      <div>
        <div style={{ fontWeight: 600 }}>{v.name}</div>
        {v.gstin && <div className="text-muted mono" style={{ fontSize: 11.5 }}>{v.gstin}</div>}
      </div>
    ) },
    { key: 'contact_person', header: 'Contact', sortable: true, render: (v) => (
      <div>
        <div>{v.contact_person || <span className="text-muted">—</span>}</div>
        {v.email && <div className="text-muted" style={{ fontSize: 11.5 }}>{v.email}</div>}
      </div>
    ) },
    { key: 'mobile', header: 'Mobile', render: (v) => <span className="mono">{v.mobile || '—'}</span> },
    { key: 'item_count', header: 'Items', align: 'right', render: (v) => (
      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
        {!!v.low_stock_count && <span className="badge badge-danger">⚠ {v.low_stock_count} low</span>}
        <span className="mono">{v.item_count ?? 0}</span>
      </div>
    ) },
    { key: 'status', header: 'Status', sortable: true, render: (v) => <StatusBadge status={v.status} /> },
    { key: 'actions', header: '', align: 'right', render: (v) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" disabled={!v.mobile} onClick={() => openOrder(v)}>📲 Place Order</button>
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>✎ Edit</button>
        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteTarget(v)}>🗑 Delete</button>
      </div>
    ) },
  ];

  return (
    <>
      <div className="card">
        <div className="table-toolbar">
          <div className="flex gap-2" style={{ flex: 1, maxWidth: 520, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <span className="input-icon">🔍</span>
              <input className="input" placeholder="Search name, contact, mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ New Vendor</button>
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
          emptyIcon="🏭"
          emptyTitle="No vendors yet"
          emptyMessage="Add the suppliers you buy from, then place orders with one click."
        />
      </div>

      {modalOpen && (
        <Modal
          title={editing ? `Edit Vendor — ${editing.name}` : 'New Vendor'}
          onClose={() => setModalOpen(false)}
          width={560}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Create Vendor'}
              </button>
            </>
          }
        >
          <TextField label="Vendor / Company Name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="form-grid-2">
            <TextField label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <TextField label="Mobile" required inputMode="numeric" maxLength={10} value={form.mobile} error={errors.mobile} hint="Orders are sent to this number on WhatsApp" onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div className="form-grid-2">
            <TextField label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label="GSTIN" value={form.gstin} error={errors.gstin} maxLength={15} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
          </div>
          <TextAreaField label="Address" value={form.address} maxLength={255} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {editing && (
            <SelectField
              label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            />
          )}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete vendor?"
          message={`“${deleteTarget.name}” will be permanently removed. Vendors that already have purchase records can’t be deleted — set those to Inactive instead.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {orderVendor && (
        <Modal
          title={`Place Order — ${orderVendor.name}`}
          onClose={() => setOrderVendor(null)}
          width={540}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setOrderVendor(null)}>Close</button>
              <a className="btn btn-secondary" href={`tel:+91${orderVendor.mobile}`}>📞 Call</a>
              <button className="btn btn-primary" onClick={sendOrder} disabled={loadingMsg || !orderMessage.trim()}>
                {loadingMsg ? <span className="spinner" /> : '💬 Send on WhatsApp'}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ fontSize: 13 }}>
            Opens a WhatsApp chat with <strong className="mono">{orderVendor.mobile}</strong>
            {orderVendor.contact_person ? ` (${orderVendor.contact_person})` : ''}. Edit the message first if you like.
          </p>
          <TextAreaField
            label="Order message" rows={9} value={orderMessage}
            onChange={(e) => setOrderMessage(e.target.value)}
            hint="Items already at or below their reorder level are listed for you to fill in quantities"
          />
        </Modal>
      )}
    </>
  );
}
