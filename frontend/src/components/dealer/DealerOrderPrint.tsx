import { useEffect, useState } from 'react';
import { PrintOverlay } from '../common/PrintOverlay';
import { api, apiErrorMessage } from '../../api/client';
import { DealerOrder } from '../../types';
import { ORDER_STATUS_LABEL } from '../../constants/units';
import { formatDate, formatMoney, formatQty } from '../../utils/format';

interface Props {
  orderId: number;
  autoPrint?: boolean;
  onClose: () => void;
}

const NO_PRICE = '--';

/** Printable dealer order invoice. Items without a price show "--" for price and amount. */
export function DealerOrderPrint({ orderId, autoPrint, onClose }: Props) {
  const [order, setOrder] = useState<DealerOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/dealer-orders/${orderId}`)
      .then((res) => setOrder(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [orderId]);

  if (error) {
    return <PrintOverlay title="Dealer order" onClose={onClose}><p className="text-danger">{error}</p></PrintOverlay>;
  }
  if (!order) {
    return <PrintOverlay title="Preparing…" onClose={onClose}><div className="flex items-center gap-2"><span className="spinner" /> Loading order…</div></PrintOverlay>;
  }

  const items = order.items || [];
  const priced = items.filter((i) => i.unit_price !== null && i.unit_price !== undefined);
  const total = priced.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const co = order.company;

  return (
    <PrintOverlay title={`Dealer Order ${order.order_no}`} onClose={onClose} autoPrint={autoPrint}>
      <div className="ps-head">
        <div>
          <h1>{co?.name}</h1>
          {co?.address && <div className="ps-muted">{co.address}</div>}
          {co?.gstin && <div className="ps-muted">GSTIN: {co.gstin}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2>DEALER ORDER</h2>
          <div className="mono">{order.order_no}</div>
          <div className="ps-muted">Status: {ORDER_STATUS_LABEL[order.status]}</div>
        </div>
      </div>

      <div className="ps-meta">
        <div>
          <div className="ps-label">Dealer</div>
          <div style={{ fontWeight: 700 }}>{order.dealer_name}</div>
          {order.dealer_mobile && <div>{order.dealer_mobile}</div>}
          {order.dealer_address && <div className="ps-muted">{order.dealer_address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span className="ps-label">Order date: </span>{formatDate(order.order_date)}</div>
          <div><span className="ps-label">Delivery date: </span>{formatDate(order.delivery_date)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 26 }}>#</th>
            <th>Product</th>
            <th className="r">Qty</th>
            <th className="r">Price</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const has = it.unit_price !== null && it.unit_price !== undefined;
            return (
              <tr key={it.id ?? i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{it.product}</td>
                <td className="r mono">{formatQty(it.quantity)}{it.unit ? ` ${it.unit}` : ''}</td>
                <td className="r mono">{has ? Number(it.unit_price).toFixed(2) : NO_PRICE}</td>
                <td className="r mono">{has ? (Number(it.quantity) * Number(it.unit_price)).toFixed(2) : NO_PRICE}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ps-totals">
        <div className="grand">
          <span>Total</span>
          <span className="mono">{priced.length ? formatMoney(total) : NO_PRICE}</span>
        </div>
        {priced.length > 0 && priced.length < items.length && (
          <div className="ps-muted" style={{ fontSize: 10.5 }}><span>Priced items only</span></div>
        )}
      </div>

      {order.notes && (
        <div style={{ marginTop: 14 }}>
          <div className="ps-label">Notes</div>
          <div>{order.notes}</div>
        </div>
      )}
      <div className="ps-foot">This is a system-generated order slip.</div>
    </PrintOverlay>
  );
}