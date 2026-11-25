import { useEffect, useState } from 'react';
import { portalApi } from '../../api/portalClient';
import { usePortalList } from '../../hooks/usePortalList';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CopyButton } from '../../components/portal/CopyButton';
import { ReferredUser } from '../../types/portal';
import { formatDate, formatINR, referralLink } from '../../utils/portalFormat';

export function PortalReferralsPage() {
  const [code, setCode] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    portalApi.get('/me').then((res) => { setCode(res.data.data.referral_code); setRate(res.data.data.config.commission_percent); });
  }, []);

  const { rows, pagination, setPage, loading, error } = usePortalList<ReferredUser>({ endpoint: '/referrals' });

  const link = code ? referralLink(code) : '';
  const shareText = encodeURIComponent(`Join me! Sign up with my referral link: ${link}`);

  const columns: Column<ReferredUser>[] = [
    { key: 'referred_name', header: 'Referred User', render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.referred_name}</div><div className="text-muted mono" style={{ fontSize: 11.5 }}>{r.referred_mobile}</div></div>
    ) },
    { key: 'created_at', header: 'Joined', render: (r) => formatDate(r.created_at) },
    { key: 'plan_name', header: 'Plan', render: (r) => r.plan_name ? <span className="badge badge-primary">{r.plan_name}</span> : <span className="text-muted">None yet</span> },
    { key: 'subscription_status', header: 'Subscription', render: (r) => r.subscription_status ? <StatusBadge status={r.subscription_status} /> : <span className="text-muted">—</span> },
    { key: 'commission_earned', header: 'Commission Earned', align: 'right', render: (r) => r.commission_earned > 0 ? <span className="mono amt-credit">{formatINR(r.commission_earned)}</span> : <span className="text-muted">—</span> },
    { key: 'status', header: 'Referral', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'reward_status', header: 'Invoice Reward', render: (r) => r.reward_status === 'not_issued' ? <span className="text-muted">—</span> : (
      <div>
        <div><span className="mono">{formatINR(r.reward_amount, 0)}</span> <StatusBadge status={r.reward_status} /></div>
        {r.reward_status === 'issued' && r.reward_valid_until && <div className="text-muted" style={{ fontSize: 11.5 }}>valid till {formatDate(r.reward_valid_until)}</div>}
      </div>
    ) },
  ];

  return (
    <>
      <div className="card card-pad flex-col gap-3">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2>Your referral link</h2>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {rate !== null && rate > 0
                ? `Earn ${rate}% of the plan price every time someone you refer subscribes.`
                : 'Share this link with friends to refer them.'}
            </p>
          </div>
          <div>Code: <span className="code-chip">{code || '…'}</span></div>
        </div>
        <div className="link-box">
          <code title={link}>{link || 'Loading…'}</code>
          {link && <CopyButton text={link} label="Copy link" />}
          {link && <a className="btn btn-primary btn-sm" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>}
        </div>
      </div>

      <div className="card">
        <div className="table-toolbar"><h3>People you referred</h3></div>
        {error && <p className="text-danger" style={{ padding: '0 16px 16px' }}>{error}</p>}
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
          emptyIcon="⇄"
          emptyTitle="No referrals yet"
          emptyMessage="When someone signs up with your link, they'll appear here."
        />
      </div>
    </>
  );
}