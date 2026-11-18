import { useEffect, useRef, type MutableRefObject } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { ChevronRight, FileCode2, FileText, Loader2, X } from 'lucide-react';
import type { RevealRequest } from '../../hooks/useWorkspace';
import { languageForPath, languageLabel } from '../../lib/languages';
import type { CursorPosition, FileDiff, Settings } from '../../lib/types';
import { basename, cn } from '../../lib/utils';
import { DiffView } from './DiffView';
import { Welcome } from './Welcome';

export interface EditorHandle {
  focus: () => void;
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  find: () => void;
  replace: () => void;
  toggleComment: () => void;
  formatDocument: () => void;
  goToLine: () => void;
  goToSymbol: () => void;
  goToDefinition: () => void;
  expandSelection: () => void;
  addCursorBelow: () => void;
  insertText: (text: string) => void;
  getSelection: () => string;
  runCommand: (id: string) => void;
}

export interface DiffState {
  path: string;
  diff: FileDiff | null;
  loading: boolean;
}

interface EditorPaneProps {
  openPaths: string[];
  activePath: string | null;
  buffers: Record<string, { content: string; original: string }>;
  dirtyPaths: string[];
  settings: Settings;
  reveal: RevealRequest | null;
  loadingPath: string | null;
  onOpen: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onCursorChange: (position: CursorPosition) => void;
  onNewFile: () => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onOpenGit: () => void;
  onToggleAssistant: () => void;
  hasProvider: boolean;
  providerLabel: string | null;
  handleRef: MutableRefObject<EditorHandle | null>;
  onSelectionChange: (text: string) => void;
  onAskAssistant: (text: string) => void;
  diffState: DiffState | null;
  onCloseDiff: () => void;
  onReloadDiff: () => void;
  onDiscardDiff: () => void;
}

type MonacoEditor = Parameters<OnMount>[0];

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'html', 'md',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'cs', 'php', 'sh', 'yml',
  'yaml', 'toml', 'sql', 'xml', 'svg', 'graphql',
]);

function isCodeFile(name: string): boolean {
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
  return extension ? CODE_EXTENSIONS.has(extension) : false;
}

