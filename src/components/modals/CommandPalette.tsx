import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, FileCode, MessageSquare, GitBranch, Settings, Terminal, Play, Square, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
  files: any[];
  openFile: (path: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onCommand,
  files,
  openFile
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { id: 'explorer', name: 'Show Explorer', icon: <FileCode size={18} />, category: 'Navigation' },
    { id: 'search', name: 'Search Files', icon: <Search size={18} />, category: 'Navigation' },
    { id: 'git', name: 'Source Control', icon: <GitBranch size={18} />, category: 'Navigation' },
    { id: 'ai', name: 'AI Assistant', icon: <MessageSquare size={18} />, category: 'Navigation' },
    { id: 'settings', name: 'Open Settings', icon: <Settings size={18} />, category: 'System' },
    { id: 'terminal', name: 'Toggle Terminal', icon: <Terminal size={18} />, category: 'System' },
    { id: 'auto-mode', name: 'Toggle Auto Mode', icon: <Play size={18} />, category: 'AI' },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const flatFiles = (items: any[]): any[] => {
    return items.reduce((acc, item) => {
      if (item.type === 'file') {
        acc.push(item);
      }
      if (item.children) {
        acc.push(...flatFiles(item.children));
      }
      return acc;
    }, []);
  };

  const filteredFiles = flatFiles(files).filter(file => 
    file.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const results = [...filteredCommands, ...filteredFiles.map(f => ({ ...f, id: `file:${f.path}`, category: 'Files', icon: <FileCode size={18} /> }))];

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, results]);

  const handleSelect = (item: any) => {
    if (item.id.startsWith('file:')) {
      openFile(item.path);
    } else {
      onCommand(item.id);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-2xl glass-card overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/10 ring-1 ring-white/10"
          >
            <div className="p-5 border-b border-white/5 flex items-center space-x-4 bg-white/5">
              <Search className="text-zinc-500" size={20} />
              <input 
                ref={inputRef}
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search files..." 
                className="flex-1 bg-transparent border-none outline-none text-lg text-zinc-200 placeholder-zinc-600"
              />
              <div className="flex items-center space-x-2 px-2 py-1 bg-black/40 rounded-lg border border-white/10 text-[10px] font-black text-zinc-500 uppercase tracking-tighter">
                <span>ESC</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              {results.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 italic opacity-40">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((item, idx) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer transition-all group",
                        selectedIndex === idx 
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-lg" 
                          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
                      )}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          selectedIndex === idx ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-zinc-500 group-hover:text-zinc-300"
                        )}>
                          {item.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold">{item.name || item.path?.split('/').pop()}</span>
                          <span className="text-[11px] font-medium opacity-50 uppercase tracking-wider">{item.category}</span>
                        </div>
                      </div>
                      {selectedIndex === idx && (
                        <div className="flex items-center space-x-2 animate-fade-in">
                          <span className="text-[11px] font-black opacity-40 uppercase tracking-tighter">Select</span>
                          <ChevronRight size={14} className="opacity-40" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-between text-[11px] font-bold text-zinc-500">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <kbd className="px-2 py-1 bg-white/5 rounded border border-white/10 text-zinc-400">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <kbd className="px-2 py-1 bg-white/5 rounded border border-white/10 text-zinc-400">Enter</kbd>
                  <span>Select</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Command size={12} />
                <span>Command Palette</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
