import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import '../print.css';

const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fc = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;

function SalaryStatement() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/employees').then(r => setEmployees(r || [])).catch(() => {});
  }, []);

  const generateReport = async () => {
    if (!selectedEmployee || !selectedYear) {
      toast.error('Please select an employee and a year.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/payroll/statement?employee_id=${selectedEmployee}&year=${selectedYear}`);
      setReportData(res);
    } catch (err) {
      toast.error(err.message || 'Could not generate report.');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totals = reportData?.monthly_data.reduce((acc, month) => {
    acc.gross_earnings += Number(month.gross_earnings) || 0;
    acc.total_deductions += Number(month.total_deductions) || 0;
    acc.net_pay += Number(month.net_pay) || 0;
    return acc;
  }, { gross_earnings: 0, total_deductions: 0, net_pay: 0 });

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="form-row no-print" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Employee</label>
          <select className="form-control" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
            <option value="">Select Employee</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <select className="form-control" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-group">
          <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {reportData && (
        <div>
          <div className="no-print" style={{ textAlign: 'right', marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={handlePrint}>🖨️ Print</button>
          </div>
          <div id="printable-statement">
            <div className="print-header">
              <h1>EmPay Inc.</h1>
              <p>Salary Statement for {selectedYear}</p>
            </div>

            <div className="employee-details">
              <div>
                <strong>Employee:</strong> {reportData.employee.first_name} {reportData.employee.last_name}<br/>
                <strong>Designation:</strong> {reportData.employee.designation}
              </div>
              <div>
                <strong>Date of Joining:</strong> {new Date(reportData.employee.date_of_joining).toLocaleDateString()}<br/>
                <strong>Salary Effective From:</strong> {new Date(reportData.employee.date_of_joining).toLocaleDateString()}
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Salary Components</th>
                  {MF.map((m) => <th key={m} className="text-right">{m.slice(0,3)}</th>)}
                  <th className="text-right">Yearly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section-header"><td colSpan="14">Earnings</td></tr>
                <tr>
                  <td>Basic</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.basic_salary)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.basic_salary), 0))}</td>
                </tr>
                <tr>
                  <td>HRA</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.hra)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.hra), 0))}</td>
                </tr>
                 <tr>
                  <td>Standard Allowance</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.standard_allowance)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.standard_allowance), 0))}</td>
                </tr>
                 <tr>
                  <td>Performance Bonus</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.performance_bonus)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.performance_bonus), 0))}</td>
                </tr>
                 <tr>
                  <td>LTA</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.lta)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.lta), 0))}</td>
                </tr>
                 <tr>
                  <td>Fixed Allowance</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.fixed_allowance)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.fixed_allowance), 0))}</td>
                </tr>
                <tr className="total-row">
                  <td>Gross Earnings</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.gross_earnings)}</td>)}
                  <td className="text-right">{fc(totals.gross_earnings)}</td>
                </tr>

                <tr className="section-header"><td colSpan="14">Deductions</td></tr>
                <tr>
                  <td>Provident Fund (PF)</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.pf_employee)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.pf_employee), 0))}</td>
                </tr>
                <tr>
                  <td>Professional Tax</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.professional_tax)}</td>)}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{fc(reportData.monthly_data.reduce((s, m) => s + Number(m.professional_tax), 0))}</td>
                </tr>
                <tr className="total-row">
                  <td>Total Deductions</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.total_deductions)}</td>)}
                  <td className="text-right">{fc(totals.total_deductions)}</td>
                </tr>

                <tr className="net-salary-row">
                  <td>Net Salary</td>
                  {reportData.monthly_data.map((d,i) => <td key={i} className="text-right">{fc(d.net_pay)}</td>)}
                  <td className="text-right">{fc(totals.net_pay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalaryStatement;
