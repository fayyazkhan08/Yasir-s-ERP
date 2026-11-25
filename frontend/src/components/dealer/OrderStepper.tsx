import { DealerOrderStatus } from '../../types';
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '../../constants/units';

/** Horizontal progress through Placed → … → Delivered. Cancelled orders show a single badge instead. */
export function OrderStepper({ status }: { status: DealerOrderStatus }) {
  if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
  const current = ORDER_FLOW.indexOf(status);
  return (
    <div className="stepper" aria-label={`Stage: ${ORDER_STATUS_LABEL[status]}`}>
      {ORDER_FLOW.map((s, i) => (
        <div key={s} className={`step ${i < current ? 'done' : i === current ? 'current' : ''}`}>
          <span className="step-dot" />
          <span className="step-label">{ORDER_STATUS_LABEL[s]}</span>
        </div>
      ))}
    </div>
  );
}