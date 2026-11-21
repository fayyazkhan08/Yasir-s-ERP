import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { DashboardSummary } from '../types';

function formatCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 96 }} />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card card-pad">
        <p className="text-danger">{error || 'Failed to load dashboard data.'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Customers</span>
          <span className="stat-value mono">{data.customers.total}</span>
          <span className="stat-delta text-success">{data.customers.active} active</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revenue (30d)</span>
          <span className="stat-value mono">{formatCurrency(data.invoices_30d.revenue)}</span>
          <span className="stat-delta text-muted">{data.invoices_30d.total} invoices</span>
        </div>
        <div className="stat-card info">
          <span className="stat-label">Active Subscriptions</span>
          <span className="stat-value mono">{data.active_subscriptions}</span>
          <span className="stat-delta text-muted">{data.referrals.active_rewards} active reward(s)</span>
        </div>
        <div className={`stat-card ${data.low_stock_count > 0 ? 'danger' : ''}`}>
          <span className="stat-label">Low Stock Alerts</span>
          <span className="stat-value mono">{data.low_stock_count}</span>
          <span className={`stat-delta ${data.low_stock_count > 0 ? 'text-danger' : 'text-success'}`}>
            {data.low_stock_count > 0 ? 'Needs attention' : 'All stocked'}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card card-pad">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h2>Revenue — Last 7 Days</h2>
            <Link to="/billing" className="btn btn-secondary btn-sm">View invoices</Link>
          </div>
          {data.revenue_trend.length === 0 ? (
            <div className="empty-state"><p>No invoices in the last 7 days yet.</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary-600)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex-col gap-4">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 12 }}>Subscriptions Expiring Soon</h3>
            {data.expiring_subscriptions.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>Nothing expiring in the next 14 days.</p>
            ) : (
              <div className="flex-col gap-2">
                {data.expiring_subscriptions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong>{s.customer_name}</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>{s.plan_name}</div>
                    </div>
                    <span className="badge badge-accent">{s.days_remaining}d left</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <h3>Quick Actions</h3>
            </div>
            <div className="flex-col gap-2">
              <Link to="/customers" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>+ New Customer</Link>
              <Link to="/billing" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>+ Create Invoice</Link>
              <Link to="/inventory" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>View Low Stock Items</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
