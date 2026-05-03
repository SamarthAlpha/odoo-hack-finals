import { useState, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fc = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;

const numToWords = (num) => {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  let nFloor = Math.floor(num);
  if (nFloor === 0) return 'Zero Rupees';
  if ((nFloor = nFloor.toString()).length > 9) return 'Overflow';
  let n = ('000000000' + nFloor).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' Rupees';
};

export default function PayslipModal({ p, onClose, onRefresh }) {
  const [showBreakdown, setShowBreakdown] = useState(true);
  const ref = useRef();

  const print = () => {
    const w = window.open('','','width=850,height=960');
    w.document.write(`<html><head><title>Payslip</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      body {
        font-family: 'Inter', system-ui, sans-serif;
        padding: 40px;
        color: #1e293b;
        font-size: 13px;
        line-height: 1.5;
        background: #fff;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .payslip-inner { max-width: 800px; margin: 0 auto; }
      .brand-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
      .brand-info h1 { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
      .brand-info p { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
      .payslip-title { margin-bottom: 24px; }
      .payslip-title h2 { font-size: 22px; font-weight: 700; color: #1e3a8a; margin: 0; }
      .payslip-title p { font-size: 13px; color: #64748b; margin-top: 4px; }
      
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
      .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 5px 0; }
      .info-label { color: #64748b; font-weight: 500; font-size: 11px; text-transform: uppercase; width: 40%; }
      .info-value { color: #0f172a; font-weight: 600; font-size: 12px; }

      .section { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
      .section-header { background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
      .section-header h3 { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
      
      .table-data { width: 100%; border-collapse: collapse; }
      .table-data th { background: #f8fafc; padding: 10px 20px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
      .table-data td { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
      .table-data tr:last-child td { border-bottom: none; }
      
      .amount-col { text-align: right; font-variant-numeric: tabular-nums; }
      .bold-text { font-weight: 700; color: #0f172a; }
      
      .total-row { background: #1e3a8a !important; color: #fff !important; }
      .total-row td { padding: 20px !important; border: none; }
      .total-label { font-size: 16px; font-weight: 700; }
      .total-amount { font-size: 24px; font-weight: 800; text-align: right; }
      .amount-words { font-size: 11px; font-weight: 400; opacity: 0.9; margin-top: 4px; display: block; }

      @media print {
        @page { margin: 15mm; }
        body { padding: 0; }
      }
    </style></head><body>`);
    w.document.write('<div class="payslip-inner">');
    w.document.write(ref.current.innerHTML);
    w.document.write('</div></body></html>');
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const doAction = async (status, msg) => {
    try { await api.put(`/payroll/${p.id}`, { status }); toast.success(msg); onRefresh(); }
    catch(e) { toast.error(e.message); }
  };

  const wDays  = parseFloat(p.working_days) || 22;
  const attDays = parseFloat(p.days_worked) || 0;
  
  const periodEnd = new Date(p.pay_period_year, p.pay_period_month, 0).getDate();
  const joinDate = p.date_of_joining ? new Date(p.date_of_joining).toLocaleDateString('en-GB') : '—';
  const payDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 900, maxHeight: '94vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 28px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', alignItems: 'center', background: '#fff', position: 'sticky', top: 0, zindex: 10 }}>
          <div style={{ marginRight: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Payslip Management</h3>
          </div>
          {p.status !== 'paid' && (
            <button className="btn btn-sm btn-success" onClick={() => doAction('paid', 'Payslip validated!')}>Validate</button>
          )}
          <button className="btn btn-sm btn-danger" onClick={() => doAction('draft', 'Payslip cancelled')}>Cancel</button>
          <button className="btn btn-sm btn-outline" onClick={print}>🖨 Print Payslip</button>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: '32px 40px', background: '#fff', margin: '20px 28px', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          
          <div ref={ref}>
            <div className="brand-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #f1f5f9', paddingBottom: 20 }}>
              <div className="brand-info">
                <h1 style={{ fontSize: 18, fontweight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>EmPay HRMS Corporation</h1>
                <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Excellence in Human Capital Management</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: p.status === 'paid' ? '#d1fae5' : '#fef3c7', color: p.status === 'paid' ? '#065f46' : '#92400e', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {p.status}
                </div>
              </div>
            </div>
            
            <div className="payslip-title" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a8a', margin: 0 }}>Salary Statement</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>For the period of {MF[p.pay_period_month - 1]} {p.pay_period_year}</p>
            </div>

            <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div className="info-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
                <table className="info-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', width: '45%', padding: '4px 0' }}>Employee Name</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.first_name} {p.last_name}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Employee Code</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.employee_code}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Department</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.department || '—'}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Location</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.location || '—'}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Joining Date</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{joinDate}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="info-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
                <table className="info-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', width: '45%', padding: '4px 0' }}>PAN Number</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.pan_number || '—'}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>UAN Number</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.uan_number || '—'}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Bank Account</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{p.bank_account || '—'}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Pay Period</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{MF[p.pay_period_month-1]} {p.pay_period_year}</td></tr>
                    <tr><td style={{ color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', padding: '4px 0' }}>Payment Date</td><td style={{ color: '#0f172a', fontWeight: 700, fontSize: 13, padding: '4px 0' }}>{payDate}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              <div className="section-header" style={{ background: '#f1f5f9', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Attendance Summary</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>{attDays} / {wDays} Days Worked</span>
              </div>
            </div>

            <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              <table className="table-data" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#f8fafc', padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Earnings</th>
                    <th style={{ background: '#f8fafc', padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                    <th style={{ background: '#f8fafc', padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Deductions</th>
                    <th style={{ background: '#f8fafc', padding: '12px 20px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>Basic Salary</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{fc(p.basic_salary)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>PF Employee</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>- {fc(p.pf_employee)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>HRA</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{fc(p.hra)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>PF Employer</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>- {fc(p.pf_employer)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>Standard Allowance</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{fc(p.standard_allowance)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>Professional Tax</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>- {fc(p.professional_tax)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>Performance Bonus</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{fc(p.performance_bonus)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>TDS</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>- {fc(p.tds_deduction || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}>Other Allowances</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{fc(p.fixed_allowance + p.lta)}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#475569' }}></td>
                    <td style={{ padding: '12px 20px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}></td>
                  </tr>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Gross Earnings</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, textAlign: 'right', fontWeight: 800, color: '#1e3a8a' }}>{fc(p.gross_earnings)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>Total Deductions</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>- {fc(p.total_deductions)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="total-bar" style={{ background: '#1e3a8a', color: '#fff', padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Net Payable</span>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 4 }}>{numToWords(p.net_pay)} only</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {fc(p.net_pay)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
