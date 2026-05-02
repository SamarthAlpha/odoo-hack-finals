

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MyProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.employee_id) {
      navigate(`/employees/${user.employee_id}`, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="page-loader" style={{ height: 300, background: 'transparent' }}>
      <div className="spinner" />
    </div>
  );
}



