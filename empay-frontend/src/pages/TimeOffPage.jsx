import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const STATUS_BADGE = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
const LEAVE_TYPES = ['sick','casual','earned','maternity','paternity','unpaid'];

function ApplyModal({ onClose, onSave }) {
  const [form, setForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await api.post('/timeoff/apply', form); toast.success('Leave request submitted!'); onSave(); }
    catch (err) { toast.error(err.message); }
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
              <select className="form-control" value={form.leave_type} onChange={e => setForm(p=>({...p,leave_type:e.target.value}))}>
                {LEAVE_TYPES.map(t => <option key={t} value={t} style={{textTransform:'capitalize'}}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-control" type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))} required /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-control" type="date" value={form.end_date} min={form.start_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))} required /></div>
            </div>
            <div className="form-group"><label className="form-label">Reason</label><textarea className="form-control" value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Briefly describe the reason..." required /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Submitting...':'Submit Request'}</button>
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
              <select className="form-control" value={form.employee_id} onChange={e=>setForm(p=>({...p,employee_id:e.target.value}))} required>
                <option value="">Select employee...</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-control" value={form.leave_type} onChange={e=>setForm(p=>({...p,leave_type:e.target.value}))}>
                  {LEAVE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Days Allocated</label><input className="form-control" type="number" min="1" max="60" value={form.total_allocated} onChange={e=>setForm(p=>({...p,total_allocated:e.target.value}))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Year</label><input className="form-control" type="number" value={form.year} onChange={e=>setForm(p=>({...p,year:e.target.value}))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Allocating...':'Allocate Leave'}</button>
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
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [filter, setFilter] = useState('');
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    const ep = isEmployee ? '/timeoff/my' : '/timeoff';
    api.get(ep).then(r => setRequests(r.data)).catch(() => {}).finally(() => setLoading(false));
    if (isEmployee && user.employee_id) api.get('/timeoff/balances').then(r => setBalances(r.data)).catch(() => {});
    if (!isEmployee) api.get('/employees').then(r => setEmployees(r.data)).catch(() => {});
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

  const filtered = filter ? requests.filter(r => r.status === filter) : requests;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Time Off</h1><p>{isEmployee ? 'Apply and track your leave requests' : 'Manage employee time off requests'}</p></div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isEmployee && <button className="btn btn-primary" onClick={() => setShowApply(true)}>+ Apply for Leave</button>}
            {can('admin','hr_officer') && <button className="btn btn-outline" onClick={() => setShowAllocate(true)}>📋 Allocate Leave</button>}
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

      {/* Filters */}
      <div className="filter-bar">
        <div className="tabs">
          {['','pending','approved','rejected'].map(s => (
            <button key={s} className={`tab${filter===s?' active':''}`} onClick={() => setFilter(s)}>
              {s===''?'All':s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>{filtered.length} requests</span>
      </div>

      {/* Requests table */}
      <div className="card">
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {!isEmployee && <th>Employee</th>}
                  <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                  {can('admin','payroll_officer') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--text-3)' }}>No requests found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    {!isEmployee && <td><div style={{ fontWeight:600 }}>{r.first_name} {r.last_name}</div><div style={{ fontSize:11,color:'var(--text-4)' }}>{r.employee_code}</div></td>}
                    <td><span style={{ textTransform:'capitalize', fontWeight:500 }}>{r.leave_type}</span></td>
                    <td>{fmtDate(r.start_date)}</td>
                    <td>{fmtDate(r.end_date)}</td>
                    <td style={{ fontWeight:600 }}>{r.total_days}</td>
                    <td style={{ maxWidth:180, color:'var(--text-3)', fontSize:12 }}>{r.reason}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]||'badge-default'}`}>{r.status}</span></td>
                    {can('admin','payroll_officer') && (
                      <td>
                        {r.status === 'pending' && (
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="btn btn-sm btn-success" onClick={() => approve(r.id)}>✓ Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setRejectId(r.id)}>✕ Reject</button>
                          </div>
                        )}
                        {r.status !== 'pending' && <span style={{ fontSize:11, color:'var(--text-4)' }}>Reviewed</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setRejectId(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Reject Leave Request</span><button className="modal-close" onClick={()=>setRejectId(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Rejection Reason</label><textarea className="form-control" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Provide a reason (optional)..." /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setRejectId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>reject(rejectId)}>Reject Request</button>
            </div>
          </div>
        </div>
      )}

      {showApply && <ApplyModal onClose={() => setShowApply(false)} onSave={() => { setShowApply(false); load(); }} />}
      {showAllocate && <AllocateModal employees={employees} onClose={() => setShowAllocate(false)} onSave={() => { setShowAllocate(false); load(); }} />}
    </div>
  );
}
