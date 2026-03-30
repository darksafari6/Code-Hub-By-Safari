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
    <div className="h-16 glass-dark border-b border-white/5 flex items-center justify-between px-6 select-none z-30 shadow-2xl sticky top-0">
      <div className="flex items-center space-x-8 h-full">
        <div className="flex items-center space-x-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-500 transition-all cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.4)] hover:scale-110" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.4)] hover:scale-110" />
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:scale-110" />
        </div>
        
        <div className="flex items-center space-x-4 text-[14px] font-bold text-zinc-400 border-l border-white/10 pl-8">
          <div className="p-2 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-xl shadow-xl shadow-blue-500/30 ring-1 ring-white/20">
            <Code2 size={18} className="text-white" />
          </div>
          <span className="gradient-text tracking-tight text-lg">Safari AI Studio</span>
          {currentFile && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <ChevronRight size={14} className="opacity-40" />
              <span className="text-zinc-300 truncate max-w-[200px] font-medium">{currentFile.split('/').pop()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex justify-center px-12">
        <div className="w-full max-w-3xl relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-500 group-focus-within:text-blue-400 transition-all duration-300" />
          </div>
          <input 
            type="text" 
            placeholder="Search files, commands, or ask AI..." 
            className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/10 rounded-2xl px-14 py-2.5 text-[14px] text-zinc-200 outline-none transition-all placeholder-zinc-500 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5 focus:ring-blue-500/20"
          />
          <div className="absolute inset-y-0 right-5 flex items-center space-x-3">
            <span className="text-[11px] font-black text-zinc-400 bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 shadow-lg tracking-tighter">⌘ K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6 h-full">
        <button 
          onClick={onAutoModeToggle}
          className={cn(
            "flex items-center space-x-3 px-6 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-[0.1em] transition-all duration-500 shadow-2xl hover:scale-105 active:scale-95",
            isAutoMode 
              ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.3)]" 
              : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.3)]"
          )}
        >
          {isAutoMode ? <Square size={16} fill="currentColor" className="animate-pulse" /> : <Play size={16} fill="currentColor" />}
          <span>{isAutoMode ? 'Stop Auto' : 'Start Auto'}</span>
        </button>
        
        <div className="flex items-center space-x-3 border-l border-white/10 pl-6">
          <button className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-12">
            <Bell size={20} />
          </button>
          <button className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all duration-300 hover:rotate-90">
            <Settings size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-[1px] shadow-xl shadow-blue-500/20 cursor-pointer hover:scale-110 transition-all duration-300">
            <div className="w-full h-full rounded-xl bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
              <User size={22} className="text-zinc-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
