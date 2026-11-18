import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { ActivityBar } from './components/layout/ActivityBar';
import { MenuBar, type MenuDef } from './components/layout/MenuBar';
import { RightDock } from './components/layout/RightDock';
import { StatusBar } from './components/layout/StatusBar';
import { TitleBar } from './components/layout/TitleBar';
import { EditorPane, type DiffState, type EditorHandle } from './components/editor/EditorPane';
import { Explorer } from './components/panels/Explorer';
import { GitPanel } from './components/panels/GitPanel';
import { SearchPanel } from './components/panels/SearchPanel';
import { AssistantPanel } from './components/chat/AssistantPanel';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { BottomPanel } from './components/terminal/BottomPanel';
import { CommandPalette, type PaletteCommand } from './components/modals/CommandPalette';
import { SettingsDialog } from './components/modals/SettingsDialog';
import { ShortcutsDialog } from './components/modals/ShortcutsDialog';
import { AboutDialog } from './components/modals/AboutDialog';
import { PromptDialog } from './components/ui/PromptDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Splitter } from './components/ui/Splitter';
import { useAiModels } from './hooks/useAiModels';
import { useChat } from './hooks/useChat';
import { isDesktop, useDesktopMenu } from './hooks/useDesktopMenu';
import { useGit } from './hooks/useGit';
import { useHotkeys } from './hooks/useHotkeys';
import { useProblems } from './hooks/useProblems';
import { useSettings } from './hooks/useSettings';
import { useSystemInfo } from './hooks/useSystemInfo';
import { useWorkspace } from './hooks/useWorkspace';
import type { ChatContext } from './hooks/useChat';
import type { TerminalHandle } from './components/terminal/TerminalView';
import type {
  BottomTab,
  CursorPosition,
  RightTab,
  SidebarView,
} from './lib/types';
import { basename, cn, flattenTree, modKey } from './lib/utils';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const REPO_URL = 'https://github.com/darksafari6/Code-Hub-By-Safari';

