import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { listProviders } from '../lib/ai.js';
import { hasGitDirectory } from '../lib/files.js';
import { route } from '../lib/http.js';

export interface SystemStats {
  cpuCount: number;
  loadAverage: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  processUptimeSeconds: number;
  platform: string;
  nodeVersion: string;
}

export const systemRouter = Router();

systemRouter.get(
  '/stats',
  route((_req, res) => {
    const memoryTotal = os.totalmem();
    const memoryFree = os.freemem();
    const stats: SystemStats = {
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg()[0] ?? 0,
      memoryUsedBytes: memoryTotal - memoryFree,
      memoryTotalBytes: memoryTotal,
      processUptimeSeconds: Math.round(process.uptime()),
      platform: `${os.type()} ${os.release()}`,
      nodeVersion: process.version,
    };
    res.json(stats);
  }),
);

systemRouter.get(
  '/info',
  route((_req, res) => {
    let workspaceEmpty = true;
    try {
      workspaceEmpty = fs.readdirSync(config.workspaceDir).length === 0;
    } catch {
      workspaceEmpty = false;
    }

    res.json({
      version: config.version,
      workspace: path.basename(config.workspaceDir),
      workspacePath: config.workspaceDir,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      workspaceEmpty,
      gitRepository: hasGitDirectory(),
      authEnabled: Boolean(config.accessToken),
      providers: listProviders().map(({ id, label, model, configured }) => ({
        id,
        label,
        model,
        configured,
      })),
    });
  }),
);
