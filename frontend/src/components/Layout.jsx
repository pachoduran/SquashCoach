import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Trophy, 
  Users, 
  BarChart3, 
  Share2, 
  LogOut, 
  Menu, 
  X,
  User
} from 'lucide-react';
import { Button } from './ui/button';

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/matches', icon: Trophy, label: 'Partidos' },
  { path: '/players', icon: Users, label: 'Jugadores' },
  { path: '/analysis', icon: BarChart3, label: 'Análisis' },
  { path: '/shared', icon: Share2, label: 'Compartidos' },
];

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-brand-black">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-brand-dark-gray border-r border-white/10 z-50">
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <Link to="/" className="flex flex-col items-center gap-2">
            <img 
              src="https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ijowgans_adaptive-icon.png" 
              alt="Squash Coach" 
              className="rounded-lg"
              style={{ width: '120px', height: '120px' }}
            />
            <div>
              <span className="font-heading text-brand-gray text-lg tracking-wide">SQUASH</span>
              <span className="font-heading text-brand-yellow text-lg tracking-wide ml-1">COACH</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active 
                    ? 'bg-brand-yellow/10 text-brand-yellow' 
                    : 'text-brand-gray hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-heading text-sm uppercase tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 px-4">
            <div className="w-10 h-10 rounded-full bg-brand-yellow/20 flex items-center justify-center">
              <User className="w-5 h-5 text-brand-yellow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.name || 'Usuario'}</p>
              <p className="text-brand-gray text-sm truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            data-testid="logout-button"
            className="w-full justify-start text-brand-gray hover:text-red-400 hover:bg-red-400/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-heading text-sm uppercase tracking-wide">Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-brand-dark-gray border-b border-white/10 z-50 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src="https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ijowgans_adaptive-icon.png" 
            alt="Squash Coach" 
            className="rounded-lg"
            style={{ width: '96px', height: '96px' }}
          />
          <span className="font-heading text-brand-yellow text-lg tracking-wide">COACH</span>
        </Link>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-white"
          data-testid="mobile-menu-toggle"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/80 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed top-16 right-0 bottom-0 w-64 bg-brand-dark-gray border-l border-white/10 z-50 transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active 
                    ? 'bg-brand-yellow/10 text-brand-yellow' 
                    : 'text-brand-gray hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-heading text-sm uppercase tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-brand-gray hover:text-red-400 hover:bg-red-400/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-heading text-sm uppercase tracking-wide">Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-brand-dark-gray border-t border-white/10 z-50 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 ${
                active ? 'text-brand-yellow' : 'text-brand-gray'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-heading uppercase tracking-wide mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 pt-16 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
