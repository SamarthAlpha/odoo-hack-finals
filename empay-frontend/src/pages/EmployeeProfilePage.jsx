

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BACKEND_BASE = ''; // Vite proxies /uploads → backend, so relative URL works

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const getInitials = (f,l) => `${f?.[0]||''}${l?.[0]||''}`.toUpperCase();
const getColor = (name) => { const c=['#1e3a8a','#1d4ed8','#059669','#7c3aed','#d97706']; let h=0; for(const ch of(name||''))h=ch.charCodeAt(0)+((h<<5)-h); return c[Math.abs(h)%c.length]; };

function SalaryRow({ label, value, pct, desc, editInput }) {
  return (
    <div style={{borderBottom:'1px solid var(--border)',padding:'10px 0'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
        <span style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{label}</span>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          {editInput
            ? editInput
            : pct && <span style={{fontSize:11,color:'var(--text-3)',background:'var(--surface-2)',padding:'2px 8px',borderRadius:99}}>{pct}%</span>
          }
          <span style={{fontWeight:700,fontSize:14,color:'var(--primary)',minWidth:100,textAlign:'right'}}>{fmtCurr(value)} <span style={{fontSize:10,color:'var(--text-4)',fontWeight:400}}>/ month</span></span>
        </div>
      </div>
      {desc && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{desc}</div>}
    </div>
  );
}

function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 } });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) { toast.error("Could not access camera"); onClose(); }
    }
    start();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 400, 400);
    canvasRef.current.toBlob(blob => onCapture(blob), 'image/jpeg');
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
      <div style={{background:'#fff',padding:20,borderRadius:12,textAlign:'center',maxWidth:440}}>
        <h3 style={{marginBottom:15}}>Take Profile Photo</h3>
        <video ref={videoRef} autoPlay playsInline style={{width:'100%',borderRadius:8,background:'#000',marginBottom:15}} />
        <canvas ref={canvasRef} width={400} height={400} style={{display:'none'}} />
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button className="btn btn-primary" onClick={capture}>📸 Capture</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Inline editable text section with pencil toggle
function InlineEdit({ value, onSave, multiline, canEdit }) {
  const [ed, setEd] = useState(false);
  const [v, setV] = useState(value || '');
  const save = async () => { await onSave(v); setEd(false); };
  const pencilBtn = { background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--text-3)', padding:'2px 6px', lineHeight:1 };
  if (!canEdit) return <p style={{color:'var(--text-2)',fontSize:13,lineHeight:1.8,margin:0}}>{value || <span style={{color:'var(--text-4)',fontStyle:'italic'}}>Not added.</span>}</p>;
  if (ed) return (
    <div>
      {multiline
        ? <textarea className="form-control" rows={4} value={v} onChange={e=>setV(e.target.value)} style={{marginBottom:8}} />
        : <input className="form-control" value={v} onChange={e=>setV(e.target.value)} style={{marginBottom:8}} />
      }
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-sm btn-primary" onClick={save}>Save</button>
        <button className="btn btn-sm btn-secondary" onClick={()=>setEd(false)}>Cancel</button>
      </div>
    </div>
  );
  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:4}}>
      <p style={{flex:1,color:'var(--text-2)',fontSize:13,lineHeight:1.8,margin:0}}>{value || <span style={{color:'var(--text-4)',fontStyle:'italic'}}>Not added yet. Click ✏ to add.</span>}</p>
      <button style={pencilBtn} onClick={()=>{setV(value||'');setEd(true);}}>✏</button>
    </div>
  );
}

// Field render helper
const Field = ({label, value}) => (
  <div style={{marginBottom:16}}>
    <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{label}</div>
    <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>{value||'—'}</div>
  </div>
);

const InputField = ({label, k, form, onChange, type='text', required}) => (
  <div className="form-group">
    <label className="form-label">{label}{required&&'*'}</label>
    <input className="form-control" type={type} value={form[k]?.toString?.()?.split?.('T')?.[0]||form[k]||''} onChange={e=>onChange(k,e.target.value)} required={required} />
  </div>
);

