import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import Dashboard from './pages/dashboard/Dashboard';
import TimeRecord from './pages/time-record/TimeRecord';
import Revenue from './pages/revenue/Revenue';
import Rankings from './pages/rankings/Rankings';
import AdminLayout from './pages/admin/AdminLayout';
import AdminTimeSheets from './pages/admin/AdminTimeSheets';
import AdminRankings from './pages/admin/AdminRankings';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/signin" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <SignIn />} />
      <Route path="/signup" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <SignUp />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/time-record"
        element={
          <ProtectedRoute>
            <TimeRecord />
          </ProtectedRoute>
        }
      />
      <Route
        path="/revenue"
        element={
          <ProtectedRoute>
            <Revenue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rankings"
        element={
          <ProtectedRoute>
            <Rankings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminTimeSheets />} />
        <Route path="rankings" element={<AdminRankings />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/signin'} replace />} />
    </Routes>
  );
}

export default App;
