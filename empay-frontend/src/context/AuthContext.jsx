import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('empay_token');
    const stored = localStorage.getItem('empay_user');
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Auth endpoint returns {success, token, user} — no .data wrapper
    // api.js unwrapper returns raw json when .data is absent
    const res = await api.post('/auth/login', { email, password });
    const token = res.token;
    const userData = res.user || res;
    localStorage.setItem('empay_token', token);
    localStorage.setItem('empay_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('empay_token');
    localStorage.removeItem('empay_user');
    setUser(null);
  };

  const can = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
