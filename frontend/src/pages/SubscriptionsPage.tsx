import { useEffect, useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CustomerSelect } from '../components/billing/CustomerSelect';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { Customer, CustomerSubscription, SubscriptionPlan } from '../types';

export function SubscriptionsPage() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState('');

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<CustomerSubscription>({ endpoint: '/subscriptions', filters: { status }, defaultSortBy: 'end_date' });

  useEffect(() => {
    api.get('/subscriptions/plans').then((res) => setPlans(res.data.data));
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openAssign = () => { setCustomer(null); setPlanId(null); setAutoRenew(false); setError(''); setModalOpen(true); };

  const handleAssign = async () => {
    if (!customer || !planId) { setError('Select both a customer and a plan'); return; }
    setSaving(true);
    try {
      await api.post('/subscriptions', { customer_id: customer.id, plan_id: planId, auto_renew: autoRenew });
      showToast('Subscription assigned successfully', 'success');
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async (sub: CustomerSubscription, newPlanId?: number) => {
    try {
      await api.post('/subscriptions', {
        customer_id: sub.customer_id,
        plan_id: newPlanId || sub.plan_id,
        existing_id: sub.id,
      });
      showToast(newPlanId ? 'Subscription upgraded' : 'Subscription renewed', 'success');
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  };

  const columns: Column<CustomerSubscription>[] = [
    { key: 'customer_name', header: 'Customer', render: (s) => (
      <div>
        <div style={{ fontWeight: 600 }}>{s.customer_name}</div>
        <div className="text-muted mono" style={{ fontSize: 11.5 }}>{s.customer_mobile}</div>
      </div>
    ) },
    { key: 'plan_name', header: 'Plan', render: (s) => <span className="badge badge-primary">{s.plan_name}</span> },
    { key: 'end_date', header: 'Validity', sortable: true, render: (s) => (
      <div>
        <div>{new Date(s.end_date).toLocaleDateString('en-IN')}</div>
        {s.status === 'active' && (
          <div className={`text-muted`} style={{ fontSize: 11.5 }}>
            {(s.days_remaining ?? 0) >= 0 ? `${s.days_remaining} days left` : 'Overdue'}
          </div>
        )}
      </div>
    ) },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    { key: 'benefits', header: 'Benefits', render: (s) => <span className="text-secondary" style={{ fontSize: 12.5 }}>{s.benefits}</span> },
    { key: 'actions', header: '', align: 'right', render: (s) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => handleRenew(s)}>Renew</button>
        {plans.find((p) => p.tier_level > (plans.find((pp) => pp.id === s.plan_id)?.tier_level || 0)) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const currentTier = plans.find((pp) => pp.id === s.plan_id)?.tier_level || 0;
              const next = plans.find((p) => p.tier_level === currentTier + 1);
              if (next) handleRenew(s, next.id);
            }}
          >
            Upgrade
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${plans.length || 3}, 1fr)` }}>
        {plans.map((plan) => (
          <div key={plan.id} className="card card-pad">
            <div className="flex items-center justify-between">
              <h3>{plan.name}</h3>
              <span className="badge badge-accent">Tier {plan.tier_level}</span>
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, margin: '8px 0' }}>₹{plan.price}<span className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>/{plan.duration_days}d</span></div>
            <p className="text-secondary" style={{ fontSize: 12.5 }}>{plan.benefits}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All subscriptions</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-primary" onClick={openAssign}>+ Assign Subscription</button>
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
          emptyIcon="★"
          emptyTitle="No subscriptions yet"
          emptyMessage="Assign a plan to a customer to get started."
        />
      </div>

      {modalOpen && (
        <Modal
          title="Assign Subscription"
          onClose={() => setModalOpen(false)}
          width={480}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Assign Plan'}
              </button>
            </>
          }
        >
          <CustomerSelect value={customer} onChange={setCustomer} />
          <div className="field">
            <label>Plan</label>
            <select className="select" value={planId || ''} onChange={(e) => setPlanId(Number(e.target.value))}>
              <option value="">Select a plan…</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price} / {p.duration_days} days</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
            Enable auto-renew
          </label>
          {error && <p className="text-danger" style={{ fontSize: 13 }}>{error}</p>}
        </Modal>
      )}
    </>
  );
}
