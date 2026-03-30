import React from 'react';
import { Files, Search, GitBranch, MessageSquare, Settings, User, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActivityBarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isSideBarVisible: boolean;
  setIsSideBarVisible: (visible: boolean) => void;
  onSettingsOpen: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  isSideBarVisible,
  setIsSideBarVisible,
  onSettingsOpen
}) => {
  const items = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'ai', icon: MessageSquare, label: 'AI Assistant' },
  ];

  return (
    <div className="w-16 glass-dark border-r border-white/5 flex flex-col items-center py-8 space-y-8 z-20 shadow-2xl relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
      
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            if (activeTab === item.id && isSideBarVisible) {
              setIsSideBarVisible(false);
            } else {
              setActiveTab(item.id);
              setIsSideBarVisible(true);
            }
          }}
          className={cn(
            "p-3 rounded-2xl transition-all duration-500 group relative hover:scale-110 active:scale-95",
            activeTab === item.id && isSideBarVisible
              ? "text-white bg-gradient-to-br from-blue-500/20 to-indigo-600/20 shadow-2xl shadow-blue-500/20 ring-1 ring-white/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
          )}
        >
          <item.icon size={24} strokeWidth={1.5} className={cn("transition-all duration-500", activeTab === item.id && isSideBarVisible ? "scale-110 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "group-hover:scale-110")} />
          <div className="absolute left-full ml-6 px-4 py-2 glass text-white text-[13px] font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-20px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-white/10 backdrop-blur-2xl">
            {item.label}
          </div>
          {activeTab === item.id && isSideBarVisible && (
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-gradient-to-b from-blue-400 to-indigo-600 rounded-r-full shadow-[0_0_15px_rgba(96,165,250,0.6)] animate-pulse" />
          )}
        </button>
      ))}
      
      <div className="flex-1" />

      <div className="flex flex-col space-y-6 pb-4">
        <button className="p-3 rounded-2xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-500 group relative hover:scale-110 active:scale-95">
          <Bell size={22} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
          <div className="absolute left-full ml-6 px-4 py-2 glass text-white text-[13px] font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-20px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-white/10 backdrop-blur-2xl">
            Notifications
          </div>
        </button>

        <button 
          onClick={onSettingsOpen}
          className="p-3 rounded-2xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-500 group relative hover:scale-110 active:scale-95"
        >
          <Settings size={22} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform duration-700" />
          <div className="absolute left-full ml-6 px-4 py-2 glass text-white text-[13px] font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-20px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-white/10 backdrop-blur-2xl">
            Settings
          </div>
        </button>
      </div>
    </div>
  );
};
