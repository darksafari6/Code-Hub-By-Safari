import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function basename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] ?? filePath;
}

export function dirname(filePath: string): string {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

export function modKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/** Generate a stable-enough unique id for chat messages and toasts. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/** Flatten a file tree into a list of files. */
export function flattenTree(
  nodes: Array<{ name: string; path: string; type: string; children?: unknown }>,
): Array<{ name: string; path: string }> {
  const files: Array<{ name: string; path: string }> = [];
  const walk = (items: typeof nodes): void => {
    for (const item of items) {
      if (item.type === 'file') files.push({ name: item.name, path: item.path });
      if (Array.isArray(item.children)) walk(item.children as typeof nodes);
    }
  };
  walk(nodes);
  return files;
}
