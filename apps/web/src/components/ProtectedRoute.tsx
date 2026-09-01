import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading, setupRequired } = useAuth();
  if (loading) return <div className="splash"><div className="spinner" /><p>Cargando sistema…</p></div>;
  if (setupRequired) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
