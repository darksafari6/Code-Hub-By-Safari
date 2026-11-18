import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { TreeNode } from '../lib/types';
import { basename } from '../lib/utils';

interface BufferState {
  content: string;
  original: string;
}

export interface RevealRequest {
  path: string;
  line: number;
  column: number;
  nonce: number;
}

export interface UseWorkspaceResult {
  tree: TreeNode[];
  treeLoading: boolean;
  refreshTree: () => Promise<void>;
  openPaths: string[];
  activePath: string | null;
  activeContent: string;
  buffers: Record<string, BufferState>;
  dirtyPaths: string[];
  loadingPath: string | null;
  reveal: RevealRequest | null;
  openFile: (path: string, position?: { line: number; column?: number }) => Promise<void>;
  setActive: (path: string) => void;
  closeFile: (path: string) => void;
  closeOtherFiles: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveActive: () => Promise<void>;
  createEntry: (path: string, type: 'file' | 'directory') => Promise<void>;
  renameEntry: (from: string, to: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
}

export function useWorkspace(options: { autoSave: boolean }): UseWorkspaceResult {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, BufferState>>({});
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealRequest | null>(null);

  const autoSaveRef = useRef(options.autoSave);
  autoSaveRef.current = options.autoSave;

  const buffersRef = useRef(buffers);
  buffersRef.current = buffers;

  const openPathsRef = useRef(openPaths);
  openPathsRef.current = openPaths;

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dirtyPaths = useMemo(
    () =>
      Object.entries(buffers)
        .filter(([, buffer]) => buffer.content !== buffer.original)
        .map(([path]) => path),
    [buffers],
  );

  const refreshTree = useCallback(async () => {
    try {
      const next = await api.files.tree();
      setTree(next);
    } catch (error) {
      toast.error(`Could not load files: ${(error as Error).message}`);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, [refreshTree]);

  const openFile = useCallback(
    async (path: string, position?: { line: number; column?: number }) => {
      setActivePath(path);
      setOpenPaths((previous) => (previous.includes(path) ? previous : [...previous, path]));

      if (position?.line) {
        setReveal({
          path,
          line: position.line,
          column: position.column ?? 1,
          nonce: Date.now(),
        });
      }

      if (buffersRef.current[path]) return;

      setLoadingPath(path);
      try {
        const file = await api.files.read(path);
        setBuffers((previous) => ({
          ...previous,
          [path]: { content: file.content, original: file.content },
        }));
      } catch (error) {
        toast.error(`Could not open ${basename(path)}: ${(error as Error).message}`);
        setOpenPaths((previous) => previous.filter((entry) => entry !== path));
        setActivePath((previous) => (previous === path ? null : previous));
      } finally {
        setLoadingPath(null);
      }
    },
    [],
  );

  const setActive = useCallback((path: string) => {
    setActivePath(path);
  }, []);

  const closeFile = useCallback((path: string) => {
    const remaining = openPathsRef.current.filter((entry) => entry !== path);
    setOpenPaths(remaining);
    setActivePath((current) => {
      if (current !== path) return current;
      return remaining.length > 0 ? (remaining[remaining.length - 1] ?? null) : null;
    });

    setBuffers((previous) => {
      const next = { ...previous };
      delete next[path];
      return next;
    });

    const timer = timersRef.current[path];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[path];
    }
  }, []);

  const closeOtherFiles = useCallback((path: string) => {
    setOpenPaths((previous) => previous.filter((entry) => entry === path));
    setBuffers((previous) => {
      const next: Record<string, BufferState> = {};
      if (previous[path]) next[path] = previous[path];
      return next;
    });
    setActivePath(path);
  }, []);

  const persist = useCallback(async (path: string, content: string, silent = false) => {
    const result = await api.files.write(path, content);
    setBuffers((previous) => {
      const existing = previous[path];
      if (!existing) return previous;
      return { ...previous, [path]: { content: existing.content, original: content } };
    });
    if (!silent) toast.success(`Saved ${basename(path)} (${result.size} bytes)`);
  }, []);

  const updateContent = useCallback(
    (path: string, content: string) => {
      setBuffers((previous) => {
        const existing = previous[path];
        if (!existing || existing.content === content) return previous;
        return { ...previous, [path]: { ...existing, content } };
      });

      if (!autoSaveRef.current) return;

      const existingTimer = timersRef.current[path];
      if (existingTimer) clearTimeout(existingTimer);

      timersRef.current[path] = setTimeout(() => {
        delete timersRef.current[path];
        void persist(path, content, true).catch((error: Error) => {
          toast.error(`Auto-save failed: ${error.message}`);
        });
      }, 900);
    },
    [persist],
  );

  const saveFile = useCallback(
    async (path: string) => {
      const buffer = buffersRef.current[path];
      if (!buffer) return;

      const pending = timersRef.current[path];
      if (pending) {
        clearTimeout(pending);
        delete timersRef.current[path];
      }

      try {
        await persist(path, buffer.content);
      } catch (error) {
        toast.error(`Could not save ${basename(path)}: ${(error as Error).message}`);
      }
    },
    [persist],
  );

  const saveActive = useCallback(async () => {
    if (activePath) await saveFile(activePath);
  }, [activePath, saveFile]);

  const createEntry = useCallback(
    async (path: string, type: 'file' | 'directory') => {
      try {
        await api.files.create(path, type);
        await refreshTree();
        toast.success(`Created ${basename(path)}`);
        if (type === 'file') await openFile(path);
      } catch (error) {
        toast.error(`Could not create ${basename(path)}: ${(error as Error).message}`);
      }
    },
    [openFile, refreshTree],
  );

  const renameEntry = useCallback(
    async (from: string, to: string) => {
      try {
        await api.files.rename(from, to);
        setOpenPaths((previous) =>
          previous.map((entry) => (entry === from ? to : entry.startsWith(`${from}/`) ? `${to}${entry.slice(from.length)}` : entry)),
        );
        setBuffers((previous) => {
          const next: Record<string, BufferState> = {};
          for (const [key, value] of Object.entries(previous)) {
            if (key === from) next[to] = value;
            else if (key.startsWith(`${from}/`)) next[`${to}${key.slice(from.length)}`] = value;
            else next[key] = value;
          }
          return next;
        });
        setActivePath((current) => (current === from ? to : current));
        await refreshTree();
        toast.success(`Renamed to ${basename(to)}`);
      } catch (error) {
        toast.error(`Could not rename: ${(error as Error).message}`);
      }
    },
    [refreshTree],
  );

  const deleteEntry = useCallback(
    async (path: string) => {
      try {
        await api.files.remove(path);
        setOpenPaths((previous) =>
          previous.filter((entry) => entry !== path && !entry.startsWith(`${path}/`)),
        );
        setActivePath((current) =>
          current && (current === path || current.startsWith(`${path}/`)) ? null : current,
        );
        setBuffers((previous) => {
          const next: Record<string, BufferState> = {};
          for (const [key, value] of Object.entries(previous)) {
            if (key !== path && !key.startsWith(`${path}/`)) next[key] = value;
          }
          return next;
        });
        await refreshTree();
        toast.success(`Deleted ${basename(path)}`);
      } catch (error) {
        toast.error(`Could not delete: ${(error as Error).message}`);
      }
    },
    [refreshTree],
  );

  const activeContent = activePath ? buffers[activePath]?.content ?? '' : '';

  return {
    tree,
    treeLoading,
    refreshTree,
    openPaths,
    activePath,
    activeContent,
    buffers,
    dirtyPaths,
    loadingPath,
    reveal,
    openFile,
    setActive,
    closeFile,
    closeOtherFiles,
    updateContent,
    saveFile,
    saveActive,
    createEntry,
    renameEntry,
    deleteEntry,
  };
}
