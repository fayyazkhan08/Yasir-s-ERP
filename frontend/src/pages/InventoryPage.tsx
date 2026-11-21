import { useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { TextField, SelectField } from '../components/common/FormField';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { InventoryItem } from '../types';

const CATEGORY_OPTIONS = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished_product', label: 'Finished Product' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

interface ItemForm { name: string; category: string; unit: string; current_stock: number; reorder_level: number; unit_price: number; }
const EMPTY_FORM: ItemForm = { name: '', category: 'raw_material', unit: 'kg', current_stock: 0, reorder_level: 0, unit_price: 0 };

export function InventoryPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<InventoryItem>({
      endpoint: '/inventory',
      filters: { search: debouncedSearch, category, lowStockOnly: lowStockOnly ? 'true' : '' },
      defaultSortBy: 'name',
      defaultSortDir: 'asc',
    });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const openCreate = () => { setForm(EMPTY_FORM); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Item name is required', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/inventory', form);
      showToast('Inventory item created', 'success');
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (item: InventoryItem) => { setAdjustTarget(item); setAdjustQty(0); setAdjustNotes(''); };
  const handleAdjust = async () => {
    if (!adjustTarget || adjustQty === 0) return;
    setAdjusting(true);
    try {
      await api.post(`/inventory/${adjustTarget.id}/adjust`, { quantity: adjustQty, notes: adjustNotes });
      showToast('Stock adjusted successfully', 'success');
      setAdjustTarget(null);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const columns: Column<InventoryItem>[] = [
    { key: 'name', header: 'Item', sortable: true, render: (i) => (
      <div>
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600 }}>{i.name}</span>
          {!!i.is_low_stock && <span className="badge badge-danger">⚠ Low</span>}
        </div>
        <div className="text-muted mono" style={{ fontSize: 11.5 }}>{i.item_code}</div>
      </div>
    ) },
    { key: 'category', header: 'Category', render: (i) => <span className="badge badge-neutral">{i.category.replace('_', ' ')}</span> },
    { key: 'current_stock', header: 'Stock', sortable: true, align: 'right', render: (i) => (
      <span className={`mono ${i.is_low_stock ? 'text-danger' : ''}`} style={{ fontWeight: 600 }}>{i.current_stock} {i.unit}</span>
    ) },
    { key: 'reorder_level', header: 'Reorder At', sortable: true, align: 'right', render: (i) => <span className="mono text-muted">{i.reorder_level} {i.unit}</span> },
    { key: 'unit_price', header: 'Unit Price', align: 'right', render: (i) => <span className="mono">₹{i.unit_price}</span> },
    { key: 'supplier_name', header: 'Supplier', render: (i) => i.supplier_name || <span className="text-muted">—</span> },
    { key: 'actions', header: '', align: 'right', render: (i) => (
      <button className="btn btn-secondary btn-sm" onClick={() => openAdjust(i)}>Adjust Stock</button>
    ) },
  ];

  return (
    <>
      <div className="card">
        <div className="table-toolbar">
          <div className="flex gap-2" style={{ flex: 1, maxWidth: 560, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
              <span className="input-icon">🔍</span>
              <input className="input" placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ width: 170 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label className="flex items-center gap-2 btn btn-secondary" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
              Low stock only
            </label>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ New Item</button>
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
          emptyIcon="▤"
          emptyTitle="No inventory items"
          emptyMessage="Add raw materials or finished products to start tracking stock."
        />
      </div>

      {modalOpen && (
        <Modal
          title="New Inventory Item"
          onClose={() => setModalOpen(false)}
          width={520}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : 'Create Item'}</button>
            </>
          }
        >
          <TextField label="Item Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="form-grid-2">
            <SelectField label="Category" options={CATEGORY_OPTIONS} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <TextField label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, pcs, ltr…" />
          </div>
          <div className="form-grid-2">
            <TextField label="Opening Stock" type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: Number(e.target.value) })} />
            <TextField label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} hint="Alert triggers at or below this level" />
          </div>
          <TextField label="Unit Price (₹)" type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
        </Modal>
      )}

      {adjustTarget && (
        <Modal
          title={`Adjust Stock — ${adjustTarget.name}`}
          onClose={() => setAdjustTarget(null)}
          width={440}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAdjustTarget(null)} disabled={adjusting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdjust} disabled={adjusting || adjustQty === 0}>
                {adjusting ? <span className="spinner" /> : 'Apply Adjustment'}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ fontSize: 13 }}>Current stock: <strong className="mono">{adjustTarget.current_stock} {adjustTarget.unit}</strong></p>
          <TextField
            label="Adjustment Quantity" type="number" value={adjustQty}
            onChange={(e) => setAdjustQty(Number(e.target.value))}
            hint="Positive to add stock, negative to remove"
          />
          <TextField label="Reason / Notes" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} placeholder="e.g. Stock take correction, damage write-off" />
        </Modal>
      )}
    </>
  );
}
