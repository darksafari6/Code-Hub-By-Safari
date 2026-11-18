import { Dialog } from '../ui/Dialog';
import type { ProviderInfo, SystemInfo } from '../../lib/types';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  systemInfo: SystemInfo | null;
  providers: ProviderInfo[];
  workspacePath: string;
}

export function AboutDialog({
  open,
  onClose,
  systemInfo,
  providers,
  workspacePath,
}: AboutDialogProps) {
  const configured = providers.filter((provider) => provider.configured);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Safari AI Dev Studio"
      description="An open-source, AI-assisted development environment for Linux desktops."
    >
      <div className="space-y-4 text-[12px] text-[color:var(--text-muted)]">
        <dl className="grid grid-cols-[130px_1fr] gap-y-2">
          <dt className="text-[color:var(--text-dim)]">Version</dt>
          <dd className="text-[color:var(--text)]">{systemInfo?.version ?? '2.1.0'}</dd>

          <dt className="text-[color:var(--text-dim)]">Licence</dt>
          <dd className="text-[color:var(--text)]">MIT</dd>

          <dt className="text-[color:var(--text-dim)]">Workspace</dt>
          <dd className="break-all font-mono text-[11px] text-[color:var(--text)]">
            {workspacePath || '—'}
          </dd>

          <dt className="text-[color:var(--text-dim)]">Platform</dt>
          <dd className="text-[color:var(--text)]">
            {systemInfo ? `${systemInfo.platform} · ${systemInfo.arch}` : '—'}
          </dd>

          <dt className="text-[color:var(--text-dim)]">Runtime</dt>
          <dd className="text-[color:var(--text)]">
            Node {systemInfo?.nodeVersion ?? '—'}
          </dd>

          <dt className="text-[color:var(--text-dim)]">AI providers</dt>
          <dd className="text-[color:var(--text)]">
            {configured.length > 0
              ? configured.map((provider) => provider.label).join(', ')
              : 'None configured — add an API key to .env'}
          </dd>
        </dl>

        <p className="border-t border-[color:var(--border)] pt-3 leading-relaxed">
          Built on React, Monaco, xterm.js, Express and libgit2. AI requests are proxied
          server-side, so API keys never reach the browser bundle.
        </p>

        <p className="text-[11px] text-[color:var(--text-dim)]">
          Source: github.com/darksafari6/Code-Hub-By-Safari
        </p>
      </div>
    </Dialog>
  );
}
