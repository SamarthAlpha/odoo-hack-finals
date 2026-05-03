import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend, ComposedChart,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import api from '../utils/api';
import SalaryStatement from './SalaryStatement';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLORS = ['#1e3a8a', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899'];
const fmtCurr = (n) => `₹${Number(n||0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

function InsightCard({ label, value, sub, icon, color = 'var(--primary)' }) {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: 24, borderLeft: `6px solid ${color}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 32, background: `${color}15`, color, width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 6, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ChartWrapper({ title, subtitle, children, height = 320, span = 1 }) {
  return (
    <div className="card" style={{ padding: '28px', gridColumn: `span ${span}`, borderRadius: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-4)', margin: '6px 0 0', fontWeight: 500 }}>{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState('payroll');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  const loadData = async () => {
    if (tab === 'statement') return;
    setLoading(true);
    try {
      let r = [];
      if (tab === 'payroll') r = await api.get(`/payroll?month=${filters.month}&year=${filters.year}`);
      else if (tab === 'timeoff') r = await api.get('/timeoff');
      else if (tab === 'attendance') r = await api.get(`/attendance?month=${filters.month}&year=${filters.year}`);
      setData(Array.isArray(r) ? r : r?.data || []);
    } catch (err) {
      console.error("Error loading report data:", err);
      setData([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { 
    setData([]);
    loadData(); 
  }, [tab, filters]);

  const insights = useMemo(() => {
    if (!data.length || !data[0]) return null;
    if (tab === 'attendance' && !data[0].date) return null;
    if (tab === 'payroll' && !data[0].net_pay && !data[0].basic_salary) return null;
    if (tab === 'timeoff' && !data[0].leave_type) return null;

    if (tab === 'payroll') {
      const totalNet = data.reduce((s, r) => s + Number(r.net_pay || 0), 0);
      const totalGross = data.reduce((s, r) => s + Number(r.gross_earnings || 0), 0);
      const totalDeds = data.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
      
      const deptStats = data.reduce((acc, r) => {
        if (!acc[r.department]) acc[r.department] = { net: 0, count: 0, gross: 0, pf: 0 };
        acc[r.department].net += Number(r.net_pay || 0);
        acc[r.department].gross += Number(r.gross_earnings || 0);
        acc[r.department].count += 1;
        return acc;
      }, {});

      const salaryBands = data.reduce((acc, r) => {
        const net = Number(r.net_pay || 0);
        let band = 'Under 20k';
        if (net >= 80000) band = '80k+';
        else if (net >= 60000) band = '60k-80k';
        else if (net >= 40000) band = '40k-60k';
        else if (net >= 20000) band = '20k-40k';
        acc[band] = (acc[band] || 0) + 1;
        return acc;
      }, {});

      return {
        cards: [
          { label: 'Fiscal Payout', value: fmtCurr(totalNet), sub: `Gross Spend: ${fmtCurr(totalGross)}`, icon: '💸', color: '#10b981' },
          { label: 'Compensation Avg', value: fmtCurr(totalNet / data.length), sub: 'Monthly average net', icon: '⚖️', color: '#3b82f6' },
          { label: 'Tax & Compliance', value: fmtCurr(totalDeds), sub: `${((totalDeds/totalGross)*100).toFixed(1)}% statutory leakage`, icon: '🏛', color: '#ef4444' },
        ],
        deptCosts: Object.entries(deptStats).map(([name, s]) => ({ name, Net: s.net, Gross: s.gross, Headcount: s.count })),
        salaryMatrix: data.map(r => ({ name: r.last_name, days: r.days_worked, pay: Number(r.net_pay || 0) })),
        bands: ['Under 20k', '20k-40k', '40k-60k', '60k-80k', '80k+'].map(b => ({ name: b, count: salaryBands[b] || 0 }))
      };
    }

    if (tab === 'timeoff') {
      const statusDist = data.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      const typeDist = data.reduce((acc, r) => { acc[r.leave_type] = (acc[r.leave_type] || 0) + 1; return acc; }, {});
      const deptLeave = data.reduce((acc, r) => { acc[r.department] = (acc[r.department] || 0) + 1; return acc; }, {});
      
      return {
        cards: [
          { label: 'Policy Adherence', value: `${((statusDist.approved || 0) / data.length * 100).toFixed(0)}%`, sub: 'Approval efficiency', icon: '🛡', color: '#10b981' },
          { label: 'Leave Intensity', value: `${(data.reduce((s,r)=>s+r.total_days,0)/data.length).toFixed(1)} Days`, sub: 'Average duration', icon: '⏳', color: '#3b82f6' },
          { label: 'Outstanding', value: statusDist.pending || 0, sub: 'Requires action', icon: '🚩', color: '#f59e0b' },
        ],
        typeChart: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
        statusChart: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
        deptChart: Object.entries(deptLeave).map(([name, value]) => ({ name, value }))
      };
    }

    if (tab === 'attendance') {
      const activeData = data.filter(r => r.status !== 'absent');
      const avgHours = activeData.reduce((s, r) => s + Number(r.total_hours || 0), 0) / activeData.length || 0;
      
      const arrivalTimes = activeData.reduce((acc, r) => {
        if (!r.check_in) return acc;
        const hour = new Date(r.check_in).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const dailyTrend = data.reduce((acc, r) => {
        const d = r.date.split('T')[0].split('-')[2];
        if (!acc[d]) acc[d] = { name: d, present: 0, hours: 0, count: 0 };
        if (r.status === 'present' || r.status === 'half_day') {
          acc[d].present += 1;
          acc[d].hours += Number(r.total_hours || 0);
          acc[d].count += 1;
        }
        return acc;
      }, {});

      const punctuality = { 
        'On Time': data.filter(r => r.check_in && new Date(r.check_in).getHours() < 10).length,
        'Late (10-11)': data.filter(r => r.check_in && new Date(r.check_in).getHours() === 10).length,
        'Very Late (11+)': data.filter(r => r.check_in && new Date(r.check_in).getHours() >= 11).length,
        'Absent': data.filter(r => r.status === 'absent').length
      };

      return {
        cards: [
          { label: 'Workforce Density', value: `${((data.filter(r=>r.status==='present').length / data.length)*100).toFixed(0)}%`, sub: 'Daily presence avg', icon: '⚡', color: '#10b981' },
          { label: 'Productivity Index', value: `${avgHours.toFixed(1)}h`, sub: 'Avg work duration', icon: '🔋', color: '#3b82f6' },
          { label: 'Shift Latency', value: `${((punctuality['On Time'] / (activeData.length) || 0) * 100).toFixed(0)}%`, sub: 'On-time arrival rate', icon: '⌚', color: '#8b5cf6' },
        ],
        trend: Object.values(dailyTrend).sort((a,b) => a.name - b.name).map(v => ({ ...v, avgHours: v.count ? (v.hours / v.count).toFixed(1) : 0 })),
        arrivalClusters: [8, 9, 10, 11, 12].map(h => ({ hour: `${h}:00`, count: arrivalTimes[h] || 0 })),
        punctChart: Object.entries(punctuality).map(([name, value]) => ({ name, value }))
      };
    }
    return null;
  }, [data, tab]);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 20px 40px' }}>
      <div className="page-header" style={{ marginBottom: 40, borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
        <div className="page-header-row">
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', color: '#1e293b' }}>Enterprise Intelligence</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 16, fontWeight: 500 }}>High-fidelity workforce analytics, fiscal trends, and operational patterns.</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: '0 16px', boxShadow: 'var(--shadow-sm)' }}>
              <select className="form-control" style={{ border: 'none', fontWeight: 800, fontSize: 15 }} value={filters.month} onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="form-control" style={{ border: 'none', fontWeight: 800, fontSize: 15 }} value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}>
                {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ borderRadius: 16, padding: '0 24px', fontWeight: 700, fontSize: 15, boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.4)' }} onClick={() => loadData()}>🔄 Recalculate Models</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: '#f1f5f9', padding: 6, borderRadius: 20, display: 'inline-flex', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
          {[
            ['payroll', '💰 Payroll'], 
            ['timeoff', '✈️ Leave'], 
            ['attendance', '📅 Presence'], 
            ['statement', '📄 Payslips']
          ].map(([k, l]) => (
            <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}
              style={{ padding: '12px 28px', borderRadius: 16, fontSize: 14, fontWeight: 700, transition: 'all 0.3s ease' }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'statement' ? <SalaryStatement /> : (
        loading ? (
          <div style={{ padding: 150, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 64, height: 64, margin: '0 auto', borderWidth: 6 }} />
            <h2 style={{ marginTop: 32, fontWeight: 900, color: '#1e293b' }}>Crunching Enterprise Data...</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 18 }}>Applying statistical models and generating visual layers.</p>
          </div>
        ) : (
          <>
            {insights && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
                {insights.cards.map((c, i) => <InsightCard key={i} {...c} />)}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24, marginBottom: 40 }}>
              
              {tab === 'payroll' && insights && (
                <>
                  <ChartWrapper title="Departmental Payout Structure" subtitle="Comparison of Net vs Gross liabilities by business unit" span={8}>
                    <ComposedChart data={insights.deptCosts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `₹${v/1000}k`} />
                      <Tooltip formatter={v => fmtCurr(v)} contentStyle={{ borderRadius: 20, border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="Gross" fill="#93c5fd" radius={[10, 10, 0, 0]} barSize={40} />
                      <Bar dataKey="Net" fill="#1e3a8a" radius={[10, 10, 0, 0]} barSize={40} />
                      <Line type="monotone" dataKey="Headcount" stroke="#f59e0b" strokeWidth={3} dot={{ r: 6, fill: '#f59e0b' }} />
                    </ComposedChart>
                  </ChartWrapper>

                  <ChartWrapper title="Income Distribution" subtitle="Headcount by net income bracket" span={4}>
                    <BarChart data={insights.bands} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} width={100} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={24} />
                    </BarChart>
                  </ChartWrapper>

                  <ChartWrapper title="Fiscal Correlation" subtitle="Net Pay vs Days Worked scatter analysis" span={12} height={400}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" dataKey="days" name="Days Worked" unit=" days" axisLine={false} />
                      <YAxis type="number" dataKey="pay" name="Net Pay" unit=" ₹" axisLine={false} tickFormatter={v => `${v/1000}k`} />
                      <ZAxis type="number" range={[100, 1000]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Legend />
                      <Scatter name="Employees" data={insights.salaryMatrix} fill="#1e3a8a" shape="circle" />
                    </ScatterChart>
                  </ChartWrapper>
                </>
              )}

              {tab === 'timeoff' && insights && (
                <>
                  <ChartWrapper title="Leave Utilization Pattern" subtitle="Distribution across leave categories" span={6}>
                    <BarChart data={insights.typeChart}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, textTransform: 'capitalize', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[12, 12, 0, 0]} barSize={60} />
                    </BarChart>
                  </ChartWrapper>

                  <ChartWrapper title="Request Lifecycle Status" subtitle="Approval vs Rejection throughput" span={6}>
                    <PieChart>
                      <Pie data={insights.statusChart} innerRadius={80} outerRadius={110} dataKey="value" stroke="none">
                        {insights.statusChart.map((d, i) => <Cell key={i} fill={d.name === 'approved' ? '#10b981' : d.name === 'rejected' ? '#ef4444' : '#f59e0b'} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ChartWrapper>

                  <ChartWrapper title="Inter-Departmental Leave Frequency" subtitle="Total requests originated by department" span={12}>
                    <AreaChart data={insights.deptChart}>
                      <defs>
                        <linearGradient id="colorDept" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="step" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorDept)" strokeWidth={4} />
                    </AreaChart>
                  </ChartWrapper>
                </>
              )}

              {tab === 'attendance' && insights && (
                <>
                  <ChartWrapper title="Presence & Productivity Index" subtitle="Headcount vs Avg work hours (Monthly Trend)" span={12} height={400}>
                    <ComposedChart data={insights.trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} unit="h" />
                      <Tooltip contentStyle={{ borderRadius: 24, border: 'none', boxShadow: 'var(--shadow-lg)', padding: 16 }} />
                      <Legend verticalAlign="top" align="right" height={40} iconType="circle" />
                      <Bar yAxisId="left" dataKey="present" name="Daily Present" fill="#93c5fd" radius={[12, 12, 0, 0]} barSize={24} />
                      <Line yAxisId="right" type="monotone" dataKey="avgHours" name="Avg Productivity" stroke="#1e3a8a" strokeWidth={5} dot={{ r: 6, fill: '#1e3a8a', strokeWidth: 3, stroke: '#fff' }} />
                    </ComposedChart>
                  </ChartWrapper>

                  <ChartWrapper title="Shift Arrival Clusters" subtitle="Distribution of daily check-in times" span={6}>
                    <BarChart data={insights.arrivalClusters}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Arrivals" fill="#0ea5e9" radius={[10, 10, 0, 0]} barSize={50} />
                    </BarChart>
                  </ChartWrapper>

                  <ChartWrapper title="Check-in Latency (Punctuality)" subtitle="Deep-dive into arrival behavior" span={6}>
                    <PieChart>
                      <Pie data={insights.punctChart} innerRadius={70} outerRadius={110} dataKey="value" stroke="none" startAngle={180} endAngle={0} cy="70%">
                        {insights.punctChart.map((d, i) => <Cell key={i} fill={d.name === 'On Time' ? '#10b981' : d.name.includes('Late') ? '#f59e0b' : '#ef4444'} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ChartWrapper>
                </>
              )}

            </div>

            <div className="card" style={{ borderRadius: 24, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#1e293b' }}>Granular Transaction Registry</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  {tab === 'payroll' && (
                    <>
                      <thead><tr><th>Employee</th><th>Dept</th><th>Efficiency (Days)</th><th>Statutory Deds</th><th>Net Disbursement</th></tr></thead>
                      <tbody>
                        {data.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 700, fontSize: 15 }}>{r.first_name} {r.last_name}</td>
                            <td style={{ fontWeight: 500 }}>{r.department}</td>
                            <td>{r.days_worked}/{r.working_days}</td>
                            <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmtCurr(r.total_deductions)}</td>
                            <td style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 16 }}>{fmtCurr(r.net_pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {tab === 'attendance' && (
                    <>
                      <thead><tr><th>Employee</th><th>Date</th><th>Entry</th><th>Exit</th><th>Shift Duration</th><th>Status Badge</th></tr></thead>
                      <tbody>
                        {data.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</td>
                            <td style={{ fontWeight: 500 }}>{fmtDate(r.date)}</td>
                            <td style={{ fontSize: 13, color: '#64748b' }}>{r.check_in ? new Date(r.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td style={{ fontSize: 13, color: '#64748b' }}>{r.check_out ? new Date(r.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td style={{ fontWeight: 800, color: '#1e293b' }}>{r.total_hours ? `${r.total_hours}h` : '—'}</td>
                            <td><span className={`badge ${r.status === 'present' ? 'badge-success' : r.status === 'absent' ? 'badge-danger' : 'badge-warning'}`} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11 }}>{r.status?.toUpperCase().replace('_', ' ')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
