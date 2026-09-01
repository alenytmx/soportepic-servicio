export const PERMISSIONS = [
  'dashboard:view',
  'clients:view', 'clients:create', 'clients:edit', 'clients:deactivate',
  'users:view', 'users:create', 'users:edit', 'users:deactivate',
  'orderTypes:view', 'orderTypes:create', 'orderTypes:edit', 'orderTypes:deactivate',
  'quotationTypes:view', 'quotationTypes:edit',
  'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:download',
  'orders:view', 'orders:create', 'orders:edit', 'orders:status', 'orders:pay', 'orders:print', 'orders:download', 'orders:cancel',
  'warranties:view', 'warranties:edit',
  'expenses:view', 'expenses:create', 'expenses:edit', 'expenses:cancel',
  'reports:view', 'reports:download',
  'settings:view', 'settings:edit',
  'controlPanel:view', 'controlPanel:edit',
  'audit:view'
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export const ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const OPERATOR_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'clients:view', 'clients:create', 'clients:edit',
  'orderTypes:view',
  'quotationTypes:view',
  'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:download',
  'orders:view', 'orders:create', 'orders:edit', 'orders:status', 'orders:pay', 'orders:print', 'orders:download',
  'warranties:view', 'warranties:edit',
  'expenses:view', 'expenses:create',
  'settings:view', 'controlPanel:view'
];