export default function App() {
  const { settings, update, reset } = useSettings();
  const workspace = useWorkspace({ autoSave: settings.autoSave });
  const git = useGit();
  const chat = useChat({ provider: settings.provider, models: settings.models });
  const { info, providers, online } = useSystemInfo();
  const { problems, counts } = useProblems();

  const [sidebarView, setSidebarView] = useState<SidebarView>('explorer');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [rightVisible, setRightVisible] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  );
  const [rightTab, setRightTab] = useState<RightTab>('assistant');
  const [rightWidth, setRightWidth] = useState(420);
  const [bottomVisible, setBottomVisible] = useState(true);
  const [bottomHeight, setBottomHeight] = useState(200);
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [terminalStatus, setTerminalStatus] = useState<'connecting' | 'open' | 'closed'>(
    'connecting',
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [previewSignal, setPreviewSignal] = useState(0);
  const [newEntry, setNewEntry] = useState<'file' | 'directory' | null>(null);
  const [selection, setSelection] = useState('');
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<string[] | null>(null);

  const terminalHandle = useRef<TerminalHandle | null>(null);
  const editorHandle = useRef<EditorHandle | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const providerWarningShown = useRef(false);

  const activeProvider = providers.find((provider) => provider.id === chat.provider) ?? null;
  const hasProvider = providers.some((provider) => provider.configured);
  const providerConfigured = activeProvider?.configured ?? false;
  const aiModels = useAiModels(chat.provider, providerConfigured);

  const activeContent = workspace.activePath
    ? workspace.buffers[workspace.activePath]?.content ?? ''
    : '';

  const chatContext: ChatContext = useMemo(
    () => ({
      filePath: workspace.activePath,
      fileContent: activeContent,
      ...(selection ? { selection } : {}),
    }),
    [workspace.activePath, activeContent, selection],
  );

  useEffect(() => {
    chat.setProvider(settings.provider);
  }, [chat.setProvider, settings.provider]);

  useEffect(() => {
    if (!info || providerWarningShown.current) return;
    providerWarningShown.current = true;
    if (!info.providers.some((provider) => provider.configured)) {
      toast.warning('No AI provider configured — add a key to .env to enable the assistant.', {
        duration: 6000,
      });
    }
  }, [info]);

  const withEditor = useCallback((action: (editor: EditorHandle) => void) => {
    const editor = editorHandle.current;
    if (!editor) {
      toast.info('Open a file to use this action');
      return;
    }
    action(editor);
  }, []);

  const openSidebar = useCallback((view: SidebarView) => {
    setSidebarView(view);
    setSidebarVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!workspace.activePath) {
      toast.info('No file is open');
      return;
    }
    void workspace.saveFile(workspace.activePath).then(() => {
      setPreviewSignal((value) => value + 1);
    });
  }, [workspace]);

  const toggleAssistant = useCallback(() => {
    if (rightVisible && rightTab === 'assistant') {
      setRightVisible(false);
      return;
    }
    setRightTab('assistant');
    setRightVisible(true);
  }, [rightTab, rightVisible]);

  const togglePreview = useCallback(() => {
    if (rightVisible && rightTab === 'preview') {
      setRightVisible(false);
      return;
    }
    setRightTab('preview');
    setRightVisible(true);
  }, [rightTab, rightVisible]);

  const askAssistant = useCallback(
    (prompt: string) => {
      if (!hasProvider) {
        toast.error('Configure an AI provider before using the assistant.');
        setSettingsOpen(true);
        return;
      }
      setRightTab('assistant');
      setRightVisible(true);
      void chat.send(prompt, chatContext);
    },
    [chat, chatContext, hasProvider],
  );

  const explainSelection = useCallback(() => {
    if (!selection.trim()) {
      toast.info('Select some code in the editor first');
      return;
    }
    askAssistant(
      `Explain this selection in detail, then suggest concrete improvements.\n\n\`\`\`\n${selection.slice(0, 6000)}\n\`\`\``,
    );
  }, [askAssistant, selection]);

  const activeFilePath = workspace.activePath;

  const reviewFile = useCallback(() => {
    if (!activeFilePath) {
      toast.info('Open a file first');
      return;
    }
    askAssistant(
      `Review ${basename(activeFilePath)} for bugs, edge cases and security issues. Quote exact lines and give corrected code.`,
    );
  }, [activeFilePath, askAssistant]);

  const generateTests = useCallback(() => {
    if (!activeFilePath) {
      toast.info('Open a file first');
      return;
    }
    askAssistant(
      `Write a complete, runnable test file for ${basename(activeFilePath)} using the project's existing conventions. Return the full test file in one code block.`,
    );
  }, [activeFilePath, askAssistant]);

  const refactorFile = useCallback(() => {
    if (!activeFilePath) {
      toast.info('Open a file first');
      return;
    }
    askAssistant(
      `Refactor ${basename(activeFilePath)} for clarity without changing behaviour. Return the complete updated file in one code block so it can be inserted into the editor.`,
    );
  }, [activeFilePath, askAssistant]);

  const insertCode = useCallback(
    (code: string) => {
      withEditor((editor) => {
        editor.insertText(code.endsWith('\n') ? code : `${code}\n`);
        toast.success('Inserted at the cursor — save to keep the change');
      });
    },
    [withEditor],
  );

  const openDiff = useCallback(
    async (path: string) => {
      setDiffState({ path, diff: null, loading: true });
      const diff = await git.loadDiff(path);
      setDiffState((current) =>
        current && current.path === path
          ? { path, diff, loading: false }
          : current,
      );
    },
    [git],
  );

  const reloadDiff = useCallback(() => {
    if (!diffState) return;
    void openDiff(diffState.path);
  }, [diffState, openDiff]);

  const applyDiscard = useCallback(
    async (paths: string[]) => {
      await git.discard(paths);
      await workspace.refreshTree();
      for (const path of paths) {
        await workspace.reloadFile(path);
      }
      setDiffState((current) => (current && paths.includes(current.path) ? null : current));
      setPreviewSignal((value) => value + 1);
    },
    [git, workspace],
  );

  const requestDiscard = useCallback((paths: string[]) => {
    setDiscardPrompt(paths);
  }, []);

  useHotkeys({
    onSave: handleSave,
    onSaveAll: () => void workspace.saveAll(),
    onCommandPalette: () => setPaletteOpen(true),
    onQuickOpen: () => setPaletteOpen(true),
    onToggleSidebar: () => setSidebarVisible((value) => !value),
    onToggleTerminal: () => {
      setBottomTab('terminal');
      setBottomVisible((value) => !value);
    },
    onTogglePreview: togglePreview,
    onOpenSettings: () => setSettingsOpen(true),
    onSearch: () => openSidebar('search'),
    onGit: () => openSidebar('git'),
    onExplorer: () => openSidebar('explorer'),
    onToggleAssistant: toggleAssistant,
  });

  useEffect(() => {
    const flush = () => {
      if (workspace.dirtyPaths.length > 0) {
        toast.warning('You have unsaved changes.', { id: 'unsaved-warning' });
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [workspace.dirtyPaths]);

  const mod = modKey();
  const shift = 'Shift';

  const menus: MenuDef[] = useMemo(
    () => [
      {
        id: 'file',
        label: 'File',
        items: [
          {
            id: 'file.newFile',
            label: 'New File…',
            shortcut: `${mod}+N`,
            onSelect: () => setNewEntry('file'),
          },
          {
            id: 'file.newFolder',
            label: 'New Folder…',
            shortcut: `${mod}+${shift}+N`,
            onSelect: () => setNewEntry('directory'),
          },
          {
            id: 'file.open',
            label: 'Open File…',
            shortcut: `${mod}+P`,
            onSelect: () => setPaletteOpen(true),
          },
          {
            id: 'file.upload',
            label: 'Upload Files…',
            onSelect: () => uploadInputRef.current?.click(),
          },
          { id: 'file.sep1', separator: true },
          { id: 'file.save', label: 'Save', shortcut: `${mod}+S`, onSelect: handleSave },
          {
            id: 'file.saveAll',
            label: 'Save All',
            shortcut: `${mod}+${shift}+S`,
            onSelect: () => void workspace.saveAll(),
          },
          { id: 'file.sep2', separator: true },
          {
            id: 'file.close',
            label: 'Close Editor',
            shortcut: `${mod}+W`,
            disabled: !workspace.activePath,
            onSelect: () => {
              if (workspace.activePath) workspace.closeFile(workspace.activePath);
            },
          },
          {
            id: 'file.closeAll',
            label: 'Close All Editors',
            disabled: workspace.openPaths.length === 0,
            onSelect: workspace.closeAll,
          },
          {
            id: 'file.closeOthers',
            label: 'Close Other Editors',
            disabled: !workspace.activePath,
            onSelect: () => {
              if (workspace.activePath) workspace.closeOtherFiles(workspace.activePath);
            },
          },
          { id: 'file.sep3', separator: true },
          {
            id: 'file.download',
            label: 'Download Active File',
            disabled: !workspace.activePath,
            onSelect: () => {
              if (!workspace.activePath) return;
              const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = basename(workspace.activePath);
              anchor.click();
              URL.revokeObjectURL(url);
            },
          },
          { id: 'file.sep4', separator: true },
          {
            id: 'file.settings',
            label: 'Settings',
            shortcut: `${mod}+,`,
            onSelect: () => setSettingsOpen(true),
          },
        ],
      },
      {
        id: 'edit',
        label: 'Edit',
        items: [
          {
            id: 'edit.undo',
            label: 'Undo',
            shortcut: `${mod}+Z`,
            onSelect: () => withEditor((editor) => editor.undo()),
          },
          {
            id: 'edit.redo',
            label: 'Redo',
            shortcut: `${mod}+${shift}+Z`,
            onSelect: () => withEditor((editor) => editor.redo()),
          },
          { id: 'edit.sep1', separator: true },
          {
            id: 'edit.find',
            label: 'Find…',
            shortcut: `${mod}+F`,
            onSelect: () => withEditor((editor) => editor.find()),
          },
          {
            id: 'edit.replace',
            label: 'Replace…',
            shortcut: `${mod}+H`,
            onSelect: () => withEditor((editor) => editor.replace()),
          },
          { id: 'edit.sep2', separator: true },
          {
            id: 'edit.comment',
            label: 'Toggle Line Comment',
            shortcut: `${mod}+/`,
            onSelect: () => withEditor((editor) => editor.toggleComment()),
          },
          {
            id: 'edit.format',
            label: 'Format Document',
            shortcut: `${shift}+Alt+F`,
            onSelect: () => withEditor((editor) => editor.formatDocument()),
          },
          { id: 'edit.sep3', separator: true },
          {
            id: 'edit.duplicateLine',
            label: 'Duplicate Line',
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.copyLinesDownAction')),
          },
          {
            id: 'edit.moveLineUp',
            label: 'Move Line Up',
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.moveLinesUpAction')),
          },
          {
            id: 'edit.moveLineDown',
            label: 'Move Line Down',
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.moveLinesDownAction')),
          },
        ],
      },
      {
        id: 'selection',
        label: 'Selection',
        items: [
          {
            id: 'selection.all',
            label: 'Select All',
            shortcut: `${mod}+A`,
            onSelect: () => withEditor((editor) => editor.selectAll()),
          },
          {
            id: 'selection.expand',
            label: 'Expand Selection',
            shortcut: `${shift}+Alt+→`,
            onSelect: () => withEditor((editor) => editor.expandSelection()),
          },
          {
            id: 'selection.addCursor',
            label: 'Add Cursor Below',
            shortcut: `${mod}+Alt+↓`,
            onSelect: () => withEditor((editor) => editor.addCursorBelow()),
          },
          { id: 'selection.sep1', separator: true },
          {
            id: 'selection.copy',
            label: 'Copy',
            shortcut: `${mod}+C`,
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.clipboardCopyAction')),
          },
          {
            id: 'selection.cut',
            label: 'Cut',
            shortcut: `${mod}+X`,
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.clipboardCutAction')),
          },
          {
            id: 'selection.paste',
            label: 'Paste',
            shortcut: `${mod}+V`,
            onSelect: () => withEditor((editor) => editor.runCommand('editor.action.clipboardPasteAction')),
          },
          { id: 'selection.sep2', separator: true },
          {
            id: 'selection.askAssistant',
            label: 'Ask Assistant About Selection',
            disabled: !selection.trim(),
            onSelect: explainSelection,
          },
          {
            id: 'selection.insertLast',
            label: 'Insert Assistant Code at Cursor',
            onSelect: () => {
              const last = [...chat.messages]
                .reverse()
                .find((message) => message.role === 'assistant' && message.content.includes('```'));
              if (!last) {
                toast.info('No code block from the assistant yet');
                return;
              }
              const match = last.content.match(/```[a-zA-Z0-9]*\n([\s\S]*?)```/);
              if (!match?.[1]) {
                toast.info('No code block found in the last reply');
                return;
              }
              insertCode(match[1]);
            },
          },
        ],
      },
      {
        id: 'view',
        label: 'View',
        items: [
          {
            id: 'view.explorer',
            label: 'Explorer',
            shortcut: `${mod}+${shift}+E`,
            checked: sidebarVisible && sidebarView === 'explorer',
            onSelect: () => openSidebar('explorer'),
          },
          {
            id: 'view.search',
            label: 'Search',
            shortcut: `${mod}+${shift}+F`,
            checked: sidebarVisible && sidebarView === 'search',
            onSelect: () => openSidebar('search'),
          },
          {
            id: 'view.git',
            label: 'Source Control',
            shortcut: `${mod}+${shift}+G`,
            checked: sidebarVisible && sidebarView === 'git',
            onSelect: () => openSidebar('git'),
          },
          { id: 'view.sep1', separator: true },
          {
            id: 'view.sidebar',
            label: 'Toggle Sidebar',
            shortcut: `${mod}+B`,
            checked: sidebarVisible,
            onSelect: () => setSidebarVisible((value) => !value),
          },
          {
            id: 'view.panel',
            label: 'Toggle Bottom Panel',
            shortcut: `${mod}+J`,
            checked: bottomVisible,
            onSelect: () => setBottomVisible((value) => !value),
          },
          {
            id: 'view.assistant',
            label: 'Toggle AI Assistant',
            shortcut: `${mod}+Alt+A`,
            checked: rightVisible && rightTab === 'assistant',
            onSelect: toggleAssistant,
          },
          {
            id: 'view.preview',
            label: 'Toggle Preview',
            shortcut: `${mod}+${shift}+V`,
            checked: rightVisible && rightTab === 'preview',
            onSelect: togglePreview,
          },
          { id: 'view.sep2', separator: true },
          {
            id: 'view.wordWrap',
            label: 'Word Wrap',
            checked: settings.wordWrap,
            onSelect: () => update('wordWrap', !settings.wordWrap),
          },
          {
            id: 'view.minimap',
            label: 'Minimap',
            checked: settings.minimap,
            onSelect: () => update('minimap', !settings.minimap),
          },
          { id: 'view.sep2b', separator: true },
          {
            id: 'view.themeDark',
            label: 'Dark Theme',
            checked: settings.theme === 'dark',
            onSelect: () => update('theme', 'dark'),
          },
          {
            id: 'view.themeLight',
            label: 'Light Theme',
            checked: settings.theme === 'light',
            onSelect: () => update('theme', 'light'),
          },
          { id: 'view.sep3', separator: true },
          {
            id: 'view.palette',
            label: 'Command Palette…',
            shortcut: `${mod}+${shift}+P`,
            onSelect: () => setPaletteOpen(true),
          },
        ],
      },
      {
        id: 'go',
        label: 'Go',
        items: [
          {
            id: 'go.file',
            label: 'Go to File…',
            shortcut: `${mod}+P`,
            onSelect: () => setPaletteOpen(true),
          },
          {
            id: 'go.line',
            label: 'Go to Line…',
            shortcut: `${mod}+G`,
            onSelect: () => withEditor((editor) => editor.goToLine()),
          },
          {
            id: 'go.symbol',
            label: 'Go to Symbol…',
            shortcut: `${mod}+${shift}+O`,
            onSelect: () => withEditor((editor) => editor.goToSymbol()),
          },
          {
            id: 'go.definition',
            label: 'Go to Definition',
            shortcut: 'F12',
            onSelect: () => withEditor((editor) => editor.goToDefinition()),
          },
          { id: 'go.sep1', separator: true },
          {
            id: 'go.problems',
            label: 'Next Problem',
            onSelect: () => {
              setBottomTab('problems');
              setBottomVisible(true);
            },
          },
          {
            id: 'go.diff',
            label: 'Show Working Tree Diff',
            disabled: !git.status.isRepo || git.status.files.length === 0,
            onSelect: () => {
              const first = git.status.files[0];
              if (first) void openDiff(first.path);
            },
          },
        ],
      },
      {
        id: 'terminal',
        label: 'Terminal',
        items: [
          {
            id: 'terminal.toggle',
            label: 'Toggle Terminal',
            shortcut: `${mod}+\``,
            onSelect: () => {
              setBottomTab('terminal');
              setBottomVisible((value) => !value);
            },
          },
          {
            id: 'terminal.new',
            label: 'Restart Session',
            onSelect: () => {
              setBottomTab('terminal');
              setBottomVisible(true);
              terminalHandle.current?.reconnect();
            },
          },
          {
            id: 'terminal.clear',
            label: 'Clear Terminal',
            onSelect: () => {
              setBottomTab('terminal');
              setBottomVisible(true);
              terminalHandle.current?.clear();
            },
          },
          { id: 'terminal.sep1', separator: true },
          {
            id: 'terminal.problems',
            label: 'Problems',
            onSelect: () => {
              setBottomTab('problems');
              setBottomVisible(true);
            },
          },
          {
            id: 'terminal.preview',
            label: 'Open Preview in Browser',
            onSelect: () => window.open('/preview/', '_blank', 'noopener'),
          },
          {
            id: 'terminal.reloadPreview',
            label: 'Reload Preview',
            onSelect: () => {
              setPreviewSignal((value) => value + 1);
              setRightTab('preview');
              setRightVisible(true);
            },
          },
        ],
      },
      {
        id: 'ai',
        label: 'AI',
        items: [
          {
            id: 'ai.assistant',
            label: 'Focus Assistant',
            shortcut: `${mod}+Alt+A`,
            onSelect: toggleAssistant,
          },
          {
            id: 'ai.explain',
            label: 'Explain Selection',
            disabled: !selection.trim(),
            onSelect: explainSelection,
          },
          { id: 'ai.review', label: 'Review Current File', disabled: !activeFilePath, onSelect: reviewFile },
          { id: 'ai.tests', label: 'Generate Tests', disabled: !activeFilePath, onSelect: generateTests },
          { id: 'ai.refactor', label: 'Refactor Current File', disabled: !activeFilePath, onSelect: refactorFile },
          { id: 'ai.sep1', separator: true },
          {
            id: 'ai.model',
            label: 'Choose Model…',
            onSelect: () => setSettingsOpen(true),
          },
          {
            id: 'ai.clear',
            label: 'Clear Conversation',
            disabled: chat.messages.length === 0,
            onSelect: chat.clear,
          },
        ],
      },
      {
        id: 'help',
        label: 'Help',
        items: [
          {
            id: 'help.shortcuts',
            label: 'Keyboard Shortcuts',
            shortcut: 'F1',
            onSelect: () => setShortcutsOpen(true),
          },
          {
            id: 'help.docs',
            label: 'Documentation',
            onSelect: () => window.open(`${REPO_URL}#readme`, '_blank', 'noopener'),
          },
          {
            id: 'help.issues',
            label: 'Report an Issue',
            onSelect: () => window.open(`${REPO_URL}/issues`, '_blank', 'noopener'),
          },
          { id: 'help.sep1', separator: true },
          { id: 'help.about', label: 'About', onSelect: () => setAboutOpen(true) },
        ],
      },
    ],
    [
      activeContent,
      activeFilePath,
      chat,
      explainSelection,
      generateTests,
      git.status,
      handleSave,
      insertCode,
      mod,
      openDiff,
      openSidebar,
      refactorFile,
      reviewFile,
      rightTab,
      rightVisible,
      selection,
      settings.minimap,
      settings.theme,
      settings.wordWrap,
      sidebarView,
      sidebarVisible,
      bottomVisible,
      toggleAssistant,
      togglePreview,
      update,
      withEditor,
      workspace,
    ],
  );

  const menuActionRef = useRef<Record<string, () => void>>({});
  menuActionRef.current = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const menu of menus) {
      for (const item of menu.items) {
        if (!item.separator && item.onSelect && !item.disabled) {
          map[item.id] = item.onSelect;
        }
      }
    }
    return map;
  }, [menus]);

  useDesktopMenu((id) => {
    const action = menuActionRef.current[id];
    if (action) action();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands: PaletteCommand[] = useMemo(() => {
    const list: PaletteCommand[] = menus.flatMap((menu) =>
      menu.items
        .filter((item) => !item.separator && item.onSelect && !item.disabled)
        .map((item) => ({
          id: item.id,
          label: item.label ?? item.id,
          hint: item.shortcut ?? menu.label,
          group: menu.label,
          run: item.onSelect!,
        })),
    );

    if (!git.status.isRepo) {
      list.push({
        id: 'git-init-action',
        label: 'Initialise git repository',
        hint: 'Create a repository on branch main',
        group: 'Source control',
        run: () => void git.init(),
      });
    }

    return list;
  }, [git, menus]);

  const annotations = counts;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      <Toaster
        position="bottom-right"
        theme={settings.theme}
        richColors
        closeButton
        toastOptions={{ style: { fontSize: '12.5px' } }}
      />

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) void workspace.uploadFiles(files, '');
        }}
      />

      <TitleBar
        workspaceName={info?.workspace ?? 'workspace'}
        branch={git.status.branch}
        onOpenPalette={() => setPaletteOpen(true)}
        assistantOpen={rightVisible && rightTab === 'assistant'}
        onToggleAssistant={toggleAssistant}
        previewOpen={rightVisible && rightTab === 'preview'}
        onTogglePreview={togglePreview}
        online={online}
        modKey={mod}
      />

      {/* Electron ships the same menus natively, so the in-app bar is only
          rendered when running in a browser. */}
      {!isDesktop() && <MenuBar menus={menus} />}

      <div className="flex min-h-0 flex-1">
        <ActivityBar
          view={sidebarView}
          onSelectView={openSidebar}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible((value) => !value)}
          assistantOpen={rightVisible && rightTab === 'assistant'}
          onToggleAssistant={toggleAssistant}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {sidebarVisible && (
          <>
            {/* All three views stay mounted so search results, expanded folders
                and half-written commit messages survive switching tabs. */}
            <div
              className="relative flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-line bg-panel"
              style={{ width: sidebarWidth }}
            >
              <div className={cn('absolute inset-0', sidebarView !== 'explorer' && 'hidden')}>
                <Explorer
                  tree={workspace.tree}
                  loading={workspace.treeLoading}
                  activePath={workspace.activePath}
                  dirtyPaths={workspace.dirtyPaths}
                  onOpen={(path) => void workspace.openFile(path)}
                  onCreate={(path, type) => void workspace.createEntry(path, type)}
                  onRename={(from, to) => void workspace.renameEntry(from, to)}
                  onDelete={(path) => void workspace.deleteEntry(path)}
                  onDuplicate={(path) => void workspace.duplicateEntry(path)}
                  onUpload={(files, directory) => void workspace.uploadFiles(files, directory)}
                  onRefresh={() => void workspace.refreshTree()}
                />
              </div>
              <div className={cn('absolute inset-0', sidebarView !== 'search' && 'hidden')}>
                <SearchPanel onOpen={(path, line, column) => void workspace.openFile(path, { line, column })} />
              </div>
              <div className={cn('absolute inset-0', sidebarView !== 'git' && 'hidden')}>
                <GitPanel
                  git={git}
                  identity={{ name: settings.gitName, email: settings.gitEmail }}
                  openDiffPath={diffState?.path ?? null}
                  onOpenFile={(path) => void workspace.openFile(path)}
                  onOpenDiff={(path) => void openDiff(path)}
                  onDiscard={requestDiscard}
                />
              </div>
            </div>
            <Splitter
              orientation="vertical"
              label="Resize sidebar"
              onResize={(delta) => setSidebarWidth((width) => clamp(width + delta, 200, 520))}
            />
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <EditorPane
            openPaths={workspace.openPaths}
            activePath={workspace.activePath}
            buffers={workspace.buffers}
            dirtyPaths={workspace.dirtyPaths}
            settings={settings}
            reveal={workspace.reveal}
            loadingPath={workspace.loadingPath}
            onOpen={(path) => {
              setDiffState(null);
              void workspace.openFile(path);
            }}
            onClose={workspace.closeFile}
            onChange={workspace.updateContent}
            onCursorChange={setCursor}
            onNewFile={() => setNewEntry('file')}
            onQuickOpen={() => setPaletteOpen(true)}
            onSearch={() => openSidebar('search')}
            onOpenGit={() => openSidebar('git')}
            onToggleAssistant={toggleAssistant}
            hasProvider={hasProvider}
            providerLabel={activeProvider?.label ?? null}
            handleRef={editorHandle}
            onSelectionChange={setSelection}
            onAskAssistant={explainSelection}
            diffState={diffState}
            onCloseDiff={() => setDiffState(null)}
            onReloadDiff={reloadDiff}
            onDiscardDiff={() => {
              if (diffState) requestDiscard([diffState.path]);
            }}
          />

          {bottomVisible && (
            <Splitter
              orientation="horizontal"
              label="Resize panel"
              onResize={(delta) =>
                setBottomHeight((height) =>
                  clamp(height - delta, 120, Math.round(window.innerHeight * 0.75)),
                )
              }
            />
          )}

          <BottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            visible={bottomVisible}
            height={bottomHeight}
            terminalMode={info?.capabilities?.terminal ?? 'line'}
            theme={settings.theme}
            fontSize={settings.terminalFontSize}
            terminalHandle={terminalHandle}
            terminalStatus={terminalStatus}
            onTerminalStatus={setTerminalStatus}
            onClose={() => setBottomVisible(false)}
            problems={problems}
            counts={counts}
            onOpenProblem={(problem) =>
              void workspace.openFile(problem.path, {
                line: problem.line,
                column: problem.column,
              })
            }
          />
        </main>

        {rightVisible && (
          <>
            <Splitter
              orientation="vertical"
              label="Resize assistant panel"
              onResize={(delta) => setRightWidth((width) => clamp(width - delta, 320, 720))}
            />
            <RightDock
              tab={rightTab}
              onTabChange={setRightTab}
              onClose={() => setRightVisible(false)}
              width={rightWidth}
              assistant={
                <AssistantPanel
                  chat={chat}
                  providers={providers}
                  activePath={workspace.activePath}
                  context={chatContext}
                  models={aiModels.models}
                  modelsLoading={aiModels.loading}
                  selectedModel={settings.models[chat.provider]}
                  onModelChange={(model) => {
                    const next = { ...settings.models };
                    if (model) next[chat.provider] = model;
                    else delete next[chat.provider];
                    update('models', next);
                  }}
                  onInsertCode={insertCode}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              }
              preview={<PreviewPanel refreshSignal={previewSignal} />}
            />
          </>
        )}
      </div>

      <StatusBar
        branch={git.status.branch}
        remote={git.status.remote}
        online={online}
        activePath={workspace.activePath}
        cursor={cursor}
        tabSize={settings.tabSize}
        errors={annotations.errors}
        warnings={annotations.warnings}
        provider={
          activeProvider
            ? {
                label: activeProvider.label,
                model: settings.models[chat.provider] ?? activeProvider.model,
                configured: activeProvider.configured,
              }
            : null
        }
        version={info?.version ?? '2.1.0'}
        onOpenProblems={() => {
          setBottomTab('problems');
          setBottomVisible(true);
        }}
        onOpenGit={() => openSidebar('git')}
      />

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        files={flattenTree(workspace.tree)}
        onClose={() => setPaletteOpen(false)}
        onOpenFile={(path) => void workspace.openFile(path)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={update}
        reset={reset}
        providers={providers}
        info={info}
      />

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        systemInfo={info}
        providers={providers}
        workspacePath={info?.workspacePath ?? ''}
      />

      <PromptDialog
        open={newEntry !== null}
        title={newEntry === 'directory' ? 'New folder' : 'New file'}
        description="Relative to the workspace root"
        label="Path"
        placeholder={newEntry === 'directory' ? 'src/components' : 'src/components/NewFile.tsx'}
        onCancel={() => setNewEntry(null)}
        onConfirm={(value) => {
          if (!newEntry) return;
          void workspace.createEntry(value.replace(/^\/+/, ''), newEntry);
          setNewEntry(null);
        }}
      />

      <ConfirmDialog
        open={discardPrompt !== null}
        title="Discard changes"
        description={
          discardPrompt
            ? discardPrompt.length === 1
              ? `Restore “${discardPrompt[0]}” from the last commit? Untracked files are deleted and local edits are lost.`
              : `Discard changes in ${discardPrompt.length} files? Untracked files are deleted and local edits are lost.`
            : ''
        }
        confirmLabel="Discard"
        danger
        onCancel={() => setDiscardPrompt(null)}
        onConfirm={() => {
          const paths = discardPrompt;
          setDiscardPrompt(null);
          if (paths) void applyDiscard(paths);
        }}
      />
    </div>
  );
}
