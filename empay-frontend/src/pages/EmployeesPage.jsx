import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { sendCredentialsEmail } from '../utils/emailService';
import toast from 'react-hot-toast';

const getInitials = (f, l) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase();
const getColor = (name) => {
  const c = ['#1e3a8a', '#1d4ed8', '#059669', '#7c3aed', '#d97706', '#0369a1', '#dc2626'];
  let h = 0; for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h);
  return c[Math.abs(h) % c.length];
};

// Status indicator — exactly as per mockup
function StatusDot({ emp }) {
  if (emp.on_leave_today) {
    return (
      <span title="On Leave" style={{
        position: 'absolute', top: 12, right: 12, fontSize: 16, lineHeight: 1,
      }}>✈️</span>
    );
  }
  if (emp.last_event_type === 'check_in') {
    return (
      <span title="Present (Checked In)" style={{
        position: 'absolute', top: 14, right: 14, width: 12, height: 12, borderRadius: '50%',
        background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #fff, 0 0 0 3px #22c55e',
      }} />
    );
  }
  // Absent/Away (yellow)
  return (
    <span title={emp.last_event_type === 'check_out' ? "Away (Checked Out)" : "Absent"} style={{
      position: 'absolute', top: 14, right: 14, width: 12, height: 12, borderRadius: '50%',
      background: '#eab308', display: 'inline-block', boxShadow: '0 0 0 2px #fff, 0 0 0 3px #eab308',
    }} />
  );
}

