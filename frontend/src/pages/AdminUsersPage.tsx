import { useEffect, useState } from 'react';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { PasswordField } from '../components/common/PasswordField';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { api, apiErrorMessage } from '../api/client';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
}

interface CreateForm { name: string; email: string; password: string; role: 'admin' | 'user'; }
const EMPTY_FORM: CreateForm = { name: '', email: '', password: '', role: 'user' };

export function AdminUsersPage() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/auth/users')
      .then((res) => setUsers(res.data.data))
      .catch((err) => showToast(apiErrorMessage(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      e.password = 'At least 8 characters, with a letter and a number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/auth/users', form);
      showToast('User account created', 'success');
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = async (u: AdminUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await api.patch(`/auth/users/${u.id}/role`, { role: newRole });
      showToast(`${u.name} is now ${newRole === 'admin' ? 'an Admin' : 'a User'}`, 'success');
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/auth/users/${u.id}/status`, { status: newStatus });
      showToast(`${u.name} is now ${newStatus}`, 'success');
      load();
    } catch (err) {
      showToast(apiErrorMessage(err), 'error');
    }
  };

  const columns: Column<AdminUser>[] = [
    { key: 'name', header: 'User', render: (u) => (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center"
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}
        >
          {u.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{u.name} {u.id === currentUser?.id && <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>(you)</span>}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>{u.email}</div>
        </div>
      </div>
    ) },
    { key: 'role', header: 'Role', render: (u) => <span className={`role-badge ${u.role}`}>{u.role}</span> },
    { key: 'status', header: 'Status', render: (u) => (
      <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-neutral'}`}><span className="badge-dot" />{u.status}</span>
    ) },
    { key: 'last_login_at', header: 'Last Login', render: (u) => u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : <span className="text-muted">Never</span> },
    { key: 'actions', header: '', align: 'right', render: (u) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" disabled={u.id === currentUser?.id} onClick={() => toggleRole(u)}>
          Make {u.role === 'admin' ? 'User' : 'Admin'}
        </button>
        <button className="btn btn-ghost btn-sm text-danger" disabled={u.id === currentUser?.id} onClick={() => toggleStatus(u)}>
          {u.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    ) },
  ];

  return (
    <div className="card">
      <div className="table-toolbar">
        <div>
          <h3>Team Accounts</h3>
          <p className="text-muted" style={{ fontSize: 12.5 }}>Manage who has access and what they can do.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New Account</button>
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        emptyIcon="👤"
        emptyTitle="No team accounts"
        emptyMessage="Create the first account for your team."
      />

      {modalOpen && (
        <Modal
          title="New Team Account"
          onClose={() => setModalOpen(false)}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Create Account'}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Full Name</label>
            <input className={`input ${errors.name ? 'has-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" className={`input ${errors.email ? 'has-error' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <PasswordField
            label="Temporary Password" value={form.password} error={errors.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} showStrength
          />
          <div className="field">
            <label>Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}>
              <option value="user">User — standard access</option>
              <option value="admin">Admin — full access + team management</option>
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
