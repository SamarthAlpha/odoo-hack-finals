import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import PayslipModal from '../components/PayslipModal';

const MF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fc = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;
const safe = r => Array.isArray(r) ? r : (r?.data ?? []);

function BarChart({ data, vk, lk, color, title }) {
  const max = Math.max(...data.map(d => Number(d[vk]) || 0), 1);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {data.map((d, i) => {
          const h = Math.max(4, (Number(d[vk]) || 0) / max * 70);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: h, background: color, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} title={String(d[vk])} />
              <div style={{ fontSize: 9, color: 'var(--text-4)' }}>{MS[(d[lk] || 1) - 1]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerateModal({ employees, onClose, onDone }) {
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const roles = [...new Set(employees.map(e => e.role).filter(Boolean))];

  const filteredEmployees = employees.filter(e => {
    const matchesSearch = `${e.first_name} ${e.last_name} ${e.employee_code}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !departmentFilter || e.department === departmentFilter;
    const matchesRole = !roleFilter || e.role === roleFilter;
    return matchesSearch && matchesDept && matchesRole;
  });

  const handleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const run = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, employee_ids: selectedIds };
      const r = await api.post('/payroll/generate', payload);
      toast.success(`Generated for ${r?.data?.length || 0} employees`);
      onDone();
    }
    catch(err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">⚡ Run Payroll</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <form onSubmit={run}>
          <div className="modal-body">
            <div className="alert alert-info" style={{ marginBottom: 16 }}>Payroll is auto-calculated from attendance records for the selected period.</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Month</label>
                <select className="form-control" value={form.month} onChange={e => setForm(p => ({ ...p, month: +e.target.value }))}>
                  {MF.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input className="form-control" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: +e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Employees ({selectedIds.length} selected)</label>
              <div className="form-row" style={{ marginBottom: 8 }}>
                <div className="form-group">
                  <select className="form-control" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <select className="form-control" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="">All Roles</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Search name or code..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                    onChange={handleSelectAll}
                    style={{ transform: 'scale(1.1)' }}
                  />
                  <label style={{ fontWeight: 600, fontSize: 12 }}>Select All (Filtered)</label>
                </div>
                {filteredEmployees.map(e => (
                  <div key={e.id} onClick={() => handleSelect(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(e.id)}
                      readOnly
                      style={{ pointerEvents: 'none' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{e.first_name} {e.last_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.employee_code}</div>
                    </div>
                  </div>
                ))}
                {filteredEmployees.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No employees found.</div>
                )}
              </div>
              <div className="form-error">Leave selection empty to run for all employees.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Running...' : '⚡ Run Payroll'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const [mainTab, setMainTab] = useState('dashboard');
  const [records, setRecords]       = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [dashStats, setDashStats]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), employee_id: '' });
  const [showGenerate, setShowGenerate] = useState(false);
  const [payslip, setPayslip]       = useState(null);

  const loadDash    = () => api.get('/payroll/dashboard-stats').then(r => setDashStats(r)).catch(() => {});
  const loadRecords = () => {
    setLoading(true);
    const q = `/payroll?month=${filters.month}&year=${filters.year}${filters.employee_id ? `&employee_id=${filters.employee_id}` : ''}`;
    api.get(q).then(r => setRecords(safe(r))).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { api.get('/employees').then(r => setEmployees(safe(r))).catch(() => {}); loadDash(); }, []);
  useEffect(() => { loadRecords(); }, [filters]);

  const openPayslip = async id => {
    try { const r = await api.get(`/payroll/payslip/${id}`); setPayslip(Array.isArray(r) ? r[0] : r); }
    catch(e) { toast.error(e.message); }
  };

  const markPaid = async id => {
    try { await api.put(`/payroll/${id}`, { status: 'paid' }); toast.success('Marked as paid'); loadRecords(); }
    catch(e) { toast.error(e.message); }
  };

  const validatePayrun = async () => {
    try { await api.post('/payroll/validate', { month: filters.month, year: filters.year }); toast.success('Payrun validated — all marked as Done!'); loadRecords(); loadDash(); }
    catch(e) { toast.error(e.message); }
  };

  const totalGross = records.reduce((s, r) => s + Number(r.gross_earnings || 0), 0);
  const totalNet   = records.reduce((s, r) => s + Number(r.net_pay || 0), 0);
  const paidCount  = records.filter(r => r.status === 'paid').length;

  const warnings      = dashStats?.warnings || {};
  const monthlyCost   = dashStats?.monthly_cost || [];
  const payrunSummary = dashStats?.payrun_summary || [];

  const STAT_CARDS = [
    { label: 'Total Records', value: records.length,   icon: '📋', bg: '#dbeafe', c: '#1e3a8a' },
    { label: 'Gross Payroll', value: fc(totalGross),   icon: '💼', bg: '#d1fae5', c: '#059669' },
    { label: 'Net Payroll',   value: fc(totalNet),     icon: '💰', bg: '#ede9fe', c: '#7c3aed' },
    { label: 'Paid',          value: paidCount,        icon: '✅', bg: '#fef3c7', c: '#d97706' },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Payroll</h1><p>Manage payroll runs and employee payslips</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={validatePayrun}>✓ Validate</button>
            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>⚡ Payrun</button>
          </div>
        </div>
      </div>

      {/* Main tabs: Dashboard | Payrun */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab${mainTab === 'dashboard' ? ' active' : ''}`} onClick={() => setMainTab('dashboard')}>Dashboard</button>
        <button className={`tab${mainTab === 'payrun' ? ' active' : ''}`} onClick={() => setMainTab('payrun')}>Payrun</button>
      </div>

      {/* ─── DASHBOARD TAB ─── */}
      {mainTab === 'dashboard' && (
        <div>
          {/* Warnings */}
          {(warnings.no_bank > 0 || warnings.no_manager > 0) && (
            <div className="card" style={{ marginBottom: 20, padding: 20, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 10 }}>⚠ Warnings</div>
              {warnings.no_bank > 0 && (
                <div style={{ fontSize: 13, color: '#b45309', marginBottom: 6 }}>
                  • {warnings.no_bank} Employee{warnings.no_bank > 1 ? 's' : ''} without Bank A/c
                </div>
              )}
              {warnings.no_manager > 0 && (
                <div style={{ fontSize: 13, color: '#b45309' }}>
                  • {warnings.no_manager} Employee{warnings.no_manager > 1 ? 's' : ''} without Manager
                </div>
              )}
            </div>
          )}

          {/* Charts */}
          {monthlyCost.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <BarChart data={monthlyCost} vk="employer_cost" lk="month" color="#6366f1" title="Employer Cost — Monthly" />
              </div>
              <div className="card" style={{ padding: 20 }}>
                <BarChart data={monthlyCost} vk="emp_count" lk="month" color="#10b981" title="Employee Count — Monthly" />
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', marginBottom: 20 }}>
              No payroll data yet — run a payroll to see charts
            </div>
          )}

          {/* Payrun summary history */}
          <div className="card">
            <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)' }}>Pay Run History</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pay Period</th><th>Employer Cost</th><th>Gross</th><th>Net</th><th>Employees</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payrunSummary.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-3)' }}>No history</td></tr>
                  ) : payrunSummary.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{MF[r.month - 1]} {r.year}</td>
                      <td>{fc(r.employer_cost)}</td>
                      <td>{fc(r.gross)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fc(r.net)}</td>
                      <td>{r.total}</td>
                      <td>
                        <span className={`badge ${Number(r.paid_count) >= Number(r.total) ? 'badge-success' : 'badge-info'}`}>
                          {Number(r.paid_count) >= Number(r.total) ? 'Done' : 'Processed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYRUN TAB ─── */}
      {mainTab === 'payrun' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            {STAT_CARDS.map(c => (
              <div key={c.label} className="stat-card">
                <div className="stat-icon" style={{ background: c.bg, color: c.c }}>{c.icon}</div>
                <div className="stat-value" style={{ fontSize: c.label.includes('Payroll') ? 16 : 28 }}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <select className="form-control" style={{ width: 140 }} value={filters.month} onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}>
              {MF.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="form-control" style={{ width: 100 }} value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}>
              {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
            <select className="form-control" style={{ width: 200 }} value={filters.employee_id} onChange={e => setFilters(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>

          {/* Records table */}
          <div className="card">
            {loading
              ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th><th>Period</th><th>Days</th>
                        <th>Gross</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No records — click "⚡ Payrun" to generate</td></tr>
                      ) : records.map(r => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{r.employee_code}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{MF[r.pay_period_month - 1]?.slice(0, 3)} {r.pay_period_year}</td>
                          <td>{r.days_worked}/{r.working_days}</td>
                          <td style={{ fontWeight: 500 }}>{fc(r.gross_earnings)}</td>
                          <td style={{ color: 'var(--danger)' }}>{fc(r.total_deductions)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fc(r.net_pay)}</td>
                          <td>
                            <span className={`badge ${r.status === 'paid' ? 'badge-success' : r.status === 'processed' ? 'badge-info' : 'badge-default'}`}>
                              {r.status === 'paid' ? 'DONE' : r.status?.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => openPayslip(r.id)}>📄 Payslip</button>
                              {r.status !== 'paid' && (
                                <button className="btn btn-sm btn-success" onClick={() => markPaid(r.id)}>✓ Mark Paid</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          employees={employees}
          onClose={() => setShowGenerate(false)}
          onDone={() => { setShowGenerate(false); loadRecords(); loadDash(); }}
        />
      )}

      {payslip && (
        <PayslipModal
          p={payslip}
          onClose={() => setPayslip(null)}
          onRefresh={() => { setPayslip(null); loadRecords(); loadDash(); }}
        />
      )}
    </div>
  );
}
