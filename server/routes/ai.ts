import { Router } from 'express';
import { z } from 'zod';
import {
  createRateLimiter,
  isProviderId,
  listModels,
  listProviders,
  streamChat,
} from '../lib/ai.js';
import { HttpError, errorMessage } from '../lib/errors.js';
import { parseBody, route } from '../lib/http.js';

const chatSchema = z.object({
  provider: z.string().refine(isProviderId, 'Unknown provider'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(60_000),
      }),
    )
    .min(1)
    .max(60),
  model: z.string().max(200).optional(),
  system: z.string().max(20_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(64).max(32_000).optional(),
});

const allowRequest = createRateLimiter({ windowMs: 60_000, max: 40 });

export const aiRouter = Router();

aiRouter.get(
  '/providers',
  route((_req, res) => {
    res.json({ providers: listProviders() });
  }),
);

aiRouter.post(
  '/chat',
  route(async (req, res) => {
    const key = req.ip ?? 'unknown';
    if (!allowRequest(key)) {
      throw new HttpError(429, 'Too many AI requests. Wait a minute and try again.');
    }

    const body = parseBody(chatSchema, req);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const delta of streamChat(body)) {
        send({ delta });
      }
      send({ done: true });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : errorMessage(error);
      send({ error: message });
    } finally {
      res.end();
    }
  }),
);

aiRouter.get(
  '/models',
  route(async (req, res) => {
    const provider = req.query.provider;
    if (!isProviderId(provider)) {
      throw new HttpError(400, 'Unknown provider');
    }
    res.json({ provider, models: await listModels(provider) });
  }),
);
