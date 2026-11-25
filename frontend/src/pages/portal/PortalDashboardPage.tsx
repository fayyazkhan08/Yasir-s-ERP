import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { portalApi } from '../../api/portalClient';
import { apiErrorMessage } from '../../api/client';
import { PortalDashboard } from '../../types/portal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CopyButton } from '../../components/portal/CopyButton';
import { formatDate, formatINR, monthLabel, referralLink } from '../../utils/portalFormat';

export function PortalDashboardPage() {
  const [data, setData] = useState<PortalDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get('/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="stats-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}</div>;
  }
  if (error || !data) {
    return <div className="card card-pad"><p className="text-danger">{error || 'Failed to load your dashboard.'}</p></div>;
  }

  const { wallet, subscription: sub, referrals } = data;
  const link = referralLink(data.referral_code);
  const totalDays = sub ? Math.max(1, Math.round((+new Date(sub.end_date) - +new Date(sub.start_date)) / 86_400_000)) : 1;
  const left = sub ? Math.max(0, sub.days_remaining) : 0;
  const pct = sub && sub.status === 'active' ? Math.min(100, Math.round((left / totalDays) * 100)) : 0;
  const expiringSoon = !!sub && sub.status === 'active' && left <= 14;
  const chartData = data.income_trend.map((m) => ({ label: monthLabel(m.month), income: m.income }));

  return (
    <>
      {sub && sub.status === 'expired' && (
        <div className="banner"><span>⚠</span><span>Your <strong>{sub.plan_name}</strong> plan expired on {formatDate(sub.end_date)}. Contact us to renew and keep your benefits.</span></div>
      )}
      {expiringSoon && (
        <div className="banner dashed"><span>⏳</span><span>Your <strong>{sub!.plan_name}</strong> plan expires in <strong>{left} day{left === 1 ? '' : 's'}</strong> ({formatDate(sub!.end_date)}).</span></div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Wallet Balance</span>
          <span className="stat-value mono">{formatINR(wallet.balance)}</span>
          <span className="stat-delta text-muted">{wallet.pending_withdrawals > 0 ? `${formatINR(wallet.pending_withdrawals)} pending payout` : 'Available to withdraw'}</span>
        </div>
        <div className="stat-card info">
          <span className="stat-label">Total Income</span>
          <span className="stat-value mono">{formatINR(wallet.total_earned)}</span>
          <span className="stat-delta text-muted">{data.config.commission_percent}% commission rate</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-label">Total Withdrawn</span>
          <span className="stat-value mono">{formatINR(wallet.total_withdrawn)}</span>
          <span className="stat-delta text-muted">Paid out to you</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">People Referred</span>
          <span className="stat-value mono">{referrals.total}</span>
          <span className="stat-delta text-muted">{referrals.with_active_subscription} with an active plan</span>
        </div>
      </div>

      <div className="portal-dash-grid">
        <div className="card card-pad">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h2>Income — Last 6 Months</h2>
            <Link to="/portal/commissions" className="btn btn-secondary btn-sm">View commissions</Link>
          </div>
          {chartData.every((d) => d.income === 0) ? (
            <div className="empty-state"><p>No commissions yet. Share your referral link to start earning.</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatINR(v)}
                  cursor={{ fill: 'var(--surface-sunken)' }}
                />
                <Bar dataKey="income" fill="var(--primary-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex-col gap-4">
          <div className="card card-pad">
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <h3>My Subscription</h3>
              <Link to="/portal/subscription" style={{ fontSize: 12.5, fontWeight: 600 }}>Details →</Link>
            </div>
            {!sub ? (
              <p className="text-muted" style={{ fontSize: 13 }}>You don't have a subscription yet. Contact us to get started.</p>
            ) : (
              <div className="flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="badge badge-primary">{sub.plan_name}</span>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="progress" aria-label={`${pct}% of the plan period remaining`}><span style={{ width: `${pct}%` }} /></div>
                <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
                  <span className="text-muted">{sub.status === 'active' ? `${left} days left` : 'Not active'}</span>
                  <span>Ends {formatDate(sub.end_date)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 4 }}>Your Referral Link</h3>
            <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Code <span className="code-chip">{data.referral_code}</span></p>
            <div className="link-box"><code title={link}>{link}</code><CopyButton text={link} /></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar"><h3>Recent Activity</h3><Link to="/portal/transactions" className="btn btn-secondary btn-sm">All transactions</Link></div>
        {data.recent_transactions.length === 0 ? (
          <div className="empty-state"><p>Nothing here yet.</p></div>
        ) : (
          <div className="flex-col" style={{ padding: '0 var(--space-4) var(--space-3)' }}>
            {data.recent_transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                <div>
                  <div>{t.description}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{formatDate(t.created_at)}</div>
                </div>
                <span className={`mono ${t.direction === 'credit' ? 'amt-credit' : 'amt-debit'}`}>{t.direction === 'credit' ? '+' : '−'}{formatINR(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}