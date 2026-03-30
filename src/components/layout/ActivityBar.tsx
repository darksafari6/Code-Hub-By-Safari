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
    <div className="w-14 glass-dark border-r border-white/5 flex flex-col items-center py-6 space-y-6 z-20 shadow-2xl">
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
            "p-2.5 rounded-xl transition-all duration-300 group relative",
            activeTab === item.id && isSideBarVisible
              ? "text-white bg-white/10 shadow-lg shadow-black/50 ring-1 ring-white/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
          )}
        >
          <item.icon size={22} strokeWidth={1.5} className={cn("transition-transform duration-300", activeTab === item.id && isSideBarVisible ? "scale-110" : "group-hover:scale-110")} />
          <div className="absolute left-full ml-4 px-3 py-1.5 glass text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl">
            {item.label}
          </div>
          {activeTab === item.id && isSideBarVisible && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-400 to-indigo-600 rounded-r-full shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
          )}
        </button>
      ))}
      
      <div className="flex-1" />

      <button className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-300 group relative">
        <Bell size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
        <div className="absolute left-full ml-4 px-3 py-1.5 glass text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl">
          Notifications
        </div>
      </button>

      <button className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-300 group relative">
        <User size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
        <div className="absolute left-full ml-4 px-3 py-1.5 glass text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl">
          Profile
        </div>
      </button>

      <button 
        onClick={onSettingsOpen}
        className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-300 group relative"
      >
        <Settings size={20} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform duration-500" />
        <div className="absolute left-full ml-4 px-3 py-1.5 glass text-white text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl">
          Settings
        </div>
      </button>
    </div>
  );
};
