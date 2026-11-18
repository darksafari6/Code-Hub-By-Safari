import { useEffect, useRef } from 'react';

export interface DesktopBridge {
  platform?: string;
  onMenuCommand?: (callback: (id: string) => void) => () => void;
}

declare global {
  interface Window {
    safariDesktop?: DesktopBridge;
  }
}

/** Subscribe to commands sent by the native Electron menu. */
export function useDesktopMenu(handler: (id: string) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const bridge = window.safariDesktop;
    if (!bridge?.onMenuCommand) return undefined;
    return bridge.onMenuCommand((id) => handlerRef.current(id));
  }, []);
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.safariDesktop);
}
