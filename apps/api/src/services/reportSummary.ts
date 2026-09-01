import { Expense } from '../models/Expense.js';
import { Client } from '../models/Client.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { money } from '../utils/money.js';

export interface ReportSummary {
  period: { start: Date; end: Date };
  totals: {
    orders: number;
    equipmentReceived: number;
    repairsCompleted: number;
    clientsRegistered: number;
    billed: number;
    collected: number;
    outstanding: number;
    expenses: number;
    unrecordedMaterialCosts: number;
    netCash: number;
    estimatedProfit: number;
  };
  paymentsByMethod: { _id: string; total: number; count: number }[];
  ordersByStatus: { _id: string; count: number; total: number; balance: number }[];
  expensesByCategory: { category: string; total: number }[];
}

export async function getReportSummary(start: Date, end: Date, status?: string): Promise<ReportSummary> {
  const orderFilter: Record<string, unknown> = {
    orderDate: { $gte: start, $lte: end },
    status: { $ne: 'Cancelado' }
  };
  if (status) orderFilter.status = status;

  const [orders, expenses, paymentsByMethod, ordersByStatus, clientsRegistered] = await Promise.all([
    ServiceOrder.find(orderFilter).select('total balance materials equipment status').lean(),
    Expense.find({ expenseDate: { $gte: start, $lte: end }, status: 'Activo' }).select('amount serviceOrder category').lean(),
    ServiceOrder.aggregate<{ _id: string; total: number; count: number }>([
      { $unwind: '$payments' },
      { $match: { 'payments.status': 'Aplicado', 'payments.paidAt': { $gte: start, $lte: end }, status: { $ne: 'Cancelado' } } },
      { $group: { _id: '$payments.paymentMethod', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    ServiceOrder.aggregate<{ _id: string; count: number; total: number; balance: number }>([
      { $match: orderFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' }, balance: { $sum: '$balance' } } },
      { $sort: { count: -1 } }
    ]),
    Client.countDocuments({ createdAt: { $gte: start, $lte: end } })
  ]);

  const linkedOrderIds = new Set(expenses.filter((item) => item.serviceOrder).map((item) => String(item.serviceOrder)));
  const materialCosts = orders.reduce((sum, order) => {
    if (linkedOrderIds.has(String(order._id))) return sum;
    return sum + (order.materials || []).reduce((inner, item) => inner + item.quantity * item.unitCost, 0);
  }, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const collected = paymentsByMethod.reduce((sum, item) => sum + item.total, 0);
  const billed = orders.reduce((sum, item) => sum + item.total, 0);
  const outstanding = orders.reduce((sum, item) => sum + item.balance, 0);

  return {
    period: { start, end },
    totals: {
      orders: orders.length,
      equipmentReceived: orders.reduce((sum, item) => sum + (item.equipment?.length || 0), 0),
      repairsCompleted: orders.filter((item) => ['Listo para entregar', 'Entregado', 'Finalizado'].includes(item.status)).length,
      clientsRegistered,
      billed: money(billed),
      collected: money(collected),
      outstanding: money(outstanding),
      expenses: money(expenseTotal),
      unrecordedMaterialCosts: money(materialCosts),
      netCash: money(collected - expenseTotal),
      estimatedProfit: money(collected - expenseTotal - materialCosts)
    },
    paymentsByMethod: paymentsByMethod.map((item) => ({ ...item, total: money(item.total) })),
    ordersByStatus: ordersByStatus.map((item) => ({ ...item, total: money(item.total), balance: money(item.balance) })),
    expensesByCategory: Object.entries(expenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {})).map(([category, total]) => ({ category, total: money(total) })).sort((a, b) => b.total - a.total)
  };
}
