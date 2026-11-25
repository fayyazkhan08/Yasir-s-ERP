import { FormEvent, useEffect, useState } from 'react';
import { portalApi } from '../../api/portalClient';
import { apiErrorMessage } from '../../api/client';
import { usePortalAuth } from '../../context/PortalAuthContext';
import { useToast } from '../../context/ToastContext';
import { PasswordField } from '../../components/common/PasswordField';
import { PortalProfile } from '../../types/portal';
import { formatDate, formatDateTime } from '../../utils/portalFormat';

export function PortalProfilePage() {
  const { user, passwordChanged } = usePortalAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApi.get('/me').then((res) => setProfile(res.data.data)).catch((err) => showToast(apiErrorMessage(err), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forced = !!user?.must_change_password;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!current) e.current = 'Enter your current password';
    if (next.length < 8) e.next = 'Must be at least 8 characters';
    else if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) e.next = 'Must include a letter and a number';
    if (confirm !== next) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const res = await portalApi.post('/change-password', { current_password: current, new_password: next });
      passwordChanged(res.data.data.token);
      setCurrent(''); setNext(''); setConfirm('');
      showToast('Password updated', 'success');
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addr = profile ? [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') : '';

  return (
    <>
      {forced && (
        <div className="banner"><span>🔒</span><span><strong>Set your own password to continue.</strong> You signed in with a temporary password issued by our team. Choose a new one below to unlock your portal.</span></div>
      )}
      <div className="portal-two-col">
        <div className="card card-pad flex-col gap-4">
          <h3>My details</h3>
          {!profile ? <div className="skeleton" style={{ height: 160 }} /> : (
            <dl className="kv">
              <dt>Name</dt><dd>{profile.name}</dd>
              <dt>Customer ID</dt><dd className="mono">{profile.customer_code}</dd>
              <dt>Email</dt><dd>{profile.email}</dd>
              <dt>Mobile</dt><dd className="mono">{profile.mobile}</dd>
              <dt>Address</dt><dd>{addr || <span className="text-muted">Not provided</span>}</dd>
              <dt>Member since</dt><dd>{formatDate(profile.created_at)}</dd>
              <dt>Last sign-in</dt><dd>{formatDateTime(profile.last_login_at)}</dd>
            </dl>
          )}
          <p className="text-muted" style={{ fontSize: 12.5 }}>To change your name, mobile or address, please contact us.</p>
        </div>

        <form className="card card-pad flex-col gap-4" onSubmit={submit} noValidate>
          <h3>Change password</h3>
          <PasswordField label="Current password" value={current} error={errors.current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
          <PasswordField label="New password" value={next} error={errors.next} autoComplete="new-password" showStrength onChange={(e) => setNext(e.target.value)} />
          <PasswordField label="Confirm new password" value={confirm} error={errors.confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>{saving ? <span className="spinner" /> : 'Update password'}</button>
        </form>
      </div>
    </>
  );
}