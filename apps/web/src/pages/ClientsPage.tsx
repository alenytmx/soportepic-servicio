import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, History, Plus, UserX } from 'lucide-react';
import { EmptyState, LoadingTable, PageHeader, Pagination, SearchInput } from '../components/Common';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage, jsonBody, query } from '../lib/api';
import type { Client, Pagination as PaginationType, ServiceOrder } from '../types';
import { formatDate, formatMoney } from '../lib/format';

const emptyClient = {
  firstName: '', lastName: '', phone: '', alternatePhone: '', email: '',
  address: { street: '', neighborhood: '', city: '', state: 'Nayarit', postalCode: '' },
  references: '', notes: '', active: true
};

export function ClientsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({ page: 1, limit: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ client: Client; orders: ServiceOrder[]; totals: { orders: number; total: number; paid: number; balance: number } } | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await api<{ data: Client[]; pagination: PaginationType }>(`/clients?${query({ page, limit: 10, search })}`);
      setData(response.data); setPagination(response.pagination);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setLoading(false); }
  }, [search, toast]);

  useEffect(() => { const id = window.setTimeout(() => void load(1), 250); return () => window.clearTimeout(id); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyClient); setModal(true); };
  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({ firstName: client.firstName, lastName: client.lastName, phone: client.phone, alternatePhone: client.alternatePhone || '', email: client.email || '', address: { ...emptyClient.address, ...client.address }, references: client.references || '', notes: client.notes || '', active: client.active });
    setModal(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const response: { message: string; possibleDuplicates?: Client[] } = editing
        ? await api<{ message: string }>(`/clients/${editing._id}`, { method: 'PUT', ...jsonBody({ ...form, revision: editing.revision }) })
        : await api<{ message: string; possibleDuplicates: Client[] }>('/clients', { method: 'POST', ...jsonBody(form) });
      toast.success(response.message);
      if (response.possibleDuplicates?.length) toast.error('Se detectaron clientes similares. Revisa la lista para evitar un duplicado real.');
      setModal(false); await load(pagination.page);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  const deactivate = async (client: Client) => {
    if (!window.confirm(`¿Desactivar a ${client.firstName} ${client.lastName}? Su historial se conservará.`)) return;
    try { const result = await api<{ message: string }>(`/clients/${client._id}/deactivate`, { method: 'PATCH' }); toast.success(result.message); await load(pagination.page); }
    catch (error) { toast.error(errorMessage(error)); }
  };
  const openHistory = async (client: Client) => { try { const response = await api<{ data: { client: Client; orders: ServiceOrder[]; totals: { orders: number; total: number; paid: number; balance: number } } }>(`/clients/${client._id}/history`); setHistory(response.data); } catch (error) { toast.error(errorMessage(error)); } };

  return <>
    <PageHeader title="Clientes" description="Directorio, referencias e historial de contacto." actions={can('clients:create') && <button className="button button-primary" onClick={openNew}><Plus size={18} />Nuevo cliente</button>} />
    <section className="panel"><div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Nombre, teléfono, correo o código…" /><span className="result-count">{pagination.total} clientes</span></div>
      {loading ? <LoadingTable /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Contacto</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {data.map((client) => <tr key={client._id}><td><span className="code-chip">{client.clientCode}</span></td><td><strong>{client.firstName} {client.lastName}</strong>{client.references && <small>{client.references}</small>}</td><td>{client.phone}<small>{client.email || 'Sin correo'}</small></td><td>{[client.address?.street, client.address?.neighborhood, client.address?.city].filter(Boolean).join(', ') || '—'}</td><td><span className={`status ${client.active ? 'status-activo' : 'status-cancelado'}`}>{client.active ? 'Activo' : 'Inactivo'}</span></td><td><div className="row-actions"><button className="icon-button" title="Historial de reparaciones y anticipos" onClick={() => void openHistory(client)}><History size={17} /></button>{can('clients:edit') && <button className="icon-button" title="Editar" onClick={() => openEdit(client)}><Edit3 size={17} /></button>}{can('clients:deactivate') && client.active && <button className="icon-button danger" title="Desactivar" onClick={() => void deactivate(client)}><UserX size={17} /></button>}</div></td></tr>)}
      </tbody></table>{!data.length && <EmptyState />}</div>}
      <Pagination page={pagination.page} pages={pagination.pages} onChange={(page) => void load(page)} />
    </section>
    <Modal open={modal} title={editing ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(false)} size="large"><form onSubmit={submit}>
      <div className="form-section"><h3>Información del cliente</h3><div className="form-grid two">
        <label className="field"><span>Nombre *</span><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required minLength={2} /></label>
        <label className="field"><span>Apellidos</span><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
        <label className="field"><span>Teléfono *</span><input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required minLength={7} /></label>
        <label className="field"><span>Teléfono alterno</span><input inputMode="tel" value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} /></label>
        <label className="field"><span>Correo</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field"><span>Referencia</span><input value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })} placeholder="Cómo ubicarlo o referencia" /></label>
      </div></div>
      <div className="form-section"><h3>Dirección</h3><div className="form-grid two">
        <label className="field"><span>Calle y número</span><input value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} /></label>
        <label className="field"><span>Colonia</span><input value={form.address.neighborhood} onChange={(e) => setForm({ ...form, address: { ...form.address, neighborhood: e.target.value } })} /></label>
        <label className="field"><span>Ciudad</span><input value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} /></label>
        <label className="field"><span>Estado</span><input value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} /></label>
        <label className="field"><span>Código postal</span><input inputMode="numeric" value={form.address.postalCode} onChange={(e) => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })} /></label>
      </div></div>
      <label className="field"><span>Notas internas</span><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</button></div>
    </form></Modal>
    <Modal open={Boolean(history)} title={`Expediente de ${history?.client.firstName || ''}`} onClose={() => setHistory(null)} size="large">{history && <><div className="stats-grid history-stats"><div className="stat-card"><div><span>Reparaciones</span><strong>{history.totals.orders}</strong></div></div><div className="stat-card"><div><span>Total</span><strong>{formatMoney(history.totals.total)}</strong></div></div><div className="stat-card"><div><span>Anticipos</span><strong>{formatMoney(history.totals.paid)}</strong></div></div><div className="stat-card"><div><span>Saldo</span><strong>{formatMoney(history.totals.balance)}</strong></div></div></div><div className="table-wrap"><table><thead><tr><th>Orden</th><th>Fecha</th><th>Equipo</th><th>Total</th><th>Anticipos</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>{history.orders.map(order => <tr key={order._id}><td>{order.folio}</td><td>{formatDate(order.orderDate)}</td><td>{order.equipment.map(e => `${e.equipmentType} ${e.brand}`).join(', ')}</td><td>{formatMoney(order.total)}</td><td>{formatMoney(order.paidAmount)}<small>{order.payments.filter(p => p.status === 'Aplicado').map(p => `${formatDate(p.paidAt, true)} ${p.paymentMethod}: ${formatMoney(p.amount)}`).join(' · ') || 'Sin anticipos'}</small></td><td>{formatMoney(order.balance)}</td><td>{order.status}</td></tr>)}</tbody></table></div></>}</Modal>
  </>;
}
