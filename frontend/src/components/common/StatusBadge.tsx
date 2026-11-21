interface StatusBadgeProps {
  status: string;
  map?: Record<string, 'success' | 'danger' | 'accent' | 'info' | 'neutral' | 'primary'>;
}

const DEFAULT_MAP: Record<string, 'success' | 'danger' | 'accent' | 'info' | 'neutral' | 'primary'> = {
  active: 'success',
  paid: 'success',
  successful: 'success',
  received: 'success',
  issued: 'success',
  unpaid: 'accent',
  pending: 'accent',
  partially_paid: 'accent',
  low_stock: 'accent',
  inactive: 'neutral',
  discontinued: 'neutral',
  cancelled: 'danger',
  expired: 'danger',
  rejected: 'danger',
  used: 'info',
  draft: 'neutral',
  not_issued: 'neutral',
};

export function StatusBadge({ status, map = DEFAULT_MAP }: StatusBadgeProps) {
  const tone = map[status] || 'neutral';
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
