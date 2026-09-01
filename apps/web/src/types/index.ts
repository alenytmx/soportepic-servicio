export type Permission = string;

export interface User {
  _id: string;
  name: string;
  username: string;
  role: 'admin' | 'operator';
  permissions: Permission[];
  active: boolean;
  revision: number;
  lastLoginAt?: string;
}

export interface Pagination { page: number; limit: number; total: number; pages: number }

export interface Client {
  _id: string;
  clientCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: { street: string; neighborhood: string; city: string; state: string; postalCode: string };
  references: string;
  notes: string;
  active: boolean;
  revision: number;
}

export interface OrderType {
  _id: string;
  name: string;
  description: string;
  active: boolean;
  revision: number;
}

export interface Equipment {
  _id?: string;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  observations: string;
  accessories: string[];
}

export interface Material {
  _id?: string;
  description: string;
  quantity: number;
  unitCost: number;
  supplier: string;
}

export interface Payment {
  _id: string;
  amount: number;
  paymentMethod: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Mixto';
  cashAmount: number;
  transferAmount: number;
  cardAmount: number;
  reference: string;
  notes: string;
  status: 'Aplicado' | 'Cancelado';
  paidAt: string;
  createdByName: string;
}

export interface ServiceOrder {
  _id: string;
  folio: string;
  orderDate: string;
  client: string;
  clientSnapshot: { name: string; phone: string; email: string; address: string };
  orderType: string;
  orderTypeName: string;
  customerReference: string;
  equipment: Equipment[];
  photos: { _id: string; filename: string; originalName: string; mimeType: string }[];
  materials: Material[];
  serviceAmount?: number;
  total: number;
  paidAmount: number;
  balance: number;
  payments: Payment[];
  status: string;
  statusHistory: { _id: string; status: string; changedAt: string; changedByName: string; note: string }[];
  deliverySignature?: { dataUrl: string; signedAt: string; signedByName: string; receivedBy: string };
  notes: string;
  createdByName: string;
  revision: number;
}

export interface Expense {
  _id: string;
  expenseCode: string;
  expenseDate: string;
  concept: string;
  category: string;
  amount: number;
  paymentMethod: 'Efectivo' | 'Transferencia';
  serviceOrder?: { _id: string; folio: string; clientSnapshot: { name: string } } | null;
  notes: string;
  status: 'Activo' | 'Cancelado';
  revision: number;
}

export interface Settings {
  businessName: string;
  brandName: string;
  slogan: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  social: { facebook: string; instagram: string; whatsapp: string; website: string };
  logoUrl: string;
  logoFilename?: string;
  printFormat: 'a4' | 'thermal58' | 'thermal80';
  ticketHeader: string;
  ticketFooter: string;
  timezone: string;
  themeMode: 'light' | 'dark' | 'system';
  primaryColor: string;
  fontFamily: 'system' | 'inter' | 'arial' | 'georgia';
  fontScale: number;
  showThemeToggle: boolean;
  showUserName: boolean;
  showDateTime: boolean;
  systemVersion: string;
  rightsText: string;
  supportPhone: string;
}
