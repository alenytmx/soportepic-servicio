import { useCallback, useEffect, useState } from 'react';
import { EmptyState, LoadingTable, PageHeader, Pagination, SearchInput } from '../components/Common';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage, query } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Pagination as PaginationType } from '../types';

interface AuditItem { _id: string; username: string; action: string; entity: string; entityId?: string; details?: unknown; ip?: string; createdAt: string }
const actionLabels: Record<string, string> = { create: 'Creación', update: 'Actualización', deactivate: 'Desactivación', payment: 'Abono registrado', status: 'Cambio de estado', claim: 'Reclamación agregada', updateLogo: 'Actualización de logotipo', passwordUpdate: 'Actualización de contraseña', deliverySignature: 'Firma de entrega', cancelPayment: 'Cancelación de abono', login: 'Inicio de sesión', logout: 'Cierre de sesión', resetDatabase: 'Reinicio de base de datos' };
const moduleLabels: Record<string, string> = { settings: 'Configuración', serviceOrder: 'Órdenes de servicio', client: 'Clientes', user: 'Usuarios', orderType: 'Tipos de orden', quotationType: 'Tipos de cotización', quotation: 'Cotizaciones', warranty: 'Garantías', expense: 'Gastos', database: 'Base de datos' };
export function AuditPage() {
  const toast = useToast(); const [data, setData] = useState<AuditItem[]>([]); const [pagination, setPagination] = useState<PaginationType>({ page: 1, limit: 20, total: 0, pages: 0 }); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async (page = 1) => { setLoading(true); try { const result = await api<{ data: AuditItem[]; pagination: PaginationType }>(`/audit?${query({ page, limit: 20, search })}`); setData(result.data); setPagination(result.pagination); } catch (error) { toast.error(errorMessage(error)); } finally { setLoading(false); } }, [search, toast]);
  useEffect(() => { const id = setTimeout(() => void load(1), 250); return () => clearTimeout(id); }, [load]);
  return <><PageHeader title="Auditoría" description="Historial en español de las operaciones importantes del sistema." /><section className="panel"><div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Usuario, acción o módulo…" /><span className="result-count">{pagination.total} eventos</span></div>{loading ? <LoadingTable /> : <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción realizada</th><th>Módulo</th><th>Dirección IP</th></tr></thead><tbody>{data.map((item) => <tr key={item._id}><td>{formatDate(item.createdAt, true)}</td><td><strong>@{item.username}</strong></td><td><span className="code-chip">{actionLabels[item.action] || item.action}</span></td><td>{moduleLabels[item.entity] || item.entity}</td><td>{item.ip || '—'}</td></tr>)}</tbody></table>{!data.length && <EmptyState />}</div>}<Pagination page={pagination.page} pages={pagination.pages} onChange={(page) => void load(page)} /></section></>;
}
