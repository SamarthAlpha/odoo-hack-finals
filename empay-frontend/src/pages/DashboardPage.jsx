import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DEPT_COLORS = ['#1e3a8a','#1d4ed8','#0369a1','#059669','#7c3aed','#d97706','#dc2626'];

const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.get('/dashboard/stats').then(r => setStats(r)).catch(() => {}).finally(() => setLoading(false));
    load();
    // Real-time: refresh dashboard every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="page-loader" style={{ height: '60vh', background: 'transparent' }}><div className="spinner" /></div>;

  const trendData = (stats?.attendance_trend || []).map(r => ({
    name: MONTH_NAMES[(r.month - 1)],
    Present: r.present_count,
    Absent: r.absent_count,
    'Half Day': r.half_day_count,
  }));

  const leaveData = (stats?.leave_distribution || []).map(r => ({ name: r.leave_type, value: r.count }));
  const deptData = (stats?.dept_stats || []).map(r => ({ name: r.department || 'N/A', value: r.count }));

  const statCards = [
    { label: 'Total Employees', value: stats?.total_employees || 0, icon: '👥', color: '#1e3a8a', bg: '#dbeafe', change: 'Active staff' },
    { label: 'Present Today', value: stats?.present_today || 0, icon: '✅', color: '#059669', bg: '#d1fae5', change: `of ${stats?.total_employees}` },
    { label: 'On Leave', value: stats?.on_leave_today || 0, icon: '✈️', color: '#d97706', bg: '#fef3c7', change: 'Today' },
    { label: 'Pending Requests', value: stats?.pending_leaves || 0, icon: '⏳', color: '#dc2626', bg: '#fee2e2', change: 'Awaiting approval' },
  ];

  if (user?.role === 'admin' || user?.role === 'payroll_officer') {
    statCards.push({ label: 'Monthly Payroll', value: fmtCurrency(stats?.total_payroll), icon: '💰', color: '#7c3aed', bg: '#ede9fe', change: `${stats?.payroll_count || 0} payslips` });
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back, <strong>{user?.name}</strong> — here's your organization overview.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => {
              setLoading(true);
              api.get('/dashboard/stats').then(r => setStats(r)).finally(() => setLoading(false));
            }}>🔄 Refresh</button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statCards.length > 4 ? 5 : 4}, 1fr)`, gap: 16, marginBottom: 24 }}>
        {statCards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-change" style={{ color: 'var(--text-4)' }}>{c.change}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Attendance Trend */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Attendance Trend</div><div className="card-subtitle">Last 6 months</div></div>
          </div>
          <div className="card-body">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} barSize={18}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} />
                  <Bar dataKey="Present" fill="#1e3a8a" radius={[4,4,0,0]} />
                  <Bar dataKey="Absent" fill="#fee2e2" stroke="#dc2626" strokeWidth={1} radius={[4,4,0,0]} />
                  <Bar dataKey="Half Day" fill="#fef3c7" stroke="#d97706" strokeWidth={1} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><div className="icon">📊</div><p>No attendance data yet</p></div>}
          </div>
        </div>

        {/* Department distribution */}
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Department Distribution</div><div className="card-subtitle">Employee count by department</div></div>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {deptData.length > 0 ? (
              <>
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={deptData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                      {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {deptData.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: DEPT_COLORS[i % DEPT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="empty-state"><div className="icon">🏢</div><p>No department data</p></div>}
          </div>
        </div>
      </div>

      {/* Leave distribution */}
      {leaveData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div><div className="card-title">Leave Type Distribution</div><div className="card-subtitle">Current year</div></div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {leaveData.map((d, i) => (
                <div key={d.name} style={{ flex: '1 1 140px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', borderLeft: `4px solid ${DEPT_COLORS[i % DEPT_COLORS.length]}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{d.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'capitalize', marginTop: 2 }}>{d.name} Leave</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
