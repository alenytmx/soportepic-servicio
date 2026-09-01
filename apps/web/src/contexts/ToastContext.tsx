import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type Kind = 'success' | 'error';
interface Toast { id: number; message: string; kind: Kind }
interface ToastValue { success(message: string): void; error(message: string): void }
const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback((message: string, kind: Kind) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, message, kind }]);
    window.setTimeout(() => remove(id), 4500);
  }, [remove]);
  const value = useMemo(() => ({ success: (message: string) => push(message, 'success'), error: (message: string) => push(message, 'error') }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.kind}`} key={toast.id}>
            {toast.kind === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            <span>{toast.message}</span>
            <button className="icon-button" onClick={() => remove(toast.id)} aria-label="Cerrar"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}