const LF = ({label, value}) => (
  <div style={{marginBottom:14}}>
    <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{label}</div>
    <div style={{fontSize:13,fontWeight:500,color:'var(--text)',borderBottom:'1px solid var(--border)',paddingBottom:6}}>{value||'—'}</div>
  </div>
);

const EditPct = ({ k, salaryForm, onChange }) => (
  <div style={{display:'flex',alignItems:'center',gap:4}}>
    <input type="number" min="0" max="100" step="0.01" value={salaryForm[k]}
      onChange={e=>onChange(k,e.target.value)}
      style={{width:64,padding:'2px 6px',fontSize:12,border:'1px solid var(--primary)',borderRadius:6,textAlign:'right'}} />
    <span style={{fontSize:12,color:'var(--text-3)'}}>%</span>
  </div>
);

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
  const [salaryEditing, setSalaryEditing] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef(null);
  const [salaryForm, setSalaryForm] = useState({
    wage: 0,
    working_days_per_week: 5,
    basic_pct: 50,
    hra_pct: 50,
    standard_allowance_pct: 0,
    perf_pct: 8.33,
    lta_pct: 8.33,
    employee_pf_pct: 12,
    employer_pf_pct: 12,
    prof_tax_amount: 200
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/employees/${id}`);
      const data = r.data || r;
      setEmp(data); setForm(data);
      setSalaryForm({
        wage: parseFloat(data.wage) || 0,
        working_days_per_week: data.working_days_per_week || 5,
        basic_pct: parseFloat(data.basic_pct) || 50,
        hra_pct: parseFloat(data.hra_pct) || 50,
        standard_allowance_pct: parseFloat(data.standard_allowance_pct) || 0,
        perf_pct: parseFloat(data.perf_pct) || 8.33,
        lta_pct:  parseFloat(data.lta_pct)  || 8.33,
        employee_pf_pct: parseFloat(data.employee_pf_pct) || 12,
        employer_pf_pct: parseFloat(data.employer_pf_pct) || 12,
        prof_tax_amount: parseFloat(data.prof_tax_amount) || 200,
      });
      // Only load leave balances for own profile or if admin/HR
      if (can('admin','hr_officer','payroll_officer') || user?.employee_id == id) {
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

  const saveSalary = async () => {
    setSalarySaving(true);
    try {
      await api.put(`/employees/${id}/salary`, salaryForm);
      toast.success('Salary structure updated!');
      setSalaryEditing(false);
      load();
    } catch (err) { toast.error(err?.message || 'Failed to update salary'); }
    finally { setSalarySaving(false); }
  };

  const handleImgUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    setUploadingImg(true);
    try {
      await api.post(`/employees/${id}/upload-image`, formData);
      toast.success('Profile picture updated!');
      load();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Upload failed. Please try again.');
    }
    finally { setUploadingImg(false); setShowCamera(false); }
  };

  const getSalaryValues = () => {
    const data = salaryEditing ? salaryForm : {
      wage: emp.wage,
      basic_pct: emp.basic_pct,
      hra_pct: emp.hra_pct,
      standard_allowance_pct: emp.standard_allowance_pct,
      perf_pct: emp.perf_pct,
      lta_pct: emp.lta_pct,
      employee_pf_pct: emp.employee_pf_pct,
      employer_pf_pct: emp.employer_pf_pct,
      prof_tax_amount: emp.prof_tax_amount
    };

    const w   = parseFloat(data.wage) || 0;
    const bp  = parseFloat(data.basic_pct) || 0;
    const hp  = parseFloat(data.hra_pct) || 0;
    const sp  = parseFloat(data.standard_allowance_pct) || 0;
    const pp  = parseFloat(data.perf_pct) || 0;
    const lp  = parseFloat(data.lta_pct) || 0;
    const ep  = parseFloat(data.employee_pf_pct) || 12;
    const erp = parseFloat(data.employer_pf_pct) || 12;
    const pt  = parseFloat(data.prof_tax_amount) || 0;

    const basic = Math.round(w * (bp / 100) * 100) / 100;
    const hra   = Math.round(basic * (hp / 100) * 100) / 100;
    const std   = Math.round(basic * (sp / 100) * 100) / 100;
    const perf  = Math.round(basic * (pp / 100) * 100) / 100;
    const lta   = Math.round(basic * (lp / 100) * 100) / 100;
    const ePf   = Math.round(basic * (ep / 100) * 100) / 100;
    const rPf   = Math.round(basic * (erp / 100) * 100) / 100;

    const earnBeforeFixed = basic + hra + std + perf + lta;
    const fixed = Math.round((w - earnBeforeFixed) * 100) / 100;
    const gross = Math.round((earnBeforeFixed + fixed) * 100) / 100;
    const deds  = Math.round((ePf + pt) * 100) / 100;
    const net   = Math.round((gross - deds) * 100) / 100;

    return { w, bp, hp, sp, pp, lp, ep, erp, pt, basic, hra, std, perf, lta, ePf, rPf, fixed, gross, deds, net };
  };

  const sf = (k, v) => setSalaryForm(p => ({ ...p, [k]: v }));

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
  const canEditSalary = can('admin','payroll_officer','hr_officer');
  const canSeeLeaves = can('admin','hr_officer','payroll_officer') || (user?.employee_id == id);
  const isOwnProfile = user?.employee_id == id;
  const isEmployee = user?.role === 'employee';

  // Tab visibility rules:
  // - Admin/HR: all tabs
  // - Employee (own profile): Resume + Security only
  // - Employee (other's profile): blocked at backend, but guard here too
  const tabs = [
    { id: 'resume',  label: 'Resume' },
    ...(canSeePrivate ? [{ id: 'private', label: 'Private Info' }] : []),
    ...(canSeeLeaves ? [{ id: 'leaves', label: 'Leave Balance' }] : []),
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



  const saveField = async (field, val) => {
    try { await api.put(`/employees/${id}`, { [field]: val }); setEmp(p=>({...p,[field]:val})); toast.success('Saved!'); }
    catch(e) { toast.error(e.message); }
  };


  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/employees')}>← Back</button>
      </div>

      {/* ── WIREFRAME HEADER ── */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-body" style={{display:'flex',gap:28,alignItems:'flex-start',flexWrap:'wrap',padding:'24px 28px'}}>
          {/* Photo */}
          <div style={{position:'relative',flexShrink:0}}>
            <div style={{width:100,height:100,borderRadius:'50%',overflow:'hidden',border:'3px solid var(--primary-light)',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,fontWeight:700,color:'#fff'}}>
              {emp.profile_image
                ? <img src={emp.profile_image} alt="profile" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : getInitials(emp.first_name,emp.last_name)}
            </div>
            {isOwnProfile && (
              <>
                <button onClick={()=>fileInputRef.current?.click()} title="Upload Photo"
                  style={{position:'absolute',bottom:2,right:2,width:28,height:28,borderRadius:'50%',background:'var(--primary)',color:'#fff',border:'2px solid #fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>
                  {uploadingImg?'…':'✏'}
                </button>
                <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={e=>handleImgUpload(e.target.files[0])} />
              </>
            )}
          </div>

          {/* Name + Contact */}
          <div style={{flex:1,minWidth:180}}>
            <h1 style={{fontSize:26,fontWeight:800,margin:'0 0 14px',color:'var(--text)'}}>{emp.first_name} {emp.last_name}</h1>
            {[['Login ID', emp.login_id||emp.employee_code],['Email', emp.email],['Mobile', emp.phone]].map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:12,fontSize:13,marginBottom:8,borderBottom:'1px solid var(--border)',paddingBottom:6}}>
                <span style={{color:'var(--text-3)',minWidth:70,fontWeight:600}}>{l}</span>
                <span style={{color:'var(--text-2)'}}>{v||'—'}</span>
              </div>
            ))}
          </div>

          {/* Company Info */}
          <div style={{minWidth:200,flexShrink:0}}>
            {[['Company','EmPay Technologies'],['Department',emp.department],['Manager',emp.manager_first_name?`${emp.manager_first_name} ${emp.manager_last_name}`:'—'],['Location',emp.location]].map(([l,val])=>(
              <LF key={l} label={l} value={val} />
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:'flex',borderBottom:'2px solid var(--border)',marginBottom:20}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{
            setTab(t.id);
            if (t.id === 'leaves') load(); // Re-fetch on tab switch to get dynamic balance updates
          }} style={{padding:'12px 24px',background:'none',border:'none',cursor:'pointer',fontSize:14,fontWeight:600,color:tab===t.id?'var(--primary)':'var(--text-3)',borderBottom:`2px solid ${tab===t.id?'var(--primary)':'transparent'}`,marginBottom:-2,transition:'all 0.2s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUME TAB (wireframe layout) ── */}
      {tab==='resume' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20}}>
                {/* Left column */}
                <div>
                  {[{key:'about',label:'About'},{key:'work_passion',label:'What I love about my job'},{key:'hobbies',label:'My interests and hobbies'}].map(({key,label})=>(
                    <div key={key} className="card" style={{marginBottom:16}}>
                      <div className="card-body">
                        <h3 style={{fontSize:15,fontWeight:700,marginBottom:10,color:'var(--text)'}}>{label}</h3>
                        <InlineEdit value={emp[key]} onSave={v=>saveField(key,v)} multiline canEdit={canEdit} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Right column */}
                <div>
                  <div className="card" style={{marginBottom:16}}>
                    <div className="card-header"><div className="card-title">Skills</div></div>
                    <div className="card-body">
                      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
                        {(emp.skills||'').split(',').filter(s=>s.trim()).map(s=>(
                          <span key={s} style={{background:'var(--primary-xlight)',color:'var(--primary)',fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:99,border:'1px solid var(--primary-light)'}}>{s.trim()}</span>
                        ))}
                        {!emp.skills && <span style={{color:'var(--text-4)',fontSize:13}}>No skills added</span>}
                      </div>
                      {canEdit && <InlineEdit value={emp.skills} onSave={v=>saveField('skills',v)} canEdit={canEdit} />}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-header"><div className="card-title">Certification</div></div>
                    <div className="card-body">
                      <div style={{marginBottom:8}}>
                        {(emp.certifications||'').split('\n').filter(s=>s.trim()).map((c,i)=>(
                          <div key={i} style={{display:'flex',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:13,color:'var(--text-2)'}}>🏅 {c.trim()}</div>
                        ))}
                        {!emp.certifications && <span style={{color:'var(--text-4)',fontSize:13}}>No certifications added</span>}
                      </div>
                      {canEdit && <InlineEdit value={emp.certifications} onSave={v=>saveField('certifications',v)} multiline canEdit={canEdit} />}
                    </div>
                  </div>
                </div>
              </div>
            )}

      {/* ── PRIVATE INFO TAB ── */}
      {tab==='private' && canSeePrivate && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Private Information</div>
            {canEdit && (editing
              ? <div style={{display:'flex',gap:8}}><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Save'}</button><button className="btn btn-secondary btn-sm" onClick={()=>{setEditing(false);setForm(emp);}}>Cancel</button></div>
              : <button className="btn btn-outline btn-sm" onClick={()=>setEditing(true)}>✏ Edit</button>
            )}
          </div>
          <div className="card-body">
          <>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>Personal Details</div>
                {editing ? (
                  <>
                    <div className="form-row">
                      <InputField label="Date of Birth" k="birth_date" type="date" form={form} onChange={f} />
                      <div className="form-group"><label className="form-label">Gender</label>
                        <select className="form-control" value={form.gender||''} onChange={e=>f('gender',e.target.value)}>
                          <option value="">Select...</option>
                          {['Male','Female','Other','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <InputField label="Nationality" k="nationality" form={form} onChange={f} />
                      <div className="form-group"><label className="form-label">Marital Status</label>
                        <select className="form-control" value={form.marital_status||''} onChange={e=>f('marital_status',e.target.value)}>
                          <option value="">Select...</option>
                          {['Single','Married','Divorced','Widowed'].map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <InputField label="Personal Email" k="personal_email" type="email" form={form} onChange={f} />
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
                      <InputField label="Account Number" k="bank_account" form={form} onChange={f} required />
                      <InputField label="Bank Name" k="bank_name" form={form} onChange={f} required />
                    </div>
                    <div className="form-row">
                      <InputField label="IFSC Code" k="ifsc_code" form={form} onChange={f} />
                      <InputField label="PAN Number" k="pan_number" form={form} onChange={f} required />
                    </div>
                    <div className="form-row">
                      <InputField label="UAN Number" k="uan_number" form={form} onChange={f} />
                      <InputField label="UAM ID" k="uam_id" form={form} onChange={f} />
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
          </div>
        </div>
      )}
      {/* ── SALARY TAB ── */}
            {tab==='salary' && canSeeSalary && (() => {
              const v = getSalaryValues();
              const dWpw = salaryEditing ? (salaryForm.working_days_per_week||5) : (emp.working_days_per_week||5);


              return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Salary Structure</div>
                      <div style={{fontSize:11,color:'var(--text-3)'}}>Formula-based dynamic computation</div>
                    </div>
                    {canEditSalary && (
                      salaryEditing
                        ? <div style={{display:'flex',gap:8}}>
                            <button className="btn btn-primary btn-sm" onClick={saveSalary} disabled={salarySaving}>{salarySaving?'Saving...':'💾 Save Changes'}</button>
                            <button className="btn btn-secondary btn-sm" onClick={()=>{setSalaryEditing(false); load();}}>Cancel</button>
                          </div>
                        : <button className="btn btn-outline btn-sm" onClick={()=>setSalaryEditing(true)}>✏ Edit Parameters</button>
                    )}
                  </div>

                  {/* Top Stats Cards */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:20}}>
                    <div style={{background:'var(--primary-xlight)',border:'1px solid var(--primary-light)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',marginBottom:6}}>Month Wage</div>
                      {salaryEditing
                        ? <input className="form-control" type="number" min="0" value={salaryForm.wage} onChange={e=>sf('wage',e.target.value)} required />
                        : <div style={{fontSize:22,fontWeight:800,color:'var(--primary)'}}>{fmtCurr(v.w)}</div>}
                    </div>
                    <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:6}}>Annual Salary</div>
                      <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{fmtCurr(v.w * 12)}</div>
                    </div>
                    <div style={{background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 18px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',marginBottom:6}}>Working Days</div>
                      {salaryEditing
                        ? <input className="form-control" type="number" min="1" max="7" value={salaryForm.working_days_per_week} onChange={e=>sf('working_days_per_week',e.target.value)} />
                        : <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>{dWpw} <span style={{fontSize:11,color:'var(--text-3)'}}>days/week</span></div>}
                    </div>
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                    {/* EARNINGS SECTION */}
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12,borderBottom:'2px solid var(--primary-light)',paddingBottom:4}}>Earnings</div>
                      
                      <SalaryRow label="Basic Salary" value={v.basic} pct={v.bp} desc={`${v.bp}% of Monthly Wage`} 
                        editInput={salaryEditing && <EditPct k="basic_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="House Rent Allowance" value={v.hra} pct={v.hp} desc={`${v.hp}% of Basic Salary`}
                        editInput={salaryEditing && <EditPct k="hra_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="Standard Allowance" value={v.std} pct={v.sp} desc={`${v.sp}% of Basic Salary`}
                        editInput={salaryEditing && <EditPct k="standard_allowance_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="Performance Bonus" value={v.perf} pct={v.pp} desc={`${v.pp}% of Basic Salary`}
                        editInput={salaryEditing && <EditPct k="perf_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="Leave Travel Allowance" value={v.lta} pct={v.lp} desc={`${v.lp}% of Basic Salary`}
                        editInput={salaryEditing && <EditPct k="lta_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="Fixed Allowance" value={v.fixed} desc="Balancing Component" />

                      <div style={{display:'flex',justifyContent:'space-between',padding:'14px 0',fontWeight:800,fontSize:16,color:'var(--primary)',borderTop:'2px solid var(--primary)',marginTop:8}}>
                        <span>Gross Salary</span><span>{fmtCurr(v.gross)}</span>
                      </div>
                    </div>

                    {/* DEDUCTIONS SECTION */}
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12,borderBottom:'2px solid var(--danger-light)',paddingBottom:4}}>Deductions</div>
                      
                      <SalaryRow label="Employee PF" value={v.ePf} pct={v.ep} desc={`${v.ep}% of Basic Salary`}
                        editInput={salaryEditing && <EditPct k="employee_pf_pct" salaryForm={salaryForm} onChange={sf} />} />
                      
                      <SalaryRow label="Professional Tax" value={v.pt} desc="Flat deduction"
                        editInput={salaryEditing && (
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <span style={{fontSize:12,color:'var(--text-3)'}}>₹</span>
                            <input type="number" min="0" value={salaryForm.prof_tax_amount}
                              onChange={e=>sf('prof_tax_amount',e.target.value)}
                              style={{width:80,padding:'2px 6px',fontSize:12,border:'1px solid var(--primary)',borderRadius:6,textAlign:'right'}} />
                          </div>
                        )} />
                      
                      <div style={{marginTop:20,paddingTop:12,borderTop:'1px solid var(--border)'}}>
                        <div style={{fontSize:12,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12,borderBottom:'2px solid var(--border)',paddingBottom:4}}>Contributions (Non-Gross)</div>
                        <SalaryRow label="Employer PF" value={v.rPf} pct={v.erp} desc={`${v.erp}% of Basic Salary`}
                          editInput={salaryEditing && <EditPct k="employer_pf_pct" salaryForm={salaryForm} onChange={sf} />} />
                      </div>

                      <div style={{display:'flex',justifyContent:'space-between',padding:'14px 0',fontWeight:800,fontSize:16,color:'var(--danger)',borderTop:'2px solid var(--danger-light)',marginTop:8}}>
                        <span>Total Deductions</span><span>{fmtCurr(v.deds)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{background:'var(--primary)',color:'#fff',borderRadius:'var(--radius)',padding:'20px 24px',display:'flex',justifyContent:'space-between',marginTop:24,boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,opacity:0.8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Net Salary (Take-home)</div>
                      <div style={{fontSize:28,fontWeight:800}}>{fmtCurr(v.net)}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,fontWeight:600,opacity:0.8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Annual Net</div>
                      <div style={{fontSize:22,fontWeight:700}}>{fmtCurr(v.net * 12)}</div>
                    </div>
                  </div>
                </>
              );
            })()}

      {/* ── LEAVE BALANCE TAB ── */}
      {tab==='leaves' && canSeeLeaves && (
        <div className="card">
          <div className="card-header">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}>
              <div className="card-title">Leave Balances — {new Date().getFullYear()}</div>
              <button 
                className="btn btn-sm btn-ghost" 
                onClick={load}
                style={{fontSize:12,padding:'4px 8px'}}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:20}}>
              {leaveBalances.length === 0 ? (
                <div style={{gridColumn:'1/-1',padding:40,textAlign:'center',color:'var(--text-3)'}}>No leave balances allocated for this year.</div>
              ) : leaveBalances.map(lb => {
                const remaining = lb.total_allocated - lb.used;
                const pct = (lb.used / lb.total_allocated) * 100;
                const color = lb.leave_type === 'sick' ? 'var(--danger)' : lb.leave_type === 'annual' ? 'var(--success)' : 'var(--primary)';
                return (
                  <div key={lb.id} style={{padding:20,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                      <div style={{textTransform:'capitalize',fontWeight:700,fontSize:15,color:'var(--text)'}}>{lb.leave_type} Leave</div>
                      <div style={{fontSize:18,fontWeight:800,color:color}}>{remaining} <span style={{fontSize:11,fontWeight:500,color:'var(--text-3)'}}>Days Left</span></div>
                    </div>
                    <div style={{height:8,background:'var(--surface-2)',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                      <div style={{height:'100%',width:`${Math.min(pct, 100)}%`,background:color,transition:'width 0.5s ease'}} />
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text-3)',fontWeight:500}}>
                      <span>Used: {lb.used}</span>
                      <span>Total: {lb.total_allocated}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:24,padding:16,background:'var(--surface-2)',borderRadius:8,fontSize:12,color:'var(--text-3)',lineHeight:1.6}}>
              <strong>Note:</strong> Leave balances are reset annually. Approved time-off requests automatically deduct from these balances. For any discrepancies, please contact HR.
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab==='security' && isOwnProfile && (
        <div className="card">
          <div className="card-body">
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
          </div>
        </div>
      )}
      {showCamera && <CameraModal onCapture={handleImgUpload} onClose={()=>setShowCamera(false)} />}
    </div>
  );
}


