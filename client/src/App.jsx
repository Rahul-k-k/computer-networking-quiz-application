import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import { FullScreenLoader } from './components/FullScreenLoader';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import QuizArena from './pages/QuizArena';
import QuizResult from './pages/QuizResult';
import Leaderboard from './pages/Leaderboard';
import TeacherDashboard from './pages/TeacherDashboard';

/** Shared chrome (nav + footer) for the "inside the app" pages. */
function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Send people to the right place based on auth state. */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'teacher' ? '/teacher' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* The quiz runs in its own distraction-free, fullscreen-capable shell —
          deliberately no shared navbar so there are fewer ways to wander off. */}
      <Route
        path="/quiz/:categoryId"
        element={
          <ProtectedRoute>
            <QuizArena />
          </ProtectedRoute>
        }
      />

      {/* The "All-in-One" mixed challenge shares the same arena in mixed mode. */}
      <Route
        path="/challenge/all-in-one"
        element={
          <ProtectedRoute>
            <QuizArena mode="mixed" />
          </ProtectedRoute>
        }
      />

      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result/:resultId"
          element={
            <ProtectedRoute>
              <QuizResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
