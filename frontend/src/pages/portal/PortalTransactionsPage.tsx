import { useState } from 'react';
import { usePortalList } from '../../hooks/usePortalList';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { WalletSummary, WalletTransaction } from '../../types/portal';
import { formatDateTime, formatINR } from '../../utils/portalFormat';

const TYPE_MAP = { commission: 'success', withdrawal: 'accent', withdrawal_refund: 'info' } as const;

export function PortalTransactionsPage() {
  const [type, setType] = useState('');
  const { rows, summary, pagination, setPage, loading, error } = usePortalList<WalletTransaction, WalletSummary>({ endpoint: '/transactions', filters: { type } });

  const columns: Column<WalletTransaction>[] = [
    { key: 'created_at', header: 'Date', render: (t) => formatDateTime(t.created_at) },
    { key: 'type', header: 'Type', render: (t) => <StatusBadge status={t.type} map={TYPE_MAP} /> },
    { key: 'description', header: 'Details', render: (t) => <span className="text-secondary">{t.description}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (t) => (
      <span className={`mono ${t.direction === 'credit' ? 'amt-credit' : 'amt-debit'}`}>{t.direction === 'credit' ? '+' : '−'}{formatINR(t.amount)}</span>
    ) },
  ];

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><span className="stat-label">Wallet Balance</span><span className="stat-value mono">{formatINR(summary?.balance ?? 0)}</span></div>
        <div className="stat-card info"><span className="stat-label">Total Earned</span><span className="stat-value mono">{formatINR(summary?.total_earned ?? 0)}</span></div>
        <div className="stat-card accent"><span className="stat-label">Total Withdrawn</span><span className="stat-value mono">{formatINR(summary?.total_withdrawn ?? 0)}</span></div>
      </div>
      <div className="card">
        <div className="table-toolbar">
          <select className="select" style={{ width: 220 }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All transactions</option>
            <option value="commission">Commissions</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="withdrawal_refund">Refunds</option>
          </select>
        </div>
        {error && <p className="text-danger" style={{ padding: '0 16px 16px' }}>{error}</p>}
        <DataTable columns={columns} rows={rows} loading={loading} pagination={pagination} onPageChange={setPage}
          emptyIcon="🧾" emptyTitle="No transactions" emptyMessage="Commissions and withdrawals will be recorded here." />
      </div>
    </>
  );
}