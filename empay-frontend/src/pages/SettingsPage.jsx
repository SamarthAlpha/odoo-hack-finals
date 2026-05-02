import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { sendCredentialsEmail } from '../utils/emailService';

const ROLES = [['admin','Admin'],['hr_officer','HR Officer'],['payroll_officer','Payroll Officer'],['employee','Employee']];
const getInitials = (n='') => n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();

export default function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState({});

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data||r)).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    try { await api.put(`/users/${id}/role`, { role }); toast.success('Role updated'); load(); }
    catch (err) { toast.error(err.message); }
  };
  const toggleActive = async (id) => {
    try { await api.put(`/users/${id}/toggle-active`, {}); toast.success('Updated'); load(); }
    catch (err) { toast.error(err.message); }
  };
  const deleteUser = async (id) => {
    if(!confirm('Delete this user permanently?')) return;
    try { await api.delete(`/users/${id}`); toast.success('Deleted'); load(); }
    catch(err){ toast.error(err.message); }
  };

  // Reset password and send email
  const resetAndSend = async (u) => {
    setSending(p=>({...p,[u.id]:true}));
    try {
      const r = await api.put(`/users/${u.id}/reset-password`, {});
      const newPass = r.new_password || r.data?.new_password;
      const name = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email;
      const result = await sendCredentialsEmail({
        toName: name,
        toEmail: u.email,
        loginId: u.login_id || u.employee_code || '—',
        password: newPass,
      });
      if (result.success) toast.success(`Credentials sent to ${u.email}`);
      else if (result.reason === 'not_configured')
        toast('Password reset ✓ | EmailJS not configured — add keys to .env', { icon: '⚠️', duration: 5000 });
      else toast.error('Password reset ✓ but email failed: ' + result.reason);
    } catch(err){ toast.error(err.message); }
    finally { setSending(p=>({...p,[u.id]:false})); }
  };

  const filtered = users.filter(u=>{
    const q = search.toLowerCase();
    return !q || `${u.first_name||''} ${u.last_name||''} ${u.email} ${u.employee_code||''}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header">
        <div><h1>Settings</h1><p>Manage users, roles, and credentials — {users.length} users</p></div>
      </div>

      {/* Credentials Table */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header">
          <div><div className="card-title">Employee Credentials</div><div className="card-subtitle">Reset passwords and send login credentials via email</div></div>
          <input className="form-control" style={{width:240}} placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {loading ? <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Login ID</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{textAlign:'center'}}>Send Credentials</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No users found</td></tr>
                ) : filtered.map(u=>(
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div className="avatar avatar-sm" style={{background:'var(--primary)',color:'#fff'}}>{getInitials(u.first_name&&u.last_name?`${u.first_name} ${u.last_name}`:u.email)}</div>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{u.first_name&&u.last_name?`${u.first_name} ${u.last_name}`:'—'}</div>
                          <div style={{fontSize:11,color:'var(--text-4)'}}>{u.employee_code||'No profile'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{color:'var(--text-3)',fontSize:13}}>{u.email}</td>
                    <td>
                      <code style={{fontSize:12,background:'var(--surface-2)',padding:'3px 8px',borderRadius:4,color:'var(--primary)',fontWeight:700}}>
                        {u.login_id||u.employee_code||'—'}
                      </code>
                    </td>
                    <td>
                      <select className="form-control" style={{width:145,padding:'5px 8px',fontSize:12}} value={u.role} onChange={e=>changeRole(u.id,e.target.value)}>
                        {ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active?'badge-success':'badge-default'}`}>{u.is_active?'Active':'Inactive'}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={()=>resetAndSend(u)}
                        disabled={sending[u.id]}
                        title="Reset password and email credentials"
                        style={{minWidth:110}}
                      >
                        {sending[u.id] ? '...' : '📧 Send Mail'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Management */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><div className="card-title">User Management</div></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>User</th><th>Department</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(u=>(
                <tr key={u.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div className="avatar avatar-sm" style={{background:'var(--primary)',color:'#fff'}}>{getInitials(u.first_name&&u.last_name?`${u.first_name} ${u.last_name}`:u.email)}</div>
                      <div>
                        <div style={{fontWeight:600}}>{u.first_name&&u.last_name?`${u.first_name} ${u.last_name}`:u.email}</div>
                        <div style={{fontSize:11,color:'var(--text-4)'}}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.department||'—'}</td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>toggleActive(u.id)}>{u.is_active?'Deactivate':'Activate'}</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteUser(u.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Matrix */}
      <div className="card">
        <div className="card-header"><div className="card-title">Role Access Matrix</div></div>
        <div className="card-body">
          <table className="data-table">
            <thead><tr><th>Module</th><th>Admin</th><th>HR Officer</th><th>Payroll Officer</th><th>Employee</th></tr></thead>
            <tbody>
              {[
                ['Employees','CRUD','Read/Edit','Read','Own'],
                ['Attendance','All','All','All','Own + Check-In/Out'],
                ['Time Off','Approve','Allocate','Approve/Reject','Apply/View'],
                ['Payroll','Full','No Access','Generate/Edit','View Own'],
                ['Reports','Full','No Access','Full','No Access'],
                ['Settings','Full','No Access','No Access','No Access'],
              ].map(([mod,...cols])=>(
                <tr key={mod}>
                  <td style={{fontWeight:600}}>{mod}</td>
                  {cols.map((c,i)=>(
                    <td key={i}><span className={`badge ${c==='No Access'?'badge-default':c==='Full'||c==='CRUD'?'badge-success':'badge-info'}`}>{c}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
