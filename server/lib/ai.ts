import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { HttpError, errorMessage } from './errors.js';

export type ProviderId = 'gemini' | 'deepseek' | 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  configured: boolean;
  description: string;
  envKey: string;
}

export function listProviders(): ProviderInfo[] {
  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      model: config.ai.gemini.model,
      configured: Boolean(config.ai.gemini.apiKey),
      description: 'Fast multimodal models from Google AI Studio.',
      envKey: 'GEMINI_API_KEY',
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      model: config.ai.deepseek.model,
      configured: Boolean(config.ai.deepseek.apiKey),
      description: 'Strong coding models, OpenAI-compatible API.',
      envKey: 'DEEPSEEK_API_KEY',
    },
    {
      id: 'openai',
      label: 'OpenAI compatible',
      model: config.ai.openai.model,
      configured: Boolean(config.ai.openai.apiKey),
      description: 'Any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Ollama…).',
      envKey: 'OPENAI_API_KEY',
    },
  ];
}

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'gemini' || value === 'deepseek' || value === 'openai';
}

function getProvider(id: ProviderId): ProviderInfo {
  const provider = listProviders().find((entry) => entry.id === id);
  if (!provider) throw new HttpError(400, `Unknown AI provider "${String(id)}"`);
  if (!provider.configured) {
    throw new HttpError(
      400,
      `${provider.label} is not configured. Add ${provider.envKey} to your .env file and restart the server.`,
    );
  }
  return provider;
}

export interface ChatRequest {
  provider: ProviderId;
  messages: ChatMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Yields incremental text chunks. Errors surface as HttpError. */
export async function* streamChat(request: ChatRequest): AsyncGenerator<string> {
  const provider = getProvider(request.provider);

  if (request.messages.length === 0) {
    throw new HttpError(400, 'At least one message is required');
  }

  if (request.provider === 'gemini') {
    yield* streamGemini(request);
    return;
  }

  yield* streamOpenAiCompatible(request, provider);
}

async function* streamGemini(request: ChatRequest): AsyncGenerator<string> {
  const apiKey = config.ai.gemini.apiKey;
  if (!apiKey) throw new HttpError(400, 'GEMINI_API_KEY is not configured');

  const ai = new GoogleGenAI({ apiKey });

  try {
    const stream = await ai.models.generateContentStream({
      model: config.ai.gemini.model,
      contents: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      config: {
        ...(request.system ? { systemInstruction: request.system } : {}),
        ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
        ...(typeof request.maxTokens === 'number' ? { maxOutputTokens: request.maxTokens } : {}),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (error) {
    throw toProviderError(error, 'Gemini');
  }
}

async function* streamOpenAiCompatible(
  request: ChatRequest,
  provider: ProviderInfo,
): AsyncGenerator<string> {
  const apiKey =
    provider.id === 'deepseek' ? config.ai.deepseek.apiKey : config.ai.openai.apiKey;
  const baseUrl =
    provider.id === 'deepseek' ? config.ai.deepseek.baseUrl : config.ai.openai.baseUrl;

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const messages = [
    ...(request.system ? [{ role: 'system', content: request.system }] : []),
    ...request.messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: true,
        ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
        ...(typeof request.maxTokens === 'number' ? { max_tokens: request.maxTokens } : {}),
      }),
    });
  } catch (error) {
    throw new HttpError(
      502,
      `Could not reach ${provider.label} at ${baseUrl}. ${errorMessage(error)}`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw toProviderError(
      { status: response.status, message: extractApiError(body) },
      provider.label,
    );
  }

  if (!response.body) {
    throw new HttpError(502, `${provider.label} returned an empty response`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      if (!payload) continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore keep-alive and malformed chunks.
      }
    }
  }
}

function extractApiError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON.
  }
  return body.slice(0, 400);
}

function toProviderError(error: unknown, label: string): HttpError {
  if (error instanceof HttpError) return error;

  const candidate = error as { status?: number; message?: string };
  const status = candidate?.status;
  const detail = candidate?.message ?? errorMessage(error);

  if (status === 401 || status === 403) {
    return new HttpError(401, `${label} rejected the API key. Check your .env configuration.`);
  }
  if (status === 429) {
    return new HttpError(429, `${label} rate limit reached. Wait a moment and retry.`);
  }
  if (status === 404) {
    return new HttpError(404, `${label} model not found. Check the model name. ${detail}`);
  }
  return new HttpError(502, `${label} request failed: ${detail}`);
}

/** Small fixed-window rate limiter for AI endpoints. */
export function createRateLimiter(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (entry.count >= options.max) return false;

    entry.count += 1;
    return true;
  };
}
