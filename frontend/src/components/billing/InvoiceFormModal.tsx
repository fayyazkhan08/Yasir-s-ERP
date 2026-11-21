import { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { CustomerSelect } from './CustomerSelect';
import { api, apiErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Customer, InvoiceItem } from '../../types';

interface InvoiceFormModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface Reward { id: number; reward_amount: number; reward_valid_until: string; }

const EMPTY_ITEM: InvoiceItem = { description: '', quantity: 1, unit_price: 0, gst_rate: 18 };

export function InvoiceFormModal({ onClose, onCreated }: InvoiceFormModalProps) {
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoiceType, setInvoiceType] = useState<'gst' | 'non_gst'>('non_gst');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<InvoiceItem[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customer) { setRewards([]); setSelectedReward(null); return; }
    api.get('/referrals/rewards/available', { params: { customer_id: customer.id } })
      .then((res) => setRewards(res.data.data))
      .catch(() => setRewards([]));
  }, [customer]);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // Live client-side calculation mirroring backend logic (backend always recomputes authoritatively)
  const rewardAmount = selectedReward ? selectedReward.reward_amount : 0;
  let subtotal = 0, cgst = 0, sgst = 0;
  items.forEach((it) => {
    const base = Number(it.quantity || 0) * Number(it.unit_price || 0);
    subtotal += base;
    if (invoiceType === 'gst') {
      const gstAmt = (base * Number(it.gst_rate || 0)) / 100;
      cgst += gstAmt / 2;
      sgst += gstAmt / 2;
    }
  });
  const total = Math.max(0, subtotal + cgst + sgst - Number(discount || 0) - rewardAmount);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!customer) e.customer = 'Please select a customer';
    if (items.some((it) => !it.description.trim() || Number(it.quantity) <= 0 || Number(it.unit_price) < 0)) {
      e.items = 'Every line item needs a description, quantity > 0, and a valid price';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/invoices', {
        customer_id: customer!.id,
        invoice_type: invoiceType,
        invoice_date: invoiceDate,
        items,
        discount_amount: discount,
        reward_applied: rewardAmount,
        referral_id: selectedReward?.id,
      });
      showToast('Invoice created successfully', 'success');
      onCreated();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Invoice"
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="spinner" /> : `Create Invoice — ₹${total.toFixed(2)}`}
          </button>
        </>
      }
    >
      <CustomerSelect value={customer} onChange={setCustomer} error={errors.customer} />

      <div className="form-grid-2">
        <div className="field">
          <label>Invoice Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn ${invoiceType === 'non_gst' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setInvoiceType('non_gst')}
            >
              Without GST
            </button>
            <button
              type="button"
              className={`btn ${invoiceType === 'gst' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setInvoiceType('gst')}
            >
              With GST
            </button>
          </div>
        </div>
        <div className="field">
          <label>Invoice Date</label>
          <input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Line Items</label>
        <div className="flex-col gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
              <input
                className="input" placeholder="Description" style={{ flex: 2, minWidth: 140 }}
                value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })}
              />
              <input
                className="input" type="number" min={0} placeholder="Qty" style={{ width: 70 }}
                value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
              />
              <input
                className="input" type="number" min={0} placeholder="Price" style={{ width: 90 }}
                value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
              />
              {invoiceType === 'gst' && (
                <select
                  className="select" style={{ width: 90 }}
                  value={item.gst_rate} onChange={(e) => updateItem(idx, { gst_rate: Number(e.target.value) })}
                >
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              )}
              <button type="button" className="btn btn-ghost btn-icon text-danger" onClick={() => removeItem(idx)} disabled={items.length === 1}>✕</button>
            </div>
          ))}
        </div>
        {errors.items && <span className="field-error">{errors.items}</span>}
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={addItem}>+ Add Line Item</button>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label>Discount Amount</label>
          <input className="input" type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Referral Reward</label>
          {rewards.length === 0 ? (
            <input className="input" disabled placeholder="No active rewards for this customer" />
          ) : (
            <select
              className="select"
              value={selectedReward?.id || ''}
              onChange={(e) => setSelectedReward(rewards.find((r) => r.id === Number(e.target.value)) || null)}
            >
              <option value="">Don't apply reward</option>
              {rewards.map((r) => (
                <option key={r.id} value={r.id}>₹{r.reward_amount} — valid till {new Date(r.reward_valid_until).toLocaleDateString('en-IN')}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ background: 'var(--surface-sunken)' }}>
        <div className="flex justify-between" style={{ fontSize: 13 }}><span>Subtotal</span><span className="mono">₹{subtotal.toFixed(2)}</span></div>
        {invoiceType === 'gst' && (
          <>
            <div className="flex justify-between" style={{ fontSize: 13 }}><span>CGST</span><span className="mono">₹{cgst.toFixed(2)}</span></div>
            <div className="flex justify-between" style={{ fontSize: 13 }}><span>SGST</span><span className="mono">₹{sgst.toFixed(2)}</span></div>
          </>
        )}
        {discount > 0 && <div className="flex justify-between" style={{ fontSize: 13 }}><span>Discount</span><span className="mono">−₹{Number(discount).toFixed(2)}</span></div>}
        {rewardAmount > 0 && <div className="flex justify-between" style={{ fontSize: 13 }}><span>Referral Reward</span><span className="mono">−₹{rewardAmount.toFixed(2)}</span></div>}
        <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <span>Total</span><span className="mono">₹{total.toFixed(2)}</span>
        </div>
      </div>
    </Modal>
  );
}
