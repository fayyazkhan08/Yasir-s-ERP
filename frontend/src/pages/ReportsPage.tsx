import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

interface ReportConfig {
  key: string;
  label: string;
  icon: string;
  description: string;
  filters: { key: string; label: string; type: 'select' | 'date'; options?: { value: string; label: string }[] }[];
}

const REPORTS: ReportConfig[] = [
  {
    key: 'customers', label: 'Customers', icon: '◈',
    description: 'Full customer directory with contact and GST details.',
    filters: [{ key: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }],
  },
  {
    key: 'invoices', label: 'Billing & Invoices', icon: '🧾',
    description: 'All invoices with tax breakdown, discounts, and totals.',
    filters: [
      { key: 'invoice_type', label: 'Type', type: 'select', options: [{ value: '', label: 'All' }, { value: 'gst', label: 'GST' }, { value: 'non_gst', label: 'Non-GST' }] },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'cancelled', label: 'Cancelled' }] },
      { key: 'from_date', label: 'From', type: 'date' },
      { key: 'to_date', label: 'To', type: 'date' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: '▤',
    description: 'Current stock levels, reorder points, and valuations.',
    filters: [{ key: 'lowStockOnly', label: 'Low stock only', type: 'select', options: [{ value: '', label: 'All items' }, { value: 'true', label: 'Low stock only' }] }],
  },
  {
    key: 'purchases', label: 'Purchase History', icon: '⇩',
    description: 'Inward stock purchases by supplier and date range.',
    filters: [
      { key: 'from_date', label: 'From', type: 'date' },
      { key: 'to_date', label: 'To', type: 'date' },
    ],
  },
  {
    key: 'subscriptions', label: 'Subscriptions', icon: '★',
    description: 'Customer subscription plans, validity, and status.',
    filters: [{ key: 'status', label: 'Status', type: 'select', options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'cancelled', label: 'Cancelled' }] }],
  },
  {
    key: 'referrals', label: 'Referrals & Rewards', icon: '⇄',
    description: 'Referral history and reward usage tracking.',
    filters: [{ key: 'reward_status', label: 'Reward Status', type: 'select', options: [{ value: '', label: 'All' }, { value: 'issued', label: 'Issued' }, { value: 'used', label: 'Used' }, { value: 'expired', label: 'Expired' }] }],
  },
];

export function ReportsPage() {
  const { showToast } = useToast();
  const [filterState, setFilterState] = useState<Record<string, Record<string, string>>>({});
  const [exporting, setExporting] = useState<string | null>(null);

  const setFilter = (reportKey: string, filterKey: string, value: string) => {
    setFilterState((prev) => ({ ...prev, [reportKey]: { ...prev[reportKey], [filterKey]: value } }));
  };

  const handleExport = async (report: ReportConfig) => {
    setExporting(report.key);
    try {
      const params = filterState[report.key] || {};
      const res = await api.get(`/reports/export/${report.key}`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.key}-report.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      showToast(`${report.label} report exported`, 'success');
    } catch {
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
      {REPORTS.map((report) => (
        <div key={report.key} className="card card-pad flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-100)', color: 'var(--primary-700)', fontSize: 18 }}
            >
              {report.icon}
            </div>
            <div>
              <h3>{report.label}</h3>
              <p className="text-muted" style={{ fontSize: 12.5 }}>{report.description}</p>
            </div>
          </div>

          {report.filters.length > 0 && (
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {report.filters.map((f) => (
                f.type === 'select' ? (
                  <select
                    key={f.key} className="select" style={{ width: 150 }}
                    value={filterState[report.key]?.[f.key] || ''}
                    onChange={(e) => setFilter(report.key, f.key, e.target.value)}
                  >
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    key={f.key} type="date" className="input" style={{ width: 150 }}
                    value={filterState[report.key]?.[f.key] || ''}
                    onChange={(e) => setFilter(report.key, f.key, e.target.value)}
                    placeholder={f.label}
                  />
                )
              ))}
            </div>
          )}

          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => handleExport(report)} disabled={exporting === report.key}>
            {exporting === report.key ? <span className="spinner" /> : '⬇ Export to Excel'}
          </button>
        </div>
      ))}
    </div>
  );
}
