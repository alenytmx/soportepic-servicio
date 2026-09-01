import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { errorMessage } from '../lib/api';

export function SetupPage() {
  const { user, loading, setupRequired, setup } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', username: '', businessName: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  if (!loading && user) return <Navigate to="/" replace />;
  if (!loading && !setupRequired) return <Navigate to="/login" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) return toast.error('Las contraseñas no coinciden.');
    setSubmitting(true);
    try {
      await setup({ name: form.name, username: form.username, password: form.password, businessName: form.businessName });
      toast.success('Sistema configurado. Bienvenido.');
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };

  return <div className="auth-page"><div className="auth-card auth-card-wide">
    <div className="auth-brand"><div className="brand-mark large"><Wrench /></div><div><h1>Configuración inicial</h1><p>Crea el primer administrador de forma segura.</p></div></div>
    <form onSubmit={submit}>
      <div className="auth-heading"><ShieldCheck /><div><h2>Administrador principal</h2><p>Esta pantalla se desactiva automáticamente al terminar.</p></div></div>
      <div className="form-grid two">
        <label className="field"><span>Nombre completo</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></label>
        <label className="field"><span>Nombre del negocio</span><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required minLength={2} /></label>
        <label className="field"><span>Usuario</span><input autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} pattern="[a-zA-Z0-9._-]+" required minLength={3} /></label>
        <div />
        <label className="field"><span>Contraseña</span><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
        <label className="field"><span>Confirmar contraseña</span><input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></label>
      </div>
      <p className="form-hint">Usa al menos 8 caracteres, una mayúscula, una minúscula y un número.</p>
      <button className="button button-primary button-block" disabled={submitting}>{submitting ? 'Creando administrador…' : 'Configurar y entrar'}</button>
    </form>
  </div></div>;
}
