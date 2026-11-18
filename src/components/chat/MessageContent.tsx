import { useState } from 'react';
import { Check, Copy, CornerDownLeft } from 'lucide-react';
import { parseInlineCode, parseMessageSegments } from '../../lib/markdown';
import { IconButton } from '../ui/IconButton';

export function MessageContent({
  content,
  onInsertCode,
}: {
  content: string;
  onInsertCode?: (code: string) => void;
}) {
  const segments = parseMessageSegments(content);

  return (
    <div className="space-y-2.5 text-[12.5px] leading-relaxed">
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <CodeBlock
            key={index}
            code={segment.content}
            language={segment.language}
            onInsert={onInsertCode}
          />
        ) : (
          <p key={index} className="whitespace-pre-wrap break-words">
            {parseInlineCode(segment.content).map((part, partIndex) =>
              part.code ? (
                <code
                  key={partIndex}
                  className="rounded bg-elevated px-1 py-0.5 font-mono text-[11.5px] text-ink"
                >
                  {part.value}
                </code>
              ) : (
                <span key={partIndex}>{part.value}</span>
              ),
            )}
          </p>
        ),
      )}
    </div>
  );
}

function CodeBlock({
  code,
  language,
  onInsert,
}: {
  code: string;
  language?: string;
  onInsert?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; ignore.
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-line bg-app">
      <div className="flex items-center justify-between border-b border-line bg-elevated/60 px-2 py-1">
        <span className="text-[10.5px] uppercase tracking-wider text-faint">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-0.5">
          {onInsert && (
            <IconButton
              label="Insert this code into the active editor"
              size="sm"
              onClick={() => onInsert(code)}
            >
              <CornerDownLeft size={12} />
            </IconButton>
          )}
          <IconButton label={copied ? 'Copied' : 'Copy code'} size="sm" onClick={copy}>
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </IconButton>
        </div>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-2.5 font-mono text-[11.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
