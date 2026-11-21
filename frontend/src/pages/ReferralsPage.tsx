import { useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CustomerSelect } from '../components/billing/CustomerSelect';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { Customer, Referral } from '../types';

export function ReferralsPage() {
  const { showToast } = useToast();
  const [rewardStatus, setRewardStatus] = useState('');

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<Referral>({ endpoint: '/referrals', filters: { reward_status: rewardStatus }, defaultSortBy: 'created_at' });

  const [modalOpen, setModalOpen] = useState(false);
  const [referrer, setReferrer] = useState<Customer | null>(null);
  const [referred, setReferred] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => { setReferrer(null); setReferred(null); setError(''); setModalOpen(true); };

  const handleCreate = async () => {
    if (!referrer || !referred) { setError('Select both the referrer and the referred customer'); return; }
    if (referrer.id === referred.id) { setError('A customer cannot refer themselves'); return; }
    setSaving(true);
    try {
      await api.post('/referrals', { referrer_id: referrer.id, referred_id: referred.id });
      showToast('Referral recorded', 'success');
      setModalOpen(false);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const markSuccessful = async (r: Referral) => {
    try {
      await api.patch(`/referrals/${r.id}/mark-successful`, { reward_amount: 200 });
      showToast('Referral marked successful — reward issued for 1 year', 'success');
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  };

  const columns: Column<Referral>[] = [
    { key: 'referrer_name', header: 'Referrer', render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.referrer_name}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{r.referrer_mobile}</div></div>
    ) },
    { key: 'referred_name', header: 'Referred Customer', render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.referred_name}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{r.referred_mobile}</div></div>
    ) },
    { key: 'status', header: 'Referral Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'reward_amount', header: 'Reward', align: 'right', render: (r) => r.reward_amount ? <span className="mono">₹{r.reward_amount}</span> : <span className="text-muted">—</span> },
    { key: 'reward_status', header: 'Reward Status', render: (r) => <StatusBadge status={r.reward_status} /> },
    { key: 'reward_valid_until', header: 'Valid Until', render: (r) => r.reward_valid_until ? (
      <div>
        <div>{new Date(r.reward_valid_until).toLocaleDateString('en-IN')}</div>
        {r.reward_status === 'issued' && <div className="text-muted" style={{ fontSize: 11.5 }}>{r.days_until_expiry} days left</div>}
      </div>
    ) : <span className="text-muted">—</span> },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      r.status === 'pending'
        ? <button className="btn btn-secondary btn-sm" onClick={() => markSuccessful(r)}>Mark Successful</button>
        : null
    ) },
  ];

  return (
    <div className="card">
      <div className="table-toolbar">
        <select className="select" style={{ width: 200 }} value={rewardStatus} onChange={(e) => setRewardStatus(e.target.value)}>
          <option value="">All reward statuses</option>
          <option value="not_issued">Not Issued</option>
          <option value="issued">Issued (Active)</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
        </select>
        <button className="btn btn-primary" onClick={openCreate}>+ Log Referral</button>
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
        emptyIcon="⇄"
        emptyTitle="No referrals yet"
        emptyMessage="Referrals are logged automatically when a new customer names a referrer, or you can add one manually."
      />

      {modalOpen && (
        <Modal
          title="Log Referral"
          onClose={() => setModalOpen(false)}
          width={480}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Log Referral'}
              </button>
            </>
          }
        >
          <CustomerSelect value={referrer} onChange={setReferrer} label="Referrer" />
          <CustomerSelect value={referred} onChange={setReferred} label="Referred Customer" />
          {error && <p className="text-danger" style={{ fontSize: 13 }}>{error}</p>}
          <p className="field-hint">Rewards remain valid for 1 year from the date they're issued (after marking the referral successful).</p>
        </Modal>
      )}
    </div>
  );
}
