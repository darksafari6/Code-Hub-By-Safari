import React from 'react';
import Editor from '@monaco-editor/react';
import { X, FileCode, ChevronRight, Code2, Copy, Download, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface EditorAreaProps {
  openFiles: string[];
  currentFile: string | null;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  fileContent: string;
  saveFile: (content: string) => void;
  theme: string;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  openFiles,
  currentFile,
  openFile,
  closeFile,
  fileContent,
  saveFile,
  theme
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.split('/').pop() || 'code.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden relative">
      {/* Tabs */}
      <div className="flex bg-[#181818] overflow-x-auto no-scrollbar border-b border-zinc-800/50">
        {openFiles.map((file) => (
          <div
            key={file}
            onClick={() => openFile(file)}
            className={cn(
              "flex items-center px-4 py-2.5 cursor-pointer border-r border-zinc-800/50 min-w-[120px] max-w-[200px] group transition-all relative",
              currentFile === file 
                ? "bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500" 
                : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
            )}
          >
            <FileCode size={14} className={cn("mr-2 flex-shrink-0", currentFile === file ? "text-blue-400" : "text-zinc-600")} />
            <span className="text-[12px] truncate font-medium">{file.split('/').pop()}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file);
              }}
              className="ml-2 p-0.5 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#1e1e1e] border-b border-zinc-800/30">
        <div className="flex items-center text-[11px] text-zinc-500">
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">Workspace</span>
          {currentFile?.split('/').map((part, idx) => (
            <React.Fragment key={idx}>
              {part && (
                <>
                  <ChevronRight size={12} className="mx-1 opacity-50" />
                  <span className="hover:text-zinc-300 cursor-pointer transition-colors">{part}</span>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
        
        {currentFile && (
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center space-x-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
            >
              <Download size={12} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {!currentFile ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 space-y-6 bg-[#1e1e1e]">
            <div className="p-8 rounded-full bg-zinc-900/50 border border-zinc-800 shadow-2xl">
              <Code2 size={64} strokeWidth={1} className="opacity-20" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-[14px] font-bold text-zinc-500 tracking-wide uppercase">No File Selected</h3>
              <p className="text-[12px] text-zinc-600 max-w-[200px] leading-relaxed">
                Select a file from the explorer or start a new project.
              </p>
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            path={currentFile}
            defaultLanguage="typescript"
            value={fileContent}
            onChange={(value) => saveFile(value || '')}
            options={{
              minimap: { enabled: true, scale: 0.75 },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              lineNumbers: 'on',
              roundedSelection: true,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              contextmenu: true,
              renderLineHighlight: 'all',
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
