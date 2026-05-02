import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const getInitials = (n) => (n||'').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
const getColor = (name) => { const c=['#1e3a8a','#1d4ed8','#059669','#7c3aed','#d97706']; let h=0; for(const ch of(name||''))h=ch.charCodeAt(0)+((h<<5)-h); return c[Math.abs(h)%c.length]; };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;
const ROLE_LABEL = { admin: 'Administrator', employee: 'Employee', hr_officer: 'HR Officer', payroll_officer: 'Payroll Officer' };

export default function MyProfilePage() {
  const { user, can } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const changePw = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try { await api.put('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password }); toast.success('Password changed!'); setPwForm({ current_password:'', new_password:'', confirm:'' }); setShowPw(false); }
    catch (err) { toast.error(err.message); }
    finally { setPwLoading(false); }
  };

  if (loading) return <div className="page-loader" style={{height:300,background:'transparent'}}><div className="spinner" /></div>;
  const p = profile;
  const color = getColor(user?.name);

  return (
    <div>
      <div className="page-header"><h1>My Profile</h1><p>View and manage your personal account information</p></div>
      <div className="grid-2" style={{alignItems:'start'}}>
        {/* Profile Card */}
        <div className="card">
          <div className="card-body" style={{textAlign:'center',padding:'36px 24px'}}>
            <div className="avatar avatar-xl" style={{background:color,color:'#fff',margin:'0 auto 16px'}}>{getInitials(user?.name)}</div>
            <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>{user?.name}</h2>
            <div style={{color:'var(--text-3)',fontSize:13,marginBottom:12}}>{p?.designation||'No designation'}</div>
            <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:20}}>
              <span className="badge badge-primary">{p?.employee_code||'—'}</span>
              <span className="badge badge-info">{ROLE_LABEL[user?.role]}</span>
              <span className={`badge ${p?.status==='active'?'badge-success':'badge-default'}`}>{p?.status||'active'}</span>
            </div>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px 20px',textAlign:'left'}}>
              {[['🏢', p?.department],['📧', user?.email],['📱', p?.phone],['📅', `Joined ${fmtDate(p?.date_of_joining)}`],['🏠', p?.address]].filter(([,v])=>v).map(([icon,val])=>(
                <div key={icon} style={{display:'flex',gap:10,fontSize:13,color:'var(--text-2)',marginBottom:10}}>
                  <span>{icon}</span><span>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {/* Details card */}
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><div className="card-title">Account Details</div></div>
            <div className="card-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
                {[['Employee Code',p?.employee_code],['Department',p?.department],['Designation',p?.designation],['Date of Joining',fmtDate(p?.date_of_joining)],['Phone',p?.phone],['Email',user?.email]].map(([k,v])=>(
                  <div key={k} style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{k}</div>
                    <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>{v||'—'}</div>
                  </div>
                ))}
              </div>
              {p?.address && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Address</div>
                  <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>{p.address}</div>
                </div>
              )}
              {can('admin','payroll_officer') && p?.basic_salary && (
                <div style={{marginTop:12,padding:'12px 16px',background:'var(--primary-xlight)',border:'1px solid var(--primary-light)',borderRadius:'var(--radius-sm)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Basic Salary</div>
                  <div style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{fmtCurr(p.basic_salary)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Security</div>
              <button className="btn btn-sm btn-outline" onClick={()=>setShowPw(!showPw)}>{showPw?'Cancel':'🔑 Change Password'}</button>
            </div>
            {showPw && (
              <div className="card-body">
                <form onSubmit={changePw}>
                  <div className="form-group"><label className="form-label">Current Password</label><input className="form-control" type="password" value={pwForm.current_password} onChange={e=>setPwForm(p=>({...p,current_password:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">New Password</label><input className="form-control" type="password" value={pwForm.new_password} onChange={e=>setPwForm(p=>({...p,new_password:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-control" type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} required /></div>
                  <button type="submit" className="btn btn-primary" disabled={pwLoading}>{pwLoading?'Changing...':'Update Password'}</button>
                </form>
              </div>
            )}
            {!showPw && <div className="card-body" style={{color:'var(--text-3)',fontSize:13}}>Your password was last set by your administrator. Click "Change Password" to update it.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
