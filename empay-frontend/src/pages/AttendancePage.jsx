import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_BADGE = { present: 'badge-success', absent: 'badge-default', half_day: 'badge-warning', on_leave: 'badge-info' };

export default function AttendancePage() {
  const { user, can } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [todayStatus, setTodayStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), employee_id: '', date: '' });
  const [employees, setEmployees] = useState([]);
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadToday = () => api.get('/attendance/today-status').then(r => setTodayStatus(r));
  const loadLogs = () => {
    setLoading(true);
    // When a specific date is selected, use it; otherwise use month+year
    const dateParam = filters.date ? `&date=${filters.date}` : `&month=${filters.month}&year=${filters.year}`;
    const empParam = (!isEmployee && filters.employee_id) ? `&employee_id=${filters.employee_id}` : '';
    const ep = isEmployee
      ? `/attendance/my?${filters.date ? `date=${filters.date}` : `month=${filters.month}&year=${filters.year}`}`
      : `/attendance?${filters.date ? `date=${filters.date}` : `month=${filters.month}&year=${filters.year}`}${empParam}`;
    api.get(ep).then(r => setLogs(Array.isArray(r) ? r : r || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isEmployee) {
      loadToday();
      // Poll today status every 30s for real-time update
      const t = setInterval(loadToday, 30000);
      return () => clearInterval(t);
    } else {
      api.get('/employees').then(r => setEmployees(Array.isArray(r) ? r : r || []));
    }
  }, []);
  useEffect(() => { loadLogs(); }, [filters]);

  const checkIn = async () => {
    setActionLoading(true);
    try { await api.post('/attendance/checkin', {}); toast.success('✅ Checked in!'); loadToday(); loadLogs(); }
    catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };
  const checkOut = async () => {
    setActionLoading(true);
    try {
      const r = await api.post('/attendance/checkout', {});
      const hours = r?.total_hours || r?.data?.total_hours || '';
      toast.success(`✅ Checked out!${hours ? ` ${hours}h worked` : ''}`);
      loadToday(); loadLogs();
    }
    catch (err) { toast.error(err.message); }
    finally { setActionLoading(false); }
  };

  const att = todayStatus?.attendance;
  const onLeave = todayStatus?.on_leave;

  // Stats from logs
  const stats = logs.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div><h1>Attendance</h1><p>Track and manage attendance records</p></div>
        </div>
      </div>

      {/* Employee: Check-in/out widget */}
      {isEmployee && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>Today — {now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                </div>
                {onLeave && <div className="badge badge-info" style={{ marginTop: 8 }}>✈️ You are on approved leave today</div>}
              </div>

              <div style={{ display: 'flex', flex: 1, gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Check In', value: att?.check_in ? fmtTime(att.check_in) : '—', icon: '🟢' },
                  { label: 'Check Out', value: att?.check_out ? fmtTime(att.check_out) : '—', icon: '🔴' },
                  { label: 'Hours Worked', value: att?.total_hours ? `${att.total_hours}h` : '—', icon: '⏱' },
                  { label: 'Status', value: att?.status || 'Not Marked', icon: '📋' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', minWidth: 100 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {!onLeave && (
                  <>
                    {!att?.check_in && (
                      <button className="btn btn-success btn-lg" onClick={checkIn} disabled={actionLoading} style={{ minWidth: 140, justifyContent: 'center' }}>
                        {actionLoading ? '...' : '🟢 Check In'}
                      </button>
                    )}
                    {att?.check_in && !att?.check_out && (
                      <button className="btn btn-danger btn-lg" onClick={checkOut} disabled={actionLoading} style={{ minWidth: 140, justifyContent: 'center' }}>
                        {actionLoading ? '...' : '🔴 Check Out'}
                      </button>
                    )}
                    {att?.check_in && att?.check_out && (
                      <div style={{ padding: '12px 20px', background: 'var(--success-light)', border: '1.5px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>
                        ✅ Completed for today
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Present', count: stats.present || 0, color: 'var(--success)', bg: 'var(--success-light)' },
          { label: 'Absent', count: stats.absent || 0, color: 'var(--danger)', bg: 'var(--danger-light)' },
          { label: 'Half Day', count: stats.half_day || 0, color: 'var(--warning)', bg: 'var(--warning-light)' },
          { label: 'On Leave', count: stats.on_leave || 0, color: 'var(--info)', bg: 'var(--info-light)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 'var(--radius)', padding: '14px 18px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        {/* Month + Year selectors — disabled when specific date is active */}
        <select
          className="form-control"
          style={{ width: 140, opacity: filters.date ? 0.45 : 1 }}
          value={filters.month}
          disabled={!!filters.date}
          onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          className="form-control"
          style={{ width: 100, opacity: filters.date ? 0.45 : 1 }}
          value={filters.year}
          disabled={!!filters.date}
          onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}
        >
          {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>

        {/* Divider */}
        <span style={{ color: 'var(--border)', fontSize: 18, fontWeight: 300, userSelect: 'none' }}>|</span>

        {/* Specific date picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Specific Date:</label>
          <input
            type="date"
            className="form-control"
            style={{ width: 160 }}
            value={filters.date}
            onChange={e => setFilters(p => ({ ...p, date: e.target.value }))}
          />
          {filters.date && (
            <button
              className="btn btn-sm btn-ghost"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setFilters(p => ({ ...p, date: '' }))}
              title="Clear date filter"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {!isEmployee && (
          <select className="form-control" style={{ width: 200 }} value={filters.employee_id} onChange={e => setFilters(p => ({ ...p, employee_id: e.target.value }))}>
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
          </select>
        )}
      </div>

      {/* Logs table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            Attendance Log —{' '}
            {filters.date
              ? new Date(filters.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : `${MONTHS[filters.month - 1]} ${filters.year}`
            }
          </div>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {!isEmployee && <th>Employee</th>}
                  <th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={!isEmployee ? 6 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No records found</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    {!isEmployee && <td><div style={{ fontWeight: 600 }}>{log.first_name} {log.last_name}</div><div style={{ fontSize: 11, color: 'var(--text-4)' }}>{log.employee_code}</div></td>}
                    <td style={{ fontWeight: 500 }}>{fmtDate(log.date)}</td>
                    <td>{fmtTime(log.check_in)}</td>
                    <td>{fmtTime(log.check_out)}</td>
                    <td>{log.total_hours ? `${log.total_hours}h` : '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[log.status] || 'badge-default'}`}>{log.status?.replace('_',' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
