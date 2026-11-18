import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Eraser,
  Loader2,
  Settings2,
  Sparkles,
  Square,
} from 'lucide-react';
import type { ChatContext, UseChatResult } from '../../hooks/useChat';
import type { ModelInfo, ProviderId, ProviderInfo } from '../../lib/types';
import { basename, cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { MessageContent } from './MessageContent';

interface AssistantPanelProps {
  chat: UseChatResult;
  providers: ProviderInfo[];
  activePath: string | null;
  context: ChatContext;
  models: ModelInfo[];
  modelsLoading: boolean;
  selectedModel: string | undefined;
  onModelChange: (model: string) => void;
  onInsertCode: (code: string) => void;
  onOpenSettings: () => void;
}

export function AssistantPanel({
  chat,
  providers,
  activePath,
  context,
  models,
  modelsLoading,
  selectedModel,
  onModelChange,
  onInsertCode,
  onOpenSettings,
}: AssistantPanelProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedProvider = providers.find((provider) => provider.id === chat.provider) ?? null;
  const configured = providers.filter((provider) => provider.configured);
  const hasProvider = configured.length > 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chat.messages]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void chat.send(trimmed, context);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const quickActions = activePath
    ? [
        { label: 'Explain this file', prompt: `Explain what ${basename(activePath)} does, focusing on the important parts.` },
        { label: 'Find bugs', prompt: `Review ${basename(activePath)} for bugs, edge cases and security issues. Be specific.` },
        { label: 'Add tests', prompt: `Write tests for ${basename(activePath)} following the project's conventions.` },
        { label: 'Refactor for clarity', prompt: `Refactor ${basename(activePath)} for clarity and readability without changing behaviour. Return the full updated file in one code block.` },
      ]
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
        <Sparkles size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Assistant
        </span>
        <div className="ml-auto flex items-center gap-1">
          <select
            value={chat.provider}
            onChange={(event) => chat.setProvider(event.target.value as ProviderId)}
            aria-label="AI provider"
            className="h-6 max-w-[150px] rounded border border-line bg-app px-1.5 text-[11px] text-muted outline-none focus:border-accent"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
                {provider.configured ? '' : ' (not configured)'}
              </option>
            ))}
          </select>
          <select
            value={selectedModel ?? ''}
            onChange={(event) => onModelChange(event.target.value)}
            aria-label="AI model"
            disabled={modelsLoading || !selectedProvider?.configured}
            title={
              models.length === 0
                ? 'Using the provider default model'
                : 'Choose the model for this provider'
            }
            className="h-6 max-w-[130px] rounded border border-line bg-app px-1.5 text-[11px] text-muted outline-none focus:border-accent disabled:opacity-60"
          >
            <option value="">
              {modelsLoading ? 'Loading…' : `Default (${selectedProvider?.model ?? '—'})`}
            </option>
            {selectedModel && !models.some((model) => model.id === selectedModel) && (
              <option value={selectedModel}>{selectedModel}</option>
            )}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          <IconButton label="Clear conversation" size="sm" onClick={chat.clear} disabled={chat.messages.length === 0}>
            <Eraser size={13} />
          </IconButton>
          <IconButton label="AI settings" size="sm" onClick={onOpenSettings}>
            <Settings2 size={13} />
          </IconButton>
        </div>
      </div>

      {!hasProvider && (
        <div className="border-b border-line bg-warning/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
            <AlertCircle size={13} />
            No AI provider configured
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Add a key to <code className="rounded bg-elevated px-1">.env</code> and restart:
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted">
            <li>GEMINI_API_KEY=…</li>
            <li>DEEPSEEK_API_KEY=…</li>
            <li>OPENAI_API_KEY=…</li>
          </ul>
        </div>
      )}

      {hasProvider && selectedProvider && !selectedProvider.configured && (
        <div className="border-b border-line bg-warning/10 px-3 py-2 text-[11.5px] text-warning">
          {selectedProvider.label} needs <code className="font-mono">{selectedProvider.envKey}</code> in{' '}
          <code className="font-mono">.env</code>.
        </div>
      )}

      <div ref={listRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-3">
        {chat.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={18} />
            </div>
            <p className="text-[13px] font-medium text-ink">Ask about your code</p>
            <p className="mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-muted">
              The assistant sees the file you have open. Ask for a review, a fix or new code.
            </p>
            {activePath && (
              <div className="mt-3 w-full space-y-1.5">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => submit(action.prompt)}
                    disabled={!hasProvider || chat.streaming}
                    className="w-full rounded-md border border-line bg-elevated/60 px-2.5 py-1.5 text-left text-[11.5px] text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-40"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'space-y-1',
                message.role === 'user' && 'rounded-lg border border-line bg-elevated/60 p-2.5',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    message.role === 'assistant' ? 'text-accent' : 'text-faint',
                  )}
                >
                  {message.role === 'assistant' ? 'Safari Assistant' : 'You'}
                </span>
                {message.status === 'streaming' && (
                  <Loader2 size={10} className="animate-spin text-faint" />
                )}
                {message.status === 'error' && (
                  <span className="text-[10px] text-danger">failed</span>
                )}
              </div>

              {message.status === 'error' ? (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-[12px] text-danger">
                  {message.content}
                </p>
              ) : message.content ? (
                <MessageContent content={message.content} onInsertCode={onInsertCode} />
              ) : (
                <div className="flex gap-1 py-1">
                  <Dot delay="0ms" />
                  <Dot delay="120ms" />
                  <Dot delay="240ms" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line p-2.5">
        {activePath && (
          <div className="mb-1.5 flex items-center gap-1 text-[10.5px] text-faint">
            <span className="rounded bg-elevated px-1.5 py-0.5">context</span>
            <span className="truncate">{activePath}</span>
            {context.selection && (
              <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-accent">
                selection
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              const element = event.target;
              element.style.height = 'auto';
              element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder={hasProvider ? 'Ask about your code…' : 'Configure a provider to start'}
            disabled={!hasProvider}
            className="scrollbar-thin w-full resize-none rounded-lg border border-line bg-app py-2 pl-2.5 pr-10 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-accent disabled:opacity-60"
          />
          {chat.streaming ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={chat.stop}
              className="absolute bottom-1.5 right-1.5 h-7 w-7 !px-0"
              title="Stop generating"
            >
              <Square size={12} />
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => submit(input)}
              disabled={!input.trim() || !hasProvider}
              aria-label="Send message"
              className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white transition-opacity hover:brightness-110 disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: delay }}
    />
  );
}
