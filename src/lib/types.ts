export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'untracked' | 'unmodified';

export interface GitFileEntry {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  hasCommits: boolean;
  remote: string | null;
  files: GitFileEntry[];
}

export interface GitBranchState {
  branches: string[];
  current: string | null;
}

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  binary: boolean;
  truncated: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface GitCommit {
  oid: string;
  shortOid: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

export type ProviderId = 'gemini' | 'deepseek' | 'openai';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  description: string;
  envKey: string;
}

export interface SystemInfo {
  version: string;
  workspace: string;
  workspacePath: string;
  platform: string;
  arch: string;
  /** Human readable runtime, e.g. "Python 3.11.2" or "Node 22.22.3". */
  runtime: string;
  nodeVersion?: string;
  capabilities?: {
    terminal: 'pty' | 'line';
    git: 'cli' | 'isomorphic-git';
    sshRemotes?: boolean;
    shell?: string;
  };
  workspaceEmpty: boolean;
  gitRepository: boolean;
  authEnabled: boolean;
  providers: Array<Pick<ProviderInfo, 'id' | 'label' | 'model' | 'configured'>>;
}

export interface SystemStats {
  cpuCount: number;
  loadAverage: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  processUptimeSeconds: number;
  platform: string;
  nodeVersion: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface SearchResult {
  query: string;
  matches: SearchMatch[];
  truncated: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorProblem {
  path: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export type SidebarView = 'explorer' | 'search' | 'git';
export type BottomTab = 'terminal' | 'problems';
export type RightTab = 'assistant' | 'preview';

export type ThemeMode = 'dark' | 'light';

export interface Settings {
  theme: ThemeMode;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  provider: ProviderId;
  terminalFontSize: number;
  /** Per-provider model override chosen in Settings; empty means "default". */
  models: Partial<Record<ProviderId, string>>;
  gitName: string;
  gitEmail: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  autoSave: false,
  provider: 'gemini',
  terminalFontSize: 13,
  models: {},
  gitName: '',
  gitEmail: '',
};
