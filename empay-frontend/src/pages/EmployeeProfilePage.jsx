import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const getInitials = (f,l) => `${f?.[0]||''}${l?.[0]||''}`.toUpperCase();
const getColor = (name) => { const c=['#1e3a8a','#1d4ed8','#059669','#7c3aed','#d97706']; let h=0; for(const ch of(name||''))h=ch.charCodeAt(0)+((h<<5)-h); return c[Math.abs(h)%c.length]; };

function SalaryRow({ label, value, pct, desc }) {
  return (
    <div style={{borderBottom:'1px solid var(--border)',padding:'10px 0'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
        <span style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{label}</span>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          {pct && <span style={{fontSize:11,color:'var(--text-3)',background:'var(--surface-2)',padding:'2px 8px',borderRadius:99}}>{pct}%</span>}
          <span style={{fontWeight:700,fontSize:14,color:'var(--primary)',minWidth:100,textAlign:'right'}}>{fmtCurr(value)} <span style={{fontSize:10,color:'var(--text-4)',fontWeight:400}}>/ month</span></span>
        </div>
      </div>
      {desc && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{desc}</div>}
    </div>
  );
}

export default function EmployeeProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resume');
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [pwForm, setPwForm] = useState({current_password:'',new_password:'',confirm:''});
  const [pwLoading, setPwLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/employees/${id}`);
      const data = r.data || r;
      setEmp(data); setForm(data);
      // Only load leave balances for own profile or if admin/HR
      if (can('admin','hr_officer') || user?.employee_id == id) {
        const lb = await api.get(`/timeoff/balances/${id}`);
        setLeaveBalances(lb.data || lb);
      }
    } catch (err) {
      // 403 = employee tried to access another's profile
      toast.error('Access denied');
      navigate('/employees');
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true);
    try { await api.put(`/employees/${id}`, form); toast.success('Saved'); setEditing(false); load(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setPwLoading(true);
    try { await api.put('/auth/change-password', { current_password:pwForm.current_password, new_password:pwForm.new_password }); toast.success('Password changed!'); setPwForm({current_password:'',new_password:'',confirm:''}); }
    catch (err) { toast.error(err.message); }
    finally { setPwLoading(false); }
  };

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const canEdit = can('admin','hr_officer') || (user?.employee_id == id);
  const canSeePrivate = can('admin','hr_officer') || (user?.employee_id == id);
  const canSeeSalary = can('admin','payroll_officer','hr_officer');
  const isOwnProfile = user?.employee_id == id;
  const isEmployee = user?.role === 'employee';

  // Tab visibility rules:
  // - Admin/HR: all tabs
  // - Employee (own profile): Resume + Security only
  // - Employee (other's profile): blocked at backend, but guard here too
  const tabs = [
    { id: 'resume',  label: 'Resume' },
    ...(canSeePrivate ? [{ id: 'private', label: 'Private Info' }] : []),
    ...(canSeeSalary ? [{ id: 'salary', label: 'Salary Info' }] : []),
    ...(isOwnProfile ? [{ id: 'security', label: 'Security' }] : []),
  ];

  if (loading) return <div className="page-loader" style={{height:300,background:'transparent'}}><div className="spinner"/></div>;
  if (!emp) return null;

  const color = getColor(`${emp.first_name} ${emp.last_name}`);
  const wage = parseFloat(emp.wage) || parseFloat(emp.basic_salary) || 0;
  const basic = Math.round(wage*0.50*100)/100;
  const hra   = Math.round(basic*0.40*100)/100;
  const std   = 967;
  const perf  = Math.round(basic*0.0933*100)/100;
  const lta   = Math.round(basic*0.0933*100)/100;
  const fixed = Math.round((wage-basic-hra-std-perf-lta)*100)/100;
  const pfEmp = Math.round(basic*0.12*100)/100;
  const pfEr  = Math.round(basic*0.12*100)/100;
  const profTax = wage > 15000 ? 200 : 0;

  // Field render helper
  const Field = ({label, value}) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{label}</div>
      <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>{value||'—'}</div>
    </div>
  );

  const InputField = ({label, k, type='text', required}) => (
    <div className="form-group">
      <label className="form-label">{label}{required&&'*'}</label>
      <input className="form-control" type={type} value={form[k]?.toString?.()?.split?.('T')?.[0]||form[k]||''} onChange={e=>f(k,e.target.value)} />
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/employees')}>← Back</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        {/* LEFT: Profile Card */}
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-body" style={{textAlign:'center',padding:'28px 20px'}}>
              <div style={{position:'relative',display:'inline-block',marginBottom:16}}>
                <div className="avatar avatar-xl" style={{background:color,color:'#fff'}}>{getInitials(emp.first_name,emp.last_name)}</div>
                {canEdit && <button style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:'var(--primary)',color:'#fff',border:'2px solid #fff',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setEditing(true)}>✏</button>}
              </div>
              <h2 style={{fontSize:18,fontWeight:700,marginBottom:2}}>{emp.first_name} {emp.last_name}</h2>
              <div style={{fontSize:13,color:'var(--text-3)',marginBottom:10}}>{emp.designation||'No designation'}</div>
              <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',marginBottom:14}}>
                <span className="badge badge-primary">{emp.employee_code}</span>
                <span className="badge badge-info" style={{textTransform:'capitalize'}}>{emp.role?.replace('_',' ')}</span>
              </div>
              {[['🏢',emp.department],['📧',emp.email],['📱',emp.phone],['📅',`Joined ${fmtDate(emp.date_of_joining)}`],['📍',emp.location]].filter(([,v])=>v).map(([icon,val])=>(
                <div key={icon} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)',marginBottom:6,textAlign:'left'}}>
                  <span>{icon}</span><span>{val}</span>
                </div>
              ))}
              {canSeePrivate && <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Login ID</div>
                <code style={{fontSize:14,fontWeight:700,color:'var(--primary)',background:'var(--primary-xlight)',padding:'4px 10px',borderRadius:6}}>{emp.login_id||emp.employee_code}</code>
              </div>}
            </div>
          </div>

          {/* Leave Balances */}
          <div className="card">
            <div className="card-header"><div className="card-title">Leave Balances</div></div>
            <div className="card-body">
              {leaveBalances.length===0 ? <div style={{color:'var(--text-3)',fontSize:13}}>No balances</div> : leaveBalances.map(lb=>(
                <div key={lb.id} style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,textTransform:'capitalize',color:'var(--text-2)'}}>{lb.leave_type}</span>
                    <span style={{fontSize:11,color:'var(--text-3)'}}>{lb.total_allocated-lb.used}/{lb.total_allocated}</span>
                  </div>
                  <div style={{height:5,background:'var(--border)',borderRadius:99,overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--primary)',borderRadius:99,width:`${Math.max(0,((lb.total_allocated-lb.used)/lb.total_allocated)*100)}%`,transition:'width 0.4s'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Tabs */}
        <div className="card">
          {/* Tab Bar */}
          <div style={{borderBottom:'1px solid var(--border)',padding:'0 20px',display:'flex',gap:4}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'14px 18px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:tab===t.id?'var(--primary)':'var(--text-3)',borderBottom:`2px solid ${tab===t.id?'var(--primary)':'transparent'}`,transition:'all 0.2s'}}>
                {t.label}
              </button>
            ))}
            {canEdit && tab!=='security' && tab!=='salary' && (
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                {editing
                  ? <><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={()=>{setEditing(false);setForm(emp);}}>Cancel</button></>
                  : <button className="btn btn-outline btn-sm" onClick={()=>setEditing(true)}>✏ Edit</button>
                }
              </div>
            )}
          </div>

          <div className="card-body">
            {/* RESUME TAB */}
            {tab==='resume' && (
              <>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:8}}>About 🖊</div>
                  {editing ? <textarea className="form-control" rows={4} value={form.about||''} onChange={e=>f('about',e.target.value)} placeholder="Write a short bio..." />
                  : <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7}}>{emp.about||<span style={{color:'var(--text-4)'}}>No bio added yet</span>}</div>}
                </div>
                <hr className="divider"/>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:8}}>Skills</div>
                  {editing ? <input className="form-control" value={form.skills||''} onChange={e=>f('skills',e.target.value)} placeholder="e.g. React, Node.js, MySQL (comma separated)" />
                  : (
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {(emp.skills||'').split(',').filter(s=>s.trim()).map(s=>(
                        <span key={s} style={{background:'var(--primary-xlight)',color:'var(--primary)',fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:99,border:'1px solid var(--primary-light)'}}>{s.trim()}</span>
                      ))}
                      {!emp.skills && <span style={{color:'var(--text-4)',fontSize:13}}>No skills added</span>}
                    </div>
                  )}
                </div>
                <hr className="divider"/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:8}}>Certifications</div>
                  {editing ? <textarea className="form-control" rows={3} value={form.certifications||''} onChange={e=>f('certifications',e.target.value)} placeholder="List certifications, one per line..." />
                  : (
                    <div>
                      {(emp.certifications||'').split('\n').filter(s=>s.trim()).map((cert,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13,color:'var(--text-2)'}}>
                          🏅 {cert.trim()}
                        </div>
                      ))}
                      {!emp.certifications && <span style={{color:'var(--text-4)',fontSize:13}}>No certifications added</span>}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* PRIVATE INFO TAB */}
            {tab==='private' && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>Personal Details</div>
                {editing ? (
                  <>
                    <div className="form-row">
                      <InputField label="Date of Birth" k="birth_date" type="date" />
                      <div className="form-group"><label className="form-label">Gender</label>
                        <select className="form-control" value={form.gender||''} onChange={e=>f('gender',e.target.value)}>
                          <option value="">Select...</option>
                          {['Male','Female','Other','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <InputField label="Nationality" k="nationality" />
                      <div className="form-group"><label className="form-label">Marital Status</label>
                        <select className="form-control" value={form.marital_status||''} onChange={e=>f('marital_status',e.target.value)}>
                          <option value="">Select...</option>
                          {['Single','Married','Divorced','Widowed'].map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <InputField label="Personal Email" k="personal_email" type="email" />
                    <div className="form-group"><label className="form-label">Permanent Address</label><textarea className="form-control" rows={2} value={form.permanent_address||''} onChange={e=>f('permanent_address',e.target.value)} /></div>
                  </>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
                    <Field label="Date of Birth" value={fmtDate(emp.birth_date)} />
                    <Field label="Gender" value={emp.gender} />
                    <Field label="Nationality" value={emp.nationality} />
                    <Field label="Marital Status" value={emp.marital_status} />
                    <Field label="Personal Email" value={emp.personal_email} />
                    <Field label="Date of Joining" value={fmtDate(emp.date_of_joining)} />
                  </div>
                )}
                {!editing && <Field label="Permanent Address" value={emp.permanent_address} />}
                <hr className="divider"/>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>Bank Details</div>
                {editing ? (
                  <>
                    <div className="form-row">
                      <InputField label="Account Number" k="bank_account" />
                      <InputField label="Bank Name" k="bank_name" />
                    </div>
                    <div className="form-row">
                      <InputField label="IFSC Code" k="ifsc_code" />
                      <InputField label="PAN Number" k="pan_number" />
                    </div>
                    <div className="form-row">
                      <InputField label="UAN Number" k="uan_number" />
                      <InputField label="UAM ID" k="uam_id" />
                    </div>
                  </>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
                    <Field label="Account Number" value={emp.bank_account} />
                    <Field label="Bank Name" value={emp.bank_name} />
                    <Field label="IFSC Code" value={emp.ifsc_code} />
                    <Field label="PAN Number" value={emp.pan_number} />
                    <Field label="UAN Number" value={emp.uan_number} />
                    <Field label="UAM ID" value={emp.uam_id} />
                    <Field label="Employee Code" value={emp.employee_code} />
                  </div>
                )}
              </>
            )}

            {/* SALARY INFO TAB */}
            {tab==='salary' && canSeeSalary && (
              <>
                {/* Wage header */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:20}}>
                  <div style={{background:'var(--primary-xlight)',border:'1px solid var(--primary-light)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',marginBottom:4}}>Month Wage</div>
                    {editing ? <input className="form-control" type="number" value={form.wage||''} onChange={e=>f('wage',e.target.value)} placeholder="0" />
                    : <div style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>{fmtCurr(wage)}<span style={{fontSize:11,fontWeight:400,color:'var(--text-3)'}}> / Month</span></div>}
                  </div>
                  <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:4}}>Yearly Wage</div>
                    <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{fmtCurr(wage*12)}<span style={{fontSize:11,fontWeight:400,color:'var(--text-3)'}}> / Year</span></div>
                  </div>
                  <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:4}}>Working Days/Week</div>
                    {editing ? <input className="form-control" type="number" value={form.working_days_per_week||5} onChange={e=>f('working_days_per_week',e.target.value)} />
                    : <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{emp.working_days_per_week||5} <span style={{fontSize:11,color:'var(--text-3)'}}>days</span></div>}
                  </div>
                </div>
                {editing && (
                  <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:'var(--radius)',padding:'10px 14px',marginBottom:16,fontSize:12,color:'#92400e'}}>
                    ⚡ All salary components are auto-calculated from the monthly wage. Basic=50%, HRA=40% of Basic, PF=12% of Basic.
                  </div>
                )}

                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:2}}>Salary Components</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:12}}>Auto-calculated based on monthly wage of {fmtCurr(wage)}</div>
                <SalaryRow label="Basic Salary" value={basic} pct={50} desc="Defined as 50% of the monthly wage." />
                <SalaryRow label="House Rent Allowance (HRA)" value={hra} pct={(hra/wage*100).toFixed(1)} desc="HRA provided to employees at 40% of basic salary." />
                <SalaryRow label="Standard Allowance" value={std} pct={(std/wage*100).toFixed(1)} desc="Fixed allowance of ₹967/month provided to all employees." />
                <SalaryRow label="Performance Bonus" value={perf} pct={(perf/wage*100).toFixed(1)} desc="Variable amount calculated as 9.33% of basic salary." />
                <SalaryRow label="Leave Travel Allowance (LTA)" value={lta} pct={(lta/wage*100).toFixed(1)} desc="Travel allowance calculated as 9.33% of basic salary." />
                <SalaryRow label="Fixed Allowance" value={fixed} pct={(fixed/wage*100).toFixed(1)} desc="Balancing component = Wage − (all above components)." />
                <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',fontWeight:800,fontSize:15,color:'var(--primary)',borderTop:'2px solid var(--primary)'}}>
                  <span>Gross Earnings</span><span>{fmtCurr(wage)}</span>
                </div>

                <hr className="divider" />
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:12}}>Provident Fund (PF) Contribution</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  {[['Employee PF (12%)',pfEmp],['Employer PF (12%)',pfEr]].map(([l,v])=>(
                    <div key={l} style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 16px'}}>
                      <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--danger)'}}>{fmtCurr(v)}<span style={{fontSize:10,color:'var(--text-4)',fontWeight:400}}>/month</span></div>
                      <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>Calculated on basic salary</div>
                    </div>
                  ))}
                </div>

                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:12}}>Tax Deductions</div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                  <div><span style={{fontWeight:600,fontSize:13}}>Professional Tax</span><div style={{fontSize:11,color:'var(--text-3)'}}>Deducted from gross salary if wage &gt; ₹15,000/month</div></div>
                  <span style={{fontWeight:700,color:'var(--danger)'}}>{fmtCurr(profTax)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',fontWeight:800,fontSize:14,color:'var(--danger)'}}>
                  <span>Total Deductions</span><span>{fmtCurr(pfEmp+profTax)}</span>
                </div>
                <div style={{background:'var(--primary)',color:'#fff',borderRadius:'var(--radius)',padding:'16px 20px',display:'flex',justifyContent:'space-between',marginTop:8}}>
                  <span style={{fontWeight:700,fontSize:15}}>Estimated Net Pay</span>
                  <span style={{fontWeight:800,fontSize:22}}>{fmtCurr(wage-pfEmp-profTax)}</span>
                </div>
                {editing && <div style={{marginTop:12,display:'flex',justifyContent:'flex-end'}}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Wage'}</button></div>}
              </>
            )}

            {/* SECURITY TAB */}
            {tab==='security' && (
              <>
                <div style={{marginBottom:20,padding:'14px 16px',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Login ID (auto-generated)</div>
                  <code style={{fontSize:18,fontWeight:800,color:'var(--primary)'}}>{emp.login_id||emp.employee_code}</code>
                  <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>This is your unique identifier. Login uses email address.</div>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:16}}>Change Password</div>
                <form onSubmit={changePw}>
                  <div className="form-group"><label className="form-label">Current Password</label><input className="form-control" type="password" value={pwForm.current_password} onChange={e=>setPwForm(p=>({...p,current_password:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">New Password</label><input className="form-control" type="password" value={pwForm.new_password} onChange={e=>setPwForm(p=>({...p,new_password:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">Confirm Password</label><input className="form-control" type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} required /></div>
                  <button type="submit" className="btn btn-primary" disabled={pwLoading}>{pwLoading?'Updating...':'Update Password'}</button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
