import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? <span className="spinner" /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <div
          className="confirm-icon"
          style={{
            background: danger ? 'var(--danger-100)' : 'var(--primary-100)',
            color: danger ? 'var(--danger-600)' : 'var(--primary-700)',
          }}
        >
          {danger ? '⚠' : 'ℹ'}
        </div>
        <p className="text-secondary">{message}</p>
      </div>
    </Modal>
  );
}
