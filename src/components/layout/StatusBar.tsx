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
    <div className="h-8 glass-dark border-t border-white/5 text-zinc-300 flex items-center justify-between px-4 text-[11px] font-medium select-none z-30 shadow-inner">
      <div className="flex items-center space-x-4 h-full">
        <button className="flex items-center space-x-2 hover:bg-white/10 hover:text-white px-3 rounded-md h-6 transition-all group">
          <GitBranch size={14} className="group-hover:scale-110 transition-transform text-blue-400" />
          <span className="tracking-wide">{gitBranch}</span>
        </button>
        <button className="flex items-center space-x-2 hover:bg-white/10 hover:text-white px-3 rounded-md h-6 transition-all group">
          <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500 text-emerald-400" />
          <span className="tracking-wide">Syncing...</span>
        </button>
        <div className="flex items-center space-x-2 px-3 h-6 border-l border-white/10 ml-2">
          <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", isOffline ? "bg-red-500 shadow-red-500/50" : "bg-emerald-500 shadow-emerald-500/50")} />
          <span className="tracking-wide">{isOffline ? 'Offline' : 'Connected'}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4 h-full">
        {isAutoMode && (
          <div className="flex items-center space-x-2 px-3 h-6 bg-blue-500/10 text-blue-400 rounded-md animate-pulse border border-blue-500/20">
            <Activity size={14} />
            <span className="uppercase tracking-widest font-bold text-[10px]">Auto Mode: {autoModeState}</span>
          </div>
        )}
        <div className="flex items-center space-x-6 px-4 h-6 border-r border-white/10 mr-2 text-zinc-400">
          <span className="hover:text-white cursor-pointer transition-colors">Ln 42, Col 18</span>
          <span className="hover:text-white cursor-pointer transition-colors">Spaces: 2</span>
          <span className="hover:text-white cursor-pointer transition-colors">UTF-8</span>
          <span className="hover:text-white cursor-pointer transition-colors">TypeScript JSX</span>
        </div>
        <button className="flex items-center space-x-2 hover:bg-white/10 hover:text-white px-3 rounded-md h-6 transition-all group relative">
          <Bell size={14} className="group-hover:animate-bounce" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </button>
        <button className="flex items-center space-x-2 hover:bg-white/10 hover:text-white px-3 rounded-md h-6 transition-all group">
          <Check size={14} className="text-emerald-400" />
          <span className="tracking-wide">Prettier</span>
        </button>
      </div>
    </div>
  );
};
