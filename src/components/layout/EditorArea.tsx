import React from 'react';
import Editor from '@monaco-editor/react';
import { X, FileCode, ChevronRight, Code2, Copy, Download, Check, Plus, Search, Terminal, Activity, Cpu, Layers, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface EditorAreaProps {
  openFiles: string[];
  currentFile: string | null;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  fileContent: string;
  saveFile: (content: string) => void;
  theme: string;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  openFiles,
  currentFile,
  openFile,
  closeFile,
  fileContent,
  saveFile,
  theme
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.split('/').pop() || 'code.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden relative">
      {/* Tabs */}
      <div className="flex bg-[#0a0a0a] overflow-x-auto no-scrollbar border-b border-white/5 h-12">
        {openFiles.map((file) => (
          <div
            key={file}
            onClick={() => openFile(file)}
            className={cn(
              "flex items-center px-6 py-3 cursor-pointer border-r border-white/5 min-w-[140px] max-w-[240px] group transition-all relative",
              currentFile === file 
                ? "bg-[#111111] text-blue-400" 
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            )}
          >
            {currentFile === file && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_2px_10px_rgba(59,130,246,0.5)]" />
            )}
            <FileCode size={16} className={cn("mr-3 flex-shrink-0 transition-colors", currentFile === file ? "text-blue-400" : "text-zinc-600")} />
            <span className="text-[13px] truncate font-bold tracking-tight">{file.split('/').pop()}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file);
              }}
              className="ml-3 p-1 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:rotate-90"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between px-6 py-2 bg-[#111111] border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center text-[12px] text-zinc-500 font-medium">
          <span className="hover:text-zinc-300 cursor-pointer transition-colors uppercase tracking-widest text-[10px] font-black">Workspace</span>
          {currentFile?.split('/').map((part, idx) => (
            <React.Fragment key={idx}>
              {part && (
                <>
                  <ChevronRight size={14} className="mx-2 opacity-30" />
                  <span className="hover:text-zinc-300 cursor-pointer transition-colors">{part}</span>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
        
        {currentFile && (
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleCopy}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[11px] uppercase tracking-[0.15em] font-black transition-all border border-white/5 shadow-xl hover:scale-105 active:scale-95"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[11px] uppercase tracking-[0.15em] font-black transition-all border border-white/5 shadow-xl hover:scale-105 active:scale-95"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {!currentFile ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#0a0a0a] relative overflow-hidden h-full">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]" />
            
            <div className="z-10 w-full max-w-5xl space-y-12 animate-fade-in">
              <div className="text-center space-y-4">
                <h1 className="text-6xl font-black tracking-tighter gradient-text animate-float">
                  Safari AI Studio
                </h1>
                <p className="text-zinc-500 text-lg font-medium max-w-2xl mx-auto">
                  The futuristic development environment powered by advanced AI. 
                  Start building your next masterpiece today.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 glass-card p-8 group hover:border-blue-500/30 transition-all duration-500 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Code2 size={120} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 flex items-center">
                    <FileCode className="mr-3 text-blue-400" />
                    Recent Files
                  </h3>
                  <div className="space-y-3 mt-6">
                    {openFiles.length > 0 ? (
                      openFiles.map(file => (
                        <div 
                          key={file}
                          onClick={() => openFile(file)}
                          className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 cursor-pointer border border-white/5 transition-all"
                        >
                          <span className="text-zinc-300 font-medium">{file.split('/').pop()}</span>
                          <ChevronRight size={16} className="text-zinc-600" />
                        </div>
                      ))
                    ) : (
                      <p className="text-zinc-600 italic">No recent files. Open one from the explorer.</p>
                    )}
                  </div>
                </div>

                <div className="glass-card p-8 group hover:border-purple-500/30 transition-all duration-500">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Activity className="mr-3 text-purple-400" />
                    Quick Actions
                  </h3>
                  <div className="space-y-4">
                    <button className="w-full flex items-center space-x-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <Plus size={18} />
                      </div>
                      <span className="text-zinc-300 font-bold text-sm">New File</span>
                    </button>
                    <button className="w-full flex items-center space-x-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                      <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <Search size={18} />
                      </div>
                      <span className="text-zinc-300 font-bold text-sm">Search All</span>
                    </button>
                    <button className="w-full flex items-center space-x-4 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                      <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                        <Terminal size={18} />
                      </div>
                      <span className="text-zinc-300 font-bold text-sm">Open Terminal</span>
                    </button>
                  </div>
                </div>

                <div className="glass-card p-8 group hover:border-indigo-500/30 transition-all duration-500">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Cpu className="mr-3 text-indigo-400" />
                    AI Insights
                  </h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                    Your AI assistant is ready to help you write, debug, and optimize your code.
                  </p>
                  <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">System Ready</span>
                    </div>
                    <p className="text-[12px] text-zinc-400 italic">"Try asking me to refactor a function or explain a complex logic."</p>
                  </div>
                </div>

                <div className="md:col-span-2 glass-card p-8 group hover:border-pink-500/30 transition-all duration-500 flex items-center justify-between">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <Layers className="mr-3 text-pink-400" />
                      Keyboard Shortcuts
                    </h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Command Palette</span>
                        <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 text-xs">⌘ K</kbd>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Save File</span>
                        <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 text-xs">⌘ S</kbd>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Toggle Sidebar</span>
                        <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 text-xs">⌘ B</kbd>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Quick Open</span>
                        <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 text-zinc-400 text-xs">⌘ P</kbd>
                      </div>
                    </div>
                  </div>
                  <div className="hidden lg:block p-6 bg-pink-500/10 rounded-full border border-pink-500/20">
                    <Settings size={48} className="text-pink-400 animate-spin-slow" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            path={currentFile}
            defaultLanguage="typescript"
            value={fileContent}
            onChange={(value) => saveFile(value || '')}
            options={{
              minimap: { enabled: true, scale: 0.75, side: 'right' },
              fontSize: 15,
              fontFamily: 'JetBrains Mono, monospace',
              lineNumbers: 'on',
              roundedSelection: true,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              padding: { top: 24, bottom: 24 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              contextmenu: true,
              renderLineHighlight: 'all',
              lineHeight: 24,
              letterSpacing: 0.5,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
