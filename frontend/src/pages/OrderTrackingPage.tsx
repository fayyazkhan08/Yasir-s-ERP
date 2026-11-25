import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { SelectField, TextField } from '../components/common/FormField';
import { OrderStepper } from '../components/dealer/OrderStepper';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '../constants/units';
import { formatDate, formatDateTime, formatQty, whatsappLink } from '../utils/format';
import { DealerOrder, DealerOrderStatus } from '../types';

interface Summary { counts: Record<string, number>; overdue: number; }

export function OrderTrackingPage() {
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<string>('open'); // 'open' | a status | 'overdue' | ''
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<DealerOrder>({
      endpoint: '/dealer-orders',
      filters: {
        search: debouncedSearch,
        status: stage === 'overdue' ? 'open' : stage,
        overdue: stage === 'overdue' ? 'true' : '',
      },
      defaultSortBy: 'delivery_date',
      defaultSortDir: 'asc',
    });

  const [summary, setSummary] = useState<Summary | null>(null);
  const loadSummary = useCallback(() => {
    api.get('/dealer-orders/summary').then((res) => setSummary(res.data.data)).catch(() => setSummary(null));
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ---- tracking detail ----
  const [openId, setOpenId] = useState<number | null>(null);
  const [order, setOrder] = useState<DealerOrder | null>(null);
  const [newStatus, setNewStatus] = useState<DealerOrderStatus>('confirmed');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const nextStage = (s: DealerOrderStatus): DealerOrderStatus => {
    const i = ORDER_FLOW.indexOf(s);
    return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : s;
  };

  const loadOrder = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/dealer-orders/${id}`);
      const o: DealerOrder = res.data.data;
      setOrder(o);
      setNewStatus(nextStage(o.status));
      setNote('');
      setReference('');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
      setOpenId(null);
    }
  }, [showToast]);

  useEffect(() => { if (openId) { setOrder(null); loadOrder(openId); } }, [openId, loadOrder]);

  // Deep link from the Dealers Order page: /order-tracking?order=12
  useEffect(() => {
    const id = Number(params.get('order'));
    if (id) { setOpenId(id); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const closeDetail = () => { setOpenId(null); setOrder(null); };

  const saveUpdate = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await api.post(`/dealer-orders/${order.id}/tracking`, { status: newStatus, note, reference });
      showToast(`Order moved to ${ORDER_STATUS_LABEL[newStatus]}`, 'success');
      await loadOrder(order.id);
      refresh();
      loadSummary();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<DealerOrder>[] = [
    { key: 'order_no', header: 'Order #', sortable: true, render: (o) => <span className="mono" style={{ fontWeight: 600 }}>{o.order_no}</span> },
    { key: 'dealer_name', header: 'Dealer', sortable: true, render: (o) => (
      <div>
        <div style={{ fontWeight: 600 }}>{o.dealer_name}</div>
        <div className="text-muted" style={{ fontSize: 11.5 }}>{o.item_count} item{o.item_count === 1 ? '' : 's'}</div>
      </div>
    ) },
    { key: 'delivery_date', header: 'Delivery', sortable: true, render: (o) => (
      <div>
        {formatDate(o.delivery_date)}
        {!!o.is_overdue && <div className="text-danger" style={{ fontSize: 11.5 }}>Overdue</div>}
      </div>
    ) },
    { key: 'progress', header: 'Progress', render: (o) => <OrderStepper status={o.status} /> },
    { key: 'status', header: 'Stage', sortable: true, render: (o) => <StatusBadge status={o.status} /> },
    { key: 'actions', header: '', align: 'right', render: (o) => (
      <button className="btn btn-primary btn-sm" onClick={() => setOpenId(o.id)}>Track / Update</button>
    ) },
  ];

  const cards: { key: string; label: string; n: number }[] = [
    { key: 'open', label: 'All open', n: summary ? ORDER_FLOW.slice(0, -1).reduce((a, s) => a + (summary.counts[s] || 0), 0) : 0 },
    ...ORDER_FLOW.map((s) => ({ key: s, label: ORDER_STATUS_LABEL[s], n: summary?.counts[s] || 0 })),
    { key: 'cancelled', label: 'Cancelled', n: summary?.counts.cancelled || 0 },
    { key: 'overdue', label: 'Overdue', n: summary?.overdue || 0 },
  ];

  return (
    <>
      <div className="stage-grid" style={{ marginBottom: 'var(--space-4)' }}>
        {cards.map((c) => (
          <button key={c.key} className={`stage-card ${stage === c.key ? 'active' : ''}`} onClick={() => { setStage(stage === c.key ? '' : c.key); setPage(1); }}>
            <span className="n">{c.n}</span>
            <span className="l">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="input-group" style={{ flex: 1, maxWidth: 420 }}>
            <span className="input-icon">🔍</span>
            <input className="input" placeholder="Search order #, dealer, mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {stage && <button className="btn btn-ghost btn-sm" onClick={() => setStage('')}>Clear filter ✕</button>}
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
          emptyIcon="🚚"
          emptyTitle="No orders to track"
          emptyMessage="Orders appear here as soon as you create them under Dealers Order."
        />
      </div>

      {openId && (
        <Modal
          title={order ? `Track ${order.order_no} — ${order.dealer_name}` : 'Loading…'}
          onClose={closeDetail}
          width={680}
          footer={<button className="btn btn-secondary" onClick={closeDetail}>Close</button>}
        >
          {!order ? (
            <div className="flex items-center gap-2"><span className="spinner" /> Loading…</div>
          ) : (
            <>
              <div className="flex items-center" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 13 }}>
                  <div>Ordered <strong>{formatDate(order.order_date)}</strong> · Delivery <strong>{formatDate(order.delivery_date)}</strong>
                    {!!order.is_overdue && <span className="text-danger"> · Overdue</span>}</div>
                  {order.dealer_mobile && (
                    <div className="text-muted">
                      {order.dealer_mobile} ·{' '}
                      <a href={whatsappLink(order.dealer_mobile, `Hello, update on your order ${order.order_no}: ${ORDER_STATUS_LABEL[order.status]}.`)} target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>
                    </div>
                  )}
                </div>
                <StatusBadge status={order.status} />
              </div>

              <OrderStepper status={order.status} />

              <div style={{ fontSize: 12.5 }}>
                <strong>Items: </strong>
                {(order.items || []).map((i) => `${i.product} ×${formatQty(i.quantity)}${i.unit ? ' ' + i.unit : ''}`).join(', ')}
              </div>

              <div>
                <strong style={{ fontSize: 13 }}>History</strong>
                <div className="timeline" style={{ marginTop: 10 }}>
                  {[...(order.tracking || [])].reverse().map((t) => (
                    <div key={t.id} className={`timeline-item ${t.status === 'cancelled' ? 'cancelled' : ''}`}>
                      <span className="timeline-dot" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{ORDER_STATUS_LABEL[t.status]}</div>
                        {t.note && <div style={{ fontSize: 13 }}>{t.note}</div>}
                        {t.reference && <div className="mono" style={{ fontSize: 12 }}>Ref: {t.reference}</div>}
                        <div className="text-muted" style={{ fontSize: 11.5 }}>{formatDateTime(t.created_at)}{t.created_by_name ? ` · ${t.created_by_name}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 'var(--space-4)', background: 'var(--surface-sunken)' }}>
                <strong style={{ fontSize: 13 }}>Add an update</strong>
                <div className="flex-col gap-3" style={{ marginTop: 10 }}>
                  <div className="form-grid-2">
                    <SelectField
                      label="New stage" value={newStatus}
                      options={[...ORDER_FLOW, 'cancelled' as const].map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))}
                      onChange={(e) => setNewStatus(e.target.value as DealerOrderStatus)}
                    />
                    <TextField label="Reference (optional)" placeholder="Vehicle / LR no." maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                  <TextField label="Note (optional)" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div>
                    <button className="btn btn-primary" onClick={saveUpdate} disabled={saving}>
                      {saving ? <span className="spinner" /> : `Move to ${ORDER_STATUS_LABEL[newStatus]}`}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
