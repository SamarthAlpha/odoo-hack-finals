import { useState, useEffect } from 'react';
import api from '../utils/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

export default function ReportsPage() {
  const [tab, setTab] = useState('payroll');
  const [payroll, setPayroll] = useState([]);
  const [timeoff, setTimeoff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'payroll') {
        const r = await api.get(`/payroll?month=${filters.month}&year=${filters.year}`);
        setPayroll(r.data);
      } else if (tab === 'timeoff') {
        const r = await api.get('/timeoff');
        setTimeoff(r.data);
      } else {
        const r = await api.get(`/attendance?month=${filters.month}&year=${filters.year}`);
        setAttendance(r.data);
      }
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, [tab, filters]);

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k]??''}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Reports</h1><p>View and export payroll, leave and attendance reports</p></div>
        </div>
      </div>

      <div className="filter-bar" style={{marginBottom:20}}>
        <div className="tabs">
          {[['payroll','💰 Payroll'],['timeoff','✈️ Time Off'],['attendance','📅 Attendance']].map(([k,l])=>(
            <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <select className="form-control" style={{width:140}} value={filters.month} onChange={e=>setFilters(p=>({...p,month:e.target.value}))}>
          {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
        </select>
        <select className="form-control" style={{width:100}} value={filters.year} onChange={e=>setFilters(p=>({...p,year:e.target.value}))}>
          {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={()=>exportCSV(tab==='payroll'?payroll:tab==='timeoff'?timeoff:attendance, `empay_${tab}_${filters.month}_${filters.year}.csv`)}>⬇️ Export CSV</button>
      </div>

      <div className="card">
        {loading ? <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div> : (
          <div className="table-wrap">
            {tab === 'payroll' && (
              <>
                {/* Summary row */}
                {payroll.length > 0 && (
                  <div style={{display:'flex',gap:20,padding:'14px 20px',background:'var(--primary-xlight)',borderBottom:'1px solid var(--border)'}}>
                    {[
                      ['Records', payroll.length],
                      ['Total Gross', fmtCurr(payroll.reduce((s,r)=>s+Number(r.gross_earnings||0),0))],
                      ['Total Net', fmtCurr(payroll.reduce((s,r)=>s+Number(r.net_pay||0),0))],
                      ['Total PF', fmtCurr(payroll.reduce((s,r)=>s+Number(r.pf_employee||0)+Number(r.pf_employer||0),0))],
                    ].map(([k,v])=>(
                      <div key={k}><span style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase'}}>{k}: </span><span style={{fontSize:13,fontWeight:700,color:'var(--primary)'}}>{v}</span></div>
                    ))}
                  </div>
                )}
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Days Worked</th><th>Basic</th><th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr></thead>
                  <tbody>
                    {payroll.length===0?<tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No payroll data for this period</td></tr>
                    :payroll.map(r=>(
                      <tr key={r.id}>
                        <td style={{fontWeight:500}}>{r.first_name} {r.last_name}</td>
                        <td style={{color:'var(--text-4)',fontSize:12}}>{r.employee_code}</td>
                        <td>{r.department}</td>
                        <td>{r.days_worked}/{r.working_days}</td>
                        <td>{fmtCurr(r.basic_salary)}</td>
                        <td style={{fontWeight:600}}>{fmtCurr(r.gross_earnings)}</td>
                        <td style={{color:'var(--danger)'}}>{fmtCurr(r.total_deductions)}</td>
                        <td style={{fontWeight:700,color:'var(--primary)'}}>{fmtCurr(r.net_pay)}</td>
                        <td><span className={`badge ${r.status==='paid'?'badge-success':r.status==='processed'?'badge-info':'badge-default'}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {tab === 'timeoff' && (
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Code</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>
                  {timeoff.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No leave requests</td></tr>
                  :timeoff.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.first_name} {r.last_name}</td>
                      <td style={{color:'var(--text-4)',fontSize:12}}>{r.employee_code}</td>
                      <td style={{textTransform:'capitalize'}}>{r.leave_type}</td>
                      <td>{fmtDate(r.start_date)}</td>
                      <td>{fmtDate(r.end_date)}</td>
                      <td style={{fontWeight:600}}>{r.total_days}</td>
                      <td><span className={`badge ${r.status==='approved'?'badge-success':r.status==='rejected'?'badge-danger':'badge-warning'}`}>{r.status}</span></td>
                      <td style={{color:'var(--text-3)',fontSize:12,maxWidth:180}}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'attendance' && (
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {attendance.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No attendance data</td></tr>
                  :attendance.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500}}>{r.first_name} {r.last_name}</td>
                      <td style={{color:'var(--text-4)',fontSize:12}}>{r.employee_code}</td>
                      <td>{r.department}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.check_in?new Date(r.check_in).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                      <td>{r.check_out?new Date(r.check_out).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                      <td>{r.total_hours?`${r.total_hours}h`:'—'}</td>
                      <td><span className={`badge ${r.status==='present'?'badge-success':r.status==='on_leave'?'badge-info':r.status==='half_day'?'badge-warning':'badge-default'}`}>{r.status?.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
