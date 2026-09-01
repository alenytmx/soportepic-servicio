import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Camera, ChevronLeft, Plus, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/Common';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage, jsonBody } from '../lib/api';
import { formatMoney, localDateInput } from '../lib/format';
import type { Client, Equipment, Material, OrderType, ServiceOrder } from '../types';

interface EquipmentForm extends Omit<Equipment, 'accessories'> { accessoriesText: string }
const newEquipment = (): EquipmentForm => ({ equipmentType: '', brand: '', model: '', serialNumber: '', observations: '', accessoriesText: '' });
const newMaterial = (): Material => ({ description: '', quantity: 1, unitCost: 0, supplier: '' });

export function OrderFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate(); const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]); const [types, setTypes] = useState<OrderType[]>([]); const [files, setFiles] = useState<File[]>([]); const [existingPhotos, setExistingPhotos] = useState(0);
  const [clientSearch, setClientSearch] = useState('');
  const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(editing);
  const [form, setForm] = useState({ orderDate: localDateInput(), clientId: '', orderTypeId: '', customerReference: '', equipment: [newEquipment()], materials: [] as Material[], total: 0, notes: '', revision: undefined as number | undefined });

  useEffect(() => {
    Promise.all([
      api<{ data: Client[] }>('/clients?limit=100'),
      api<{ data: OrderType[] }>('/order-types?limit=100')
    ]).then(([clientResult, typeResult]) => { setClients(clientResult.data); setTypes(typeResult.data); }).catch((error) => toast.error(errorMessage(error)));
  }, [toast]);
  useEffect(() => {
    if (!id) return;
    api<{ data: ServiceOrder }>(`/service-orders/${id}`).then(({ data }) => {
      setExistingPhotos(data.photos.length);
      setForm({
        orderDate: localDateInput(new Date(data.orderDate)), clientId: String(data.client), orderTypeId: String(data.orderType), customerReference: data.customerReference || '',
        equipment: data.equipment.map((item) => ({ equipmentType: item.equipmentType, brand: item.brand || '', model: item.model || '', serialNumber: item.serialNumber || '', observations: item.observations || '', accessoriesText: item.accessories?.join(', ') || '' })),
        materials: data.materials.map((item) => ({ description: item.description, quantity: item.quantity, unitCost: item.unitCost, supplier: item.supplier || '' })), total: data.serviceAmount ?? data.total, notes: data.notes || '', revision: data.revision
      });
    }).catch((error) => toast.error(errorMessage(error))).finally(() => setLoading(false));
  }, [id, toast]);

  const materialsCost = useMemo(() => form.materials.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0), [form.materials]);
  const orderTotal = Number(form.total || 0) + materialsCost;
  const filteredClients = useMemo(() => { const needle = clientSearch.trim().toLocaleLowerCase('es-MX'); if (!needle) return clients; return clients.filter((client) => `${client.clientCode} ${client.firstName} ${client.lastName} ${client.phone}`.toLocaleLowerCase('es-MX').includes(needle)); }, [clients, clientSearch]);
  const updateEquipment = (index: number, key: keyof EquipmentForm, value: string) => setForm((current) => ({ ...current, equipment: current.equipment.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const updateMaterial = (index: number, key: keyof Material, value: string | number) => setForm((current) => ({ ...current, materials: current.materials.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const chooseFiles = (selected: FileList | null) => {
    if (!selected) return;
    const accepted = Array.from(selected).filter((file) => ['image/jpeg', 'image/png'].includes(file.type));
    if (accepted.length !== selected.length) toast.error('Solo se aceptan fotografías JPG o PNG.');
    const available = 5 - existingPhotos;
    if (accepted.length > available) toast.error(`Solo puedes agregar ${available} fotografía(s).`);
    setFiles(accepted.slice(0, available));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.clientId || !form.orderTypeId) return toast.error('Selecciona el cliente y el tipo de orden.');
    if (form.equipment.some((item) => item.equipmentType.trim().length < 2)) return toast.error('Captura el tipo de cada equipo.');
    const payload = {
      ...form,
      orderDate: new Date(`${form.orderDate}T12:00:00`).toISOString(),
      equipment: form.equipment.map(({ accessoriesText, ...item }) => ({ ...item, accessories: accessoriesText.split(',').map((value) => value.trim()).filter(Boolean) })),
      materials: form.materials.filter((item) => item.description.trim())
    };
    setSaving(true);
    try {
      let orderId = id;
      if (editing) {
        await api(`/service-orders/${id}`, { method: 'PUT', ...jsonBody(payload) });
        if (files.length) { const photos = new FormData(); files.forEach((file) => photos.append('photos', file)); await api(`/service-orders/${id}/photos`, { method: 'POST', body: photos }); }
        toast.success('Orden actualizada.');
      } else {
        const body = new FormData(); body.append('payload', JSON.stringify(payload)); files.forEach((file) => body.append('photos', file));
        const response = await api<{ data: ServiceOrder; message: string }>('/service-orders', { method: 'POST', body }); orderId = response.data._id; toast.success(response.message);
      }
      navigate(`/orders/${orderId}`);
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-panel page-loading"><div className="spinner" />Cargando orden…</div>;
  return <form onSubmit={submit}>
    <PageHeader title={editing ? 'Editar orden' : 'Nueva orden de servicio'} description="Registra al cliente, los equipos y la evidencia de recepción." actions={<div className="page-actions"><Link to={id ? `/orders/${id}` : '/orders'} className="button button-secondary"><ChevronLeft size={18} />Cancelar</Link><button className="button button-primary" disabled={saving}><Save size={18} />{saving ? 'Guardando…' : 'Guardar orden'}</button></div>} />
    <section className="panel form-panel"><div className="form-section"><h2>Datos generales</h2><div className="form-grid three">
      <label className="field"><span>Fecha *</span><input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} required /></label>
      <label className="field client-combobox"><span>Buscar cliente por código, nombre o teléfono *</span><input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Ej. CLI-00012, Javier o 311…" /><select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required><option value="">Seleccionar resultado…</option>{filteredClients.map((client) => <option value={client._id} key={client._id}>{client.clientCode} · {client.firstName} {client.lastName} · {client.phone}</option>)}</select><small><Link to="/clients">¿No aparece? Registra al cliente</Link></small></label>
      <label className="field"><span>Tipo de orden *</span><select value={form.orderTypeId} onChange={(e) => setForm({ ...form, orderTypeId: e.target.value })} required><option value="">Seleccionar tipo…</option>{types.map((type) => <option value={type._id} key={type._id}>{type.name}</option>)}</select></label>
      <label className="field field-span-2"><span>Referencias del cliente</span><input value={form.customerReference} onChange={(e) => setForm({ ...form, customerReference: e.target.value })} placeholder="Indicaciones, persona autorizada o referencia" /></label>
    </div></div>

    <div className="form-section"><div className="section-heading"><div><h2>Equipos</h2><p>Máximo 10 equipos por orden.</p></div><button type="button" className="button button-secondary" disabled={form.equipment.length >= 10} onClick={() => setForm({ ...form, equipment: [...form.equipment, newEquipment()] })}><Plus size={17} />Agregar equipo</button></div>
      <div className="repeat-list">{form.equipment.map((item, index) => <div className="repeat-card" key={index}><div className="repeat-title"><strong>Equipo {index + 1}</strong>{form.equipment.length > 1 && <button type="button" className="icon-button danger" onClick={() => setForm({ ...form, equipment: form.equipment.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={17} /></button>}</div><div className="form-grid three">
        <label className="field"><span>Tipo de equipo *</span><input value={item.equipmentType} onChange={(e) => updateEquipment(index, 'equipmentType', e.target.value)} placeholder="Celular, laptop, PC…" required /></label>
        <label className="field"><span>Marca</span><input value={item.brand} onChange={(e) => updateEquipment(index, 'brand', e.target.value)} /></label>
        <label className="field"><span>Modelo</span><input value={item.model} onChange={(e) => updateEquipment(index, 'model', e.target.value)} /></label>
        <label className="field"><span>Número de serie / IMEI</span><input value={item.serialNumber} onChange={(e) => updateEquipment(index, 'serialNumber', e.target.value)} /></label>
        <label className="field field-span-2"><span>Accesorios separados por coma</span><input value={item.accessoriesText} onChange={(e) => updateEquipment(index, 'accessoriesText', e.target.value)} placeholder="Cargador, funda, memoria" /></label>
        <label className="field field-span-3"><span>Observaciones y condiciones de recepción</span><textarea rows={3} value={item.observations} onChange={(e) => updateEquipment(index, 'observations', e.target.value)} placeholder="Falla reportada, golpes, rayones, contraseña de prueba…" /></label>
      </div></div>)}</div>
    </div>

    <div className="form-section"><div className="section-heading"><div><h2>Refacciones y materiales</h2><p>Estos importes se suman al servicio y forman parte del saldo del cliente.</p></div><button type="button" className="button button-secondary" onClick={() => setForm({ ...form, materials: [...form.materials, newMaterial()] })}><Plus size={17} />Agregar material</button></div>
      {form.materials.map((item, index) => <div className="material-row" key={index}><label className="field"><span>Descripción</span><input value={item.description} onChange={(e) => updateMaterial(index, 'description', e.target.value)} /></label><label className="field"><span>Cantidad</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateMaterial(index, 'quantity', Number(e.target.value))} /></label><label className="field"><span>Precio unitario</span><input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updateMaterial(index, 'unitCost', Number(e.target.value))} /></label><label className="field"><span>Proveedor</span><input value={item.supplier} onChange={(e) => updateMaterial(index, 'supplier', e.target.value)} /></label><button type="button" className="icon-button danger material-delete" onClick={() => setForm({ ...form, materials: form.materials.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={17} /></button></div>)}
    </div>

    <div className="form-section"><h2>Evidencias fotográficas</h2><p>Hasta cinco imágenes JPG o PNG de máximo 5 MB cada una. El reporte A4 las incluirá.</p><label className="upload-zone"><Camera size={30} /><strong>Seleccionar fotografías</strong><span>{existingPhotos} existentes · {files.length} nuevas</span><input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => chooseFiles(e.target.files)} /></label>{files.length > 0 && <div className="file-list">{files.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}</div>
    <label className="field"><span>Notas generales</span><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    <div className="service-total-final"><label className="field"><span>Total del servicio *</span><input type="number" min="0" step="0.01" inputMode="decimal" value={form.total} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} required /><small>Captura sólo el servicio; las refacciones se suman aparte.</small></label><div className="order-total-preview"><span>Servicio: <strong>{formatMoney(form.total)}</strong></span><span>Refacciones: <strong>{formatMoney(materialsCost)}</strong></span><span>Total de la orden: <strong>{formatMoney(orderTotal)}</strong></span></div></div>
    <div className="form-submit"><button className="button button-primary button-large" disabled={saving}><Save size={19} />{saving ? 'Guardando orden…' : 'Guardar orden de servicio'}</button></div>
    </section>
  </form>;
}
