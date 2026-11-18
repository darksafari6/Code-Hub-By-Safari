import { Router } from 'express';
import { z } from 'zod';
import {
  createEntry,
  deleteEntry,
  listTree,
  readTextFile,
  renameEntry,
  searchWorkspace,
  writeTextFile,
} from '../lib/files.js';
import { parseBody, parseQuery, route } from '../lib/http.js';

const pathSchema = z.string().min(1).max(1024);

const writeSchema = z.object({
  path: pathSchema,
  content: z.string(),
});

const createSchema = z.object({
  path: pathSchema,
  type: z.enum(['file', 'directory']).default('file'),
});

const renameSchema = z.object({
  from: pathSchema,
  to: pathSchema,
});

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  caseSensitive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  path: z.string().max(1024).optional(),
});

export const filesRouter = Router();

filesRouter.get(
  '/tree',
  route((_req, res) => {
    res.json({ tree: listTree() });
  }),
);

filesRouter.get(
  '/content',
  route((req, res) => {
    const { path } = z.object({ path: pathSchema }).parse(req.query);
    res.json(readTextFile(path));
  }),
);

filesRouter.put(
  '/content',
  route((req, res) => {
    const { path, content } = parseBody(writeSchema, req);
    res.json(writeTextFile(path, content));
  }),
);

filesRouter.post(
  '/create',
  route((req, res) => {
    const { path, type } = parseBody(createSchema, req);
    res.status(201).json(createEntry(path, type));
  }),
);

filesRouter.post(
  '/rename',
  route((req, res) => {
    const { from, to } = parseBody(renameSchema, req);
    res.json(renameEntry(from, to));
  }),
);

filesRouter.post(
  '/delete',
  route((req, res) => {
    const { path } = parseBody(z.object({ path: pathSchema }), req);
    res.json(deleteEntry(path));
  }),
);

filesRouter.get(
  '/search',
  route((req, res) => {
    const { q, caseSensitive, path } = parseQuery(searchSchema, req);
    res.json(searchWorkspace(q, { caseSensitive, path }));
  }),
);
