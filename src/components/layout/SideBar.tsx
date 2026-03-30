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
      className="glass border-r border-white/5 flex flex-col h-full overflow-hidden select-none relative shadow-xl"
      style={{ width: leftWidth }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-400">
          {activeTab === 'explorer' && 'Explorer'}
          {activeTab === 'search' && 'Search'}
          {activeTab === 'git' && 'Source Control'}
          {activeTab === 'ai' && 'AI Assistant'}
        </h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsSideBarVisible(false)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'explorer' && (
          <div className="py-2">
            <div className="px-5 py-2 flex items-center text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1 hover:text-zinc-300 cursor-pointer transition-colors">
              <ChevronDown size={12} className="mr-1" />
              Workspace
            </div>
            {renderFileTree(files)}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-[#252526] border border-zinc-800 focus:border-blue-500/50 rounded px-3 py-1.5 text-[13px] text-white outline-none transition-all"
                />
              </div>
              <input 
                type="text" 
                placeholder="Replace" 
                className="w-full bg-[#252526] border border-zinc-800 focus:border-blue-500/50 rounded px-3 py-1.5 text-[13px] text-white outline-none transition-all"
              />
            </div>
            <div className="text-center py-10 text-zinc-500 text-[12px] italic">
              No search results yet.
            </div>
          </div>
        )}

        {activeTab === 'git' && (
          <div className="p-4 space-y-6">
            {!isRepo ? (
              <div className="text-center space-y-4 py-10">
                <GitBranch size={48} className="mx-auto text-zinc-700 mb-2 opacity-20" />
                <p className="text-[13px] text-zinc-400 px-4 leading-relaxed">
                  The current workspace is not a Git repository.
                </p>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Repository URL" 
                    value={gitCloneUrl}
                    onChange={(e) => setGitCloneUrl(e.target.value)}
                    className="w-full bg-[#252526] border border-zinc-800 focus:border-blue-500/50 rounded px-3 py-1.5 text-[13px] text-white outline-none transition-all"
                  />
                  <button 
                    onClick={handleGitClone}
                    disabled={isGitLoading || !gitCloneUrl}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[13px] font-medium py-2 rounded-md transition-all shadow-lg shadow-blue-900/20"
                  >
                    {isGitLoading ? 'Cloning...' : 'Clone Repository'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <textarea 
                    value={gitCommitMessage}
                    onChange={(e) => setGitCommitMessage(e.target.value)}
                    placeholder="Message (Cmd+Enter to commit)" 
                    className="w-full bg-[#252526] border border-zinc-800 focus:border-blue-500/50 rounded px-3 py-2 text-[13px] text-white outline-none resize-none h-24 transition-all placeholder-zinc-600"
                  />
                  <button 
                    onClick={handleGitCommit}
                    disabled={!gitCommitMessage.trim() || isGitLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[13px] font-medium py-2 rounded-md transition-all shadow-lg shadow-blue-900/20"
                  >
                    {isGitLoading ? 'Committing...' : 'Commit'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                    <span>Changes</span>
                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{gitStatus.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {gitStatus.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer group transition-colors">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileCode size={14} className="text-zinc-500 flex-shrink-0" />
                          <span className="text-[13px] text-zinc-300 truncate">{item[0]}</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 rounded flex-shrink-0">M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col h-full">
            <div className="p-5 border-b border-white/5 bg-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-blue-400">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg shadow-inner">
                    <Activity size={16} className="text-blue-400" />
                  </div>
                  <span className="text-[13px] font-bold tracking-wide">AI Assistant</span>
                </div>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-white/5 border border-white/10 text-[11px] text-zinc-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500/50 transition-all cursor-pointer hover:bg-white/10"
                >
                  <option value="DeepSeek-Coder" className="bg-zinc-900">DeepSeek Coder</option>
                  <option value="Gemini-Flash" className="bg-zinc-900">Gemini Flash</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 opacity-50">
                  <MessageSquare size={48} strokeWidth={1} />
                  <p className="text-[12px] text-center max-w-[200px]">How can I help you code today?</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={cn(
                    "flex flex-col space-y-2 max-w-[90%] animate-fade-in",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-lg backdrop-blur-md border",
                      msg.role === 'user' 
                        ? "bg-blue-600/90 text-white rounded-tr-sm border-blue-500/50" 
                        : "bg-white/5 text-zinc-200 rounded-tl-sm border-white/10"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-1">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-5 border-t border-white/5 bg-black/20">
              <form onSubmit={handleChatSubmit} className="relative group">
                <textarea 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question..." 
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 rounded-xl px-4 py-3 text-[13px] text-zinc-200 outline-none resize-none h-28 transition-all placeholder-zinc-500 pr-12 custom-scrollbar shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit(e);
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-3 bottom-3 p-2 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:from-zinc-700 disabled:to-zinc-800 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20"
                >
                  <Send size={16} className={cn(chatInput.trim() ? "translate-x-0.5 -translate-y-0.5 transition-transform" : "")} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
