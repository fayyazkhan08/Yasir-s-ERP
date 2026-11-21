export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  mobile: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  referred_by?: number | null;
  referred_by_name?: string;
  status: 'active' | 'inactive';
  notes?: string;
  invoice_count?: number;
  subscription_status?: string;
  created_at: string;
}

export interface InvoiceItem {
  id?: number;
  item_id?: number | null;
  description: string;
  hsn_code?: string;
  quantity: number;
  unit_price: number;
  gst_rate?: number;
  line_total?: number;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  customer_id: number;
  customer_name?: string;
  customer_mobile?: string;
  invoice_type: 'gst' | 'non_gst';
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  reward_applied: number;
  total_amount: number;
  status: 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'cancelled';
  payment_mode?: string;
  notes?: string;
  items?: InvoiceItem[];
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  tier_level: number;
  price: number;
  duration_days: number;
  benefits: string;
}

export interface CustomerSubscription {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_mobile?: string;
  plan_id: number;
  plan_name?: string;
  benefits?: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  auto_renew: boolean;
  days_remaining?: number;
}

export interface Referral {
  id: number;
  referrer_id: number;
  referrer_name?: string;
  referrer_mobile?: string;
  referred_id: number;
  referred_name?: string;
  referred_mobile?: string;
  status: 'pending' | 'successful' | 'rejected';
  reward_amount: number;
  reward_valid_until?: string;
  reward_status: 'not_issued' | 'issued' | 'used' | 'expired';
  days_until_expiry?: number;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  category: 'raw_material' | 'finished_product' | 'packaging' | 'other';
  unit: string;
  current_stock: number;
  reorder_level: number;
  unit_price: number;
  supplier_id?: number;
  supplier_name?: string;
  is_low_stock?: number;
  status: 'active' | 'discontinued';
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
}

export interface Purchase {
  id: number;
  purchase_no: string;
  supplier_id: number;
  supplier_name?: string;
  purchase_date: string;
  total_amount: number;
  status: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface DashboardSummary {
  customers: { total: number; active: number };
  invoices_30d: { total: number; revenue: number; unpaid: number; paid: number };
  active_subscriptions: number;
  low_stock_count: number;
  referrals: { active_rewards: number; total: number };
  purchases_30d: number;
  revenue_trend: { date: string; revenue: number }[];
  expiring_subscriptions: { id: number; customer_name: string; plan_name: string; end_date: string; days_remaining: number }[];
}
