import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const navConfig = [
  { section: 'Main', items: [
    { label: 'Dashboard', icon: '⊞', path: '/dashboard', roles: ['admin','employee','hr_officer','payroll_officer'] },
  ]},
  { section: 'Workforce', items: [
    { label: 'Employees',  icon: '👥', path: '/employees',  roles: ['admin','employee','hr_officer','payroll_officer'] },
    { label: 'Attendance', icon: '📅', path: '/attendance', roles: ['admin','employee','hr_officer','payroll_officer'] },
    { label: 'Time Off',   icon: '✈️', path: '/time-off',   roles: ['admin','employee','hr_officer','payroll_officer'] },
  ]},
  { section: 'Finance', items: [
    { label: 'Payroll', icon: '💰', path: '/payroll', roles: ['admin','payroll_officer'] },
    { label: 'Reports', icon: '📊', path: '/reports', roles: ['admin','payroll_officer'] },
  ]},
  { section: 'System', items: [
    { label: 'Settings', icon: '⚙️', path: '/settings', roles: ['admin'] },
  ]},
];

const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : 'U';
const getAvatarColor = (name) => {
  const c = ['#1e3a8a','#1d4ed8','#0369a1','#059669','#7c3aed','#b45309'];
  let h = 0; if (name) for (const ch of name) h = ch.charCodeAt(0) + ((h<<5)-h);
  return c[Math.abs(h)%c.length];
};
const getRoleLabel = (role) => ({ admin:'Administrator', employee:'Employee', hr_officer:'HR Officer', payroll_officer:'Payroll Officer' }[role] || role);

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropRef = useRef(null);

  const now = new Date();
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const filteredNav = navConfig.map(s => ({
    ...s, items: s.items.filter(i => i.roles.includes(user?.role))
  })).filter(s => s.items.length > 0);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">EP</div>
          {!collapsed && <div><div className="logo-text">EmPay</div><div className="logo-sub">HRMS Platform</div></div>}
        </div>
        <nav className="sidebar-nav">
          {filteredNav.map(section => (
            <div key={section.section} className="nav-section">
              {!collapsed && <div className="nav-section-label">{section.section}</div>}
              {section.items.map(item => (
                <Link key={item.path} to={item.path}
                  className={`nav-item${location.pathname === item.path || location.pathname.startsWith(item.path+'/') ? ' active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '→' : '← Collapse'}
          </button>
          <div className="sidebar-user" onClick={() => navigate('/profile')} style={{cursor:'pointer'}}>
            <div className="avatar avatar-sm" style={{ background: getAvatarColor(user?.name), color: '#fff' }}>
              {getInitials(user?.name)}
            </div>
            {!collapsed && (
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{getRoleLabel(user?.role)}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={`main-content${collapsed ? ' collapsed' : ''}`}>
        <header className="top-header">
          <span className="header-title">{dateStr}</span>
          <div className="header-actions">
            <span style={{ fontSize:12, background:'var(--primary-light)', padding:'4px 10px', borderRadius:99, fontWeight:600, color:'var(--primary)' }}>
              {getRoleLabel(user?.role)}
            </span>

            {/* Avatar with dropdown */}
            <div ref={dropRef} style={{ position:'relative' }}>
              <div className="header-avatar" style={{ background: getAvatarColor(user?.name), cursor:'pointer' }}
                onClick={() => setShowDropdown(p => !p)}>
                {getInitials(user?.name)}
              </div>

              {showDropdown && (
                <div style={{
                  position:'absolute', top:'calc(100% + 10px)', right:0, minWidth:180,
                  background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)',
                  boxShadow:'var(--shadow-lg)', zIndex:1000, overflow:'hidden',
                }}>
                  {/* User info header */}
                  <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{user?.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{user?.email}</div>
                  </div>
                  <button style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--text-2)', textAlign:'left' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                    onClick={() => { setShowDropdown(false); navigate('/profile'); }}>
                    👤 My Profile
                  </button>
                  <button style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'12px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--danger)', textAlign:'left', borderTop:'1px solid var(--border)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--danger-light)'}
                    onMouseLeave={e=>e.currentTarget.style.background='none'}
                    onClick={handleLogout}>
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
