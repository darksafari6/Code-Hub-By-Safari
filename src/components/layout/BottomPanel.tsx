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
    <div className={cn("h-72 glass-dark border-t border-white/5 flex flex-col overflow-hidden select-none z-10 shadow-2xl", !isTerminalVisible && "hidden")}>
      {/* Tabs */}
      <div className="flex items-center justify-between px-6 bg-black/20 border-b border-white/5">
        <div className="flex items-center space-x-8">
          {[
            { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
            { id: 'output', label: 'Output', icon: Monitor },
            { id: 'debug', label: 'Debug Console', icon: Code2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveBottomTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 py-3 text-[12px] font-bold uppercase tracking-widest transition-all relative group",
                activeBottomTab === tab.id 
                  ? "text-blue-400" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <tab.icon size={16} className={cn("transition-transform", activeBottomTab === tab.id ? "" : "group-hover:scale-110")} />
              <span>{tab.label}</span>
              {activeBottomTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-t-full shadow-[0_-2px_10px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all">
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={() => setIsTerminalVisible(false)}
            className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-transparent">
        <div 
          ref={terminalRef} 
          className={cn(
            "absolute inset-0 p-4 custom-scrollbar transition-opacity duration-200", 
            activeBottomTab === 'terminal' ? "opacity-100 z-10" : "opacity-0 -z-10 pointer-events-none"
          )} 
        />
        
        {activeBottomTab === 'output' && (
          <div className="absolute inset-0 p-6 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'CPU Usage', value: systemStats.cpu, icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10', progress: 12 },
                { label: 'Memory', value: systemStats.ram, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', progress: 26 },
                { label: 'Processes', value: systemStats.processes.toString(), icon: Layers, color: 'text-amber-400', bg: 'bg-amber-500/10', progress: 42 },
              ].map((stat, idx) => (
                <div key={idx} className="glass border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-all group shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-xl shadow-inner", stat.bg)}>
                      <stat.icon size={24} className={stat.color} />
                    </div>
                    <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="space-y-4">
                    <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={cn("h-full transition-all duration-1000 rounded-full", stat.color.replace('text', 'bg'))}
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeBottomTab === 'debug' && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-zinc-500 space-y-6">
            <div className="p-8 rounded-full glass border border-white/5 shadow-2xl">
              <Code2 size={64} strokeWidth={1} className="opacity-30" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-[14px] font-bold text-zinc-400 tracking-widest uppercase">No Debug Session</h3>
              <p className="text-[12px] text-zinc-500 max-w-[250px] leading-relaxed">
                Start a debug session to see logs and breakpoints.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
