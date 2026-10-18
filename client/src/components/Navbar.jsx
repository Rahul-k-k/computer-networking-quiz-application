import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, Trophy, LayoutDashboard, GraduationCap, Sparkles } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, isTrial, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isTeacher = user?.role === 'teacher';
  const home = isTeacher ? '/teacher' : '/dashboard';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-4 pt-3">
      <nav className="clay-card mx-auto max-w-6xl flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
        <Link to={user ? home : '/'} className="shrink-0">
          <Logo size={36} withText />
        </Link>

        <div className="flex-1" />

        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
            <Link
              to={home}
              className="clay-chip hidden sm:inline-flex items-center gap-1.5 text-slate-600 hover:text-grape-600"
            >
              {isTeacher ? <GraduationCap className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
              <span>Dashboard</span>
            </Link>
            <Link
              to="/leaderboard"
              className="clay-chip hidden sm:inline-flex items-center gap-1.5 text-slate-600 hover:text-grape-600"
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </Link>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="clay-chip grid place-items-center w-10 h-10 !px-0 text-slate-600 hover:text-grape-600"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {user && (
          <>
            <div className="hidden md:flex flex-col items-end leading-tight max-w-[9rem]">
              <span className="font-display font-bold text-slate-800 text-sm truncate w-full text-right" title={user.name}>
                {user.name}
              </span>
              {isTrial ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-peach-600">
                  <Sparkles className="w-3 h-3" /> Trial session
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-400 capitalize">{user.role}</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="clay-chip grid place-items-center w-10 h-10 !px-0 text-slate-600 hover:text-peach-600"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
