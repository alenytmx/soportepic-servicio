import { money } from './money.js';

export interface PricedMaterial {
  quantity?: number;
  unitCost?: number;
}

export function calculateMaterialsTotal(materials: PricedMaterial[] = []) {
  return money(materials.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0));
}

export function calculateOrderTotal(serviceAmount: number, materials: PricedMaterial[] = []) {
  return money(Number(serviceAmount || 0) + calculateMaterialsTotal(materials));
}
