import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Toaster, toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ActivityBar } from './components/layout/ActivityBar';
import { SideBar } from './components/layout/SideBar';
import { EditorArea } from './components/layout/EditorArea';
import { BottomPanel } from './components/layout/BottomPanel';
import { RightPanel } from './components/layout/RightPanel';
import { StatusBar } from './components/layout/StatusBar';
import { TitleBar } from './components/layout/TitleBar';
import { SettingsModal } from './components/modals/SettingsModal';
import { CommandPalette } from './components/modals/CommandPalette';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  // Layout State
  const [activityBarTab, setActivityBarTab] = useState<'explorer' | 'search' | 'git' | 'ai'>('explorer');
  const [isSideBarVisible, setIsSideBarVisible] = useState(true);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState('terminal');
  const [outputTab, setOutputTab] = useState('preview');
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(400);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // File System State
  const [files, setFiles] = useState<any[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  // AI State
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [autoModeState, setAutoModeState] = useState<'idle' | 'planning' | 'paused' | 'running' | 'completed' | 'error'>('idle');
  const [executionPlan, setExecutionPlan] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [autoModeConfig, setAutoModeConfig] = useState({ maxRetries: 3, autoRollback: true });
  const [selectedModel, setSelectedModel] = useState('DeepSeek-Coder');

  // Git State
  const [gitStatus, setGitStatus] = useState<any[]>([]);
  const [isRepo, setIsRepo] = useState(false);
  const [gitLog, setGitLog] = useState<any[]>([]);
  const [gitUsername, setGitUsername] = useState('');
  const [gitPassword, setGitPassword] = useState('');
  const [gitCommitMessage, setGitCommitMessage] = useState('');
  const [gitCloneUrl, setGitCloneUrl] = useState('');
  const [isGitLoading, setIsGitLoading] = useState(false);

  // System State
  const [systemStats, setSystemStats] = useState({ cpu: '12%', ram: '4.2GB / 16GB', processes: 142 });
  const [theme, setTheme] = useState('dark');
  const [isOffline, setIsOffline] = useState(false);

  // Refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const autoModeStateRef = useRef(autoModeState);

  useEffect(() => {
    autoModeStateRef.current = autoModeState;
  }, [autoModeState]);

  useEffect(() => {
    fetchFiles();
    initTerminal();
    fetchGitStatus();
    
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set. AI features might not work.');
      toast.warning('Gemini API key is missing. AI features will be limited.');
    }

    const interval = setInterval(() => {
      setSystemStats({
        cpu: `${Math.floor(Math.random() * 20 + 5)}%`,
        ram: `${(Math.random() * 2 + 4).toFixed(1)}GB / 16GB`,
        processes: Math.floor(Math.random() * 20 + 130)
      });
    }, 2000);

    return () => {
      const term = xtermRef.current;
      if (term) {
        setTimeout(() => term.dispose(), 50);
      }
      wsRef.current?.close();
      resizeObserverRef.current?.disconnect();
      clearInterval(interval);
    };
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      toast.error('Failed to fetch files');
    }
  };

  const openFile = async (path: string) => {
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const content = await res.text();
        setCurrentFile(path);
        setFileContent(content);
        if (!openFiles.includes(path)) {
          setOpenFiles([...openFiles, path]);
        }
        toast.success(`Opened ${path.split('/').pop()}`);
      }
    } catch (e) {
      toast.error('Failed to read file');
    }
  };

  const closeFile = (path: string) => {
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    if (currentFile === path) {
      if (newOpenFiles.length > 0) {
        openFile(newOpenFiles[newOpenFiles.length - 1]);
      } else {
        setCurrentFile(null);
        setFileContent('');
      }
    }
  };

  const saveFile = async (content: string) => {
    if (!currentFile) return;
    try {
      await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentFile, content })
      });
      setFileContent(content);
      toast.success('File saved');
      if (isRepo) fetchGitStatus();
    } catch (e) {
      toast.error('Failed to save file');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentFile && fileContent) {
          saveFile(fileContent);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, fileContent]);

  const fetchGitStatus = async () => {
    try {
      const res = await fetch('/api/git/status');
      const data = await res.json();
      setGitStatus(data.status || []);
      setIsRepo(data.isRepo);
      if (data.isRepo) {
        fetchGitLog();
      }
    } catch (e) {
      console.error('Failed to fetch git status', e);
    }
  };

  const fetchGitLog = async () => {
    try {
      const res = await fetch('/api/git/log');
      const data = await res.json();
      setGitLog(data.log || []);
    } catch (e) {
      console.error('Failed to fetch git log', e);
    }
  };

  const initTerminal = () => {
    if (!terminalRef.current) return;
    terminalRef.current.innerHTML = '';
    
    const term = new Terminal({
      theme: { background: '#1e1e1e' },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    const fitTerminal = () => {
      if (!term || !term.element || !term.element.parentElement) return;
      if (term.element.clientWidth === 0 || term.element.clientHeight === 0) return;
      try {
        if ((term as any)._core?._renderService?.dimensions) {
          fitAddon.fit();
        }
      } catch (e) {
        console.warn('Terminal fit error', e);
      }
    };

    setTimeout(fitTerminal, 100);
    const resizeObserver = new ResizeObserver(() => fitTerminal());
    resizeObserver.observe(terminalRef.current);
    resizeObserverRef.current = resizeObserver;
    xtermRef.current = term;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'terminal') term.write(msg.data);
    };

    term.onData((data) => {
      ws.send(JSON.stringify({ type: 'terminal', data }));
    });
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newHistory = [...chatHistory, { role: 'user', content: chatInput }];
    setChatHistory(newHistory);
    const currentInput = chatInput;
    setChatInput('');
    setIsAiLoading(true);

    try {
      if (selectedModel === 'DeepSeek-Coder') {
        const res = await fetch('/api/ai/deepseek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: currentInput,
            context: `Current file: ${currentFile}\nContent:\n${fileContent}`,
            isOffline,
            model: selectedModel
          })
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to get response from DeepSeek');
        }

        const data = await res.json();
        setChatHistory([...newHistory, { role: 'ai', content: data.reply }]);
      } else {
        // Call Gemini directly from frontend
        if (!process.env.GEMINI_API_KEY) {
          throw new Error('Gemini API key is not configured. Please add it to your environment variables.');
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Context:\nCurrent file: ${currentFile}\nContent:\n${fileContent}\n\nUser: ${currentInput}`,
          config: {
            systemInstruction: "You are a professional coding assistant. Provide concise and accurate answers."
          }
        });
        
        const reply = response.text;
        if (!reply) throw new Error('Empty response from Gemini');
        setChatHistory([...newHistory, { role: 'ai', content: reply }]);
      }
    } catch (e: any) {
      console.error('AI Chat Error:', e);
      toast.error('AI Chat Error: ' + (e.message || 'Unknown error'));
      setChatHistory([...newHistory, { role: 'ai', content: `Error: ${e.message || 'I encountered an issue processing your request.'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGitClone = async () => {
    if (!gitCloneUrl) return;
    setIsGitLoading(true);
    try {
      const res = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gitCloneUrl, username: gitUsername, password: gitPassword })
      });
      if (res.ok) {
        toast.success('Repository cloned successfully');
        fetchGitStatus();
        fetchFiles();
        setGitCloneUrl('');
      }
    } catch (e) {
      toast.error('Failed to clone repository');
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleGitCommit = async () => {
    if (!gitCommitMessage) return;
    setIsGitLoading(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: gitCommitMessage })
      });
      if (res.ok) {
        toast.success('Changes committed');
        setGitCommitMessage('');
        fetchGitStatus();
      }
    } catch (e) {
      toast.error('Failed to commit changes');
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleCommand = (command: string) => {
    switch (command) {
      case 'explorer': setActivityBarTab('explorer'); setIsSideBarVisible(true); break;
      case 'search': setActivityBarTab('search'); setIsSideBarVisible(true); break;
      case 'git': setActivityBarTab('git'); setIsSideBarVisible(true); break;
      case 'ai': setActivityBarTab('ai'); setIsSideBarVisible(true); break;
      case 'settings': setIsSettingsOpen(true); break;
      case 'terminal': setIsTerminalVisible(!isTerminalVisible); break;
      case 'auto-mode': setIsAutoMode(!isAutoMode); break;
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden select-none transition-colors duration-300",
      theme === 'light' ? 'bg-zinc-50 text-zinc-900' : 'bg-[#1e1e1e] text-zinc-100'
    )}>
      <Toaster position="top-right" theme={theme === 'light' ? 'light' : 'dark'} richColors />
      
      <TitleBar 
        currentFile={currentFile}
        isAutoMode={isAutoMode}
        onAutoModeToggle={() => setIsAutoMode(!isAutoMode)}
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <ActivityBar 
          activeTab={activityBarTab}
          setActiveTab={setActivityBarTab}
          isSideBarVisible={isSideBarVisible}
          setIsSideBarVisible={setIsSideBarVisible}
          onSettingsOpen={() => setIsSettingsOpen(true)}
        />

        <SideBar 
          activeTab={activityBarTab}
          isSideBarVisible={isSideBarVisible}
          setIsSideBarVisible={setIsSideBarVisible}
          files={files}
          openFile={openFile}
          currentFile={currentFile}
          chatHistory={chatHistory}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleChatSubmit={handleChatSubmit}
          isAiLoading={isAiLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isRepo={isRepo}
          gitStatus={gitStatus}
          gitCommitMessage={gitCommitMessage}
          setGitCommitMessage={setGitCommitMessage}
          handleGitCommit={handleGitCommit}
          gitCloneUrl={gitCloneUrl}
          setGitCloneUrl={setGitCloneUrl}
          handleGitClone={handleGitClone}
          isGitLoading={isGitLoading}
          leftWidth={leftWidth}
          setLeftWidth={setLeftWidth}
        />

        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#1e1e1e]">
          <EditorArea 
            openFiles={openFiles}
            currentFile={currentFile}
            openFile={openFile}
            closeFile={closeFile}
            fileContent={fileContent}
            saveFile={saveFile}
            theme={theme}
          />

          <BottomPanel 
            activeBottomTab={activeBottomTab}
            setActiveBottomTab={setActiveBottomTab}
            terminalRef={terminalRef}
            systemStats={systemStats}
            isTerminalVisible={isTerminalVisible}
            setIsTerminalVisible={setIsTerminalVisible}
          />
        </div>

        <RightPanel 
          outputTab={outputTab}
          setOutputTab={setOutputTab}
          rightWidth={rightWidth}
          setRightWidth={setRightWidth}
        />
      </div>

      <StatusBar 
        gitBranch="main"
        isOffline={isOffline}
        isAutoMode={isAutoMode}
        autoModeState={autoModeState}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={autoModeConfig}
        setConfig={setAutoModeConfig}
        theme={theme}
        setTheme={setTheme}
      />

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onCommand={handleCommand}
        files={files}
        openFile={openFile}
      />
    </div>
  );
}
