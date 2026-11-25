import { useState } from 'react';
import '../styles/portal.css';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CopyButton } from '../components/portal/CopyButton';
import { useToast } from '../context/ToastContext';
import { api, apiErrorMessage } from '../api/client';
import { AdminPortalAccountRow, AdminWithdrawal } from '../types/portal';
import { formatDateTime, formatINR } from '../utils/portalFormat';

type Tab = 'withdrawals' | 'logins';

export function PortalAdminPage() {
  const [tab, setTab] = useState<Tab>('withdrawals');
  return (
    <div className="card">
      <div className="tabs">
        <button className={`tab ${tab === 'withdrawals' ? 'active' : ''}`} onClick={() => setTab('withdrawals')}>Withdrawal Requests</button>
        <button className={`tab ${tab === 'logins' ? 'active' : ''}`} onClick={() => setTab('logins')}>Customer Logins</button>
      </div>
      {tab === 'withdrawals' ? <WithdrawalsTab /> : <LoginsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------
function WithdrawalsTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);

  const { rows, pagination, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<AdminWithdrawal>({ endpoint: '/admin/portal/withdrawals', filters: { status, search: debounced }, defaultSortBy: 'created_at' });

  const [payTarget, setPayTarget] = useState<AdminWithdrawal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminWithdrawal | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const openPay = (w: AdminWithdrawal) => { setPayTarget(w); setReference(''); setNote(''); setErr(''); };
  const openReject = (w: AdminWithdrawal) => { setRejectTarget(w); setNote(''); setErr(''); };

  const act = async (kind: 'pay' | 'reject') => {
    const target = kind === 'pay' ? payTarget : rejectTarget;
    if (!target) return;
    if (kind === 'pay' && reference.trim().length < 3) { setErr('Enter the payment reference (UTR / transaction id)'); return; }
    if (kind === 'reject' && note.trim().length < 3) { setErr('Give the customer a reason'); return; }
    setSaving(true);
    try {
      await api.patch(`/admin/portal/withdrawals/${target.id}/${kind}`, kind === 'pay'
        ? { payout_reference: reference.trim(), admin_note: note.trim() || undefined }
        : { admin_note: note.trim() });
      showToast(kind === 'pay' ? 'Marked as paid' : 'Rejected — amount returned to the customer', 'success');
      setPayTarget(null); setRejectTarget(null);
      refresh();
    } catch (e) {
      showToast(apiErrorMessage(e), 'error');
      setPayTarget(null); setRejectTarget(null);
      refresh(); // e.g. the customer cancelled first — show the current state
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AdminWithdrawal>[] = [
    { key: 'customer_name', header: 'Customer', render: (w) => (
      <div><div style={{ fontWeight: 600 }}>{w.customer_name}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{w.customer_code} · {w.customer_mobile}</div></div>
    ) },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (w) => <span className="mono" style={{ fontWeight: 700 }}>{formatINR(w.amount)}</span> },
    { key: 'payout_method', header: 'Pay To', render: (w) => w.payout_method === 'upi'
      ? <div><div className="mono" style={{ fontSize: 12.5 }}>{w.upi_id}</div><div className="text-muted" style={{ fontSize: 11.5 }}>UPI</div></div>
      : <div style={{ fontSize: 12.5 }}><div>{w.bank_account_name}</div><div className="mono">{w.bank_account_number}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{w.bank_ifsc}</div></div> },
    { key: 'created_at', header: 'Requested', sortable: true, render: (w) => formatDateTime(w.created_at) },
    { key: 'status', header: 'Status', render: (w) => (
      <div><StatusBadge status={w.status} />{w.processed_by_name && <div className="text-muted" style={{ fontSize: 11.5, marginTop: 4 }}>by {w.processed_by_name}</div>}{w.payout_reference && <div className="mono" style={{ fontSize: 11.5 }}>{w.payout_reference}</div>}</div>
    ) },
    { key: 'actions', header: '', align: 'right', render: (w) => w.status === 'pending' ? (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => openPay(w)}>Mark Paid</button>
        <button className="btn btn-danger btn-sm" onClick={() => openReject(w)}>Reject</button>
      </div>
    ) : null },
  ];

  return (
    <>
      <div className="table-toolbar">
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 240 }} placeholder="Search customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
        pagination={pagination} onPageChange={setPage} emptyIcon="⇧" emptyTitle="No withdrawal requests"
        emptyMessage={status === 'pending' ? 'Nothing is waiting for payout.' : 'No requests match this filter.'} />

      {payTarget && (
        <Modal title="Mark as Paid" onClose={() => setPayTarget(null)} width={460}
          footer={<><button className="btn btn-secondary" onClick={() => setPayTarget(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={() => act('pay')} disabled={saving}>{saving ? <span className="spinner" /> : 'Confirm Payment'}</button></>}>
          <p className="text-secondary" style={{ fontSize: 13.5 }}>Confirm you have transferred <strong className="mono">{formatINR(payTarget.amount)}</strong> to {payTarget.customer_name}. Payouts are made manually — this only records it.</p>
          <div className="field"><label>Payment reference (UTR)</label><input className="input mono" value={reference} onChange={(e) => { setReference(e.target.value); setErr(''); }} /></div>
          <div className="field"><label>Note to customer (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {err && <p className="text-danger" style={{ fontSize: 13 }}>{err}</p>}
        </Modal>
      )}
      {rejectTarget && (
        <Modal title="Reject Request" onClose={() => setRejectTarget(null)} width={460}
          footer={<><button className="btn btn-secondary" onClick={() => setRejectTarget(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={() => act('reject')} disabled={saving}>{saving ? <span className="spinner" /> : 'Reject & Refund'}</button></>}>
          <p className="text-secondary" style={{ fontSize: 13.5 }}><strong className="mono">{formatINR(rejectTarget.amount)}</strong> will be returned to {rejectTarget.customer_name}'s wallet.</p>
          <div className="field"><label>Reason (shown to the customer)</label><input className="input" value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} /></div>
          {err && <p className="text-danger" style={{ fontSize: 13 }}>{err}</p>}
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Customer logins
// ---------------------------------------------------------------------
function LoginsTab() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { rows, pagination, setPage, loading, refresh } =
    usePaginatedList<AdminPortalAccountRow>({ endpoint: '/admin/portal/accounts', filters: { search: debounced } });

  const [createFor, setCreateFor] = useState<AdminPortalAccountRow | null>(null);
  const [email, setEmail] = useState('');
  const [resetFor, setResetFor] = useState<AdminPortalAccountRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<{ email: string; temp_password: string } | null>(null);
  const [error, setError] = useState('');

  const openCreate = (r: AdminPortalAccountRow) => { setCreateFor(r); setEmail(r.customer_email || ''); setError(''); };

  const create = async () => {
    if (!createFor) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/admin/portal/customers/${createFor.id}/account`, { email: email.trim() });
      setCreateFor(null);
      setIssued(res.data.data);
      refresh();
    } catch (e) { setError(apiErrorMessage(e)); } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!resetFor) return;
    setSaving(true);
    try {
      const res = await api.post(`/admin/portal/customers/${resetFor.id}/reset-password`);
      setResetFor(null);
      setIssued(res.data.data);
      refresh();
    } catch (e) { showToast(apiErrorMessage(e), 'error'); setResetFor(null); } finally { setSaving(false); }
  };

  const toggle = async (r: AdminPortalAccountRow) => {
    const status = r.login_status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/portal/customers/${r.id}/account-status`, { status });
      showToast(`Portal login ${status === 'active' ? 'activated' : 'deactivated'}`, 'success');
      refresh();
    } catch (e) { showToast(apiErrorMessage(e), 'error'); }
  };

  const columns: Column<AdminPortalAccountRow>[] = [
    { key: 'name', header: 'Customer', render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.name}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{r.customer_code} · {r.mobile}</div></div>
    ) },
    { key: 'login_email', header: 'Portal Login', render: (r) => r.account_id
      ? <div><div style={{ fontSize: 13 }}>{r.login_email}</div><div className="text-muted" style={{ fontSize: 11.5 }}>{r.last_login_at ? `Last: ${formatDateTime(r.last_login_at)}` : r.must_change_password ? 'Awaiting first sign-in' : 'Never signed in'}</div></div>
      : <span className="text-muted">No login yet</span> },
    { key: 'login_status', header: 'Status', render: (r) => r.login_status ? <StatusBadge status={r.login_status} /> : <span className="text-muted">—</span> },
    { key: 'actions', header: '', align: 'right', render: (r) => r.account_id ? (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setResetFor(r)}>Reset password</button>
        <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>{r.login_status === 'active' ? 'Deactivate' : 'Activate'}</button>
      </div>
    ) : <button className="btn btn-primary btn-sm" onClick={() => openCreate(r)}>Create login</button> },
  ];

  return (
    <>
      <div className="table-toolbar">
        <input className="input" style={{ width: 280 }} placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="text-muted" style={{ fontSize: 12.5 }}>Customers can also register themselves at <span className="mono">/portal/register</span>. Use this to give existing customers access.</span>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} pagination={pagination} onPageChange={setPage} emptyIcon="👤" emptyTitle="No customers found" emptyMessage="Try a different search." />

      {createFor && (
        <Modal title={`Create portal login — ${createFor.name}`} onClose={() => setCreateFor(null)} width={460}
          footer={<><button className="btn btn-secondary" onClick={() => setCreateFor(null)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? <span className="spinner" /> : 'Create Login'}</button></>}>
          <div className="field"><label>Sign-in email</label><input type="email" className={`input ${error ? 'has-error' : ''}`} value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
            {error ? <span className="field-error">{error}</span> : <span className="field-hint">A one-time temporary password will be generated. The customer must change it at first sign-in.</span>}</div>
        </Modal>
      )}
      {resetFor && (
        <ConfirmDialog title="Reset password?" danger={false} loading={saving} confirmLabel="Reset"
          message={`${resetFor.name} will be signed out everywhere and given a new temporary password.`} onConfirm={reset} onCancel={() => setResetFor(null)} />
      )}
      {issued && (
        <Modal title="Temporary password" onClose={() => setIssued(null)} width={460} footer={<button className="btn btn-primary" onClick={() => setIssued(null)}>Done</button>}>
          <div className="banner dashed"><span>⚠</span><span>This password is shown <strong>only once</strong>. Share it with the customer securely — they'll be asked to replace it when they sign in.</span></div>
          <dl className="kv"><dt>Email</dt><dd>{issued.email}</dd><dt>Password</dt><dd className="flex items-center gap-2"><code className="code-chip" style={{ letterSpacing: '0.06em' }}>{issued.temp_password}</code><CopyButton text={issued.temp_password} /></dd></dl>
        </Modal>
      )}
    </>
  );
}