export function EditorPane({
  openPaths,
  activePath,
  buffers,
  dirtyPaths,
  settings,
  reveal,
  loadingPath,
  onOpen,
  onClose,
  onChange,
  onCursorChange,
  onNewFile,
  onQuickOpen,
  onSearch,
  onOpenGit,
  onToggleAssistant,
  hasProvider,
  providerLabel,
  handleRef,
  onSelectionChange,
  onAskAssistant,
  diffState,
  onCloseDiff,
  onReloadDiff,
  onDiscardDiff,
}: EditorPaneProps) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const askRef = useRef(onAskAssistant);
  askRef.current = onAskAssistant;

  const dirtySet = new Set(dirtyPaths);
  const content = activePath ? buffers[activePath]?.content ?? '' : '';
  const isBufferReady = activePath ? buffers[activePath] !== undefined : false;

  useEffect(() => {
    if (!reveal || !activePath || reveal.path !== activePath) return;
    const editor = editorRef.current;
    if (!editor) return;

    editor.revealLineInCenter(reveal.line);
    editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
    editor.focus();
  }, [reveal, activePath]);

  useEffect(() => {
    if (diffState) {
      editorRef.current = null;
      handleRef.current = null;
    }
  }, [diffState, handleRef]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((event) => {
      onCursorChange({ line: event.position.lineNumber, column: event.position.column });
    });

    editor.onDidChangeCursorSelection(() => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection || selection.isEmpty()) {
        onSelectionChange('');
        return;
      }
      onSelectionChange(model.getValueInRange(selection));
    });

    const action = (id: string) => () => {
      void editor.getAction(id)?.run();
    };

    handleRef.current = {
      focus: () => editor.focus(),
      undo: () => editor.trigger('menu', 'undo', null),
      redo: () => editor.trigger('menu', 'redo', null),
      selectAll: () => editor.trigger('menu', 'editor.action.selectAll', null),
      find: action('actions.find'),
      replace: action('editor.action.startFindReplaceAction'),
      toggleComment: action('editor.action.commentLine'),
      formatDocument: action('editor.action.formatDocument'),
      goToLine: action('editor.action.gotoLine'),
      goToSymbol: action('editor.action.quickOutline'),
      goToDefinition: action('editor.action.revealDefinition'),
      expandSelection: action('editor.action.smartSelect.expand'),
      addCursorBelow: action('editor.action.insertCursorBelow'),
      runCommand: action as unknown as (id: string) => void,
      getSelection: () => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection || selection.isEmpty()) return '';
        return model.getValueInRange(selection);
      },
      insertText: (text: string) => {
        const model = editor.getModel();
        if (!model) return;
        const selection = editor.getSelection();
        const target = selection ?? {
          startLineNumber: model.getLineCount(),
          startColumn: model.getLineMaxColumn(model.getLineCount()),
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount()),
        };

        editor.executeEdits('safari-assistant', [
          { range: target, text, forceMoveMarkers: true },
        ]);
        editor.pushUndoStop();
        editor.focus();
        editor.revealPositionInCenterIfOutsideViewport({
          lineNumber: target.endLineNumber,
          column: target.endColumn,
        });
      },
    };

    editor.addAction({
      id: 'safari.askAssistant',
      label: 'Ask Safari Assistant about selection',
      contextMenuGroupId: 'safari',
      contextMenuOrder: 1,
      precondition: 'editorHasSelection',
      run: (instance) => {
        const model = instance.getModel();
        const selection = instance.getSelection();
        if (!model || !selection) return;
        const text = model.getValueInRange(selection);
        if (text.trim()) askRef.current(text);
      },
    });

    editor.addAction({
      id: 'safari.insertHere',
      label: 'Safari: assistant can insert code at cursor',
      contextMenuGroupId: 'safari',
      contextMenuOrder: 2,
      run: () => editor.focus(),
    });

    editor.focus();
  };

  const segments = activePath ? activePath.split('/') : [];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-app" aria-label="Editor">
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line bg-panel scrollbar-thin">
        {openPaths.map((path) => {
          const isActive = path === activePath;
          const isDirty = dirtySet.has(path);

          return (
            <div
              key={path}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onOpen(path)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(path);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen(path);
                if (event.key === 'Delete') onClose(path);
              }}
              title={path}
              className={cn(
                'group relative flex max-w-[220px] min-w-0 cursor-pointer items-center gap-1.5 border-r border-line px-2.5 text-[12px] outline-none transition-colors',
                isActive ? 'bg-app text-ink' : 'text-muted hover:bg-hover hover:text-ink',
              )}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-[2px] bg-accent" />}
              {isCodeFile(basename(path)) ? (
                <FileCode2 size={13} className={isActive ? 'text-accent' : 'text-faint'} />
              ) : (
                <FileText size={13} className={isActive ? 'text-accent' : 'text-faint'} />
              )}
              <span className="truncate">{basename(path)}</span>
              <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center">
                {isDirty ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent group-hover:hidden" />
                ) : null}
                <button
                  type="button"
                  aria-label={`Close ${basename(path)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(path);
                  }}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-ink',
                    isDirty ? 'hidden group-hover:flex' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <X size={12} />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {activePath && !diffState && (
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-line bg-panel/60 px-3 text-[11px] text-faint">
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight size={11} />}
              <span className={index === segments.length - 1 ? 'text-muted' : undefined}>
                {segment}
              </span>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2">
            {dirtySet.has(activePath) && (
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent">
                unsaved
              </span>
            )}
            <span>{languageLabel(activePath)}</span>
          </span>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {diffState ? (
          <DiffView
            diff={diffState.diff}
            loading={diffState.loading}
            onClose={onCloseDiff}
            onReload={onReloadDiff}
            onDiscard={onDiscardDiff}
          />
        ) : !activePath ? (
          <Welcome
            onNewFile={onNewFile}
            onQuickOpen={onQuickOpen}
            onSearch={onSearch}
            onOpenGit={onOpenGit}
            onToggleAssistant={onToggleAssistant}
            recentFiles={openPaths}
            onOpenRecent={onOpen}
            hasProvider={hasProvider}
            providerLabel={providerLabel}
          />
        ) : !isBufferReady || loadingPath === activePath ? (
          <div className="flex h-full items-center justify-center gap-2 text-[12px] text-faint">
            <Loader2 size={14} className="animate-spin" />
            Opening {basename(activePath)}…
          </div>
        ) : (
          <Editor
            key={activePath}
            path={`file:///${activePath}`}
            language={languageForPath(activePath)}
            value={content}
            theme={settings.theme === 'dark' ? 'safari-dark' : 'safari-light'}
            onChange={(value) => onChange(activePath, value ?? '')}
            onMount={handleMount}
            loading={
              <div className="flex h-full items-center justify-center gap-2 text-[12px] text-faint">
                <Loader2 size={14} className="animate-spin" />
                Loading editor…
              </div>
            }
            options={{
              fontSize: settings.fontSize,
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              fontLigatures: true,
              tabSize: settings.tabSize,
              wordWrap: settings.wordWrap ? 'on' : 'off',
              minimap: { enabled: settings.minimap, scale: 1, renderCharacters: false },
              automaticLayout: true,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderLineHighlight: 'line',
              lineNumbersMinChars: 3,
              padding: { top: 10, bottom: 24 },
              bracketPairColorization: { enabled: true },
              guides: { indentation: true, bracketPairs: false },
              scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
                useShadows: false,
              },
              overviewRulerBorder: false,
              contextmenu: true,
              fixedOverflowWidgets: true,
            }}
          />
        )}
      </div>
    </section>
  );
}
