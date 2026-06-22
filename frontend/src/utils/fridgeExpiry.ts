import type { FridgeItem } from '../types';

export type ExpiryStatus = 'ok' | 'soon' | 'expired';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getExpiryStatus(expiresAt?: string): ExpiryStatus {
  if (!expiresAt) return 'ok';
  const today = startOfDay();
  const expiry = startOfDay(new Date(expiresAt));
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'soon';
  return 'ok';
}

export function getExpiredItems(items: FridgeItem[]) {
  return items.filter((item) => getExpiryStatus(item.expiresAt) === 'expired');
}

export function getExpiringSoonItems(items: FridgeItem[]) {
  return items.filter((item) => getExpiryStatus(item.expiresAt) === 'soon');
}
