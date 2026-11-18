import { useCallback, useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronsDownUp,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { TreeNode } from '../../lib/types';
import { basename, cn } from '../../lib/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { IconButton } from '../ui/IconButton';
import { PromptDialog } from '../ui/PromptDialog';

interface ExplorerProps {
  tree: TreeNode[];
  loading: boolean;
  activePath: string | null;
  dirtyPaths: string[];
  onOpen: (path: string) => void;
  onCreate: (path: string, type: 'file' | 'directory') => void;
  onRename: (from: string, to: string) => void;
  onDelete: (path: string) => void;
  onRefresh: () => void;
}

type DialogState =
  | { kind: 'create'; type: 'file' | 'directory'; parent: string }
  | { kind: 'rename'; node: TreeNode }
  | { kind: 'delete'; node: TreeNode }
  | null;

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'html', 'md',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'cs', 'php', 'sh', 'yml',
  'yaml', 'toml', 'sql', 'xml', 'svg', 'graphql',
]);

function isCodeFile(name: string): boolean {
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
  return extension ? CODE_EXTENSIONS.has(extension) : false;
}

export function Explorer({
  tree,
  loading,
  activePath,
  dirtyPaths,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onRefresh,
}: ExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode | null } | null>(null);

  const dirtySet = useMemo(() => new Set(dirtyPaths), [dirtyPaths]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const openCreateDialog = (parent: string, type: 'file' | 'directory') => {
    if (parent) {
      setExpanded((previous) => new Set(previous).add(parent));
    }
    setDialog({ kind: 'create', type, parent });
  };

  const menuItems = (node: TreeNode | null): ContextMenuItem[] => {
    if (!node) {
      return [
        { label: 'New file', icon: <FilePlus2 size={13} />, onSelect: () => openCreateDialog('', 'file') },
        { label: 'New folder', icon: <FolderPlus size={13} />, onSelect: () => openCreateDialog('', 'directory') },
        { label: 'Refresh', icon: <RefreshCw size={13} />, onSelect: onRefresh },
      ];
    }

    const items: ContextMenuItem[] = [];

    if (node.type === 'file') {
      items.push({
        label: 'Open',
        icon: <FileText size={13} />,
        onSelect: () => onOpen(node.path),
      });
    } else {
      items.push(
        { label: 'New file', icon: <FilePlus2 size={13} />, onSelect: () => openCreateDialog(node.path, 'file') },
        { label: 'New folder', icon: <FolderPlus size={13} />, onSelect: () => openCreateDialog(node.path, 'directory') },
      );
    }

    items.push(
      {
        label: 'Rename',
        icon: <Pencil size={13} />,
        onSelect: () => setDialog({ kind: 'rename', node }),
      },
      {
        label: 'Delete',
        icon: <Trash2 size={13} />,
        danger: true,
        onSelect: () => setDialog({ kind: 'delete', node }),
      },
    );

    return items;
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const isFolder = node.type === 'directory';
      const isOpen = expanded.has(node.path);
      const isActive = activePath === node.path;
      const isDirty = dirtySet.has(node.path);

      return (
        <div key={node.path}>
          <div
            role="treeitem"
            aria-expanded={isFolder ? isOpen : undefined}
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => (isFolder ? toggleFolder(node.path) : onOpen(node.path))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (isFolder) toggleFolder(node.path);
                else onOpen(node.path);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ x: event.clientX, y: event.clientY, node });
            }}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className={cn(
              'group flex h-[26px] cursor-pointer items-center gap-1.5 pr-2 text-[12.5px] outline-none transition-colors',
              isActive
                ? 'bg-accent-soft text-ink'
                : 'text-muted hover:bg-hover hover:text-ink',
            )}
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-faint">
              {isFolder ? (
                <ChevronRight
                  size={13}
                  className={cn('transition-transform', isOpen && 'rotate-90')}
                />
              ) : null}
            </span>

            <span
              className={cn(
                'flex shrink-0 items-center',
                isFolder ? 'text-accent' : 'text-muted',
              )}
            >
              {isFolder ? (
                isOpen ? (
                  <FolderOpen size={14} />
                ) : (
                  <Folder size={14} />
                )
              ) : isCodeFile(node.name) ? (
                <FileCode2 size={14} />
              ) : (
                <FileText size={14} />
              )}
            </span>

            <span className="flex-1 truncate">{node.name}</span>

            {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Unsaved changes" />}
          </div>

          {isFolder && isOpen && node.children && renderNodes(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-0.5 border-b border-line px-2 py-1.5">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Explorer
        </span>
        <IconButton label="New file" size="sm" onClick={() => openCreateDialog('', 'file')}>
          <FilePlus2 size={14} />
        </IconButton>
        <IconButton label="New folder" size="sm" onClick={() => openCreateDialog('', 'directory')}>
          <FolderPlus size={14} />
        </IconButton>
        <IconButton label="Refresh" size="sm" onClick={onRefresh}>
          <RefreshCw size={13} />
        </IconButton>
        <IconButton label="Collapse all" size="sm" onClick={() => setExpanded(new Set())}>
          <ChevronsDownUp size={13} />
        </IconButton>
      </div>

      <div
        className="scrollbar-thin flex-1 overflow-y-auto py-1"
        role="tree"
        aria-label="Workspace files"
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY, node: null });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMenu(null);
        }}
      >
        {loading && tree.length === 0 ? (
          <div className="space-y-1.5 p-3">
            {[70, 52, 64, 44, 58].map((width, index) => (
              <div
                key={index}
                className="h-3 animate-pulse rounded bg-elevated"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-faint">
            <p>This workspace is empty.</p>
            <button
              type="button"
              onClick={() => openCreateDialog('', 'file')}
              className="mt-2 text-accent hover:underline"
            >
              Create your first file
            </button>
          </div>
        ) : (
          renderNodes(tree, 0)
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.node)}
          onClose={() => setMenu(null)}
        />
      )}

      <PromptDialog
        open={dialog?.kind === 'create'}
        title={dialog?.kind === 'create' && dialog.type === 'file' ? 'New file' : 'New folder'}
        description={
          dialog?.kind === 'create' && dialog.parent
            ? `Creating inside “${dialog.parent}”`
            : 'Relative to the workspace root'
        }
        label="Path"
        placeholder={dialog?.kind === 'create' && dialog.type === 'file' ? 'src/components/Button.tsx' : 'src/components'}
        confirmLabel="Create"
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.kind !== 'create') return;
          const clean = value.replace(/^\/+/, '');
          const target = dialog.parent ? `${dialog.parent}/${clean}` : clean;
          onCreate(target, dialog.type);
          setDialog(null);
        }}
      />

      <PromptDialog
        open={dialog?.kind === 'rename'}
        title="Rename"
        description={dialog?.kind === 'rename' ? `Renaming “${dialog.node.path}”` : undefined}
        label="New path"
        defaultValue={dialog?.kind === 'rename' ? dialog.node.path : ''}
        confirmLabel="Rename"
        onCancel={() => setDialog(null)}
        onConfirm={(value) => {
          if (dialog?.kind !== 'rename') return;
          onRename(dialog.node.path, value.replace(/^\/+/, ''));
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title="Delete"
        description={
          dialog?.kind === 'delete'
            ? `Permanently delete “${basename(dialog.node.path)}”${
                dialog.node.type === 'directory' ? ' and everything inside it' : ''
              }? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind !== 'delete') return;
          onDelete(dialog.node.path);
          setDialog(null);
        }}
      />
    </div>
  );
}
