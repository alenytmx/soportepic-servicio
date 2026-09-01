import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BarChart3, Download, FileText, Play } from 'lucide-react';
import { PageHeader, StatusBadge } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api, errorMessage, openPdf, query } from '../lib/api';
import { formatMoney, localDateInput } from '../lib/format';

interface Report {
  period: { start: string; end: string };
  totals: { orders: number; billed: number; collected: number; outstanding: number; expenses: number; unrecordedMaterialCosts: number; netCash: number; estimatedProfit: number };
  paymentsByMethod: { _id: string; total: number; count: number }[];
  ordersByStatus: { _id: string; count: number; total: number; balance: number }[];
  expensesByCategory: { category: string; total: number }[];
}

interface ReportProgress { stage: string; percent: number; message: string }

export function ReportsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const [dates, setDates] = useState({ start: localDateInput(first), end: localDateInput(now) });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<ReportProgress | null>(null);

  useEffect(() => {
    const socket = io({ withCredentials: true });
    socket.on('reports:progress', (progress: ReportProgress) => setPdfProgress(progress));
    return () => { socket.disconnect(); };
  }, []);

  const reportParams = () => ({
    start: new Date(`${dates.start}T00:00:00`).toISOString(),
    end: new Date(`${dates.end}T23:59:59.999`).toISOString()
  });

  const generate = async () => {
    setLoading(true);
    try {
      const result = await api<{ data: Report }>(`/reports/summary?${query(reportParams())}`);
      setReport(result.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    setPdfProgress({ stage: 'connecting', percent: 2, message: 'Solicitando el reporte…' });
    try {
      await openPdf(`/api/reports/pdf?${query(reportParams())}`);
      setPdfProgress({ stage: 'completed', percent: 100, message: 'Reporte PDF abierto en otra pestaña.' });
      toast.success('Reporte PDF abierto correctamente.');
    } catch (error) {
      setPdfProgress(null);
      toast.error(errorMessage(error));
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ['REPORTE SOPORTEPIC'], ['Desde', dates.start], ['Hasta', dates.end], [], ['Indicador', 'Importe'],
      ['Facturado', report.totals.billed], ['Cobrado', report.totals.collected], ['Saldo pendiente', report.totals.outstanding],
      ['Gastos', report.totals.expenses], ['Material sin gasto relacionado', report.totals.unrecordedMaterialCosts],
      ['Neto en caja', report.totals.netCash], ['Utilidad estimada', report.totals.estimatedProfit], [],
      ['Estado', 'Ordenes', 'Total', 'Saldo'], ...report.ordersByStatus.map((item) => [item._id, item.count, item.total, item.balance])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-${dates.start}-${dates.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const actions = can('reports:download') && report ? <>
    <button className="button button-primary" onClick={() => void downloadPdf()} disabled={pdfLoading}><FileText size={18} />{pdfLoading ? `${pdfProgress?.percent || 0}% PDF` : 'Abrir PDF'}</button>
    <button className="button button-secondary" onClick={downloadCsv}><Download size={18} />Descargar CSV</button>
  </> : null;

  return <>
    <PageHeader title="Reportes" description="Cobros, saldos, gastos y utilidad estimada del taller." actions={actions} />
    <section className="panel report-filters">
      <div className="form-grid three">
        <label className="field"><span>Fecha inicial</span><input type="date" value={dates.start} onChange={(event) => setDates({ ...dates, start: event.target.value })} /></label>
        <label className="field"><span>Fecha final</span><input type="date" value={dates.end} onChange={(event) => setDates({ ...dates, end: event.target.value })} /></label>
        <button className="button button-primary report-button" onClick={() => void generate()} disabled={loading}><Play size={18} />{loading ? 'Calculando…' : 'Generar reporte'}</button>
      </div>
      {pdfProgress && <div className="report-progress" role="status"><div><span style={{ width: `${pdfProgress.percent}%` }} /></div><small>{pdfProgress.message}</small></div>}
    </section>
    {!report && <section className="panel report-placeholder"><BarChart3 size={52} /><h2>Selecciona un periodo</h2><p>El sistema separa lo cobrado de lo facturado y descuenta los gastos activos.</p><button className="button button-primary" onClick={() => void generate()}>Generar reporte del mes</button></section>}
    {report && <>
      <div className="stats-grid report-stats">
        <div className="stat-card"><div><span>Facturado</span><strong>{formatMoney(report.totals.billed)}</strong><small>{report.totals.orders} órdenes</small></div></div>
        <div className="stat-card"><div><span>Cobrado</span><strong className="money-paid">{formatMoney(report.totals.collected)}</strong><small>Abonos del periodo</small></div></div>
        <div className="stat-card"><div><span>Saldo pendiente</span><strong className="money-pending">{formatMoney(report.totals.outstanding)}</strong><small>De órdenes del periodo</small></div></div>
        <div className="stat-card"><div><span>Gastos</span><strong>{formatMoney(report.totals.expenses)}</strong><small>Salidas activas</small></div></div>
        <div className="stat-card"><div><span>Neto en caja</span><strong>{formatMoney(report.totals.netCash)}</strong><small>Cobros menos gastos</small></div></div>
        <div className="stat-card featured"><div><span>Utilidad estimada</span><strong>{formatMoney(report.totals.estimatedProfit)}</strong><small>Descuenta materiales sin gasto relacionado</small></div></div>
      </div>
      <div className="report-grid">
        <section className="panel"><div className="panel-header"><div><h2>Órdenes por estado</h2><p>Distribución del periodo.</p></div></div><div className="table-wrap"><table><thead><tr><th>Estado</th><th>Órdenes</th><th>Total</th><th>Saldo</th></tr></thead><tbody>{report.ordersByStatus.map((item) => <tr key={item._id}><td><StatusBadge status={item._id} /></td><td>{item.count}</td><td>{formatMoney(item.total)}</td><td>{formatMoney(item.balance)}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><div className="panel-header"><div><h2>Movimientos del periodo</h2><p>Formas de pago y categorías.</p></div></div><h3>Abonos por forma de pago</h3><div className="summary-list">{report.paymentsByMethod.map((item) => <div key={item._id}><span>{item._id} ({item.count})</span><strong>{formatMoney(item.total)}</strong></div>)}{!report.paymentsByMethod.length && <p className="muted">Sin abonos.</p>}</div><h3>Gastos por categoría</h3><div className="summary-list">{report.expensesByCategory.map((item) => <div key={item.category}><span>{item.category}</span><strong>{formatMoney(item.total)}</strong></div>)}{!report.expensesByCategory.length && <p className="muted">Sin gastos.</p>}</div></section>
      </div>
    </>}
  </>;
}
