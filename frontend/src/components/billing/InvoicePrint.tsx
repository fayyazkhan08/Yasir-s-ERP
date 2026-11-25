import { useEffect, useState } from 'react';
import { PrintOverlay } from '../common/PrintOverlay';
import { api, apiErrorMessage } from '../../api/client';
import { Invoice } from '../../types';
import { formatDate, formatMoney, formatQty } from '../../utils/format';

interface InvoicePrintProps {
  invoiceId: number;
  autoPrint?: boolean;
  onClose: () => void;
}

/** Loads one invoice and shows it as a printable A4 sheet (optionally opening the print dialog straight away). */
export function InvoicePrint({ invoiceId, autoPrint, onClose }: InvoicePrintProps) {
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/invoices/${invoiceId}`)
      .then((res) => setInv(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [invoiceId]);

  if (error) {
    return (
      <PrintOverlay title="Print invoice" onClose={onClose}>
        <p className="text-danger">{error}</p>
      </PrintOverlay>
    );
  }
  if (!inv) {
    return (
      <PrintOverlay title="Preparing invoice…" onClose={onClose}>
        <div className="flex items-center gap-2"><span className="spinner" /> Loading invoice…</div>
      </PrintOverlay>
    );
  }

  const isGst = inv.invoice_type === 'gst';
  const co = inv.company;
  const items = inv.items || [];

  return (
    <PrintOverlay title={`Invoice ${inv.invoice_no}`} onClose={onClose} autoPrint={autoPrint}>
      <div className="ps-head">
        <div>
          <h1>{co?.name}</h1>
          {co?.address && <div className="ps-muted">{co.address}</div>}
          {isGst && co?.gstin && <div className="ps-muted">GSTIN: {co.gstin}{co.state ? ` · State: ${co.state}` : ''}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2>{isGst ? 'TAX INVOICE' : 'INVOICE'}</h2>
          <div className="mono">{inv.invoice_no}</div>
          <div className="ps-muted">Date: {formatDate(inv.invoice_date)}</div>
          <div className="ps-muted">Status: {inv.status.replace(/_/g, ' ').toUpperCase()}</div>
        </div>
      </div>

      <div className="ps-meta">
        <div>
          <div className="ps-label">Bill to</div>
          <div style={{ fontWeight: 700 }}>{inv.customer_name}</div>
          <div>{inv.customer_mobile}</div>
          {inv.customer_email && <div>{inv.customer_email}</div>}
          {inv.customer_gstin && <div>GSTIN: {inv.customer_gstin}</div>}
          {inv.customer_address && <div className="ps-muted">{inv.customer_address}</div>}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 26 }}>#</th>
            <th>Description</th>
            {isGst && <th>HSN</th>}
            <th className="r">Qty</th>
            <th className="r">Price</th>
            {isGst && <th className="r">GST</th>}
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id ?? i}>
              <td>{i + 1}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{it.description}</div>
                {it.comment && <div className="ps-comment">{it.comment}</div>}
              </td>
              {isGst && <td>{it.hsn_code || '—'}</td>}
              <td className="r mono">{formatQty(it.quantity)}{it.unit ? ` ${it.unit}` : ''}</td>
              <td className="r mono">{Number(it.unit_price).toFixed(2)}</td>
              {isGst && <td className="r mono">{Number(it.gst_rate || 0)}%</td>}
              <td className="r mono">{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ps-totals">
        <div><span>Subtotal</span><span className="mono">{formatMoney(inv.subtotal)}</span></div>
        {isGst && Number(inv.cgst_amount) > 0 && <div><span>CGST</span><span className="mono">{formatMoney(inv.cgst_amount)}</span></div>}
        {isGst && Number(inv.sgst_amount) > 0 && <div><span>SGST</span><span className="mono">{formatMoney(inv.sgst_amount)}</span></div>}
        {isGst && Number(inv.igst_amount) > 0 && <div><span>IGST</span><span className="mono">{formatMoney(inv.igst_amount)}</span></div>}
        {Number(inv.discount_amount) > 0 && <div><span>Discount</span><span className="mono">−{formatMoney(inv.discount_amount)}</span></div>}
        {Number(inv.reward_applied) > 0 && <div><span>Referral Reward</span><span className="mono">−{formatMoney(inv.reward_applied)}</span></div>}
        <div className="grand"><span>Total</span><span className="mono">{formatMoney(inv.total_amount)}</span></div>
      </div>

      <div className="ps-foot">This is a system-generated invoice.</div>
    </PrintOverlay>
  );
}