import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { GitCommit, GitStatus } from '../lib/types';

const EMPTY_STATUS: GitStatus = {
  isRepo: false,
  branch: null,
  hasCommits: false,
  remote: null,
  files: [],
};

export interface UseGitResult {
  status: GitStatus;
  commits: GitCommit[];
  busy: string | null;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  clone: (url: string, token?: string, replace?: boolean) => Promise<boolean>;
  stageAll: () => Promise<void>;
  stage: (paths: string[]) => Promise<void>;
  unstage: (paths: string[]) => Promise<void>;
  commit: (message: string, stageAll: boolean) => Promise<boolean>;
  push: (token: string) => Promise<boolean>;
}

export function useGit(): UseGitResult {
  const [status, setStatus] = useState<GitStatus>(EMPTY_STATUS);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.git.status();
      setStatus(next);
      if (next.isRepo) {
        setCommits(await api.git.log());
      } else {
        setCommits([]);
      }
    } catch (error) {
      toast.error(`Git status failed: ${(error as Error).message}`);
    }
  }, []);

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

  const applyStatus = useCallback(
    async (next: GitStatus) => {
      setStatus(next);
      if (next.isRepo) setCommits(await api.git.log());
    },
    [],
  );

  const init = useCallback(async () => {
    const result = await run('init', () => api.git.init());
    if (result) {
      setStatus(result);
      setCommits(await api.git.log());
      toast.success('Git repository initialised on branch main');
    }
  }, [run]);

  const clone = useCallback(
    async (url: string, token?: string, replace?: boolean) => {
      const result = await run('clone', () => api.git.clone(url, token, replace));
      if (!result) return false;
      await applyStatus(result);
      toast.success('Repository cloned');
      return true;
    },
    [applyStatus, run],
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

  const commit = useCallback(
    async (message: string, stageAllChanges: boolean) => {
      const result = await run('commit', () => api.git.commit(message, stageAllChanges));
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

  return {
    status,
    commits,
    busy,
    refresh,
    init,
    clone,
    stageAll,
    stage,
    unstage,
    commit,
    push,
  };
}
