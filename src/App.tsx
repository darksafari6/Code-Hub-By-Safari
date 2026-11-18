import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ActivityBar } from './components/layout/ActivityBar';
import { RightDock } from './components/layout/RightDock';
import { StatusBar } from './components/layout/StatusBar';
import { TitleBar } from './components/layout/TitleBar';
import { EditorPane } from './components/editor/EditorPane';
import { Explorer } from './components/panels/Explorer';
import { GitPanel } from './components/panels/GitPanel';
import { SearchPanel } from './components/panels/SearchPanel';
import { AssistantPanel } from './components/chat/AssistantPanel';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { BottomPanel } from './components/terminal/BottomPanel';
import { CommandPalette, type PaletteCommand } from './components/modals/CommandPalette';
import { SettingsDialog } from './components/modals/SettingsDialog';
import { PromptDialog } from './components/ui/PromptDialog';
import { Splitter } from './components/ui/Splitter';
import { useChat } from './hooks/useChat';
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
import { cn, flattenTree, modKey } from './lib/utils';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export default function App() {
  const { settings, update, reset } = useSettings();
  const workspace = useWorkspace({ autoSave: settings.autoSave });
  const git = useGit();
  const chat = useChat(settings.provider);
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
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [previewSignal, setPreviewSignal] = useState(0);
  const [newEntry, setNewEntry] = useState<'file' | 'directory' | null>(null);

  const terminalHandle = useRef<TerminalHandle | null>(null);

  const providerWarningShown = useRef(false);

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

  const openSearchResult = useCallback(
    (path: string, line: number, column: number) => {
      void workspace.openFile(path, { line, column });
    },
    [workspace],
  );

  const handleSave = useCallback(() => {
    if (!workspace.activePath) return;
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

  const openSidebar = useCallback((view: SidebarView) => {
    setSidebarView(view);
    setSidebarVisible(true);
  }, []);

  useHotkeys({
    onSave: handleSave,
    onCommandPalette: () => setPaletteOpen(true),
    onQuickOpen: () => setPaletteOpen(true),
    onToggleSidebar: () => setSidebarVisible((value) => !value),
    onToggleTerminal: () => setBottomVisible((value) => !value),
    onTogglePreview: togglePreview,
    onOpenSettings: () => setSettingsOpen(true),
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

  const activeContent = workspace.activePath
    ? workspace.buffers[workspace.activePath]?.content ?? ''
    : '';
  const chatContext: ChatContext = {
    filePath: workspace.activePath,
    fileContent: activeContent,
  };

  const activeProvider = providers.find((provider) => provider.id === settings.provider) ?? null;
  const hasProvider = providers.some((provider) => provider.configured);

  const commands: PaletteCommand[] = [
    {
      id: 'new-file',
      label: 'New file',
      hint: 'Create a file in the workspace',
      group: 'File',
      run: () => setNewEntry('file'),
    },
    {
      id: 'new-folder',
      label: 'New folder',
      hint: 'Create a directory',
      group: 'File',
      run: () => setNewEntry('directory'),
    },
    {
      id: 'save',
      label: 'Save file',
      hint: 'Write the active file to disk',
      group: 'File',
      run: handleSave,
    },
    {
      id: 'close',
      label: 'Close editor tab',
      hint: 'Close the active file',
      group: 'File',
      run: () => {
        if (workspace.activePath) workspace.closeFile(workspace.activePath);
      },
    },
    {
      id: 'refresh',
      label: 'Refresh file tree',
      hint: 'Reload the workspace listing',
      group: 'View',
      run: () => void workspace.refreshTree(),
    },
    {
      id: 'sidebar',
      label: 'Toggle sidebar',
      hint: `${modKey()} B`,
      group: 'View',
      run: () => setSidebarVisible((value) => !value),
    },
    {
      id: 'terminal',
      label: 'Toggle terminal',
      hint: `${modKey()} J`,
      group: 'Terminal',
      run: () => {
        setBottomTab('terminal');
        setBottomVisible((value) => !value);
      },
    },
    {
      id: 'problems',
      label: 'Show problems',
      hint: 'Diagnostics for open files',
      group: 'View',
      run: () => {
        setBottomTab('problems');
        setBottomVisible(true);
      },
    },
    {
      id: 'assistant',
      label: 'Toggle assistant',
      hint: 'AI chat about the current file',
      group: 'AI',
      run: toggleAssistant,
    },
    {
      id: 'preview',
      label: 'Toggle preview',
      hint: 'Static preview of the workspace',
      group: 'View',
      run: togglePreview,
    },
    {
      id: 'search',
      label: 'Search in files',
      hint: 'Find text across the workspace',
      group: 'Navigate',
      run: () => openSidebar('search'),
    },
    {
      id: 'git',
      label: 'Show source control',
      hint: 'Commit, clone and push',
      group: 'Navigate',
      run: () => openSidebar('git'),
    },
    {
      id: 'settings',
      label: 'Open settings',
      hint: `${modKey()} ,`,
      group: 'System',
      run: () => setSettingsOpen(true),
    },
  ];

  if (!git.status.isRepo) {
    commands.push({
      id: 'git-init',
      label: 'Initialise git repository',
      hint: 'Create a repository on branch main',
      group: 'Source control',
      run: () => void git.init(),
    });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      <Toaster
        position="bottom-right"
        theme={settings.theme}
        richColors
        closeButton
        toastOptions={{ style: { fontSize: '12.5px' } }}
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
        modKey={modKey()}
      />

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
              <div
                className={cn(
                  'absolute inset-0',
                  sidebarView !== 'explorer' && 'hidden',
                )}
              >
                <Explorer
                  tree={workspace.tree}
                  loading={workspace.treeLoading}
                  activePath={workspace.activePath}
                  dirtyPaths={workspace.dirtyPaths}
                  onOpen={(path) => void workspace.openFile(path)}
                  onCreate={(path, type) => void workspace.createEntry(path, type)}
                  onRename={(from, to) => void workspace.renameEntry(from, to)}
                  onDelete={(path) => void workspace.deleteEntry(path)}
                  onRefresh={() => void workspace.refreshTree()}
                />
              </div>
              <div
                className={cn('absolute inset-0', sidebarView !== 'search' && 'hidden')}
              >
                <SearchPanel onOpen={openSearchResult} />
              </div>
              <div
                className={cn('absolute inset-0', sidebarView !== 'git' && 'hidden')}
              >
                <GitPanel git={git} onOpenFile={(path) => void workspace.openFile(path)} />
              </div>
            </div>
            <Splitter
              orientation="vertical"
              label="Resize sidebar"
              onResize={(delta) =>
                setSidebarWidth((width) => clamp(width + delta, 200, 520))
              }
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
            onOpen={(path) => void workspace.openFile(path)}
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
              onResize={(delta) =>
                setRightWidth((width) => clamp(width - delta, 320, 720))
              }
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
        errors={counts.errors}
        warnings={counts.warnings}
        provider={
          activeProvider
            ? {
                label: activeProvider.label,
                model: activeProvider.model,
                configured: activeProvider.configured,
              }
            : null
        }
        version={info?.version ?? '2.0.0'}
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

      <PromptDialog
        open={newEntry !== null}
        title={newEntry === 'directory' ? 'New folder' : 'New file'}
        description="Relative to the workspace root"
        label="Path"
        placeholder={
          newEntry === 'directory' ? 'src/components' : 'src/components/NewFile.tsx'
        }
        onCancel={() => setNewEntry(null)}
        onConfirm={(value) => {
          if (!newEntry) return;
          void workspace.createEntry(value.replace(/^\/+/, ''), newEntry);
          setNewEntry(null);
        }}
      />
    </div>
  );
}
