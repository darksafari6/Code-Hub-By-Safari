import React from 'react';
import { GitBranch, RefreshCw, Bell, Check, Globe, Layout, Settings, User, MoreVertical, Files, Search, Monitor, Code2, Cpu, Activity, Layers, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatusBarProps {
  gitBranch: string;
  isOffline: boolean;
  isAutoMode: boolean;
  autoModeState: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gitBranch,
  isOffline,
  isAutoMode,
  autoModeState
}) => {
  return (
    <div className="h-10 glass-dark border-t border-white/5 text-zinc-400 flex items-center justify-between px-6 text-[11px] font-black select-none z-30 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="flex items-center space-x-6 h-full">
        <button className="flex items-center space-x-2.5 hover:bg-white/5 hover:text-white px-4 rounded-xl h-7 transition-all group border border-transparent hover:border-white/5">
          <GitBranch size={16} className="group-hover:scale-110 transition-transform text-blue-500" />
          <span className="tracking-[0.1em] uppercase">{gitBranch}</span>
        </button>
        <button className="flex items-center space-x-2.5 hover:bg-white/5 hover:text-white px-4 rounded-xl h-7 transition-all group border border-transparent hover:border-white/5">
          <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700 text-emerald-500" />
          <span className="tracking-[0.1em] uppercase">Syncing...</span>
        </button>
        <div className="flex items-center space-x-3 px-4 h-7 border-l border-white/10 ml-2">
          <div className={cn("w-2 h-2 rounded-full shadow-lg", isOffline ? "bg-red-500 shadow-red-500/50" : "bg-emerald-500 shadow-emerald-500/50 animate-pulse")} />
          <span className="tracking-[0.1em] uppercase text-zinc-500">{isOffline ? 'Offline' : 'Connected'}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-6 h-full">
        {isAutoMode && (
          <div className="flex items-center space-x-3 px-4 h-7 bg-blue-500/10 text-blue-400 rounded-xl animate-pulse border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Activity size={14} />
            <span className="uppercase tracking-[0.2em] font-black text-[9px]">Auto Mode: {autoModeState}</span>
          </div>
        )}
        <div className="flex items-center space-x-8 px-6 h-7 border-r border-white/10 mr-2 text-zinc-500 font-bold">
          <span className="hover:text-white cursor-pointer transition-colors tracking-widest">LN 42, COL 18</span>
          <span className="hover:text-white cursor-pointer transition-colors tracking-widest">SPACES: 2</span>
          <span className="hover:text-white cursor-pointer transition-colors tracking-widest uppercase">UTF-8</span>
          <span className="hover:text-white cursor-pointer transition-colors tracking-widest uppercase">TypeScript JSX</span>
        </div>
        <button className="flex items-center space-x-2.5 hover:bg-white/5 hover:text-white px-4 rounded-xl h-7 transition-all group relative border border-transparent hover:border-white/5">
          <Bell size={16} className="group-hover:animate-bounce" />
          <span className="absolute top-1.5 right-3 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)] border border-white/20" />
        </button>
        <button className="flex items-center space-x-2.5 hover:bg-white/5 hover:text-white px-4 rounded-xl h-7 transition-all group border border-transparent hover:border-white/5">
          <Check size={16} className="text-emerald-500" />
          <span className="tracking-[0.1em] uppercase">Prettier</span>
        </button>
      </div>
    </div>
  );
};
