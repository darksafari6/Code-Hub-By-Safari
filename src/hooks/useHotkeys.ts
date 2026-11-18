import { useEffect, useRef } from 'react';

export interface HotkeyHandlers {
  onSave: () => void;
  onCommandPalette: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
  onOpenSettings: () => void;
  onQuickOpen: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const typingInField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      if (modifier && !event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlersRef.current.onSave();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlersRef.current.onCommandPalette();
        return;
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handlersRef.current.onCommandPalette();
        return;
      }

      if (modifier && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handlersRef.current.onQuickOpen();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        handlersRef.current.onToggleSidebar();
        return;
      }

      if (modifier && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        handlersRef.current.onToggleTerminal();
        return;
      }

      if (modifier && event.key === '`' && !typingInField) {
        event.preventDefault();
        handlersRef.current.onToggleTerminal();
        return;
      }

      if (modifier && event.key === ',') {
        event.preventDefault();
        handlersRef.current.onOpenSettings();
        return;
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        handlersRef.current.onTogglePreview();
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
