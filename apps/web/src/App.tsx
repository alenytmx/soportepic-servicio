import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { OrderTypesPage } from './pages/OrderTypesPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderFormPage } from './pages/OrderFormPage';
import { OrderDetailsPage } from './pages/OrderDetailsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { UsersPage } from './pages/UsersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { QuotationTypesPage } from './pages/QuotationTypesPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { WarrantiesPage } from './pages/WarrantiesPage';

function PermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? children : <Navigate to="/" replace />;
}

export function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/setup" element={<SetupPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route index element={<PermissionGate permission="dashboard:view"><DashboardPage /></PermissionGate>} />
      <Route path="clients" element={<PermissionGate permission="clients:view"><ClientsPage /></PermissionGate>} />
      <Route path="order-types" element={<PermissionGate permission="orderTypes:view"><OrderTypesPage /></PermissionGate>} />
      <Route path="quotation-types" element={<PermissionGate permission="quotationTypes:view"><QuotationTypesPage /></PermissionGate>} />
      <Route path="quotations" element={<PermissionGate permission="quotations:view"><QuotationsPage /></PermissionGate>} />
      <Route path="orders" element={<PermissionGate permission="orders:view"><OrdersPage /></PermissionGate>} />
      <Route path="orders/new" element={<PermissionGate permission="orders:create"><OrderFormPage /></PermissionGate>} />
      <Route path="orders/:id" element={<PermissionGate permission="orders:view"><OrderDetailsPage /></PermissionGate>} />
      <Route path="orders/:id/edit" element={<PermissionGate permission="orders:edit"><OrderFormPage /></PermissionGate>} />
      <Route path="warranties" element={<PermissionGate permission="warranties:view"><WarrantiesPage /></PermissionGate>} />
      <Route path="expenses" element={<PermissionGate permission="expenses:view"><ExpensesPage /></PermissionGate>} />
      <Route path="users" element={<PermissionGate permission="users:view"><UsersPage /></PermissionGate>} />
      <Route path="reports" element={<PermissionGate permission="reports:view"><ReportsPage /></PermissionGate>} />
      <Route path="settings" element={<PermissionGate permission="settings:view"><SettingsPage /></PermissionGate>} />
      <Route path="audit" element={<PermissionGate permission="audit:view"><AuditPage /></PermissionGate>} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter>;
}
