import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal, type ITheme } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { withTokenQuery } from '../../lib/api';
import type { ThemeMode } from '../../lib/types';

export interface TerminalHandle {
  clear: () => void;
  reconnect: () => void;
  focus: () => void;
}

interface TerminalViewProps {
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

const BANNER =
  '\x1b[38;5;245mSafari terminal\x1b[0m \x1b[38;5;240m· commands run inside your workspace\x1b[0m\r\n\r\n';

function toLines(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

export function TerminalView({
  visible,
  fontSize,
  theme,
  handleRef,
  onStatusChange,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  const lineRef = useRef('');
  const cursorRef = useRef(0);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const runningRef = useRef(false);
  const cwdRef = useRef('');
  const endedWithNewlineRef = useRef(true);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 8000,
      theme: THEMES[theme],
      allowTransparency: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);

    termRef.current = term;
    fitRef.current = fit;

    const fitNow = () => {
      if (!visibleRef.current) return;
      const element = term.element;
      if (!element || element.clientWidth === 0 || element.clientHeight === 0) return;
      try {
        fit.fit();
      } catch {
        // Fitting can fail while the element is being laid out.
      }
    };

    requestAnimationFrame(fitNow);

    const observer = new ResizeObserver(() => fitNow());
    observer.observe(container);

    const writePrompt = () => {
      const label = cwdRef.current ? `workspace/${cwdRef.current}` : 'workspace';
      term.write(`\x1b[38;5;75m${label}\x1b[0m \x1b[38;5;244m$\x1b[0m `);
    };

    const redraw = () => {
      term.write('\x1b[2K\r');
      writePrompt();
      term.write(lineRef.current);
      const behind = lineRef.current.length - cursorRef.current;
      if (behind > 0) term.write(`\x1b[${behind}D`);
    };

    const insertText = (text: string) => {
      const line = lineRef.current;
      const at = cursorRef.current;
      if (at === line.length) {
        lineRef.current = line + text;
        cursorRef.current = lineRef.current.length;
        term.write(text);
        return;
      }
      lineRef.current = line.slice(0, at) + text + line.slice(at);
      cursorRef.current = at + text.length;
      redraw();
    };

    const resetLine = () => {
      lineRef.current = '';
      cursorRef.current = 0;
      historyIndexRef.current = historyRef.current.length;
    };

    onStatusChange('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/ws/terminal${withTokenQuery('')}`,
    );
    socketRef.current = socket;

    socket.onopen = () => onStatusChange('open');
    socket.onclose = () => {
      onStatusChange('closed');
      runningRef.current = false;
      term.write('\r\n\x1b[38;5;244m[disconnected — use Reconnect in the panel toolbar]\x1b[0m\r\n');
    };
    socket.onerror = () => onStatusChange('closed');

    socket.onmessage = (message) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(String(message.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      switch (event.type) {
        case 'ready': {
          cwdRef.current = typeof event.cwd === 'string' ? event.cwd : '';
          onStatusChange('open');
          term.write(BANNER);
          resetLine();
          writePrompt();
          break;
        }
        case 'cwd': {
          cwdRef.current = typeof event.cwd === 'string' ? event.cwd : '';
          break;
        }
        case 'command': {
          runningRef.current = true;
          endedWithNewlineRef.current = true;
          break;
        }
        case 'stdout':
        case 'stderr': {
          const data = typeof event.data === 'string' ? event.data : '';
          if (!data) break;
          endedWithNewlineRef.current = data.endsWith('\n');
          term.write(toLines(data));
          break;
        }
        case 'exit': {
          runningRef.current = false;
          const code = typeof event.code === 'number' ? event.code : null;
          if (code !== null && code !== 0) {
            if (!endedWithNewlineRef.current) term.write('\r\n');
            term.write(`\x1b[38;5;244m[exit ${code}]\x1b[0m\r\n`);
          } else if (!endedWithNewlineRef.current) {
            term.write('\r\n');
          }
          resetLine();
          writePrompt();
          break;
        }
        case 'error': {
          const text = typeof event.message === 'string' ? event.message : 'Unknown error';
          term.write(`\x1b[31m${text}\x1b[0m\r\n`);
          if (!runningRef.current) writePrompt();
          break;
        }
        case 'clear': {
          term.clear();
          break;
        }
        default:
          break;
      }
    };

    term.onData((data) => {
      if (socket.readyState !== WebSocket.OPEN) return;

      if (data === '\r') {
        const command = lineRef.current;
        term.write('\r\n');
        if (!command.trim()) {
          resetLine();
          writePrompt();
          return;
        }

        historyRef.current.push(command);
        if (historyRef.current.length > 200) historyRef.current.shift();
        resetLine();
        socket.send(JSON.stringify({ type: 'exec', command }));
        return;
      }

      if (data === '\u007f') {
        if (cursorRef.current === 0) return;
        const line = lineRef.current;
        const at = cursorRef.current;
        lineRef.current = line.slice(0, at - 1) + line.slice(at);
        cursorRef.current = at - 1;
        redraw();
        return;
      }

      if (data === '\u0003') {
        if (runningRef.current) {
          socket.send(JSON.stringify({ type: 'interrupt' }));
        } else {
          term.write('^C\r\n');
          resetLine();
          writePrompt();
        }
        return;
      }

      if (data === '\u000c') {
        term.clear();
        writePrompt();
        term.write(lineRef.current);
        return;
      }

      if (data === '\u001b[A' || data === '\u001b[B') {
        const history = historyRef.current;
        if (history.length === 0) return;

        let index = historyIndexRef.current;
        if (index < 0 || index > history.length) index = history.length;

        index = data === '\u001b[A' ? Math.max(0, index - 1) : Math.min(history.length, index + 1);
        historyIndexRef.current = index;
        lineRef.current = history[index] ?? '';
        cursorRef.current = lineRef.current.length;
        redraw();
        return;
      }

      if (data === '\u001b[D') {
        if (cursorRef.current === 0) return;
        cursorRef.current -= 1;
        term.write('\x1b[D');
        return;
      }

      if (data === '\u001b[C') {
        if (cursorRef.current >= lineRef.current.length) return;
        cursorRef.current += 1;
        term.write('\x1b[C');
        return;
      }

      if (data === '\u001b[3~') {
        const line = lineRef.current;
        const at = cursorRef.current;
        if (at >= line.length) return;
        lineRef.current = line.slice(0, at) + line.slice(at + 1);
        redraw();
        return;
      }

      if (data === '\u001b[H' || data === '\u0001') {
        if (cursorRef.current === 0) return;
        term.write(`\x1b[${cursorRef.current}D`);
        cursorRef.current = 0;
        return;
      }

      if (data === '\u001b[F' || data === '\u0005') {
        const ahead = lineRef.current.length - cursorRef.current;
        if (ahead === 0) return;
        term.write(`\x1b[${ahead}C`);
        cursorRef.current = lineRef.current.length;
        return;
      }

      // Printable input, including pasted text.
      const printable = data.replace(/[\u0000-\u001f\u007f]/g, '');
      if (printable) insertText(printable);
    });

    if (handleRef) {
      handleRef.current = {
        clear: () => term.clear(),
        reconnect: () => setReconnectKey((value) => value + 1),
        focus: () => term.focus(),
      };
    }

    term.focus();

    return () => {
      observer.disconnect();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      socketRef.current = null;
      if (handleRef) handleRef.current = null;
    };
    // The terminal is recreated only on explicit reconnect requests; theme and
    // font size are applied through separate effects.
  }, [reconnectKey]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = THEMES[theme];
  }, [theme]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        // ignore
      }
    });
  }, [fontSize]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      const term = termRef.current;
      if (!term?.element) return;
      try {
        fitRef.current?.fit();
      } catch {
        // ignore
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
