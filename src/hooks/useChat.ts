import { useCallback, useRef, useState } from 'react';
import { streamAssistantReply } from '../lib/api';
import type { ChatMessage, ProviderId } from '../lib/types';
import { createId } from '../lib/utils';

export interface ChatContext {
  filePath?: string | null;
  fileContent?: string;
  selection?: string;
}

const MAX_CONTEXT_CHARS = 14_000;

function buildSystemPrompt(context?: ChatContext): string {
  const parts = [
    'You are Safari Assistant, a senior software engineer embedded in a code workspace.',
    'Be concise and practical. Prefer complete, runnable code over fragments.',
    'Use Markdown. Wrap code in fenced blocks with a language tag.',
    'If the user asks about the current file, refer to it by name.',
  ];

  if (context?.filePath) {
    parts.push(`Current file: ${context.filePath}`);
    if (context.selection?.trim()) {
      parts.push(`Selected text:\n\`\`\`\n${context.selection.slice(0, 4000)}\n\`\`\``);
    } else if (context.fileContent?.trim()) {
      const truncated = context.fileContent.slice(0, MAX_CONTEXT_CHARS);
      const suffix =
        context.fileContent.length > MAX_CONTEXT_CHARS ? '\n… (file truncated)' : '';
      parts.push(`File contents:\n\`\`\`\n${truncated}${suffix}\n\`\`\``);
    }
  }

  return parts.join('\n\n');
}

export interface UseChatResult {
  messages: ChatMessage[];
  streaming: boolean;
  provider: ProviderId;
  setProvider: (provider: ProviderId) => void;
  send: (text: string, context?: ChatContext) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

export interface UseChatOptions {
  provider: ProviderId;
  /** Per-provider model overrides from settings. */
  models?: Partial<Record<ProviderId, string>>;
}

export function useChat(options: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(options.provider);
  const abortRef = useRef<AbortController | null>(null);

  const modelsRef = useRef(options.models);
  modelsRef.current = options.models;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((previous) =>
      previous.map((message) =>
        message.status === 'streaming' ? { ...message, status: 'done' } : message,
      ),
    );
  }, []);

  const send = useCallback(
    async (text: string, context?: ChatContext) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        status: 'done',
      };
      const assistantId = createId();

      const history = [...messages, userMessage];
      setMessages([
        ...history,
        { id: assistantId, role: 'assistant', content: '', status: 'streaming' },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const append = (delta: string) => {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + delta } : message,
          ),
        );
      };

      try {
        const model = modelsRef.current?.[provider];

        await streamAssistantReply(
          {
            provider,
            messages: history,
            ...(model ? { model } : {}),
            system: buildSystemPrompt(context),
            signal: controller.signal,
          },
          {
            onDelta: append,
            onDone: () => {
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantId ? { ...message, status: 'done' } : message,
                ),
              );
            },
            onError: (message) => {
              setMessages((previous) =>
                previous.map((entry) =>
                  entry.id === assistantId
                    ? { ...entry, status: 'error', content: message }
                    : entry,
                ),
              );
            },
          },
        );
      } finally {
        abortRef.current = null;
        setStreaming(false);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId && message.status === 'streaming'
              ? { ...message, status: 'done' }
              : message,
          ),
        );
      }
    },
    [messages, provider, streaming],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStreaming(false);
  }, []);

  return { messages, streaming, provider, setProvider, send, stop, clear };
}
