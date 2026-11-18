import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { FileDiff, GitBranchState, GitCommit, GitStatus } from '../lib/types';

const EMPTY_STATUS: GitStatus = {
  isRepo: false,
  branch: null,
  hasCommits: false,
  remote: null,
  files: [],
};

const EMPTY_BRANCHES: GitBranchState = { branches: [], current: null };

export interface GitIdentity {
  name?: string;
  email?: string;
}

export interface UseGitResult {
  status: GitStatus;
  commits: GitCommit[];
  branches: GitBranchState;
  busy: string | null;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  clone: (url: string, token?: string, replace?: boolean) => Promise<boolean>;
  stageAll: () => Promise<void>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  discard: (paths: string[]) => Promise<void>;
  commit: (message: string, stageAll: boolean, identity?: GitIdentity) => Promise<boolean>;
  push: (token: string) => Promise<boolean>;
  createBranch: (name: string) => Promise<boolean>;
  checkout: (name: string) => Promise<boolean>;
  loadDiff: (path: string) => Promise<FileDiff | null>;
}

export function useGit(): UseGitResult {
  const [status, setStatus] = useState<GitStatus>(EMPTY_STATUS);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranchState>(EMPTY_BRANCHES);
  const [busy, setBusy] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    try {
      setBranches(await api.git.branches());
    } catch {
      setBranches(EMPTY_BRANCHES);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.git.status();
      setStatus(next);
      if (next.isRepo) {
        setCommits(await api.git.log());
        await loadBranches();
      } else {
        setCommits([]);
        setBranches(EMPTY_BRANCHES);
      }
    } catch (error) {
      toast.error(`Git status failed: ${(error as Error).message}`);
    }
  }, [loadBranches]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
      setBusy(label);
      try {
        return await action();
      } catch (error) {
        toast.error((error as Error).message);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const applyStatus = useCallback(async (next: GitStatus) => {
    setStatus(next);
    setCommits(next.isRepo ? await api.git.log() : []);
  }, []);

  const init = useCallback(async () => {
    const result = await run('init', () => api.git.init());
    if (!result) return;
    await applyStatus(result);
    await loadBranches();
    toast.success('Git repository initialised on branch main');
  }, [applyStatus, loadBranches, run]);

  const clone = useCallback(
    async (url: string, token?: string, replace?: boolean) => {
      const result = await run('clone', () => api.git.clone(url, token, replace));
      if (!result) return false;
      await applyStatus(result);
      await loadBranches();
      toast.success('Repository cloned');
      return true;
    },
    [applyStatus, loadBranches, run],
  );

  const stageAll = useCallback(async () => {
    const result = await run('stage', () => api.git.stage('all'));
    if (result) setStatus(result);
  }, [run]);

  const stage = useCallback(
    async (paths: string[]) => {
      const result = await run('stage', () => api.git.stage(paths));
      if (result) setStatus(result);
    },
    [run],
  );

  const unstage = useCallback(
    async (paths: string[]) => {
      const result = await run('unstage', () => api.git.unstage(paths));
      if (result) setStatus(result);
    },
    [run],
  );

  const discard = useCallback(
    async (paths: string[]) => {
      const result = await run('discard', () => api.git.discard(paths));
      if (result) {
        setStatus(result);
        toast.success(
          paths.length === 1 ? `Discarded changes in ${paths[0]}` : `Discarded ${paths.length} files`,
        );
      }
    },
    [run],
  );

  const commit = useCallback(
    async (message: string, stageAllChanges: boolean, identity?: GitIdentity) => {
      const result = await run('commit', () =>
        api.git.commit(message, stageAllChanges, {
          ...(identity?.name ? { name: identity.name } : {}),
          ...(identity?.email ? { email: identity.email } : {}),
        }),
      );
      if (!result) return false;
      setStatus(result.status);
      setCommits(await api.git.log());
      toast.success(`Committed ${result.oid.slice(0, 7)}`);
      return true;
    },
    [run],
  );

  const push = useCallback(
    async (token: string) => {
      const result = await run('push', () => api.git.push(token));
      if (!result) return false;
      toast.success('Pushed to origin');
      return true;
    },
    [run],
  );

  const createBranch = useCallback(
    async (name: string) => {
      const result = await run('branch', () => api.git.createBranch(name, true));
      if (!result) return false;
      setBranches(result);
      await refresh();
      toast.success(`Switched to new branch ${name}`);
      return true;
    },
    [refresh, run],
  );

  const checkout = useCallback(
    async (name: string) => {
      const result = await run('checkout', () => api.git.checkout(name));
      if (!result) return false;
      setBranches(result);
      await refresh();
      toast.success(`Switched to ${name}`);
      return true;
    },
    [refresh, run],
  );

  const loadDiff = useCallback(
    async (path: string) => run('diff', () => api.git.diff(path)),
    [run],
  );

  return {
    status,
    commits,
    branches,
    busy,
    refresh,
    init,
    clone,
    stageAll,
    stage,
    unstage,
    discard,
    commit,
    push,
    createBranch,
    checkout,
    loadDiff,
  };
}
