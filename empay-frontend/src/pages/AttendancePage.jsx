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
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadToday = () => api.get('/attendance/today-status').then(r => setTodayStatus(r));
  const loadLogs = () => {
    setLoading(true);
    const dateParam = filters.date ? `date=${filters.date}` : `month=${filters.month}&year=${filters.year}`;
    const empParam = (!isEmployee && filters.employee_id) ? `&employee_id=${filters.employee_id}` : '';
    const ep = isEmployee ? `/attendance/my?${dateParam}` : `/attendance?${dateParam}${empParam}`;
    api.get(ep)
       .then(r => setLogs(Array.isArray(r) ? r : (r?.data || [])))
       .catch(() => setLogs([]))
       .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadToday();
    if (!isEmployee) {
      api.get('/employees').then(r => setEmployees(Array.isArray(r) ? r : []));
    }
  }, [isEmployee]);

  useEffect(() => {
    loadLogs();
    if (isEmployee) loadToday();
  }, [filters, isEmployee]);

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
  const searchLower = search.toLowerCase().trim();
  const visibleLogs = (!isEmployee && searchLower)
    ? logs.filter(l =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(searchLower) ||
        (l.employee_code || '').toLowerCase().includes(searchLower) ||
        (l.department || '').toLowerCase().includes(searchLower)
      )
    : logs;

  const [statusFilter, setStatusFilter] = useState('all');

  const stats = visibleLogs.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const renderTable = (data, title, isTimeIrrelevant = false) => {
    if (data.length === 0 && statusFilter !== 'all') return null;
    return (
      <div style={{ marginBottom: 30 }}>
        {statusFilter === 'all' && (
          <div style={{ padding: '8px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title} — {data.length} records
          </div>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {!isEmployee && <th>Employee</th>}
                <th>Date</th>
                {!isTimeIrrelevant && (
                  <>
                    <th>Check In</th><th>Check Out</th><th>Hours</th>
                  </>
                )}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={!isEmployee ? 6 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No {title.toLowerCase()} records found</td></tr>
              ) : data.map(log => (
                <tr key={log.id}>
                  {!isEmployee && <td><div style={{ fontWeight: 600 }}>{log.first_name} {log.last_name}</div><div style={{ fontSize: 11, color: 'var(--text-4)' }}>{log.employee_code}</div></td>}
                  <td style={{ fontWeight: 500 }}>{fmtDate(log.date)}</td>
                  {!isTimeIrrelevant && (
                    <>
                      <td>{fmtTime(log.check_in)}</td>
                      <td>{fmtTime(log.check_out)}</td>
                      <td>{log.total_hours ? `${log.total_hours}h` : '—'}</td>
                    </>
                  )}
                  <td><span className={`badge ${STATUS_BADGE[log.status] || 'badge-default'}`}>{log.status?.replace('_',' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const presentLogs = visibleLogs.filter(l => l.status === 'present' || l.status === 'half_day');
  const absentLogs = visibleLogs.filter(l => l.status === 'absent');
  const leaveLogs = visibleLogs.filter(l => l.status === 'on_leave');

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
                    {(!att || !att.last_event_type || att.last_event_type === 'check_out') ? (
                      <button className="btn btn-success btn-lg" onClick={checkIn} disabled={actionLoading} style={{ minWidth: 140, justifyContent: 'center' }}>
                        {actionLoading ? '...' : '🟢 Check In'}
                      </button>
                    ) : (
                      <button className="btn btn-danger btn-lg" onClick={checkOut} disabled={actionLoading} style={{ minWidth: 140, justifyContent: 'center' }}>
                        {actionLoading ? '...' : '🔴 Check Out'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly stats — Clickable filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        <div 
          onClick={() => setStatusFilter('all')}
          style={{ 
            cursor: 'pointer',
            background: statusFilter === 'all' ? 'var(--primary)' : 'var(--surface)', 
            border: `1px solid ${statusFilter === 'all' ? 'var(--primary)' : 'var(--border)'}`, 
            borderRadius: 'var(--radius)', padding: '14px 18px',
            color: statusFilter === 'all' ? '#fff' : 'var(--text)',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700 }}>{visibleLogs.length}</div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>All Records</div>
        </div>
        {[
          { id: 'present', label: 'Present', count: (stats.present || 0) + (stats.half_day || 0), color: 'var(--success)', bg: 'var(--success-light)' },
          { id: 'absent', label: 'Absent', count: stats.absent || 0, color: 'var(--danger)', bg: 'var(--danger-light)' },
          { id: 'half_day', label: 'Half Day', count: stats.half_day || 0, color: 'var(--warning)', bg: 'var(--warning-light)' },
          { id: 'on_leave', label: 'On Leave', count: stats.on_leave || 0, color: 'var(--info)', bg: 'var(--info-light)' },
        ].map(s => (
          <div 
            key={s.id} 
            onClick={() => setStatusFilter(s.id)}
            style={{ 
              cursor: 'pointer',
              background: statusFilter === s.id ? s.color : s.bg, 
              border: `1px solid ${statusFilter === s.id ? s.color : s.color + '22'}`, 
              borderRadius: 'var(--radius)', padding: '14px 18px', borderLeft: `4px solid ${s.color}`,
              color: statusFilter === s.id ? '#fff' : s.color,
              transition: 'all 0.2s',
              transform: statusFilter === s.id ? 'translateY(-2px)' : 'none',
              boxShadow: statusFilter === s.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>{s.count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: statusFilter === s.id ? 0.9 : 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
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

        <span style={{ color: 'var(--border)', fontSize: 18, fontWeight: 300, userSelect: 'none' }}>|</span>

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
          <>
            <select className="form-control" style={{ width: 200 }} value={filters.employee_id} onChange={e => setFilters(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
            </select>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name/code..."
              style={{ width: 180 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </>
        )}
      </div>

      {/* Segregated Logs */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: statusFilter === 'all' ? 'none' : '1px solid var(--border)' }}>
          <div className="card-title">
            {statusFilter === 'all' ? 'Attendance Log — Detailed Sections' : `${statusFilter.replace('_',' ').toUpperCase()} Logs`} —{' '}
            {filters.date
              ? new Date(filters.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : `${MONTHS[filters.month - 1]} ${filters.year}`
            }
          </div>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
          <div>
            {statusFilter === 'all' ? (
              <>
                {renderTable(presentLogs, 'Present / Half Day')}
                {renderTable(absentLogs, 'Absent', true)}
                {renderTable(leaveLogs, 'On Leave', true)}
              </>
            ) : (
              renderTable(visibleLogs.filter(l => {
                if (statusFilter === 'present') return l.status === 'present' || l.status === 'half_day';
                return l.status === statusFilter;
              }), statusFilter.toUpperCase(), statusFilter === 'absent' || statusFilter === 'on_leave')
            )}
          </div>
        )}
      </div>
    </div>
  );
}
