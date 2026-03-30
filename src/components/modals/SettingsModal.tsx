import React from 'react';
import { X, Settings, Shield, Zap, RotateCcw, Monitor, Globe, Lock, User, MoreVertical, Files, Search, Code2, Cpu, Activity, Layers, Check, Bell, Layout, MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: { maxRetries: number, autoRollback: boolean };
  setConfig: (config: any) => void;
  theme: string;
  setTheme: (theme: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  setConfig,
  theme,
  setTheme
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
      <div className="glass-dark border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
              <Settings size={28} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Application Settings</h2>
              <p className="text-[14px] text-zinc-400 font-medium mt-1">Configure your development environment and AI behavior.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all group"
          >
            <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="p-8 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar bg-transparent">
          {/* AI Settings */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 text-blue-400">
              <Zap size={20} />
              <h3 className="text-[13px] font-bold uppercase tracking-widest">AI & Automation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[14px] font-bold text-zinc-300 flex items-center space-x-3">
                  <span>Max Retries</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-md text-[11px] text-zinc-400 border border-white/5">Auto Mode</span>
                </label>
                <div className="flex items-center space-x-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={config.maxRetries}
                    onChange={(e) => setConfig({ ...config, maxRetries: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-black/40 rounded-full appearance-none cursor-pointer accent-blue-500 shadow-inner"
                  />
                  <span className="text-[15px] font-bold text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-xl border border-blue-500/20 shadow-inner">{config.maxRetries}</span>
                </div>
                <p className="text-[12px] text-zinc-500 leading-relaxed">Maximum number of attempts the AI will make to fix an error before pausing.</p>
              </div>
              <div className="flex items-center justify-between p-6 glass border border-white/5 rounded-2xl hover:bg-white/5 transition-all group shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Shield size={18} className="text-emerald-400" />
                    <span className="text-[14px] font-bold text-zinc-200">Auto-Rollback</span>
                  </div>
                  <p className="text-[12px] text-zinc-500 leading-relaxed pr-4">Automatically restore files if a step fails after all retries.</p>
                </div>
                <button 
                  onClick={() => setConfig({ ...config, autoRollback: !config.autoRollback })}
                  className={cn(
                    "w-14 h-7 rounded-full transition-all relative shadow-inner border border-white/5",
                    config.autoRollback ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-black/40"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md",
                    config.autoRollback ? "left-8" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Interface Settings */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 text-amber-400">
              <Monitor size={20} />
              <h3 className="text-[13px] font-bold uppercase tracking-widest">Interface & Theme</h3>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                { id: 'dark', label: 'Dark Mode', color: 'bg-zinc-950 border-zinc-800' },
                { id: 'light', label: 'Light Mode', color: 'bg-zinc-100 border-zinc-300' },
                { id: 'system', label: 'System', color: 'bg-gradient-to-br from-zinc-950 to-zinc-100 border-zinc-800' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center space-y-4 p-5 rounded-2xl border-2 transition-all group relative overflow-hidden",
                    theme === t.id 
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                      : "border-white/5 glass hover:border-white/10 hover:bg-white/5"
                  )}
                >
                  <div className={cn("w-full h-20 rounded-xl border shadow-inner", t.color)} />
                  <span className={cn("text-[13px] font-bold", theme === t.id ? "text-blue-400" : "text-zinc-400 group-hover:text-zinc-300")}>{t.label}</span>
                  {theme === t.id && (
                    <div className="absolute top-3 right-3 p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-6 pt-8 border-t border-white/5">
            <div className="flex items-center space-x-3 text-red-500">
              <RotateCcw size={20} />
              <h3 className="text-[13px] font-bold uppercase tracking-widest">Danger Zone</h3>
            </div>
            <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-between group shadow-inner">
              <div className="space-y-2">
                <h4 className="text-[14px] font-bold text-red-400">Reset Workspace</h4>
                <p className="text-[12px] text-zinc-500 leading-relaxed max-w-[350px]">Permanently delete all files and reset the environment. This action cannot be undone.</p>
              </div>
              <button className="px-8 py-3 bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95">
                Reset All
              </button>
            </div>
          </section>
        </div>

        <div className="px-8 py-6 bg-black/20 border-t border-white/5 flex justify-end space-x-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-[14px] font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-[14px] font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
