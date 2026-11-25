export interface PortalProfile {
  customer_id: number;
  customer_code: string;
  name: string;
  mobile: string;
  email: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  created_at: string;
  last_login_at?: string | null;
  must_change_password: boolean;
  referral_code: string;
  config: { commission_percent: number; min_withdrawal: number };
}

export interface PortalSessionUser {
  customer_id: number;
  customer_code: string;
  name: string;
  email: string;
  must_change_password: boolean;
}

export interface WalletSummary {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawals: number;
}

export interface PortalSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  tier_level: number;
  price: number;
  duration_days: number;
  benefits: string | null;
  start_date: string;
  end_date: string;
  auto_renew: number | boolean;
  status: 'active' | 'expired' | 'cancelled';
  days_remaining: number;
}

export interface WalletTransaction {
  id: number;
  type: 'commission' | 'withdrawal' | 'withdrawal_refund';
  direction: 'credit' | 'debit';
  amount: number;
  description: string | null;
  created_at: string;
}

export interface PortalDashboard {
  referral_code: string;
  wallet: WalletSummary;
  subscription: PortalSubscription | null;
  referrals: { total: number; successful: number; with_active_subscription: number };
  income_trend: { month: string; income: number }[];
  recent_transactions: WalletTransaction[];
  config: { commission_percent: number; min_withdrawal: number };
}

export interface ReferredUser {
  id: number;
  referred_name: string;
  referred_mobile: string;
  status: 'pending' | 'successful' | 'rejected';
  reward_amount: number;
  reward_status: 'not_issued' | 'issued' | 'used' | 'expired';
  reward_valid_until: string | null;
  created_at: string;
  plan_name: string | null;
  subscription_status: string | null;
  commission_earned: number;
}

export interface Commission {
  id: number;
  created_at: string;
  base_amount: number;
  rate_percent: number;
  amount: number;
  referred_name: string;
  plan_name: string;
  start_date: string;
  end_date: string;
}

export interface Withdrawal {
  id: number;
  amount: number;
  payout_method: 'upi' | 'bank_transfer';
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  payout_reference: string | null;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface AdminWithdrawal extends Withdrawal {
  customer_id: number;
  customer_code: string;
  customer_name: string;
  customer_mobile: string;
  processed_by_name: string | null;
}

export interface AdminPortalAccountRow {
  id: number;
  customer_code: string;
  name: string;
  mobile: string;
  customer_email: string | null;
  customer_status: 'active' | 'inactive';
  account_id: number | null;
  login_email: string | null;
  login_status: 'active' | 'inactive' | null;
  last_login_at: string | null;
  must_change_password: number | null;
}