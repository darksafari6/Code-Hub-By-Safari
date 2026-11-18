import { useEffect, useState } from 'react';
import { ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { withTokenQuery } from '../../lib/api';
import { IconButton } from '../ui/IconButton';

interface PreviewPanelProps {
  refreshSignal: number;
}

export function PreviewPanel({ refreshSignal }: PreviewPanelProps) {
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (refreshSignal > 0) setNonce((value) => value + 1);
  }, [refreshSignal]);

  const url = withTokenQuery('/preview/');

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-2">
        <Globe size={12} className="shrink-0 text-faint" />
        <span className="truncate rounded bg-elevated px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
          {url}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Reload preview" size="sm" onClick={() => setNonce((value) => value + 1)}>
            <RefreshCw size={12} />
          </IconButton>
          <IconButton
            label="Open in new tab"
            size="sm"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={12} />
          </IconButton>
        </div>
      </div>

      <div className="relative flex-1 bg-white">
        <iframe
          key={nonce}
          src={url}
          title="Workspace preview"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
        />
      </div>
    </div>
  );
}
