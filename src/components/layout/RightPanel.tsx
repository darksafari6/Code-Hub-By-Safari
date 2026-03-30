import React from 'react';
import { Globe, Terminal as TerminalIcon, RefreshCw, ExternalLink, Lock, ChevronRight, ChevronDown, Play, Square, Monitor, Code2, Cpu, Activity, Layers, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RightPanelProps {
  outputTab: string;
  setOutputTab: (tab: string) => void;
  rightWidth: number;
  setRightWidth: (width: number) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  outputTab,
  setOutputTab,
  rightWidth,
  setRightWidth
}) => {
  return (
    <div 
      className="glass-dark border-l border-white/5 flex flex-col h-full overflow-hidden select-none z-10 shadow-2xl"
      style={{ width: rightWidth }}
    >
      {/* Tabs */}
      <div className="flex items-center justify-between px-6 bg-black/20 border-b border-white/5">
        <div className="flex items-center space-x-8">
          {[
            { id: 'preview', label: 'Live Preview', icon: Globe },
            { id: 'console', label: 'Console', icon: TerminalIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setOutputTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 py-3 text-[12px] font-bold uppercase tracking-widest transition-all relative group",
                outputTab === tab.id 
                  ? "text-blue-400" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon size={16} className={cn("transition-transform", outputTab === tab.id ? "" : "group-hover:scale-110")} />
              <span>{tab.label}</span>
              {outputTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
            <RefreshCw size={16} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-transparent">
        {outputTab === 'preview' && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center px-4 py-3 bg-black/20 border-b border-white/5 space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-inner" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-inner" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-inner" />
              </div>
              <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-1.5 space-x-3 shadow-inner group focus-within:border-blue-500/50 focus-within:bg-white/10 transition-all">
                <Lock size={14} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                <span className="text-[13px] text-zinc-300 truncate font-medium tracking-wide">localhost:3000</span>
              </div>
              <RefreshCw size={16} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
            </div>
            <iframe 
              id="preview-iframe"
              src="/preview/index.html" 
              className="flex-1 w-full border-none bg-white"
              title="Live Preview"
            />
          </div>
        )}
        
        {outputTab === 'console' && (
          <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar font-mono text-[13px] space-y-4 bg-transparent">
            <div className="flex items-center space-x-3 text-zinc-500 mb-8 border-b border-white/5 pb-4">
              <TerminalIcon size={16} />
              <span className="uppercase text-[11px] font-bold tracking-widest">Browser Console</span>
            </div>
            <div className="space-y-2">
              {[
                { type: 'INFO', time: '14:25:16', msg: 'App mounted successfully', color: 'text-emerald-400' },
                { type: 'INFO', time: '14:25:17', msg: 'WebSocket connected to dev server', color: 'text-emerald-400' },
                { type: 'LOG', time: '14:25:18', msg: 'Initial state loaded: 42 files found', color: 'text-blue-400' },
                { type: 'WARN', time: '14:25:20', msg: 'HMR is disabled in this environment', color: 'text-amber-400' },
                { type: 'LOG', time: '14:25:22', msg: 'Rendering main component...', color: 'text-blue-400' },
              ].map((log, idx) => (
                <div key={idx} className="flex space-x-4 py-2 px-3 hover:bg-white/5 rounded-lg transition-colors group">
                  <span className={cn("font-bold min-w-[48px]", log.color)}>{log.type}</span>
                  <span className="text-zinc-600 group-hover:text-zinc-500">[{log.time}]</span>
                  <span className="text-zinc-300 leading-relaxed">{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
