import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { BarChart3, BriefcaseBusiness, CircleDollarSign, ClipboardList, FileQuestion, LayoutDashboard, LogOut, Menu, Moon, Settings, ShieldCheck, Sun, Tags, Users, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { Settings as SettingsType } from '../types';

const links = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, permission: 'dashboard:view' },
  { to: '/orders', label: 'Órdenes', icon: ClipboardList, permission: 'orders:view' },
  { to: '/clients', label: 'Clientes', icon: Users, permission: 'clients:view' },
  { to: '/order-types', label: 'Tipos de orden', icon: Tags, permission: 'orderTypes:view' },
  { to: '/quotation-types', label: 'Tipos de cotización', icon: FileQuestion, permission: 'quotationTypes:view' },
  { to: '/quotations', label: 'Cotizaciones', icon: FileQuestion, permission: 'quotations:view' },
  { to: '/warranties', label: 'Garantías', icon: ShieldCheck, permission: 'warranties:view' },
  { to: '/expenses', label: 'Gastos', icon: CircleDollarSign, permission: 'expenses:view' },
  { to: '/reports', label: 'Reportes', icon: BarChart3, permission: 'reports:view' },
  { to: '/users', label: 'Usuarios', icon: ShieldCheck, permission: 'users:view' },
  { to: '/audit', label: 'Auditoría', icon: BriefcaseBusiness, permission: 'audit:view' },
  { to: '/settings', label: 'Configuración', icon: Settings, permission: 'settings:view' }
];

export function AppShell() {
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('sp-theme') === 'dark');
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [now, setNow] = useState(new Date());
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sp-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    api<{ data: SettingsType }>('/settings').then((result) => setSettings(result.data)).catch(() => undefined);
    const socket = io({ withCredentials: true });
    socket.on('settings:changed', () => api<{ data: SettingsType }>('/settings').then((result) => setSettings(result.data)).catch(() => undefined));
    return () => { socket.disconnect(); };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!settings?.themeMode) return;
    const resolved = settings.themeMode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.themeMode;
    setDark(resolved === 'dark');
  }, [settings?.themeMode]);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.style.setProperty('--primary', settings.primaryColor || '#2563eb');
    document.documentElement.style.setProperty('--font-scale', String(settings.fontScale || 1));
    const fonts = { system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', inter: 'Inter, "Segoe UI", sans-serif', arial: 'Arial, sans-serif', georgia: 'Georgia, serif' };
    document.documentElement.style.setProperty('--app-font', fonts[settings.fontFamily || 'system']);
  }, [settings]);

  return (
    <div className="app-layout">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Wrench size={22} /></div><div className="brand-copy"><strong>{settings?.businessName || 'Soportepic'}</strong><span>Servicio técnico</span></div></div>
        <nav>
          {links.filter((link) => can(link.permission)).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={20} /><span>{label}</span></NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setOpen(true)}><Menu /></button>
          {settings?.showDateTime !== false && <div className="topbar-clock"><strong>{new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(now)}</strong><span>{new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now)}</span></div>}<div className="topbar-spacer" />
          {settings?.showThemeToggle !== false && <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Cambiar tema">{dark ? <Sun /> : <Moon />}</button>}
          <div className="user-chip"><div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div>{settings?.showUserName !== false && <div><strong>{user?.name}</strong><span>{user?.role === 'admin' ? 'Administrador' : 'Operador'}</span></div>}</div>
          <button className="icon-button" onClick={() => void logout()} title="Cerrar sesión"><LogOut /></button>
        </header>
        <main className="content"><Outlet /></main>
        <footer>{settings?.rightsText || 'Derechos reservados Soportepic'} · Soporte {settings?.supportPhone || '311-135-45-85'} · v{settings?.systemVersion || '1.3.0'}</footer>
      </div>
    </div>
  );
}
