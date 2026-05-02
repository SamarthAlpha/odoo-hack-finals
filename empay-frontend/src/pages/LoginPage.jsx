import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, pass) => setForm({ email, password: pass });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, maxWidth: 900, width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* Left Panel */}
        <div style={{ background: 'var(--accent)', padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
              <div style={{ width: 40, height: 40, background: 'var(--primary-mid)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#fff' }}>EP</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>EmPay</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>HRMS Platform</div>
              </div>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 12 }}>Smart Human<br />Resource<br />Management</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>Streamline attendance, leave, payroll, and analytics from one unified platform.</p>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Quick Login</div>
            {[
              { label: 'Admin', email: 'admin@empay.com', pass: 'Admin@1234', color: '#1d4ed8' },
              { label: 'HR Officer', email: 'hr@empay.com', pass: 'HR@1234', color: '#059669' },
              { label: 'Payroll Officer', email: 'payroll@empay.com', pass: 'Payroll@1234', color: '#d97706' },
              { label: 'Employee', email: 'john.doe@empay.com', pass: 'Employee@1234', color: '#7c3aed' },
            ].map(d => (
              <button key={d.label} onClick={() => fillDemo(d.email, d.pass)}
                style={{ width: '100%', textAlign: 'left', padding: '9px 14px', marginBottom: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{d.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 'auto' }}>{d.email}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 32 }}>Sign in to your EmPay account</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" placeholder="you@company.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="form-control" type={showPass ? 'text' : 'password'} placeholder="Enter password"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                  style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14 }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? '⏳ Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 32, padding: '16px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Default Credentials</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.9 }}>
              Admin: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, color: 'var(--primary)' }}>Admin@1234</code><br />
              HR Officer: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, color: 'var(--primary)' }}>HR@1234</code><br />
              Payroll Officer: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, color: 'var(--primary)' }}>Payroll@1234</code><br />
              Employees: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3, color: 'var(--primary)' }}>Employee@1234</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
