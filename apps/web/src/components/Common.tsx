import type { ReactNode } from 'react';
import { Inbox, Search } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange(value: string): void; placeholder?: string }) {
  return <label className="search-input"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export function EmptyState({ title = 'No hay registros', description = 'Cambia los filtros o agrega un nuevo registro.' }: { title?: string; description?: string }) {
  return <div className="empty-state"><Inbox size={40} /><strong>{title}</strong><span>{description}</span></div>;
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange(page: number): void }) {
  if (pages <= 1) return null;
  return <div className="pagination"><button className="button button-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button className="button button-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</button></div>;
}

export function StatusBadge({ status }: { status: string }) {
  const slug = status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  return <span className={`status status-${slug}`}>{status}</span>;
}

export function LoadingTable() {
  return <div className="loading-panel"><div className="spinner" /><span>Cargando información…</span></div>;
}
