import type {
  ChatMessage,
  FileContent,
  GitCommit,
  GitStatus,
  ProviderId,
  ProviderInfo,
  SearchResult,
  SystemInfo,
  SystemStats,
  TreeNode,
} from './types';

const TOKEN_STORAGE_KEY = 'safari.accessToken';

/** Optional access token. Captured from `?token=` once and persisted. */
export function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('token');
    if (fromUrl) {
      localStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function withTokenQuery(path: string): string {
  const token = readAccessToken();
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}`;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readAccessToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('x-safari-token', token);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is it still running?');
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Non-JSON error body.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

export const api = {
  files: {
    tree: () => request<{ tree: TreeNode[] }>('/api/files/tree').then((data) => data.tree),
    read: (path: string) =>
      request<FileContent>(`/api/files/content?path=${encodeURIComponent(path)}`),
    write: (path: string, content: string) =>
      request<{ path: string; size: number }>('/api/files/content', {
        method: 'PUT',
        body: jsonBody({ path, content }),
      }),
    create: (path: string, type: 'file' | 'directory') =>
      request<TreeNode>('/api/files/create', {
        method: 'POST',
        body: jsonBody({ path, type }),
      }),
    rename: (from: string, to: string) =>
      request<TreeNode>('/api/files/rename', {
        method: 'POST',
        body: jsonBody({ from, to }),
      }),
    remove: (path: string) =>
      request<{ path: string }>('/api/files/delete', {
        method: 'POST',
        body: jsonBody({ path }),
      }),
    search: (query: string, caseSensitive = false) =>
      request<SearchResult>(
        `/api/files/search?q=${encodeURIComponent(query)}&caseSensitive=${caseSensitive}`,
      ),
  },

  git: {
    status: () => request<GitStatus>('/api/git/status'),
    log: () => request<{ commits: GitCommit[] }>('/api/git/log').then((data) => data.commits),
    init: () =>
      request<GitStatus>('/api/git/init', { method: 'POST', body: jsonBody({}) }),
    clone: (url: string, token?: string, replace?: boolean) =>
      request<GitStatus>('/api/git/clone', {
        method: 'POST',
        body: jsonBody({ url, token: token || undefined, replace }),
      }),
    stage: (paths: string[] | 'all') =>
      request<GitStatus>('/api/git/stage', {
        method: 'POST',
        body: jsonBody(paths === 'all' ? { all: true } : { paths }),
      }),
    unstage: (paths: string[]) =>
      request<GitStatus>('/api/git/unstage', {
        method: 'POST',
        body: jsonBody({ paths }),
      }),
    commit: (message: string, stageAll: boolean) =>
      request<{ oid: string; status: GitStatus }>('/api/git/commit', {
        method: 'POST',
        body: jsonBody({ message, stageAll }),
      }),
    push: (token: string) =>
      request<{ ok: true }>('/api/git/push', {
        method: 'POST',
        body: jsonBody({ token }),
      }),
  },

  ai: {
    providers: () =>
      request<{ providers: ProviderInfo[] }>('/api/ai/providers').then((data) => data.providers),
  },

  system: {
    info: () => request<SystemInfo>('/api/system/info'),
    stats: () => request<SystemStats>('/api/system/stats'),
  },
};

export interface StreamHandlers {
  onDelta: (delta: string) => void;
  onDone?: () => void;
  onError: (message: string) => void;
}

export interface StreamChatOptions {
  provider: ProviderId;
  messages: ChatMessage[];
  system?: string;
  signal?: AbortSignal;
}

/**
 * Streams an assistant reply. The server sends newline-delimited JSON events:
 * `{ delta }`, then either `{ done: true }` or `{ error }`.
 */
export async function streamAssistantReply(
  options: StreamChatOptions,
  handlers: StreamHandlers,
): Promise<void> {
  const token = readAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-safari-token'] = token;

  let response: Response;
  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      signal: options.signal,
      body: JSON.stringify({
        provider: options.provider,
        messages: options.messages
          .filter((message) => message.status !== 'error')
          .map((message) => ({ role: message.role, content: message.content })),
        ...(options.system ? { system: options.system } : {}),
      }),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    handlers.onError('Cannot reach the server. Is it still running?');
    return;
  }

  if (!response.ok || !response.body) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // ignore
    }
    handlers.onError(message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const handleLine = (line: string): void => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload) return;

    try {
      const event = JSON.parse(payload) as { delta?: string; done?: boolean; error?: string };
      if (event.error) {
        handlers.onError(event.error);
        finished = true;
        return;
      }
      if (typeof event.delta === 'string') handlers.onDelta(event.delta);
      if (event.done) {
        finished = true;
        handlers.onDone?.();
      }
    } catch {
      // Ignore malformed keep-alive chunks.
    }
  };

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        handleLine(line.trim());
        if (finished) break;
      }
    }
    if (!finished && buffer.trim()) handleLine(buffer.trim());
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      handlers.onError('The connection was interrupted while the assistant was replying.');
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
