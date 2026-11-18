import { Router } from 'express';
import { z } from 'zod';
import {
  addRemote,
  cloneRepository,
  commit,
  getLog,
  getStatus,
  initRepository,
  listBranches,
  push,
  stagePaths,
  unstagePaths,
} from '../lib/git.js';
import { parseBody, route } from '../lib/http.js';

const tokenSchema = z.string().min(1).max(500).optional();

export const gitRouter = Router();

gitRouter.get(
  '/status',
  route(async (_req, res) => {
    res.json(await getStatus());
  }),
);

gitRouter.get(
  '/log',
  route(async (req, res) => {
    const limit = Number(req.query.limit ?? 25);
    res.json({ commits: await getLog(Number.isFinite(limit) ? limit : 25) });
  }),
);

gitRouter.get(
  '/branches',
  route(async (_req, res) => {
    res.json(await listBranches());
  }),
);

gitRouter.post(
  '/init',
  route(async (_req, res) => {
    res.json(await initRepository());
  }),
);

gitRouter.post(
  '/clone',
  route(async (req, res) => {
    const body = parseBody(
      z.object({
        url: z.string().url().max(2000),
        token: tokenSchema,
        replace: z.boolean().optional(),
      }),
      req,
    );
    res.json(
      await cloneRepository({ url: body.url, token: body.token, replace: body.replace }),
    );
  }),
);

gitRouter.post(
  '/stage',
  route(async (req, res) => {
    const body = parseBody(
      z.object({
        paths: z.array(z.string().min(1).max(1024)).max(500).optional(),
        all: z.boolean().optional(),
      }),
      req,
    );
    res.json(await stagePaths(body.all ? 'all' : (body.paths ?? [])));
  }),
);

gitRouter.post(
  '/unstage',
  route(async (req, res) => {
    const body = parseBody(
      z.object({ paths: z.array(z.string().min(1).max(1024)).min(1).max(500) }),
      req,
    );
    res.json(await unstagePaths(body.paths));
  }),
);

gitRouter.post(
  '/commit',
  route(async (req, res) => {
    const body = parseBody(
      z.object({
        message: z.string().min(1).max(5000),
        stageAll: z.boolean().optional(),
        name: z.string().max(120).optional(),
        email: z.string().max(200).optional(),
      }),
      req,
    );
    res.json(await commit(body));
  }),
);

gitRouter.post(
  '/push',
  route(async (req, res) => {
    const body = parseBody(
      z.object({
        token: tokenSchema,
        remote: z.string().max(120).optional(),
        ref: z.string().max(255).optional(),
        force: z.boolean().optional(),
      }),
      req,
    );
    res.json(await push(body));
  }),
);

gitRouter.post(
  '/remote',
  route(async (req, res) => {
    const body = parseBody(z.object({ url: z.string().url().max(2000) }), req);
    await addRemote(body.url);
    res.json(await getStatus());
  }),
);
