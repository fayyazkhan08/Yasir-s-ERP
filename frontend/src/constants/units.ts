/** Units offered in the Billing and Dealer Order line items. Anything else can be typed manually. */
export const UNIT_OPTIONS = ['Liters', 'KGS', 'NOS', 'PCS', 'SQ FT.', 'QTY'] as const;

export type OrderStatus = 'placed' | 'confirmed' | 'in_production' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';

/** The normal journey of a dealer order, in order. 'cancelled' sits outside it. */
export const ORDER_FLOW: OrderStatus[] = ['placed', 'confirmed', 'in_production', 'ready', 'dispatched', 'delivered'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  ready: 'Ready',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};