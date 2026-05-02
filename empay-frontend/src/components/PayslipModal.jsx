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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const ref = useRef();

  const print = () => {
    const w = window.open('','','width=820,height=960');
    w.document.write(`<html><head><title>Payslip</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,400;0,700;1,400&display=swap');
      body{font-family:'Comic Neue',cursive,sans-serif;padding:32px;color:#333;font-size:14px}
      .payslip-container{border:1px solid #93c5fd;border-radius:12px;padding:24px;}
      .header-logo{font-weight:bold;margin-bottom:12px;font-size:16px;}
      hr.sep{border:0;border-top:1px solid #93c5fd;margin:12px -24px 20px -24px;}
      h2.title{color:#06b6d4;margin-top:0;font-size:20px;font-weight:700;}
      .emp-details{border:1px solid #93c5fd;border-radius:12px;padding:16px;display:flex;justify-content:space-between;color:#6366f1;margin-bottom:20px;}
      .emp-details table{width:48%;border:none;}
      .emp-details td{padding:4px 0;}
      .section-box{border:1px solid #93c5fd;border-radius:12px;overflow:hidden;margin-bottom:20px;}
      .purple-header{background:#6b4c7a;color:white;padding:10px 20px;display:flex;justify-content:space-between;font-weight:bold;}
      .purple-header th{color:white;font-weight:bold;padding:10px 20px;text-align:left;}
      .row{padding:10px 20px;display:flex;justify-content:space-between;color:#6366f1;}
      .row-sep{border:0;border-top:1px solid #93c5fd;margin:0;}
      table.breakdown{width:100%;border-collapse:collapse;}
      table.breakdown td{padding:10px 20px;font-size:13px;}
      .footer-bar{display:flex;background:#6b4c7a;color:white;align-items:stretch;}
      .footer-left{flex:1;padding:16px 20px;font-size:18px;font-weight:bold;display:flex;align-items:center;}
      .footer-right{background:#06b6d4;padding:16px 30px;text-align:center;display:flex;flex-direction:column;justify-content:center;min-width:160px;}
    </style></head><body>`);
    w.document.write(ref.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 500); // slight delay for fonts to load
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
      <div className="modal modal-lg" style={{ maxWidth: 840, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowBreakdown(!showBreakdown)}>
            {showBreakdown ? 'Hide Breakdown' : 'Compute'}
          </button>
          {p.status !== 'paid' && (
            <button className="btn btn-sm btn-success" onClick={() => doAction('paid', 'Payslip validated!')}>Validate</button>
          )}
          <button className="btn btn-sm btn-danger" onClick={() => doAction('draft', 'Payslip cancelled')}>Cancel</button>
          <button className="btn btn-sm btn-outline" onClick={print}>🖨 Print</button>
          <button className="modal-close" style={{ marginLeft: 'auto' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ flex: 1, padding: 24, background: '#f8fafc' }}>
          
          {/* Printable Payslip Container */}
          <div ref={ref} style={{ fontFamily: "'Comic Neue', cursive, sans-serif", color: '#333' }}>
            <div className="payslip-container" style={{ border: '1px solid #93c5fd', borderRadius: 12, padding: 24, background: '#fff' }}>
              
              <div className="header-logo" style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 16 }}>
                EmPay HRMS Corporation
              </div>
              <hr className="sep" style={{ border: 0, borderTop: '1px solid #93c5fd', margin: '12px -24px 20px -24px' }} />
              
              <h2 className="title" style={{ color: '#06b6d4', marginTop: 0, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                Salary slip for month of {MF[p.pay_period_month - 1].toLowerCase()} {p.pay_period_year}
              </h2>

              {/* Employee Details Box */}
              <div className="emp-details" style={{ border: '1px solid #93c5fd', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', color: '#6366f1', marginBottom: 20 }}>
                <table style={{ width: '48%', border: 'none', fontSize: 13 }}>
                  <tbody>
                    <tr><td style={{padding:'4px 0'}}>Employee name</td><td style={{padding:'4px 0'}}>: {p.first_name} {p.last_name}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Employee Code</td><td style={{padding:'4px 0'}}>: {p.employee_code}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Department</td><td style={{padding:'4px 0'}}>: {p.department || '—'}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Location</td><td style={{padding:'4px 0'}}>: {p.location || '—'}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Date of joining</td><td style={{padding:'4px 0'}}>: {joinDate}</td></tr>
                  </tbody>
                </table>
                <table style={{ width: '48%', border: 'none', fontSize: 13 }}>
                  <tbody>
                    <tr><td style={{padding:'4px 0'}}>PAN</td><td style={{padding:'4px 0'}}>: {p.pan_number || '—'}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>UAN</td><td style={{padding:'4px 0'}}>: {p.uan_number || '—'}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Bank A/c NO.</td><td style={{padding:'4px 0'}}>: {p.bank_account || '—'}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Pay period</td><td style={{padding:'4px 0'}}>: 1/{p.pay_period_month}/{p.pay_period_year} to {periodEnd}/{p.pay_period_month}/{p.pay_period_year}</td></tr>
                    <tr><td style={{padding:'4px 0'}}>Pay date</td><td style={{padding:'4px 0'}}>: {payDate}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Worked Days Box */}
              <div className="section-box" style={{ border: '1px solid #93c5fd', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                <div className="purple-header" style={{ background: '#6b4c7a', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Worked Days</span>
                  <span>Number of Days</span>
                </div>
                <div className="row" style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', color: '#6366f1', fontSize: 13 }}>
                  <span>Attendance</span>
                  <span>{attDays} Days</span>
                </div>
                <hr className="row-sep" style={{ border: 0, borderTop: '1px solid #93c5fd', margin: 0 }} />
                <div className="row" style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', color: '#6366f1', fontSize: 13 }}>
                  <span>Total</span>
                  <span>{wDays} Days</span>
                </div>
              </div>

              {/* Earnings & Deductions */}
              {showBreakdown && (
                <div className="section-box" style={{ border: '1px solid #93c5fd', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                  <table className="breakdown" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="purple-header" style={{ background: '#6b4c7a' }}>
                        <th style={{ color: 'white', fontWeight: 'bold', padding: '10px 20px', textAlign: 'left' }}>Earnings</th>
                        <th style={{ color: 'white', fontWeight: 'bold', padding: '10px 20px', textAlign: 'left' }}>Amounts</th>
                        <th style={{ color: 'white', fontWeight: 'bold', padding: '10px 20px', textAlign: 'left' }}>Deductions</th>
                        <th style={{ color: 'white', fontWeight: 'bold', padding: '10px 20px', textAlign: 'left' }}>Amounts</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: '#333' }}>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Basic Salary</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.basic_salary)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>PF Employee</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>- {fc(p.pf_employee)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>House Rent Allowance</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.hra)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>PF Employer</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>- {fc(p.pf_employer)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Standard Allowance</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.standard_allowance)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Professional Tax</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>- {fc(p.professional_tax)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Performance Bonus</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.performance_bonus)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>TDS Deduction</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>- {fc(p.tds_deduction || 0)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Leave Travel Allowance</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.lta)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>Fixed Allowance</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}>{fc(p.fixed_allowance)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 20px', fontSize: 13, paddingTop: 20 }}>Gross</td>
                        <td style={{ padding: '10px 20px', fontSize: 13, paddingTop: 20 }}>{fc(p.gross_earnings)}</td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                        <td style={{ padding: '10px 20px', fontSize: 13 }}></td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {/* Total Bar */}
                  <div className="footer-bar" style={{ display: 'flex', background: '#6b4c7a', color: 'white', alignItems: 'stretch' }}>
                    <div className="footer-left" style={{ flex: 1, padding: '16px 20px', fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                      Total Net Payable <span style={{ fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>(Gross Earning - Total deductions)</span>
                    </div>
                    <div className="footer-right" style={{ background: '#06b6d4', padding: '16px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 160 }}>
                      <div style={{ fontSize: 18, fontWeight: 'bold' }}>{fc(p.net_pay).replace('₹', '')}</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>[{numToWords(p.net_pay)}] only</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
