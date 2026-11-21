import { useEffect, useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { Purchase, Supplier, InventoryItem } from '../types';

interface PurchaseLine { item_id: number; quantity: number; unit_price: number; }

export function PurchasesPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<Purchase>({
      endpoint: '/purchases',
      filters: { search: debouncedSearch, supplier_id: supplierId, from_date: fromDate, to_date: toDate },
      defaultSortBy: 'purchase_date',
    });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    api.get('/purchases/suppliers').then((res) => setSuppliers(res.data.data));
    api.get('/inventory', { params: { limit: 100 } }).then((res) => setItems(res.data.data));
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [formSupplier, setFormSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<PurchaseLine[]>([{ item_id: 0, quantity: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => {
    setFormSupplier(''); setPurchaseDate(new Date().toISOString().slice(0, 10));
    setLines([{ item_id: 0, quantity: 1, unit_price: 0 }]); setNotes(''); setError(''); setModalOpen(true);
  };

  const updateLine = (idx: number, patch: Partial<PurchaseLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { item_id: 0, quantity: 1, unit_price: 0 }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const total = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);

  const handleSave = async () => {
    if (!formSupplier) { setError('Select a supplier'); return; }
    if (lines.some((l) => !l.item_id || l.quantity <= 0)) { setError('Every line needs an item and quantity > 0'); return; }
    setSaving(true);
    try {
      await api.post('/purchases', { supplier_id: Number(formSupplier), purchase_date: purchaseDate, items: lines, notes });
      showToast('Purchase recorded — stock updated', 'success');
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Purchase>[] = [
    { key: 'purchase_no', header: 'Purchase #', sortable: true, render: (p) => <span className="mono" style={{ fontWeight: 600 }}>{p.purchase_no}</span> },
    { key: 'supplier_name', header: 'Supplier', render: (p) => p.supplier_name },
    { key: 'purchase_date', header: 'Date', sortable: true, render: (p) => new Date(p.purchase_date).toLocaleDateString('en-IN') },
    { key: 'total_amount', header: 'Amount', sortable: true, align: 'right', render: (p) => <span className="mono" style={{ fontWeight: 600 }}>₹{Number(p.total_amount).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div className="card">
      <div className="table-toolbar">
        <div className="flex gap-2" style={{ flex: 1, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 180 }}>
            <span className="input-icon">🔍</span>
            <input className="input" placeholder="Search purchase # or supplier…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 170 }} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 150 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="input" style={{ width: 150 }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Record Purchase</button>
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
        emptyIcon="⇩"
        emptyTitle="No purchases recorded"
        emptyMessage="Record an inward stock purchase to update your inventory."
      />

      {modalOpen && (
        <Modal
          title="Record Inward Purchase"
          onClose={() => setModalOpen(false)}
          width={720}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : `Save Purchase — ₹${total.toFixed(2)}`}
              </button>
            </>
          }
        >
          <div className="form-grid-2">
            <div className="field">
              <label>Supplier *</label>
              <select className="select" value={formSupplier} onChange={(e) => setFormSupplier(e.target.value)}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Purchase Date</label>
              <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Items</label>
            <div className="flex-col gap-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                  <select className="select" style={{ flex: 2, minWidth: 160 }} value={line.item_id} onChange={(e) => updateLine(idx, { item_id: Number(e.target.value) })}>
                    <option value={0}>Select item…</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>)}
                  </select>
                  <input className="input" type="number" min={0} placeholder="Qty" style={{ width: 90 }} value={line.quantity} onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })} />
                  <input className="input" type="number" min={0} placeholder="Unit Price" style={{ width: 110 }} value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })} />
                  <button type="button" className="btn btn-ghost btn-icon text-danger" onClick={() => removeLine(idx)} disabled={lines.length === 1}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={addLine}>+ Add Item</button>
          </div>

          <div className="field">
            <label>Notes</label>
            <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-danger" style={{ fontSize: 13 }}>{error}</p>}
        </Modal>
      )}
    </div>
  );
}
