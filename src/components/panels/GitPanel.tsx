import { useState } from 'react';
import {
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommitHorizontal,
  History,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import type { UseGitResult } from '../../hooks/useGit';
import type { GitFileEntry } from '../../lib/types';
import { cn, formatRelativeTime } from '../../lib/utils';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

interface GitPanelProps {
  git: UseGitResult;
  onOpenFile: (path: string) => void;
}

function statusStyle(entry: GitFileEntry): string {
  switch (entry.status) {
    case 'added':
      return 'text-success';
    case 'modified':
      return 'text-warning';
    case 'deleted':
      return 'text-danger';
    default:
      return 'text-accent';
  }
}

function statusLetter(entry: GitFileEntry): string {
  switch (entry.status) {
    case 'added':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    default:
      return 'U';
  }
}

export function GitPanel({ git, onOpenFile }: GitPanelProps) {
  const [message, setMessage] = useState('');
  const [stageAll, setStageAll] = useState(true);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneToken, setCloneToken] = useState('');
  const [replaceWorkspace, setReplaceWorkspace] = useState(false);
  const [pushToken, setPushToken] = useState('');
  const [showPush, setShowPush] = useState(false);
  const [showClone, setShowClone] = useState(false);

  const { status, commits, busy } = git;
  const staged = status.files.filter((entry) => entry.staged);
  const unstaged = status.files.filter((entry) => !entry.staged);

  if (!status.isRepo) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-2.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Source control
          </span>
        </div>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-3">
          <div className="rounded-lg border border-line bg-elevated/50 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink">
              <GitBranch size={14} className="text-accent" />
              No repository yet
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-muted">
              Track changes locally, or clone an existing repository into this workspace.
            </p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={busy !== null}
                onClick={() => void git.init()}
              >
                {busy === 'init' ? <Loader2 size={13} className="animate-spin" /> : <GitCommitHorizontal size={13} />}
                Initialise
              </Button>
              <Button size="sm" onClick={() => setShowClone((value) => !value)}>
                Clone
              </Button>
            </div>
          </div>

          {showClone && (
            <div className="space-y-2 rounded-lg border border-line p-3">
              <label className="block space-y-1">
                <span className="text-[11px] text-muted">Repository URL</span>
                <input
                  value={cloneUrl}
                  onChange={(event) => setCloneUrl(event.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="h-8 w-full rounded-md border border-line bg-app px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] text-muted">Access token (optional, private repos)</span>
                <input
                  value={cloneToken}
                  onChange={(event) => setCloneToken(event.target.value)}
                  type="password"
                  placeholder="ghp_…"
                  autoComplete="off"
                  className="h-8 w-full rounded-md border border-line bg-app px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
              <label className="flex items-start gap-2 text-[11.5px] text-muted">
                <input
                  type="checkbox"
                  checked={replaceWorkspace}
                  onChange={(event) => setReplaceWorkspace(event.target.checked)}
                  className="mt-0.5 accent-[var(--color-accent)]"
                />
                Replace the current workspace contents if it is not empty
              </label>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                disabled={!cloneUrl.trim() || busy !== null}
                onClick={async () => {
                  const ok = await git.clone(cloneUrl.trim(), cloneToken || undefined, replaceWorkspace);
                  if (ok) {
                    setCloneUrl('');
                    setCloneToken('');
                    setShowClone(false);
                  }
                }}
              >
                {busy === 'clone' ? <Loader2 size={13} className="animate-spin" /> : null}
                Clone into workspace
              </Button>
              <p className="text-[11px] leading-relaxed text-faint">
                Tokens are used for this request only and are never stored on the server.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Source control
        </span>
        <span className="ml-auto" />
        <IconButton label="Refresh" size="sm" onClick={() => void git.refresh()}>
          <RefreshCw size={13} />
        </IconButton>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-2.5">
        <div className="space-y-1 rounded-lg border border-line bg-elevated/40 p-2.5">
          <div className="flex items-center gap-1.5 text-[12px] text-ink">
            <GitBranch size={13} className="text-accent" />
            <span className="font-medium">{status.branch ?? 'detached HEAD'}</span>
          </div>
          <p className="truncate text-[11px] text-faint" title={status.remote ?? undefined}>
            {status.remote ?? 'No remote configured'}
          </p>
          {!status.hasCommits && (
            <p className="text-[11px] text-warning">No commits yet — make your first commit below.</p>
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Commit message"
            rows={3}
            className="w-full resize-none rounded-md border border-line bg-app px-2.5 py-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
          />
          <label className="flex items-center gap-2 text-[11.5px] text-muted">
            <input
              type="checkbox"
              checked={stageAll}
              onChange={(event) => setStageAll(event.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Stage all changes
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              disabled={!message.trim() || busy !== null}
              onClick={async () => {
                const ok = await git.commit(message, stageAll);
                if (ok) setMessage('');
              }}
            >
              {busy === 'commit' ? <Loader2 size={13} className="animate-spin" /> : <GitCommitHorizontal size={13} />}
              Commit
            </Button>
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => setShowPush((value) => !value)}
              title="Push to origin"
            >
              <ArrowUpFromLine size={13} />
            </Button>
          </div>

          {showPush && (
            <div className="space-y-2 rounded-md border border-line p-2.5">
              <input
                value={pushToken}
                onChange={(event) => setPushToken(event.target.value)}
                type="password"
                placeholder="Personal access token"
                autoComplete="off"
                className="h-8 w-full rounded-md border border-line bg-app px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
              />
              <Button
                size="sm"
                className="w-full"
                variant="primary"
                disabled={!pushToken.trim() || busy !== null}
                onClick={async () => {
                  const ok = await git.push(pushToken);
                  if (ok) {
                    setPushToken('');
                    setShowPush(false);
                  }
                }}
              >
                {busy === 'push' ? <Loader2 size={13} className="animate-spin" /> : null}
                Push {status.branch}
              </Button>
            </div>
          )}
        </div>

        <ChangeGroup
          title="Staged"
          entries={staged}
          emptyLabel="Nothing staged"
          action={(entry) => (
            <IconButton
              label="Unstage"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                void git.unstage([entry.path]);
              }}
            >
              <Minus size={12} />
            </IconButton>
          )}
          onOpen={onOpenFile}
        />

        <ChangeGroup
          title="Changes"
          entries={unstaged}
          emptyLabel="Working tree clean"
          action={(entry) => (
            <IconButton
              label="Stage"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                void git.stage([entry.path]);
              }}
            >
              <Plus size={12} />
            </IconButton>
          )}
          onOpen={onOpenFile}
        />

        <div>
          <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <History size={12} />
            Recent commits
          </div>
          {commits.length === 0 ? (
            <p className="px-1 py-2 text-[11.5px] text-faint">No commits yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {commits.slice(0, 8).map((commit) => (
                <li key={commit.oid} className="rounded px-1 py-1 hover:bg-hover" title={commit.oid}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[10.5px] text-accent">{commit.shortOid}</span>
                    <span className="truncate text-[11.5px] text-ink">{commit.message}</span>
                  </div>
                  <div className="text-[10.5px] text-faint">
                    {commit.author} · {formatRelativeTime(commit.timestamp)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChangeGroupProps {
  title: string;
  entries: GitFileEntry[];
  emptyLabel: string;
  action: (entry: GitFileEntry) => React.ReactNode;
  onOpen: (path: string) => void;
}

function ChangeGroup({ title, entries, emptyLabel, action, onOpen }: ChangeGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-1 flex w-full items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        <span className="ml-1 rounded bg-elevated px-1 text-[10px] normal-case text-muted">
          {entries.length}
        </span>
      </button>

      {open &&
        (entries.length === 0 ? (
          <p className="px-2 pb-1 text-[11.5px] text-faint">{emptyLabel}</p>
        ) : (
          <ul className="space-y-px">
            {entries.map((entry) => (
              <li key={entry.path}>
                <div
                  onClick={() => onOpen(entry.path)}
                  className="group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 hover:bg-hover"
                >
                  <span className={cn('w-2.5 text-[11px] font-bold', statusStyle(entry))}>
                    {statusLetter(entry)}
                  </span>
                  <span className="truncate text-[11.5px] text-muted group-hover:text-ink" title={entry.path}>
                    {entry.path}
                  </span>
                  <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                    {action(entry)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
