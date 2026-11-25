import { useState } from 'react';
import { usePortalList } from '../../hooks/usePortalList';
import { portalApi } from '../../api/portalClient';
import { apiErrorMessage } from '../../api/client';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { WalletSummary, Withdrawal } from '../../types/portal';
import { formatDateTime, formatINR } from '../../utils/portalFormat';

type Summary = WalletSummary & { min_withdrawal: number };
interface Form { amount: string; payout_method: 'upi' | 'bank_transfer'; upi_id: string; bank_account_name: string; bank_account_number: string; bank_ifsc: string; }
const EMPTY: Form = { amount: '', payout_method: 'upi', upi_id: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '' };

export function PortalWithdrawalsPage() {
  const { showToast } = useToast();
  const { rows, summary, pagination, setPage, loading, error, refresh } = usePortalList<Withdrawal, Summary>({ endpoint: '/withdrawals' });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Withdrawal | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const balance = summary?.balance ?? 0;
  const min = summary?.min_withdrawal ?? 0;
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    const amt = Number(form.amount);
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount) || amt <= 0) e.amount = 'Enter a valid amount';
    else if (amt < min) e.amount = `Minimum withdrawal is ${formatINR(min, 0)}`;
    else if (amt > balance) e.amount = `You can withdraw up to ${formatINR(balance)}`;
    if (form.payout_method === 'upi') {
      if (!/^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/.test(form.upi_id.trim())) e.upi_id = 'Enter a valid UPI ID, e.g. name@bank';
    } else {
      if (form.bank_account_name.trim().length < 2) e.bank_account_name = "Enter the account holder's name";
      if (!/^\d{9,18}$/.test(form.bank_account_number.trim())) e.bank_account_number = 'Account number must be 9–18 digits';
      if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.bank_ifsc.trim())) e.bank_ifsc = 'Enter a valid 11-character IFSC';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: any = { amount: form.amount, payout_method: form.payout_method };
      if (form.payout_method === 'upi') body.upi_id = form.upi_id.trim();
      else Object.assign(body, { bank_account_name: form.bank_account_name.trim(), bank_account_number: form.bank_account_number.trim(), bank_ifsc: form.bank_ifsc.trim().toUpperCase() });
      await portalApi.post('/withdrawals', body);
      showToast('Withdrawal request submitted', 'success');
      setOpen(false);
      setForm(EMPTY);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await portalApi.post(`/withdrawals/${cancelTarget.id}/cancel`);
      showToast('Request cancelled — amount returned to your wallet', 'success');
      setCancelTarget(null);
      refresh();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
      setCancelTarget(null);
      refresh();
    } finally {
      setCancelling(false);
    }
  };

  const columns: Column<Withdrawal>[] = [
    { key: 'created_at', header: 'Requested', render: (w) => formatDateTime(w.created_at) },
    { key: 'amount', header: 'Amount', align: 'right', render: (w) => <span className="mono" style={{ fontWeight: 700 }}>{formatINR(w.amount)}</span> },
    { key: 'payout_method', header: 'Payout To', render: (w) => w.payout_method === 'upi'
      ? <div><div className="mono" style={{ fontSize: 12.5 }}>{w.upi_id}</div><div className="text-muted" style={{ fontSize: 11.5 }}>UPI</div></div>
      : <div><div className="mono" style={{ fontSize: 12.5 }}>{w.bank_account_number}</div><div className="text-muted" style={{ fontSize: 11.5 }}>{w.bank_account_name} · {w.bank_ifsc}</div></div> },
    { key: 'status', header: 'Status', render: (w) => <StatusBadge status={w.status} /> },
    { key: 'admin_note', header: 'Details', render: (w) => (
      <div style={{ fontSize: 12.5 }}>
        {w.payout_reference && <div>Ref: <span className="mono">{w.payout_reference}</span></div>}
        {w.admin_note && <div className="text-secondary">{w.admin_note}</div>}
        {!w.payout_reference && !w.admin_note && <span className="text-muted">—</span>}
      </div>
    ) },
    { key: 'actions', header: '', align: 'right', render: (w) => w.status === 'pending'
      ? <button className="btn btn-ghost btn-sm" onClick={() => setCancelTarget(w)}>Cancel</button> : null },
  ];

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Available Balance</span><span className="stat-value mono">{formatINR(balance)}</span></div>
        <div className="stat-card accent"><span className="stat-label">Pending Payout</span><span className="stat-value mono">{formatINR(summary?.pending_withdrawals ?? 0)}</span></div>
        <div className="stat-card info"><span className="stat-label">Total Withdrawn</span><span className="stat-value mono">{formatINR(summary?.total_withdrawn ?? 0)}</span></div>
        <div className="stat-card"><span className="stat-label">Minimum Withdrawal</span><span className="stat-value mono">{formatINR(min, 0)}</span></div>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div><h3>Withdrawal requests</h3><p className="text-muted" style={{ fontSize: 12.5 }}>The amount is held when you request it, and returned if the request is cancelled or rejected.</p></div>
          <button className="btn btn-primary" disabled={balance < min} title={balance < min ? `You need at least ${formatINR(min, 0)} to withdraw` : undefined} onClick={() => { setForm(EMPTY); setErrors({}); setOpen(true); }}>+ Request Withdrawal</button>
        </div>
        {error && <p className="text-danger" style={{ padding: '0 16px 16px' }}>{error}</p>}
        <DataTable columns={columns} rows={rows} loading={loading} pagination={pagination} onPageChange={setPage}
          emptyIcon="⇧" emptyTitle="No withdrawals yet" emptyMessage="Once you've earned commission, you can request a payout here." />
      </div>

      {open && (
        <Modal title="Request Withdrawal" onClose={() => setOpen(false)} width={480}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <span className="spinner" /> : 'Submit Request'}</button>
          </>}>
          <div className="field">
            <label>Amount (₹)</label>
            <input className={`input mono ${errors.amount ? 'has-error' : ''}`} inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder={`Up to ${formatINR(balance)}`} />
            {errors.amount ? <span className="field-error">{errors.amount}</span> : <span className="field-hint">Available: {formatINR(balance)} · Minimum: {formatINR(min, 0)}</span>}
          </div>
          <div className="field">
            <label>Payout method</label>
            <select className="select" value={form.payout_method} onChange={(e) => set('payout_method', e.target.value)}>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
          </div>
          {form.payout_method === 'upi' ? (
            <div className="field">
              <label>UPI ID</label>
              <input className={`input ${errors.upi_id ? 'has-error' : ''}`} value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} placeholder="name@bank" />
              {errors.upi_id && <span className="field-error">{errors.upi_id}</span>}
            </div>
          ) : (
            <>
              <div className="field">
                <label>Account holder name</label>
                <input className={`input ${errors.bank_account_name ? 'has-error' : ''}`} value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} />
                {errors.bank_account_name && <span className="field-error">{errors.bank_account_name}</span>}
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label>Account number</label>
                  <input className={`input mono ${errors.bank_account_number ? 'has-error' : ''}`} inputMode="numeric" value={form.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value.replace(/\D/g, ''))} />
                  {errors.bank_account_number && <span className="field-error">{errors.bank_account_number}</span>}
                </div>
                <div className="field">
                  <label>IFSC</label>
                  <input className={`input mono ${errors.bank_ifsc ? 'has-error' : ''}`} maxLength={11} value={form.bank_ifsc} onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase())} />
                  {errors.bank_ifsc && <span className="field-error">{errors.bank_ifsc}</span>}
                </div>
              </div>
            </>
          )}
        </Modal>
      )}

      {cancelTarget && (
        <ConfirmDialog title="Cancel this request?" message={`${formatINR(cancelTarget.amount)} will be returned to your wallet.`}
          confirmLabel="Cancel request" loading={cancelling} onConfirm={cancel} onCancel={() => setCancelTarget(null)} />
      )}
    </>
  );
}