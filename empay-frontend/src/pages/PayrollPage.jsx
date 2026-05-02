import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const STATUS_BADGE = { draft: 'badge-default', processed: 'badge-info', paid: 'badge-success' };

function PayslipModal({ payslip, onClose }) {
  const printRef = useRef();
  const handlePrint = () => {
    const w = window.open('', '', 'width=800,height=900');
    w.document.write('<html><head><title>Payslip</title><style>body{font-family:Inter,sans-serif;color:#0f172a;padding:32px} table{width:100%;border-collapse:collapse} td,th{padding:8px 12px;border:1px solid #e2e8f0;font-size:13px} th{background:#f8fafc;font-weight:600} .header{display:flex;justify-content:space-between;margin-bottom:24px} h2{margin:0} .section{margin:16px 0} .section-title{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:8px;} .net{background:#1e3a8a;color:#fff;padding:16px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}</style></head><body>');
    w.document.write(printRef.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close(); w.print();
  };
  const p = payslip;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Payslip — {MONTHS[p.pay_period_month-1]} {p.pay_period_year}</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-outline btn-sm" onClick={handlePrint}>🖨 Print</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body" ref={printRef}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,padding:'16px 20px',background:'var(--primary)',borderRadius:'var(--radius)',color:'#fff'}}>
            <div>
              <div style={{fontSize:20,fontWeight:800}}>EmPay HRMS</div>
              <div style={{fontSize:12,opacity:0.7}}>Payslip for {MONTHS[p.pay_period_month-1]} {p.pay_period_year}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <span className={`badge badge-${p.status==='paid'?'success':p.status==='processed'?'info':'default'}`}>{p.status?.toUpperCase()}</span>
            </div>
          </div>

          <div className="form-row" style={{marginBottom:20}}>
            {[['Employee','`'+p.first_name+' '+p.last_name+'`'],['Employee Code',p.employee_code],['Department',p.department],['Designation',p.designation],['Bank Account',p.bank_account||'—'],['PAN',p.pan_number||'—'],['Days Worked',`${p.days_worked} / ${p.working_days}`]].map(([k,v])=>(
              <div key={k}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>{k}</div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{v.replace(/`/g,'')}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,borderBottom:'2px solid var(--primary)',paddingBottom:6}}>EARNINGS</div>
              {[['Basic Salary',p.basic_salary],['HRA',p.hra],['Standard Allowance',p.standard_allowance],['Performance Bonus',p.performance_bonus],['LTA',p.lta],['Fixed Allowance',p.fixed_allowance]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--text-2)'}}>{k}</span><span style={{fontWeight:600}}>{fmtCurr(v)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:14,fontWeight:700,color:'var(--primary)'}}>
                <span>Gross Earnings</span><span>{fmtCurr(p.gross_earnings)}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--danger)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,borderBottom:'2px solid var(--danger)',paddingBottom:6}}>DEDUCTIONS</div>
              {[['PF (Employee 12%)',p.pf_employee],['PF (Employer 12%)',p.pf_employer],['Professional Tax',p.professional_tax],['TDS',p.tds]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--text-2)'}}>{k}</span><span style={{fontWeight:600,color:'var(--danger)'}}>{fmtCurr(v)}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:14,fontWeight:700,color:'var(--danger)'}}>
                <span>Total Deductions</span><span>{fmtCurr(p.total_deductions)}</span>
              </div>
            </div>
          </div>
          <div style={{background:'var(--primary)',color:'#fff',padding:'16px 20px',borderRadius:'var(--radius)',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20}}>
            <span style={{fontSize:16,fontWeight:700}}>Net Pay</span>
            <span style={{fontSize:24,fontWeight:800}}>{fmtCurr(p.net_pay)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerateModal({ employees, onClose, onGenerate }) {
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), employee_ids: [] });
  const [loading, setLoading] = useState(false);
  const generate = async (e) => {
    e.preventDefault(); setLoading(true);
    try { const r = await api.post('/payroll/generate', form); toast.success(`Generated for ${r.data?.length} employees`); onGenerate(); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Generate Payroll</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={generate}>
          <div className="modal-body">
            <div className="alert alert-info" style={{marginBottom:16}}>Payroll will be auto-calculated based on attendance records for the selected month.</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Month</label>
                <select className="form-control" value={form.month} onChange={e=>setForm(p=>({...p,month:+e.target.value}))}>
                  {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Year</label><input className="form-control" type="number" value={form.year} onChange={e=>setForm(p=>({...p,year:+e.target.value}))} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Employees (leave blank for all)</label>
              <select className="form-control" multiple size={5} onChange={e=>setForm(p=>({...p,employee_ids:[...e.target.selectedOptions].map(o=>+o.value)}))}>
                {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.employee_code}</option>)}
              </select>
              <div className="form-error">Hold Ctrl/Cmd to select multiple. Leave unselected for all.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Generating...':'⚡ Run Payroll'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), employee_id: '' });
  const [showGenerate, setShowGenerate] = useState(false);
  const [payslip, setPayslip] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/payroll?month=${filters.month}&year=${filters.year}${filters.employee_id?`&employee_id=${filters.employee_id}`:''}`).then(r=>setRecords(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { api.get('/employees').then(r=>setEmployees(r.data)).catch(()=>{}); }, []);
  useEffect(() => { load(); }, [filters]);

  const openPayslip = async (id) => {
    try { const r = await api.get(`/payroll/payslip/${id}`); setPayslip(r.data); }
    catch (err) { toast.error(err.message); }
  };

  const markPaid = async (id) => {
    try { await api.put(`/payroll/${id}`, { status: 'paid' }); toast.success('Marked as paid'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const totalNetPay = records.reduce((s, r) => s + Number(r.net_pay || 0), 0);
  const totalGross = records.reduce((s, r) => s + Number(r.gross_earnings || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Payroll</h1><p>Manage monthly payroll runs and payslips</p></div>
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>⚡ Generate Payroll</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Records', value: records.length, icon: '📋', color: '#1e3a8a', bg: '#dbeafe' },
          { label: 'Gross Payroll', value: fmtCurr(totalGross), icon: '💼', color: '#059669', bg: '#d1fae5' },
          { label: 'Net Payroll', value: fmtCurr(totalNetPay), icon: '💰', color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Paid', value: records.filter(r=>r.status==='paid').length, icon: '✅', color: '#d97706', bg: '#fef3c7' },
        ].map(c=>(
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{background:c.bg,color:c.color}}>{c.icon}</div>
            <div className="stat-value" style={{fontSize:c.label.includes('Payroll')?16:28}}>{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-control" style={{width:140}} value={filters.month} onChange={e=>setFilters(p=>({...p,month:e.target.value}))}>
          {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
        </select>
        <select className="form-control" style={{width:100}} value={filters.year} onChange={e=>setFilters(p=>({...p,year:e.target.value}))}>
          {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
        </select>
        <select className="form-control" style={{width:200}} value={filters.employee_id} onChange={e=>setFilters(p=>({...p,employee_id:e.target.value}))}>
          <option value="">All Employees</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Employee</th><th>Period</th><th>Days</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No payroll records. Click "Generate Payroll" to start.</td></tr>
                ) : records.map(r=>(
                  <tr key={r.id}>
                    <td><div style={{fontWeight:600}}>{r.first_name} {r.last_name}</div><div style={{fontSize:11,color:'var(--text-4)'}}>{r.employee_code}</div></td>
                    <td style={{fontWeight:500}}>{MONTHS[r.pay_period_month-1].slice(0,3)} {r.pay_period_year}</td>
                    <td>{r.days_worked}/{r.working_days}</td>
                    <td style={{fontWeight:500}}>{fmtCurr(r.gross_earnings)}</td>
                    <td style={{color:'var(--danger)'}}>{fmtCurr(r.total_deductions)}</td>
                    <td style={{fontWeight:700,color:'var(--primary)'}}>{fmtCurr(r.net_pay)}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]||'badge-default'}`}>{r.status}</span></td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-sm btn-secondary" onClick={()=>openPayslip(r.id)}>📄 Payslip</button>
                        {r.status !== 'paid' && <button className="btn btn-sm btn-success" onClick={()=>markPaid(r.id)}>✓ Mark Paid</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenerate && <GenerateModal employees={employees} onClose={()=>setShowGenerate(false)} onGenerate={()=>{setShowGenerate(false);load();}} />}
      {payslip && <PayslipModal payslip={payslip} onClose={()=>setPayslip(null)} />}
    </div>
  );
}
