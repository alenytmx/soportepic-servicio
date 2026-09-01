import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { DatabaseZap, LockKeyhole, RefreshCw, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { errorMessage } from '../lib/api';

export function LoginPage() {
  const { user, loading, setupRequired, systemError, login, refresh } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && setupRequired) return <Navigate to="/setup" replace />;
  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try { await login(username, password); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  return <div className="auth-page"><div className="auth-card">
    <div className="auth-brand"><div className="brand-mark large"><Wrench /></div><div><h1>Soportepic Servicio</h1><p>Gestión segura de tu taller</p></div></div>
    <form onSubmit={submit}>
      <div className="auth-heading"><LockKeyhole /><div><h2>Iniciar sesión</h2><p>Ingresa con tu cuenta autorizada.</p></div></div>
      {systemError && <div className="database-alert"><DatabaseZap size={24} /><div><strong>MongoDB no está conectado</strong><p>{systemError}</p><small>Si usas MongoDB local, inicia su servicio. Si usas Atlas, revisa `MONGODB_URI` en `apps/api/.env`.</small></div><button type="button" className="button button-secondary" onClick={() => void refresh()}><RefreshCw size={16} />Reintentar</button></div>}
      <label className="field"><span>Usuario</span><input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} /></label>
      <label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="button button-primary button-block" disabled={submitting || Boolean(systemError)}>{submitting ? 'Verificando…' : 'Entrar al sistema'}</button>
    </form>
    <small>Soporte técnico: 311-135-45-85</small>
  </div></div>;
}
