import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const ROOT = process.cwd();

function env(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function envNumber(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const workspaceDir = path.resolve(env('WORKSPACE_DIR') ?? path.join(ROOT, 'workspace'));
fs.mkdirSync(workspaceDir, { recursive: true });

export const config = {
  root: ROOT,
  isProduction: process.env.NODE_ENV === 'production',
  host: env('HOST') ?? '0.0.0.0',
  port: envNumber('PORT', 3000),
  workspaceDir,
  accessToken: env('SAFARI_ACCESS_TOKEN'),
  version: '2.0.0',
  limits: {
    maxFileBytes: 2 * 1024 * 1024,
    maxTreeEntries: 5000,
    maxTreeDepth: 24,
    maxSearchResults: 200,
    maxSearchFileBytes: 1024 * 1024,
    maxCommandOutputBytes: 1024 * 1024,
    maxCommandRuntimeMs: 10 * 60 * 1000,
    maxJsonBody: '5mb',
  },
  ai: {
    gemini: {
      apiKey: env('GEMINI_API_KEY'),
      model: env('GEMINI_MODEL') ?? 'gemini-2.5-flash',
    },
    deepseek: {
      apiKey: env('DEEPSEEK_API_KEY'),
      model: env('DEEPSEEK_MODEL') ?? 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
    },
    openai: {
      apiKey: env('OPENAI_API_KEY'),
      model: env('OPENAI_MODEL') ?? 'gpt-4o-mini',
      baseUrl: env('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
    },
  },
} as const;
