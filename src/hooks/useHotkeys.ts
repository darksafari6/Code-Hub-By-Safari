import { useEffect, useRef } from 'react';

export interface HotkeyHandlers {
  onSave: () => void;
  onSaveAll: () => void;
  onCommandPalette: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
  onOpenSettings: () => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onGit: () => void;
  onExplorer: () => void;
  onToggleAssistant: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;

      const target = event.target as HTMLElement | null;
      const typingInField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      const key = event.key.toLowerCase();
      const shift = event.shiftKey;
      const alt = event.altKey;
      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };

      if (key === 's' && !shift && !alt) {
        run(handlersRef.current.onSave);
        return;
      }

      if (key === 's' && shift) {
        run(handlersRef.current.onSaveAll);
        return;
      }

      if (key === 'k') {
        run(handlersRef.current.onCommandPalette);
        return;
      }

      if (key === 'p' && shift) {
        run(handlersRef.current.onCommandPalette);
        return;
      }

      if (key === 'p' && !shift) {
        run(handlersRef.current.onQuickOpen);
        return;
      }

      if (key === 'f' && shift) {
        run(handlersRef.current.onSearch);
        return;
      }

      if (key === 'g' && shift) {
        run(handlersRef.current.onGit);
        return;
      }

      if (key === 'e' && shift) {
        run(handlersRef.current.onExplorer);
        return;
      }

      if (key === 'b' && !shift) {
        run(handlersRef.current.onToggleSidebar);
        return;
      }

      if (key === 'j' && !shift) {
        run(handlersRef.current.onToggleTerminal);
        return;
      }

      if (key === '`' && !typingInField) {
        run(handlersRef.current.onToggleTerminal);
        return;
      }

      if (key === ',' && !shift) {
        run(handlersRef.current.onOpenSettings);
        return;
      }

      if (key === 'v' && shift) {
        run(handlersRef.current.onTogglePreview);
        return;
      }

      if (key === 'a' && alt) {
        run(handlersRef.current.onToggleAssistant);
        return;
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
