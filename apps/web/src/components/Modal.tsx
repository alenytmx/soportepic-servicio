import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, title, onClose, children, size = 'medium' }: { open: boolean; title: string; onClose(): void; children: ReactNode; size?: 'small' | 'medium' | 'large' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose}><X /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
