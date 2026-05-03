

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const STATUS_BADGE = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
const LEAVE_TYPES = ['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid'];

function ApplyModal({ onClose, onSave, balances }) {
  const [form, setForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
  const [docFile, setDocFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const getDuration = () => {
    if (!form.start_date || !form.end_date) return 0;
    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    const diffTime = Math.abs(e - s);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const duration = getDuration();
  const isSick = form.leave_type === 'sick';
  const isDocRequired = isSick && duration >= 4;

  const save = async (e) => {
    e.preventDefault();

    // Check balance (Frontend validation)
    if (form.leave_type !== 'unpaid') {
      const bal = (balances || []).find(b => b.leave_type === form.leave_type);
      if (!bal) {
        toast.error(`No ${form.leave_type} leave has been allocated for you.`);
        return;
      }
      const remaining = bal.total_allocated - bal.used;
      if (duration > remaining) {
        toast.error(`Insufficient balance. You only have ${remaining} days of ${form.leave_type} leave available.`);
        return;
      }
    }

    if (isDocRequired && !docFile) {
      toast.error('Supporting document is required for sick leave of 3 or more days');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('leave_type', form.leave_type);
      fd.append('start_date', form.start_date);
      fd.append('end_date', form.end_date);
      fd.append('reason', form.reason);
      if (docFile) fd.append('document', docFile);

      await api.post('/timeoff/apply', fd);
      toast.success('Leave request submitted!');
      onSave();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Apply for Time Off</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Leave Type</label>
              <select className="form-control" value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
                {LEAVE_TYPES.map(t => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-control" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-control" type="date" value={form.end_date} min={form.start_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
            </div>
            <div className="form-group"><label className="form-label">Reason</label><textarea className="form-control" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Briefly describe the reason..." required /></div>

            {/* Document upload */}
            <div className="form-group">
              <label className="form-label">
                Supporting Document
                {isDocRequired
                  ? <span style={{ color: 'var(--danger)', marginLeft: 4 }}>* (Required for Sick Leave ≥ 3 days)</span>
                  : <span style={{ color: 'var(--text-3)', marginLeft: 4, fontSize: 11 }}>{isSick ? '(Optional for < 4 days)' : '(Optional)'}</span>
                }
              </label>
              <div style={{
                border: `2px dashed ${isDocRequired && !docFile ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', padding: '14px 16px',
                background: 'var(--surface)', transition: 'border-color 0.2s',
              }}>
                <input
                  type="file"
                  id="timeoff-doc"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={e => setDocFile(e.target.files[0] || null)}
                />
                <label htmlFor="timeoff-doc" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>📎</span>
                  <div>
                    {docFile
                      ? <><div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}>✓ {docFile.name}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{(docFile.size / 1024).toFixed(1)} KB — click to change</div></>
                      : <><div style={{ fontWeight: 500, fontSize: 13 }}>Click to upload file</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>JPG, PNG, PDF, DOC — max 5 MB</div></>
                    }
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocateModal({ employees, onClose, onSave }) {
  const [form, setForm] = useState({ employee_id: '', leave_type: 'casual', total_allocated: 10, year: new Date().getFullYear() });
  const [loading, setLoading] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/timeoff/allocate', form); toast.success('Leave allocated!'); onSave(); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Allocate Leave</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Employee</label>
              <select className="form-control" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} required>
                <option value="">Select employee...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-control" value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Days Allocated</label><input className="form-control" type="number" min="1" max="60" value={form.total_allocated} onChange={e => setForm(p => ({ ...p, total_allocated: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Year</label><input className="form-control" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Allocating...' : 'Allocate Leave'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TimeOffPage() {
  const { can, user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [balances, setBalances] = useState([]);
  const [allBalances, setAllBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'balances'
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const ep = isEmployee ? '/timeoff/my' : '/timeoff';
      const promises = [api.get(ep)];

      if (isEmployee) {
        if (user.employee_id) promises.push(api.get('/timeoff/balances'));
      } else {
        promises.push(api.get('/timeoff/all-balances'));
        promises.push(api.get('/employees'));
      }

      const [reqs, bals, emps] = await Promise.all(promises);

      setRequests(Array.isArray(reqs) ? reqs : reqs?.data ?? []);
      if (isEmployee) {
        setBalances(Array.isArray(bals) ? bals : bals?.data ?? []);
      } else {
        setAllBalances(Array.isArray(bals) ? bals : bals?.data ?? []);
        if (emps) setEmployees(Array.isArray(emps) ? emps : emps?.data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api.put(`/timeoff/${id}/approve`, {}); toast.success('Approved'); load(); }
    catch (err) { toast.error(err.message); }
  };
  const reject = async (id) => {
    try { await api.put(`/timeoff/${id}/reject`, { rejection_reason: rejectReason }); toast.success('Rejected'); setRejectId(null); setRejectReason(''); load(); }
    catch (err) { toast.error(err.message); }
  };

  const statusFiltered = filter ? requests.filter(r => r.status === filter) : requests;
  const searchLower = search.toLowerCase().trim();
  const filtered = (!isEmployee && searchLower)
    ? statusFiltered.filter(r =>
      `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(searchLower) ||
      (r.employee_code || '').toLowerCase().includes(searchLower) ||
      (r.department || '').toLowerCase().includes(searchLower) ||
      (r.leave_type || '').toLowerCase().includes(searchLower)
    )
    : statusFiltered;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Time Off</h1><p>{isEmployee ? 'Apply and track your leave requests' : 'Manage employee time off requests'}</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isEmployee && <button className="btn btn-primary" onClick={() => setShowApply(true)}>+ Apply for Leave</button>}
            {can('admin', 'hr_officer') && <button className="btn btn-outline" onClick={() => setShowAllocate(true)}>📋 Allocate Leave</button>}
          </div>
        </div>
      </div>

      {/* Balance cards for employee */}
      {isEmployee && balances.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {balances.map(b => (
            <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px', minWidth: 130, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{b.total_allocated - b.used}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'capitalize', marginTop: 2 }}>{b.leave_type} Remaining</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>Used: {b.used}/{b.total_allocated}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs for Admin/HR to switch between requests and balances */}
      {!isEmployee && (
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Leave Requests</button>
          <button className={`tab ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>Organization Balances</button>
        </div>
      )}

      {/* Filters for Requests */}
      {activeTab === 'requests' && (
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="tabs">
            {['', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} className={`tab${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Search bar — admin/HR only */}
          {!isEmployee && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, width: 240 }}
                placeholder="Search name, code, dept, type..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14 }}
                >✕</button>
              )}
            </div>
          )}

          <span style={{ fontSize: 12, color: 'var(--text-3)', ...(isEmployee ? { marginLeft: 'auto' } : {}) }}>
            {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            {search && ` for "${search}"`}
          </span>
        </div>
      )}

      {/* Requests table */}
      {activeTab === 'requests' && (
        <div className="card">
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {!isEmployee && <th>Employee</th>}
                    <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Document</th>
                    {can('admin', 'payroll_officer', 'hr_officer') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No requests found{search ? ` for "${search}"` : ''}</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id}>
                      {!isEmployee && <td><div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize: 11, color: 'var(--text-4)' }}>{r.employee_code}</div></td>}
                      <td><span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{r.leave_type}</span></td>
                      <td>{fmtDate(r.start_date)}</td>
                      <td>{fmtDate(r.end_date)}</td>
                      <td style={{ fontWeight: 600 }}>{r.total_days}</td>
                      <td style={{ maxWidth: 180, color: 'var(--text-3)', fontSize: 12 }}>{r.reason}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-default'}`}>{r.status}</span></td>
                      <td>
                        {r.document_path
                          ? <a href={`http://localhost:5001/uploads/timeoff/${r.document_path}`} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none',
                              padding: '4px 10px', border: '1px solid var(--primary-light)', borderRadius: 99, background: 'var(--primary-xlight)'
                            }}>
                            📎 View Doc
                          </a>
                          : <span style={{ fontSize: 11, color: 'var(--text-4)' }}>—</span>
                        }
                      </td>
                      {can('admin', 'payroll_officer', 'hr_officer') && (
                        <td>
                          {r.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-success" onClick={() => approve(r.id)}>✓ Approve</button>
                              <button className="btn btn-sm btn-danger" onClick={() => setRejectId(r.id)}>✕ Reject</button>
                            </div>
                          )}
                          {r.status !== 'pending' && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Reviewed</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Organization Balances table (Admin/HR only) */}
      {activeTab === 'balances' && !isEmployee && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div className="card-title">Organization Leave Balances — {new Date().getFullYear()}</div>
              <button className="btn btn-sm btn-ghost" onClick={load}>🔄 Refresh</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Allocated</th>
                  <th>Used</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {allBalances.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No leave balances found. Use the 'Allocate Leave' button to get started.</td></tr>
                ) : allBalances.map(b => (
                  <tr key={b.id}>
                    <td><div style={{ fontWeight: 600 }}>{b.first_name} {b.last_name}</div><div style={{ fontSize: 11, color: 'var(--text-4)' }}>{b.employee_code}</div></td>
                    <td style={{ textTransform: 'capitalize' }}>{b.leave_type}</td>
                    <td style={{ fontWeight: 700 }}>{b.total_allocated}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{b.used}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15 }}>{b.total_allocated - b.used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRejectId(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Reject Leave Request</span><button className="modal-close" onClick={() => setRejectId(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Rejection Reason</label><textarea className="form-control" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Provide a reason (optional)..." /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => reject(rejectId)}>Reject Request</button>
            </div>
          </div>
        </div>
      )}

      {showApply && <ApplyModal onClose={() => setShowApply(false)} onSave={() => { setShowApply(false); load(); }} balances={balances} />}
      {showAllocate && <AllocateModal employees={employees} onClose={() => setShowAllocate(false)} onSave={() => { setShowAllocate(false); load(); }} />}
    </div>
  );
}




