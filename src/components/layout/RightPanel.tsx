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
      className="glass-dark border-l border-white/5 flex flex-col h-full overflow-hidden select-none z-10 shadow-2xl backdrop-blur-3xl"
      style={{ width: rightWidth }}
    >
      {/* Tabs */}
      <div className="flex items-center justify-between px-8 bg-black/40 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="flex items-center space-x-10">
          {[
            { id: 'preview', label: 'Live Preview', icon: Globe },
            { id: 'console', label: 'Console', icon: TerminalIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setOutputTab(tab.id)}
              className={cn(
                "flex items-center space-x-3 py-4 text-[12px] font-black uppercase tracking-[0.2em] transition-all relative group",
                outputTab === tab.id 
                  ? "text-blue-400" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon size={18} className={cn("transition-all duration-300", outputTab === tab.id ? "scale-110" : "group-hover:scale-125 group-hover:rotate-6")} />
              <span>{tab.label}</span>
              {outputTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-full shadow-[0_-4px_15px_rgba(59,130,246,0.8)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all hover:rotate-180 duration-500">
            <RefreshCw size={18} />
          </button>
          <button className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all hover:scale-110">
            <ExternalLink size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-black/20">
        {outputTab === 'preview' && (
          <div className="absolute inset-0 flex flex-col animate-fade-in">
            <div className="flex items-center px-6 py-4 bg-black/40 border-b border-white/5 space-x-6 backdrop-blur-xl">
              <div className="flex items-center space-x-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 shadow-lg shadow-red-500/20" />
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80 shadow-lg shadow-amber-500/20" />
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 shadow-lg shadow-emerald-500/20" />
              </div>
              <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-2xl px-5 py-2 space-x-4 shadow-inner group focus-within:border-blue-500/50 focus-within:bg-white/10 transition-all ring-1 ring-white/5">
                <Lock size={16} className="text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                <span className="text-[14px] text-zinc-300 truncate font-bold tracking-wide">localhost:3000</span>
              </div>
              <RefreshCw size={18} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-all hover:rotate-180 duration-700" />
            </div>
            <div className="flex-1 w-full bg-white relative group">
              <iframe 
                id="preview-iframe"
                src="/preview/index.html" 
                className="w-full h-full border-none"
                title="Live Preview"
              />
              <div className="absolute inset-0 pointer-events-none border-[8px] border-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
        
        {outputTab === 'console' && (
          <div className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar font-mono text-[14px] space-y-6 bg-transparent animate-fade-in">
            <div className="flex items-center space-x-4 text-zinc-500 mb-10 border-b border-white/5 pb-6">
              <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                <TerminalIcon size={20} className="text-blue-400" />
              </div>
              <span className="uppercase text-[12px] font-black tracking-[0.2em] text-zinc-400">Browser Console Output</span>
            </div>
            <div className="space-y-3">
              {[
                { type: 'INFO', time: '14:25:16', msg: 'App mounted successfully', color: 'text-emerald-400', bg: 'bg-emerald-400/5' },
                { type: 'INFO', time: '14:25:17', msg: 'WebSocket connected to dev server', color: 'text-emerald-400', bg: 'bg-emerald-400/5' },
                { type: 'LOG', time: '14:25:18', msg: 'Initial state loaded: 42 files found', color: 'text-blue-400', bg: 'bg-blue-400/5' },
                { type: 'WARN', time: '14:25:20', msg: 'HMR is disabled in this environment', color: 'text-amber-400', bg: 'bg-amber-400/5' },
                { type: 'LOG', time: '14:25:22', msg: 'Rendering main component...', color: 'text-blue-400', bg: 'bg-blue-400/5' },
              ].map((log, idx) => (
                <div key={idx} className={cn("flex space-x-6 py-3.5 px-5 rounded-2xl transition-all group border border-transparent hover:border-white/5", log.bg)}>
                  <span className={cn("font-black min-w-[60px] text-[12px] tracking-widest", log.color)}>{log.type}</span>
                  <span className="text-zinc-600 group-hover:text-zinc-500 font-bold">[{log.time}]</span>
                  <span className="text-zinc-300 leading-relaxed font-medium">{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
