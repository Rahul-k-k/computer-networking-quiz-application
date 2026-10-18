import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from './FullScreenLoader';

/**
 * Gate a route behind authentication (and optionally a role). While the auth
 * state is resolving we show a loader so we don't flash the login screen at a
 * user who is actually signed in.
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/dashboard'} replace />;
  }
  return children;
}
