import React from 'react';
import { Terminal as TerminalIcon, Monitor, Code2, Cpu, Activity, Layers, RefreshCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomPanelProps {
  activeBottomTab: string;
  setActiveBottomTab: (tab: string) => void;
  terminalRef: React.RefObject<HTMLDivElement | null>;
  systemStats: { cpu: string, ram: string, processes: number };
  isTerminalVisible: boolean;
  setIsTerminalVisible: (visible: boolean) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  activeBottomTab,
  setActiveBottomTab,
  terminalRef,
  systemStats,
  isTerminalVisible,
  setIsTerminalVisible
}) => {
  return (
    <div className={cn("h-80 glass-dark border-t border-white/5 flex flex-col overflow-hidden select-none z-10 shadow-2xl backdrop-blur-3xl", !isTerminalVisible && "hidden")}>
      {/* Tabs */}
      <div className="flex items-center justify-between px-8 bg-black/40 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="flex items-center space-x-10">
          {[
            { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
            { id: 'output', label: 'System Stats', icon: Monitor },
            { id: 'debug', label: 'Debug Console', icon: Code2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveBottomTab(tab.id)}
              className={cn(
                "flex items-center space-x-3 py-4 text-[12px] font-black uppercase tracking-[0.2em] transition-all relative group",
                activeBottomTab === tab.id 
                  ? "text-blue-400" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon size={18} className={cn("transition-all duration-300", activeBottomTab === tab.id ? "scale-110" : "group-hover:scale-125 group-hover:rotate-6")} />
              <span>{tab.label}</span>
              {activeBottomTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-full shadow-[0_-4px_15px_rgba(59,130,246,0.8)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all hover:rotate-180 duration-500">
            <RefreshCw size={18} />
          </button>
          <button 
            onClick={() => setIsTerminalVisible(false)}
            className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white transition-all hover:scale-110"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-black/20">
        <div 
          ref={terminalRef} 
          className={cn(
            "absolute inset-0 p-6 custom-scrollbar transition-all duration-500 ease-out", 
            activeBottomTab === 'terminal' ? "opacity-100 translate-y-0 z-10" : "opacity-0 translate-y-4 -z-10 pointer-events-none"
          )} 
        />
        
        {activeBottomTab === 'output' && (
          <div className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'CPU Load', value: systemStats.cpu, icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10', progress: 12, glow: 'shadow-blue-500/20' },
                { label: 'RAM Usage', value: systemStats.ram, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', progress: 26, glow: 'shadow-emerald-500/20' },
                { label: 'Active Tasks', value: systemStats.processes.toString(), icon: Layers, color: 'text-amber-400', bg: 'bg-amber-500/10', progress: 42, glow: 'shadow-amber-500/20' },
              ].map((stat, idx) => (
                <div key={idx} className={cn("glass border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all group shadow-2xl relative overflow-hidden", stat.glow)}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent -mr-16 -mt-16 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between mb-6 relative">
                    <div className={cn("p-4 rounded-2xl shadow-inner ring-1 ring-white/10", stat.bg)}>
                      <stat.icon size={28} className={cn(stat.color, "animate-pulse")} />
                    </div>
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">{stat.label}</span>
                  </div>
                  <div className="space-y-6 relative">
                    <div className="text-4xl font-black text-white tracking-tighter">{stat.value}</div>
                    <div className="h-2.5 w-full bg-black/60 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
                      <div 
                        className={cn("h-full transition-all duration-1000 rounded-full relative", stat.color.replace('text', 'bg'))}
                        style={{ width: `${stat.progress}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeBottomTab === 'debug' && (
          <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-zinc-500 space-y-8 animate-fade-in">
            <div className="relative">
              <div className="p-12 rounded-full glass border border-white/10 shadow-2xl backdrop-blur-3xl">
                <Code2 size={80} strokeWidth={1} className="opacity-20 animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-[16px] font-black text-zinc-400 tracking-[0.2em] uppercase">Debugger Offline</h3>
              <p className="text-[13px] text-zinc-600 max-w-[280px] leading-relaxed font-medium">
                Initialize a debug session to inspect runtime variables and stack traces.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