function EmployeeModal({ employee, onClose, onSave }) {
  const isNew = !employee?.id;
  const [form, setForm] = useState(employee || {
    email: '', role: 'employee', first_name: '', last_name: '', department: '', designation: '',
    date_of_joining: '', phone: '', address: '', pan_number: '', uan_number: '', bank_account: '',
    bank_name: '', ifsc_code: '', uam_id: '', wage: 0, location: '',
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null); // holds {employee_code, email, temp_password}
  const [emailSending, setEmailSending] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const DEPTS = ['Engineering', 'Marketing', 'Finance', 'Human Resources', 'Sales', 'Design', 'Operations', 'Legal'];
  const ROLES = [['employee', 'Employee'], ['hr_officer', 'HR Officer'], ['payroll_officer', 'Payroll Officer'], ['admin', 'Admin']];

  const save = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isNew) {
        const r = await api.post('/employees', form);
        toast.success('Employee created!');
        setCreated(r.data);
      } else {
        await api.put(`/employees/${employee.id}`, form);
        toast.success('Updated!'); onSave();
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const sendMail = async () => {
    if (!created) return;
    setEmailSending(true);
    const result = await sendCredentialsEmail({
      toName: `${form.first_name} ${form.last_name}`,
      toEmail: created.email,
      loginId: created.login_id || created.employee_code,
      password: created.temp_password,
    });
    if (result.success) toast.success('Credentials email sent!');
    else if (result.reason === 'not_configured') toast.error('Configure EmailJS in .env to send emails');
    else toast.error('Email failed: ' + result.reason);
    setEmailSending(false);
  };

  if (created) return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header"><span className="modal-title">✅ Employee Created</span></div>
        <div className="modal-body">
          <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>Account Credentials</div>
            {[['Name', `${form.first_name} ${form.last_name}`], ['Login ID', created.login_id || created.employee_code], ['Email', created.email], ['Temp Password', created.temp_password]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)', minWidth: 100 }}>{k}</span>
                <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{v}</strong>
              </div>
            ))}
          </div>
          <div className="alert-info" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Make sure to share these credentials with the employee. Click "Send Mail" to email them directly.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={sendMail} disabled={emailSending}>
            {emailSending ? 'Sending...' : '📧 Send Credentials Email'}
          </button>
          <button className="btn btn-secondary" onClick={() => { onSave(); onClose(); }}>Done</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{isNew ? '+ New Employee' : 'Edit Employee'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Personal Information</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">First Name*</label><input className="form-control" value={form.first_name} onChange={e => f('first_name', e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Last Name*</label><input className="form-control" value={form.last_name} onChange={e => f('last_name', e.target.value)} required /></div>
            </div>
            {isNew && (
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email*</label><input className="form-control" type="email" value={form.email} onChange={e => f('email', e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={e => f('role', e.target.value)}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label className="form-label">Department</label>
                <select className="form-control" value={form.department} onChange={e => f('department', e.target.value)}>
                  <option value="">Select...</option>
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Designation</label><input className="form-control" value={form.designation || ''} onChange={e => f('designation', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Date of Joining</label><input className="form-control" type="date" value={form.date_of_joining || ''} onChange={e => f('date_of_joining', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone || ''} onChange={e => f('phone', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" value={form.address || ''} onChange={e => f('address', e.target.value)} rows={2} /></div>
            <hr className="divider" />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Financial</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monthly Wage (₹) — all components auto-calculated</label>
                <input className="form-control" type="number" value={form.wage || ''} onChange={e => f('wage', e.target.value)} placeholder="e.g. 50000" />
              </div>
              <div className="form-group"><label className="form-label">PAN Number</label><input className="form-control" value={form.pan_number || ''} onChange={e => f('pan_number', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Bank Account</label><input className="form-control" value={form.bank_account || ''} onChange={e => f('bank_account', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Bank Name</label><input className="form-control" value={form.bank_name || ''} onChange={e => f('bank_name', e.target.value)} /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isNew ? 'Create Employee' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [modal, setModal] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  const load = () => {
    setLoading(true);
    api.get('/employees').then(r => setEmployees(Array.isArray(r) ? r : r || [])).catch(() => { }).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // Real-time: refresh every 30s so status dots update when employees check in/out
    const interval = setInterval(() => {
      api.get('/employees').then(r => setEmployees(Array.isArray(r) ? r : r || [])).catch(() => { });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (!q || `${e.first_name} ${e.last_name} ${e.employee_code} ${e.email}`.toLowerCase().includes(q)) &&
      (!dept || e.department === dept);
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try { await api.delete(`/employees/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Employees</h1><p>{employees.length} total employees</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            {can('admin', 'hr_officer') && <button className="btn btn-primary" onClick={() => setModal('new')}>+ New Employee</button>}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <span className="icon">🔍</span>
          <input className="form-control" placeholder="Search name, code, email..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36, width: 260 }} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>☰</button>
        </div>
      </div>

      {loading ? <div className="page-loader" style={{ height: 300, background: 'transparent' }}><div className="spinner" /></div>
        : filtered.length === 0 ? <div className="empty-state"><div className="icon">👥</div><h3>No employees found</h3></div>
          : viewMode === 'grid' ? (
            <div className="emp-grid">
              {filtered.map(emp => {
                const color = getColor(`${emp.first_name} ${emp.last_name}`);
                return (
                  <div key={emp.id} className="emp-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate(`/employees/${emp.id}`)}>
                    <StatusDot emp={emp} />
                    <div className="emp-card-top">
                      <div
                        className="avatar avatar-lg"
                        style={emp.profile_image
                          ? { backgroundImage: `url(${emp.profile_image})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }
                          : { background: color, color: '#fff' }
                        }
                      >
                        {!emp.profile_image && getInitials(emp.first_name, emp.last_name)}
                      </div>
                      <div className="emp-info">
                        <h3>{emp.first_name} {emp.last_name}</h3>
                        <p>{emp.designation || 'No designation'}</p>
                        <div className="emp-code">{emp.employee_code}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                      <div>🏢 {emp.department || '—'}</div>
                      <div style={{ marginTop: 3 }}>📧 {emp.email}</div>
                    </div>
                    <div className="emp-card-footer">
                      <span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-default'}`}>{emp.status}</span>
                      {can('admin', 'hr_officer') && (
                        <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setModal(emp); }}>Edit</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Department</th><th>Email</th><th>Login ID</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map(emp => {
                      const color = getColor(`${emp.first_name} ${emp.last_name}`);
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ position: 'relative' }}>
                                <div
                                  className="avatar avatar-sm"
                                  style={emp.profile_image
                                    ? { backgroundImage: `url(${emp.profile_image})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }
                                    : { background: color, color: '#fff' }
                                  }
                                >
                                  {!emp.profile_image && getInitials(emp.first_name, emp.last_name)}
                                </div>
                                <span style={{position:'absolute',bottom:-2,right:-2,width:9,height:9,borderRadius:'50%',background:emp.on_leave_today?'#3b82f6':(emp.last_event_type==='check_in')?'#22c55e':'#eab308',border:'1.5px solid #fff'}}/>
                              </div>
                              <div><div style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</div><div style={{ fontSize: 11, color: 'var(--text-4)' }}>{emp.employee_code}</div></div>
                            </div>
                          </td>
                          <td>{emp.department || '—'}</td>
                          <td style={{ color: 'var(--text-3)' }}>{emp.email}</td>
                          <td><code style={{ fontSize: 11, background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{emp.login_id || emp.employee_code}</code></td>
                          <td><span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-default'}`}>{emp.status}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/employees/${emp.id}`)}>View</button>
                              {can('admin', 'hr_officer') && <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setModal(emp); }}>Edit</button>}
                              {can('admin') && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(emp.id)}>Del</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {modal && <EmployeeModal employee={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
    </div>
  );
}



