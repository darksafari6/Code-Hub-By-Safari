import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const git = require('isomorphic-git');
const httpGit = require('isomorphic-git/http/node');

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // Workspace root
  const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  // AI Setup
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Serve workspace files for preview
  app.use('/preview', express.static(WORKSPACE_DIR));

  app.get('/api/files', (req, res) => {
    const getFiles = (dir: string): any[] => {
      const files = fs.readdirSync(dir);
      return files.map(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          return { name: file, type: 'directory', path: fullPath.replace(WORKSPACE_DIR, ''), children: getFiles(fullPath) };
        }
        return { name: file, type: 'file', path: fullPath.replace(WORKSPACE_DIR, '') };
      });
    };
    res.json(getFiles(WORKSPACE_DIR));
  });

  app.get('/api/files/read', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'Path required' });
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      res.send(fs.readFileSync(fullPath, 'utf-8'));
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  app.post('/api/files/write', (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Path required' });
    const fullPath = path.join(WORKSPACE_DIR, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    res.json({ success: true });
  });

  // Git API
  app.get('/api/git/status', async (req, res) => {
    try {
      if (!fs.existsSync(path.join(WORKSPACE_DIR, '.git'))) {
        return res.json({ status: [], isRepo: false });
      }
      const status = await git.statusMatrix({ fs, dir: WORKSPACE_DIR });
      res.json({ status, isRepo: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/init', async (req, res) => {
    try {
      await git.init({ fs, dir: WORKSPACE_DIR });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/clone', async (req, res) => {
    const { url, username, password } = req.body;
    try {
      await git.clone({
        fs,
        http: httpGit,
        dir: WORKSPACE_DIR,
        url,
        onAuth: () => ({ username, password }),
        singleBranch: true,
        depth: 1
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/add', async (req, res) => {
    const { filepath } = req.body;
    try {
      await git.add({ fs, dir: WORKSPACE_DIR, filepath });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/remove', async (req, res) => {
    const { filepath } = req.body;
    try {
      await git.remove({ fs, dir: WORKSPACE_DIR, filepath });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    const { message, author } = req.body;
    try {
      const sha = await git.commit({
        fs,
        dir: WORKSPACE_DIR,
        message,
        author: author || { name: 'User', email: 'user@example.com' },
      });
      res.json({ success: true, sha });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/git/push', async (req, res) => {
    const { remote, ref, username, password } = req.body;
    try {
      await git.push({
        fs,
        http: httpGit,
        dir: WORKSPACE_DIR,
        remote: remote || 'origin',
        ref: ref || 'main',
        onAuth: () => ({ username, password }),
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/git/log', async (req, res) => {
    try {
      if (!fs.existsSync(path.join(WORKSPACE_DIR, '.git'))) {
        return res.json({ log: [] });
      }
      const log = await git.log({ fs, dir: WORKSPACE_DIR, depth: 10 });
      res.json({ log });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Cache for Smart Execution
  const aiCache = new Map<string, string>();

  app.post('/api/ai/chat', async (req, res) => {
    const { message, context, isOffline, model } = req.body;
    
    if (isOffline) {
      return res.json({ reply: "[Offline Mode] Local AI fallback active. I am currently running in limited capacity." });
    }

    try {
      const cacheKey = `chat:${message}`;
      if (aiCache.has(cacheKey)) {
        return res.json({ reply: aiCache.get(cacheKey) });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Context:\n${context}\n\nUser: ${message}`,
      });
      
      const reply = response.text;
      aiCache.set(cacheKey, reply || '');
      res.json({ reply });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/deepseek', async (req, res) => {
    const { prompt, model = 'deepseek-coder' } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'DeepSeek API key not configured' });
    }

    try {
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: model,
        messages: [
          { role: 'system', content: 'You are a professional coding assistant.' },
          { role: 'user', content: prompt }
        ],
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json({ reply: response.data.choices[0].message.content });
    } catch (error: any) {
      console.error('DeepSeek API error:', error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
  });

  app.post('/api/ai/auto-mode/plan', async (req, res) => {
    const { task, isOffline, model } = req.body;
    if (isOffline) {
      return res.status(400).json({ error: "Cannot plan in offline mode." });
    }

    try {
      const planPrompt = `You are the Planner agent. Create a JSON execution plan for this task: ${task}.
      Format strictly as JSON:
      {
        "steps": [
          {
            "agent": "Executor|Debugger|DevOps|Reviewer|Tester",
            "action": "string",
            "file": "string",
            "content": "string"
          }
        ]
      }`;

      let plan;
      const cacheKey = `plan:${task}`;
      
      if (aiCache.has(cacheKey)) {
        plan = JSON.parse(aiCache.get(cacheKey)!);
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: planPrompt,
          config: { responseMimeType: "application/json" }
        });
        plan = JSON.parse(response.text || '{}');
        aiCache.set(cacheKey, JSON.stringify(plan));
      }

      res.json({ plan });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/auto-mode/execute-step', async (req, res) => {
    const { step, isOffline, config } = req.body;
    if (isOffline) {
      return res.status(400).json({ error: "Cannot execute in offline mode." });
    }

    try {
      let success = false;
      let attempts = 0;
      const maxRetries = config?.maxRetries || 1;
      let lastError = null;

      while (!success && attempts < maxRetries) {
        attempts++;
        try {
          if (step.file && step.content) {
            const filePath = path.join(WORKSPACE_DIR, step.file);
            
            // Auto-rollback support: backup existing file
            if (config?.autoRollback && fs.existsSync(filePath)) {
              const backupPath = `${filePath}.bak`;
              fs.copyFileSync(filePath, backupPath);
            }

            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, step.content);
          }
          // Simulate processing time
          await new Promise(r => setTimeout(r, 400));
          success = true;
        } catch (err: any) {
          lastError = err;
          if (attempts >= maxRetries && config?.autoRollback && step.file) {
             const filePath = path.join(WORKSPACE_DIR, step.file);
             const backupPath = `${filePath}.bak`;
             if (fs.existsSync(backupPath)) {
               fs.copyFileSync(backupPath, filePath);
               fs.unlinkSync(backupPath);
             }
          }
        }
      }

      if (!success) {
        throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
      }

      res.json({ success: true, log: `[${step.agent}] Executed: ${step.action}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket for Terminal
  wss.on('connection', (ws) => {
    const shell = spawn('bash', [], {
      cwd: WORKSPACE_DIR,
      env: process.env,
    });

    shell.stdout.on('data', (data) => {
      ws.send(JSON.stringify({ type: 'terminal', data: data.toString() }));
    });

    shell.stderr.on('data', (data) => {
      ws.send(JSON.stringify({ type: 'terminal', data: data.toString() }));
    });

    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'terminal') {
        shell.stdin.write(parsed.data);
      }
    });

    ws.on('close', () => {
      shell.kill();
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
