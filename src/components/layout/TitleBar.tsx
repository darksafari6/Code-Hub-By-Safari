import React from 'react';
import { Play, Square, RefreshCw, ExternalLink, Globe, Lock, User, MoreVertical, Files, Search, Monitor, Code2, Cpu, Activity, Layers, X, Minus, Plus, Check, Bell, Settings, Layout, MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TitleBarProps {
  currentFile: string | null;
  isAutoMode: boolean;
  onAutoModeToggle: () => void;
  onMenuToggle: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentFile,
  isAutoMode,
  onAutoModeToggle,
  onMenuToggle
}) => {
  return (
    <div className="h-14 glass-dark border-b border-white/5 flex items-center justify-between px-6 select-none z-30 shadow-sm sticky top-0">
      <div className="flex items-center space-x-6 h-full">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        </div>
        
        <div className="flex items-center space-x-3 text-[13px] font-semibold text-zinc-400 border-l border-white/10 pl-6">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
            <Code2 size={16} className="text-white" />
          </div>
          <span className="text-white tracking-tight">Safari AI Studio</span>
          {currentFile && (
            <>
              <ChevronRight size={14} className="opacity-40" />
              <span className="text-zinc-500 truncate max-w-[200px] font-medium">{currentFile.split('/').pop()}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex justify-center px-8">
        <div className="w-full max-w-2xl relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={16} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search files, commands, or ask AI..." 
            className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 rounded-xl px-12 py-2 text-[13px] text-zinc-200 outline-none transition-all placeholder-zinc-500 shadow-inner backdrop-blur-md"
          />
          <div className="absolute inset-y-0 right-4 flex items-center space-x-2">
            <span className="text-[10px] font-bold text-zinc-500 bg-black/40 px-2 py-1 rounded-md border border-white/5 shadow-sm">⌘ K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 h-full">
        <button 
          onClick={onAutoModeToggle}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest transition-all shadow-lg",
            isAutoMode 
              ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
              : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
          )}
        >
          {isAutoMode ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          <span>{isAutoMode ? 'Stop Auto' : 'Start Auto'}</span>
        </button>
        
        <div className="flex items-center space-x-2 border-l border-white/10 pl-4">
          <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all">
            <Layout size={18} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all">
            <User size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
