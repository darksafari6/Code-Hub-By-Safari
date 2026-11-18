import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { ITheme } from '@xterm/xterm';
import { withTokenQuery } from '../../lib/api';
import type { ThemeMode } from '../../lib/types';
import type { TerminalHandle } from './TerminalView';

interface PtyTerminalProps {
  visible: boolean;
  fontSize: number;
  theme: ThemeMode;
  handleRef: MutableRefObject<TerminalHandle | null>;
  onStatusChange: (status: 'connecting' | 'open' | 'closed') => void;
}

const THEMES: Record<ThemeMode, ITheme> = {
  dark: {
    background: '#0e1116',
    foreground: '#d7dce3',
    cursor: '#4c8dff',
    cursorAccent: '#0e1116',
    selectionBackground: '#26406b',
    black: '#0e1116',
    red: '#ff7b72',
    green: '#7ee787',
    yellow: '#e3b341',
    blue: '#79c0ff',
    magenta: '#d2a8ff',
    cyan: '#76e3ea',
    white: '#d7dce3',
    brightBlack: '#6b7684',
    brightRed: '#ffa198',
    brightGreen: '#a5f3b0',
    brightYellow: '#f0c674',
    brightBlue: '#a5d6ff',
    brightMagenta: '#e2c5ff',
    brightCyan: '#a5f3f0',
    brightWhite: '#ffffff',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f242c',
    cursor: '#2f6fed',
    selectionBackground: '#cfe0ff',
    black: '#1f242c',
    red: '#cf222e',
    green: '#1a7f37',
    yellow: '#9a6700',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#8a93a1',
  },
};

type ServerMessage =
  | { type: 'ready'; cwd?: string; pid?: number }
  | { type: 'output'; data: string }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }
  | { type: 'pong' };

/**
 * A real pseudo-terminal. The server owns the PTY, so keystrokes are forwarded
 * verbatim and full-screen programs (vim, htop, ssh) work exactly as they do in
 * a normal terminal. Only available when the backend reports `terminal: 'pty'`.
 */
export function PtyTerminal({
  visible,
  fontSize,
  theme,
  handleRef,
  onStatusChange,
}: PtyTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  // Create the terminal once; it outlives socket reconnects.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize,
      cursorBlink: true,
      scrollback: 10_000,
      allowProposedApi: false,
      theme: THEMES[theme],
      convertEol: false,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    term.write(
      '\x1b[38;5;245mSafari terminal\x1b[0m \x1b[38;5;240m· real PTY · your shell, your tools\x1b[0m\r\n\r\n',
    );

    termRef.current = term;
    fitRef.current = fit;

    const sendResize = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    const dataDisposable = term.onData((data) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'input', data }));
    });

    const resizeDisposable = term.onResize(sendResize);

    handleRef.current = {
      clear: () => term.clear(),
      reconnect: () => setReconnectKey((value) => value + 1),
      focus: () => term.focus(),
    };

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
        sendResize();
      } catch {
        // The element can be detached during teardown.
      }
    });
    observer.observe(container);

    const timer = window.setTimeout(() => {
      try {
        fit.fit();
        term.focus();
        sendResize();
      } catch {
        // ignore
      }
    }, 30);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      handleRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = THEMES[theme];
    term.options.fontSize = fontSize;
  }, [theme, fontSize]);

  useEffect(() => {
    if (!visible) return;
    const term = termRef.current;
    if (!term) return;

    const timer = window.setTimeout(() => {
      try {
        fitRef.current?.fit();
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
        term.focus();
      } catch {
        // ignore
      }
    }, 40);

    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return undefined;

    onStatusChange('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/ws/pty${withTokenQuery('')}`,
    );
    socketRef.current = socket;

    socket.onopen = () => {
      onStatusChange('open');
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      term.focus();
    };

    socket.onmessage = (message) => {
      let payload: ServerMessage;
      try {
        payload = JSON.parse(String(message.data)) as ServerMessage;
      } catch {
        return;
      }

      switch (payload.type) {
        case 'output':
          term.write(payload.data);
          break;
        case 'ready':
          term.focus();
          break;
        case 'exit':
          term.write(
            `\r\n\x1b[38;5;244m[process exited${
              payload.code === null ? '' : ` with code ${payload.code}`
            } — use Restart in the panel toolbar]\x1b[0m\r\n`,
          );
          break;
        case 'error':
          term.write(`\r\n\x1b[31m${payload.message}\x1b[0m\r\n`);
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      onStatusChange('closed');
      term.write('\r\n\x1b[38;5;244m[disconnected — use Restart in the panel toolbar]\x1b[0m\r\n');
    };

    socket.onerror = () => {
      onStatusChange('closed');
    };

    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socketRef.current = null;
    };
  }, [onStatusChange, reconnectKey]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden px-1 py-1" />;
}
