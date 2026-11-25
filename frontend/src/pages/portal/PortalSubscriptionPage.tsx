import { useEffect, useState } from 'react';
import { portalApi } from '../../api/portalClient';
import { apiErrorMessage } from '../../api/client';
import { PortalSubscription } from '../../types/portal';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatINR } from '../../utils/portalFormat';

export function PortalSubscriptionPage() {
  const [current, setCurrent] = useState<PortalSubscription | null>(null);
  const [history, setHistory] = useState<PortalSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    portalApi.get('/subscription')
      .then((res) => { setCurrent(res.data.data.current); setHistory(res.data.data.history); })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton" style={{ height: 220 }} />;
  if (error) return <div className="card card-pad"><p className="text-danger">{error}</p></div>;

  const columns: Column<PortalSubscription>[] = [
    { key: 'plan_name', header: 'Plan', render: (s) => <span className="badge badge-primary">{s.plan_name}</span> },
    { key: 'start_date', header: 'Started', render: (s) => formatDate(s.start_date) },
    { key: 'end_date', header: 'Expires', render: (s) => formatDate(s.end_date) },
    { key: 'price', header: 'Plan Price', align: 'right', render: (s) => <span className="mono">{formatINR(s.price, 0)}</span> },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
  ];

  const left = current ? Math.max(0, current.days_remaining) : 0;
  const totalDays = current ? Math.max(1, Math.round((+new Date(current.end_date) - +new Date(current.start_date)) / 86_400_000)) : 1;
  const pct = current && current.status === 'active' ? Math.min(100, Math.round((left / totalDays) * 100)) : 0;
  const benefits = (current?.benefits || '').split(',').map((b) => b.trim()).filter(Boolean);

  return (
    <>
      {!current ? (
        <div className="card card-pad empty-state">
          <div style={{ fontSize: 32 }}>★</div>
          <h3>No subscription yet</h3>
          <p className="text-muted">Contact us to choose a plan — it will appear here as soon as it's activated.</p>
        </div>
      ) : (
        <div className="portal-two-col">
          <div className="card card-pad flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2>{current.plan_name} Plan</h2>
              <StatusBadge status={current.status} />
            </div>
            <dl className="kv">
              <dt>Started</dt><dd>{formatDate(current.start_date)}</dd>
              <dt>Expires</dt><dd><strong>{formatDate(current.end_date)}</strong></dd>
              <dt>Time left</dt><dd>{current.status === 'active' ? `${left} day${left === 1 ? '' : 's'}` : current.status === 'expired' ? 'Expired' : 'Cancelled'}</dd>
              <dt>Plan price</dt><dd className="mono">{formatINR(current.price, 0)} / {current.duration_days} days</dd>
              <dt>Auto-renew</dt><dd>{current.auto_renew ? 'On' : 'Off'}</dd>
            </dl>
            {current.status === 'active' && <div className="progress" aria-label={`${pct}% remaining`}><span style={{ width: `${pct}%` }} /></div>}
            {current.status !== 'active' && <p className="text-muted" style={{ fontSize: 13 }}>Contact us to renew this plan.</p>}
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 12 }}>Your benefits</h3>
            {benefits.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>No benefits listed for this plan.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                {benefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-toolbar"><h3>Subscription history</h3></div>
        <DataTable columns={columns} rows={history} emptyIcon="★" emptyTitle="No history yet" emptyMessage="Your past and current plans will be listed here." />
      </div>
    </>
  );
}