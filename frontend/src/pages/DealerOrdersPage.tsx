import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TextField, TextAreaField } from '../components/common/FormField';
import { UnitSelect } from '../components/common/UnitSelect';
import { DealerOrderPrint } from '../components/dealer/DealerOrderPrint';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { ORDER_STATUS_LABEL, ORDER_FLOW } from '../constants/units';
import { formatDate, formatMoney, todayLocal } from '../utils/format';
import { DealerOrder, DealerOrderItem } from '../types';

interface LineForm { product: string; quantity: string; unit: string; unit_price: string; }
interface OrderForm {
  dealer_name: string; dealer_mobile: string; dealer_address: string;
  order_date: string; delivery_date: string; notes: string; items: LineForm[];
}
interface KnownDealer { dealer_name: string; dealer_mobile?: string | null; dealer_address?: string | null; }

const EMPTY_LINE: LineForm = { product: '', quantity: '1', unit: '', unit_price: '' };
const emptyForm = (): OrderForm => ({
  dealer_name: '', dealer_mobile: '', dealer_address: '', order_date: todayLocal(), delivery_date: '', notes: '', items: [{ ...EMPTY_LINE }],
});

export function DealerOrdersPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<DealerOrder>({
      endpoint: '/dealer-orders',
      filters: { search: debouncedSearch, status },
      defaultSortBy: 'id',
      defaultSortDir: 'desc',
    });

  const [dealers, setDealers] = useState<KnownDealer[]>([]);
  useEffect(() => {
    api.get('/dealer-orders/dealers').then((res) => setDealers(res.data.data)).catch(() => setDealers([]));
  }, []);

  // ---- create / edit ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DealerOrder | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true); };

  const openEdit = async (o: DealerOrder) => {
    try {
      const res = await api.get(`/dealer-orders/${o.id}`);
      const full: DealerOrder = res.data.data;
      setEditing(full);
      setForm({
        dealer_name: full.dealer_name, dealer_mobile: full.dealer_mobile || '', dealer_address: full.dealer_address || '',
        order_date: full.order_date, delivery_date: full.delivery_date || '', notes: full.notes || '',
        items: (full.items || []).map((i: DealerOrderItem) => ({
          product: i.product, quantity: String(Number(i.quantity)), unit: i.unit || '',
          unit_price: i.unit_price === null || i.unit_price === undefined ? '' : String(Number(i.unit_price)),
        })),
      });
      setModalOpen(true);
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  };

  const setLine = (idx: number, patch: Partial<LineForm>) =>
    setForm((f) => ({ ...f, items: f.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));

  // Picking a dealer you've ordered for before fills in their mobile and address.
  const onDealerName = (name: string) => {
    const known = dealers.find((d) => d.dealer_name.toLowerCase() === name.trim().toLowerCase());
    setForm((f) => ({
      ...f, dealer_name: name,
      ...(known && !f.dealer_mobile && !f.dealer_address
        ? { dealer_mobile: known.dealer_mobile || '', dealer_address: known.dealer_address || '' } : {}),
    }));
  };

  const [printTarget, setPrintTarget] = useState<{ id: number; auto: boolean } | null>(null);

  const handleSave = async () => {
    if (!form.dealer_name.trim()) { showToast('Dealer name is required', 'error'); return; }
    if (form.dealer_mobile && !/^[6-9]\d{9}$/.test(form.dealer_mobile)) { showToast('Enter a valid 10-digit dealer mobile', 'error'); return; }
    if (!form.order_date) { showToast('Order date is required', 'error'); return; }
    if (form.delivery_date && form.delivery_date < form.order_date) { showToast('Delivery date cannot be before the order date', 'error'); return; }
    if (form.items.some((l) => !l.product.trim() || !(Number(l.quantity) > 0))) {
      showToast('Every line needs a product and a quantity above 0', 'error'); return;
    }
    if (form.items.some((l) => l.unit_price.trim() !== '' && (Number.isNaN(Number(l.unit_price)) || Number(l.unit_price) < 0))) {
      showToast('Price must be a number (or leave it blank)', 'error'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        delivery_date: form.delivery_date || null,
        items: form.items.map((l) => ({
          product: l.product.trim(), quantity: Number(l.quantity), unit: l.unit.trim(),
          unit_price: l.unit_price.trim() === '' ? null : Number(l.unit_price), // blank price -> stored as "no price" -> prints "--"
        })),
      };
      let id: number;
      if (editing) {
        await api.put(`/dealer-orders/${editing.id}`, payload);
        id = editing.id;
      } else {
        const res = await api.post('/dealer-orders', payload);
        id = res.data.data.id;
      }
      showToast(editing ? 'Dealer order updated' : 'Dealer order created', 'success');
      setModalOpen(false);
      refresh();
      api.get('/dealer-orders/dealers').then((res) => setDealers(res.data.data)).catch(() => undefined);
      if (!editing) setPrintTarget({ id, auto: false }); // show the order invoice right away
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState<DealerOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/dealer-orders/${deleteTarget.id}`);
      showToast(`Order ${deleteTarget.order_no} deleted`, 'success');
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setPage(page - 1); else refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<DealerOrder>[] = [
    { key: 'order_no', header: 'Order #', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 600 }}>{o.order_no}</span> },
    { key: 'dealer_name', header: 'Dealer', sortable: true, render: (o) => (
      <div>
        <div style={{ fontWeight: 600 }}>{o.dealer_name}</div>
        {o.dealer_mobile && <div className="text-muted mono" style={{ fontSize: 11.5 }}>{o.dealer_mobile}</div>}
      </div>
    ) },
    { key: 'products', header: 'Products', render: (o) => (
      <div style={{ maxWidth: 280, fontSize: 12.5 }} title={o.products_summary || ''}>
        {(o.products_summary || '').length > 90 ? `${o.products_summary!.slice(0, 90)}…` : o.products_summary}
      </div>
    ) },
    { key: 'order_date', header: 'Order Date', sortable: true, render: (o) => formatDate(o.order_date) },
    { key: 'delivery_date', header: 'Delivery', sortable: true, render: (o) => (
      <div>
        {formatDate(o.delivery_date)}
        {!!o.is_overdue && <div className="text-danger" style={{ fontSize: 11.5 }}>Overdue</div>}
      </div>
    ) },
    { key: 'amount', header: 'Amount', align: 'right', render: (o) => (
      <span className="mono">
        {Number(o.priced_total) > 0 ? formatMoney(o.priced_total!) : '--'}
        {Number(o.unpriced_count) > 0 && Number(o.priced_total) > 0 && <span className="text-muted" title="Some items have no price"> *</span>}
      </span>
    ) },
    { key: 'status', header: 'Status', sortable: true, render: (o) => <StatusBadge status={o.status} /> },
    { key: 'actions', header: '', align: 'right', render: (o) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setPrintTarget({ id: o.id, auto: false })}>🖨 Invoice</button>
        <Link className="btn btn-secondary btn-sm" to={`/order-tracking?order=${o.id}`}>🚚 Track</Link>
        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(o)}>✎ Edit</button>
        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setDeleteTarget(o)}>🗑</button>
      </div>
    ) },
  ];

  return (
    <>
      <div className="card">
        <div className="table-toolbar">
          <div className="flex gap-2" style={{ flex: 1, maxWidth: 560, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <span className="input-icon">🔍</span>
              <input className="input" placeholder="Search order #, dealer, mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              <option value="open">Open (not delivered)</option>
              {[...ORDER_FLOW, 'cancelled' as const].map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ New Dealer Order</button>
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
          emptyIcon="📦"
          emptyTitle="No dealer orders yet"
          emptyMessage="Create an order with just the product, quantity and dates — prices are optional."
        />
      </div>

      {modalOpen && (
        <Modal
          title={editing ? `Edit Order — ${editing.order_no}` : 'New Dealer Order'}
          onClose={() => setModalOpen(false)}
          width={760}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Create Order'}
              </button>
            </>
          }
        >
          <div className="form-grid-2">
            <div className="field">
              <label>Dealer Name <span className="text-danger">*</span></label>
              <input className="input" list="dealer-names" value={form.dealer_name} onChange={(e) => onDealerName(e.target.value)} placeholder="Type or pick a previous dealer" />
              <datalist id="dealer-names">{dealers.map((d) => <option key={d.dealer_name} value={d.dealer_name} />)}</datalist>
            </div>
            <TextField label="Dealer Mobile" inputMode="numeric" maxLength={10} value={form.dealer_mobile} onChange={(e) => setForm({ ...form, dealer_mobile: e.target.value.replace(/\D/g, '') })} />
          </div>
          <TextField label="Dealer Address" value={form.dealer_address} maxLength={255} onChange={(e) => setForm({ ...form, dealer_address: e.target.value })} />
          <div className="form-grid-2">
            <TextField label="Order Date" type="date" required value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
            <TextField label="Delivery Date" type="date" value={form.delivery_date} min={form.order_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
          </div>

          <div className="flex-col gap-2">
            <div className="flex items-center" style={{ justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>Products</strong>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_LINE }] })}>+ Add product</button>
            </div>
            {form.items.map((l, idx) => (
              <div key={idx} className="line-card">
                <div className="line-row">
                  <input className="input grow" placeholder="Product *" aria-label="Product" value={l.product} onChange={(e) => setLine(idx, { product: e.target.value })} />
                  <input className="input" type="number" min={0} step="any" placeholder="Qty" aria-label="Quantity" style={{ width: 84 }} value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                  <UnitSelect value={l.unit} onChange={(unit) => setLine(idx, { unit })} style={{ width: 150 }} />
                  <input className="input" type="number" min={0} step="any" placeholder="Price (optional)" aria-label="Price (optional)" style={{ width: 130 }} value={l.unit_price} onChange={(e) => setLine(idx, { unit_price: e.target.value })} />
                  <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label="Remove product" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>✕</button>
                </div>
              </div>
            ))}
            <span className="field-hint">Price is optional — items left without a price print as “--” on the order invoice.</span>
          </div>

          <TextAreaField label="Notes" value={form.notes} maxLength={255} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete dealer order?"
          message={`Order ${deleteTarget.order_no} for ${deleteTarget.dealer_name} and its tracking history will be permanently deleted.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {printTarget && <DealerOrderPrint orderId={printTarget.id} autoPrint={printTarget.auto} onClose={() => setPrintTarget(null)} />}
    </>
  );
}
