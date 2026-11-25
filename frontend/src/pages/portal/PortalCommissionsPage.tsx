import { usePortalList } from '../../hooks/usePortalList';
import { DataTable, Column } from '../../components/common/DataTable';
import { Commission } from '../../types/portal';
import { formatDate, formatINR } from '../../utils/portalFormat';

interface Summary { total_earned: number; count: number; rate_percent: number; }

export function PortalCommissionsPage() {
  const { rows, summary, pagination, setPage, loading, error } = usePortalList<Commission, Summary>({ endpoint: '/commissions' });

  const columns: Column<Commission>[] = [
    { key: 'created_at', header: 'Date', render: (c) => formatDate(c.created_at) },
    { key: 'referred_name', header: 'Referred User', render: (c) => <strong>{c.referred_name}</strong> },
    { key: 'plan_name', header: 'Plan Purchased', render: (c) => <span className="badge badge-primary">{c.plan_name}</span> },
    { key: 'base_amount', header: 'Plan Price', align: 'right', render: (c) => <span className="mono">{formatINR(c.base_amount, 0)}</span> },
    { key: 'rate_percent', header: 'Rate', align: 'right', render: (c) => <span className="mono">{c.rate_percent}%</span> },
    { key: 'amount', header: 'Commission', align: 'right', render: (c) => <span className="mono amt-credit">+{formatINR(c.amount)}</span> },
  ];

  return (
    <>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card info"><span className="stat-label">Total Commission Earned</span><span className="stat-value mono">{formatINR(summary?.total_earned ?? 0)}</span></div>
        <div className="stat-card"><span className="stat-label">Commissions</span><span className="stat-value mono">{summary?.count ?? 0}</span></div>
        <div className="stat-card accent"><span className="stat-label">Current Rate</span><span className="stat-value mono">{summary?.rate_percent ?? 0}%</span><span className="stat-delta text-muted">of plan price</span></div>
      </div>
      <div className="card">
        <div className="table-toolbar"><h3>Commission history</h3></div>
        {error && <p className="text-danger" style={{ padding: '0 16px 16px' }}>{error}</p>}
        <DataTable columns={columns} rows={rows} loading={loading} pagination={pagination} onPageChange={setPage}
          emptyIcon="％" emptyTitle="No commissions yet" emptyMessage="You earn a commission each time someone you referred buys a subscription." />
      </div>
    </>
  );
}