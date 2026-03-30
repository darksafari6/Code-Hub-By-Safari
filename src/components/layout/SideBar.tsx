import React from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, RefreshCw, Plus, Search as SearchIcon, GitBranch, MessageSquare, X, Send, Activity, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SideBarProps {
  activeTab: string;
  isSideBarVisible: boolean;
  setIsSideBarVisible: (visible: boolean) => void;
  leftWidth: number;
  setLeftWidth: (width: number) => void;
  files: any[];
  currentFile: string | null;
  openFile: (path: string) => void;
  chatHistory: { role: string, content: string }[];
  chatInput: string;
  setChatInput: (input: string) => void;
  handleChatSubmit: (e: React.FormEvent) => void;
  isAiLoading: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isRepo: boolean;
  gitStatus: any[];
  gitCommitMessage: string;
  setGitCommitMessage: (msg: string) => void;
  handleGitCommit: () => void;
  gitCloneUrl: string;
  setGitCloneUrl: (url: string) => void;
  handleGitClone: () => void;
  isGitLoading: boolean;
}

export const SideBar: React.FC<SideBarProps> = ({
  activeTab,
  isSideBarVisible,
  setIsSideBarVisible,
  leftWidth,
  setLeftWidth,
  files,
  currentFile,
  openFile,
  chatHistory,
  chatInput,
  setChatInput,
  handleChatSubmit,
  isAiLoading,
  selectedModel,
  setSelectedModel,
  isRepo,
  gitStatus,
  gitCommitMessage,
  setGitCommitMessage,
  handleGitCommit,
  gitCloneUrl,
  setGitCloneUrl,
  handleGitClone,
  isGitLoading
}) => {
  if (!isSideBarVisible) return null;

  const renderFileTree = (items: any[], depth = 0) => {
    return items.map((item, idx) => (
      <div key={idx}>
        <div
          onClick={() => item.type === 'file' ? openFile(item.path) : null}
          className={cn(
            "flex items-center py-1.5 px-3 mx-2 rounded-lg cursor-pointer transition-all group text-[13px] font-medium",
            currentFile === item.path 
              ? "bg-blue-500/10 text-blue-400" 
              : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {item.type === 'directory' ? (
            <ChevronRight size={14} className="mr-2 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
          ) : (
            <FileCode size={14} className={cn("mr-2 transition-colors", currentFile === item.path ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400")} />
          )}
          <span className="truncate">{item.name}</span>
        </div>
        {item.children && renderFileTree(item.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div 
      className="glass border-r border-white/5 flex flex-col h-full overflow-hidden select-none relative shadow-2xl backdrop-blur-3xl"
      style={{ width: leftWidth }}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-black/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-zinc-300 drop-shadow-sm">
          {activeTab === 'explorer' && 'Explorer'}
          {activeTab === 'search' && 'Search'}
          {activeTab === 'git' && 'Source Control'}
          {activeTab === 'ai' && 'AI Assistant'}
        </h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsSideBarVisible(false)}
            className="p-2 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all duration-300 hover:rotate-90"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {activeTab === 'explorer' && (
          <div className="py-4">
            <div className="px-6 py-2.5 flex items-center text-[12px] font-black text-zinc-500 uppercase tracking-[0.15em] mb-2 hover:text-zinc-300 cursor-pointer transition-all group">
              <ChevronDown size={14} className="mr-2 group-hover:translate-y-0.5 transition-transform" />
              Workspace
            </div>
            {renderFileTree(files)}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="p-6 space-y-6">
            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <SearchIcon size={14} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-10 py-2.5 text-[13px] text-white outline-none transition-all shadow-inner backdrop-blur-md"
                />
              </div>
              <input 
                type="text" 
                placeholder="Replace" 
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-[13px] text-white outline-none transition-all shadow-inner backdrop-blur-md"
              />
            </div>
            <div className="text-center py-16 text-zinc-500 text-[13px] font-medium italic opacity-40">
              No search results yet.
            </div>
          </div>
        )}

        {activeTab === 'git' && (
          <div className="p-6 space-y-8">
            {!isRepo ? (
              <div className="text-center space-y-6 py-16">
                <div className="relative inline-block">
                  <GitBranch size={64} className="mx-auto text-blue-500/20 mb-4 animate-pulse" />
                  <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                </div>
                <p className="text-[14px] text-zinc-400 px-6 leading-relaxed font-medium">
                  The current workspace is not a Git repository.
                </p>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Repository URL" 
                    value={gitCloneUrl}
                    onChange={(e) => setGitCloneUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-[13px] text-white outline-none transition-all shadow-inner"
                  />
                  <button 
                    onClick={handleGitClone}
                    disabled={isGitLoading || !gitCloneUrl}
                    className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 text-white text-[14px] font-bold py-3 rounded-xl transition-all shadow-2xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isGitLoading ? 'Cloning...' : 'Clone Repository'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <textarea 
                    value={gitCommitMessage}
                    onChange={(e) => setGitCommitMessage(e.target.value)}
                    placeholder="Message (Cmd+Enter to commit)" 
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-xl px-4 py-3 text-[13px] text-white outline-none resize-none h-32 transition-all placeholder-zinc-600 shadow-inner custom-scrollbar"
                  />
                  <button 
                    onClick={handleGitCommit}
                    disabled={!gitCommitMessage.trim() || isGitLoading}
                    className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 text-white text-[14px] font-bold py-3 rounded-xl transition-all shadow-2xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isGitLoading ? 'Committing...' : 'Commit Changes'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[12px] font-black text-zinc-500 uppercase tracking-[0.15em] px-1">
                    <span>Changes</span>
                    <span className="bg-white/10 px-2 py-0.5 rounded-lg text-zinc-300 border border-white/5">{gitStatus.length}</span>
                  </div>
                  <div className="space-y-1">
                    {gitStatus.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2.5 px-3 hover:bg-white/5 rounded-xl cursor-pointer group transition-all border border-transparent hover:border-white/5">
                        <div className="flex items-center space-x-3 min-w-0">
                          <FileCode size={16} className="text-zinc-500 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                          <span className="text-[13px] text-zinc-300 truncate font-medium">{item[0]}</span>
                        </div>
                        <span className="text-[11px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20 flex-shrink-0">M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col h-full relative">
            <div className="p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl shadow-inner ring-1 ring-blue-500/20">
                    <Activity size={18} className="text-blue-400 animate-pulse" />
                  </div>
                  <span className="text-[14px] font-black tracking-[0.1em] text-zinc-200">AI ASSISTANT</span>
                </div>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-white/5 border border-white/10 text-[12px] font-bold text-zinc-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-500/50 transition-all cursor-pointer hover:bg-white/10 shadow-xl"
                >
                  <option value="DeepSeek-Coder" className="bg-[#1e1e1e]">DeepSeek Coder</option>
                  <option value="Gemini-Flash" className="bg-[#1e1e1e]">Gemini Flash</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
                  Explain Code
                </button>
                <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition-all">
                  Fix Bugs
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-6 opacity-40">
                  <div className="relative">
                    <MessageSquare size={64} strokeWidth={1} />
                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                  </div>
                  <p className="text-[14px] text-center max-w-[220px] font-medium leading-relaxed">I am your AI co-pilot. How can I accelerate your development today?</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex flex-col space-y-2.5 max-w-[92%] animate-fade-in",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "px-5 py-4 rounded-2xl text-[14px] leading-relaxed shadow-2xl backdrop-blur-2xl border transition-all duration-300",
                      msg.role === 'user' 
                        ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-sm border-blue-400/30 shadow-blue-500/20" 
                        : "bg-white/5 text-zinc-200 rounded-tl-sm border-white/10 hover:bg-white/10"
                    )}>
                      {msg.content}
                    </div>
                    <div className="flex items-center space-x-2 px-2">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">
                        {msg.role === 'user' ? 'YOU' : 'AI ENGINE'}
                      </span>
                      {msg.role === 'ai' && <div className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />}
                    </div>
                  </div>
                ))
              )}
              {isAiLoading && (
                <div className="flex flex-col space-y-2.5 max-w-[92%] animate-pulse mr-auto items-start">
                  <div className="px-5 py-4 rounded-2xl text-[14px] leading-relaxed shadow-2xl backdrop-blur-2xl border bg-white/5 text-zinc-400 rounded-tl-sm border-white/10 flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    </div>
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-xl">
              <form onSubmit={handleChatSubmit} className="relative group">
                <textarea 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Describe your task or ask a question..." 
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 rounded-2xl px-5 py-4 text-[14px] text-zinc-200 outline-none resize-none h-32 transition-all placeholder-zinc-600 pr-14 custom-scrollbar shadow-2xl ring-1 ring-white/5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isAiLoading}
                  className="absolute right-4 bottom-4 p-3 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-30 disabled:grayscale text-white rounded-xl transition-all shadow-2xl shadow-blue-900/40 hover:scale-110 active:scale-90"
                >
                  {isAiLoading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} className={cn(chatInput.trim() ? "translate-x-0.5 -translate-y-0.5 transition-transform duration-300" : "")} />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
