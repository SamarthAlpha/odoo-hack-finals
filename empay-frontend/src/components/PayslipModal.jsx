import { useState, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fc = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;

export default function PayslipModal({ p, onClose, onRefresh }) {
  const [tab, setTab] = useState('worked');
  const ref = useRef();

  const print = () => {
    const w = window.open('','','width=820,height=960');
    w.document.write(`<html><head><title>Payslip</title><style>
      body{font-family:Inter,sans-serif;padding:32px;color:#0f172a}
      h3{margin:0 0 12px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      td,th{padding:8px 12px;border:1px solid #e2e8f0;font-size:13px}
      th{background:#f8fafc;font-weight:600;text-align:left}
      .info{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:13px;margin-bottom:20px}
      .lbl{color:#64748b;font-weight:600}
    </style></head><body>`);
    w.document.write(ref.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close(); w.print();
  };

  const doAction = async (status, msg) => {
    try { await api.put(`/payroll/${p.id}`, { status }); toast.success(msg); onRefresh(); }
    catch(e) { toast.error(e.message); }
  };

  const wDays  = parseFloat(p.working_days) || 22;
  const attDays = parseFloat(p.days_worked) || 0;
  const pLeave  = Math.max(0, wDays - attDays);
  const wage    = parseFloat(p.wage || 0) || parseFloat(p.gross_earnings || 0);
  const attAmt  = wDays > 0 ? (wage / wDays) * attDays : 0;
  const leaveAmt = wDays > 0 ? (wage / wDays) * pLeave : 0;

  const salaryRows = [
    { name: 'Basic Salary',            val: p.basic_salary,       deduct: false },
    { name: 'House Rent Allowance',    val: p.hra,                deduct: false },
    { name: 'Standard Allowance',      val: p.standard_allowance, deduct: false },
    { name: 'Performance Bonus',       val: p.performance_bonus,  deduct: false },
    { name: 'Leave Travel Allowance',  val: p.lta,                deduct: false },
    { name: 'Fixed Allowance',         val: p.fixed_allowance,    deduct: false },
    { name: 'Gross',                   val: p.gross_earnings,     deduct: false, bold: true },
    { name: 'PF Employee',             val: p.pf_employee,        deduct: true  },
    { name: "PF Employer's",           val: p.pf_employer,        deduct: true  },
    { name: 'Professional Tax',        val: p.professional_tax,   deduct: true  },
    { name: 'Net Amount',              val: p.net_pay,            deduct: false, bold: true, highlight: true },
  ];

  const periodEnd = new Date(p.pay_period_year, p.pay_period_month, 0).getDate();

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)' }}>
          <button className="btn btn-sm" style={{ background: '#818cf8', color: '#fff' }} onClick={onClose}>+ New Payslip</button>
          <button className="btn btn-sm btn-secondary">Compute</button>
          {p.status !== 'paid' && (
            <button className="btn btn-sm btn-success" onClick={() => doAction('paid', 'Payslip validated!')}>Validate</button>
          )}
          <button className="btn btn-sm btn-danger" onClick={() => doAction('draft', 'Payslip cancelled')}>Cancel</button>
          <button className="btn btn-sm btn-outline" onClick={print}>🖨 Print</button>
          <button className="modal-close" style={{ marginLeft: 'auto' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" ref={ref} style={{ flex: 1 }}>
          {/* Employee header */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>[{p.first_name} {p.last_name}]</h3>
            <div className="info" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '7px 16px', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Payrun</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
                Payrun {MF[p.pay_period_month - 1]} {p.pay_period_year}
              </span>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Salary Structure</span>
              <span>Regular Pay</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Period</span>
              <span>01 {MS[p.pay_period_month - 1]} To {periodEnd} {MS[p.pay_period_month - 1]}</span>
            </div>
          </div>

          {/* Status badge */}
          <div style={{ marginBottom: 16 }}>
            <span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'processed' ? 'badge-info' : 'badge-default'}`} style={{ fontSize: 12 }}>
              {p.status === 'paid' ? 'DONE' : p.status?.toUpperCase()}
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 18, gap: 0 }}>
            {[['worked', 'Worked Days'], ['salary', 'Salary Computation']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: '8px 22px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                borderBottom: tab === k ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === k ? 'var(--primary)' : 'var(--text-3)', marginBottom: -2
              }}>{label}</button>
            ))}
          </div>

          {/* Worked Days */}
          {tab === 'worked' && (
            <div>
              <table className="data-table">
                <thead>
                  <tr><th>Type</th><th>Days</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Attendance</td>
                    <td>{attDays.toFixed(2)} (5 working days in week)</td>
                    <td>{fc(attAmt)}</td>
                  </tr>
                  <tr>
                    <td>Paid Time off</td>
                    <td>{pLeave.toFixed(2)} (2 Paid leaves/Month)</td>
                    <td>{fc(leaveAmt)}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, background: 'var(--surface)' }}>
                    <td></td>
                    <td>{(attDays + pLeave).toFixed(2)}</td>
                    <td>{fc(attAmt + leaveAmt)}</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 12, lineHeight: 1.6 }}>
                Salary is calculated based on the employee's monthly attendance. Paid leaves are included in the total payable days, while unpaid leaves are deducted from the salary.
              </p>
            </div>
          )}

          {/* Salary Computation */}
          {tab === 'salary' && (
            <table className="data-table">
              <thead>
                <tr><th>Rule Name</th><th>Rate %</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {salaryRows.map(({ name, val, deduct, bold, highlight }, i) => (
                  <tr key={i} style={{ fontWeight: bold ? 700 : undefined, background: highlight ? 'var(--surface)' : undefined }}>
                    <td style={{ color: deduct ? 'var(--danger)' : undefined }}>{name}</td>
                    <td>100</td>
                    <td style={{ fontWeight: bold ? 700 : undefined, color: deduct ? 'var(--danger)' : highlight ? 'var(--primary)' : undefined }}>
                      {deduct ? `- ${fc(val)}` : fc(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
