import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ConsoleProps {
  logs: LogEntry[];
}

const Console: React.FC<ConsoleProps> = ({ logs }) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of console only (does not move page viewport)
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full bg-slate-900 handdrawn-border overflow-hidden flex flex-col h-64 font-mono text-sm">
      <div className="bg-slate-800 px-4 py-2 border-b-4 border-slate-700 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
        <span className="ml-2 text-slate-300 text-xs font-bold uppercase tracking-wider">System Status Console</span>
      </div>
      <div 
        ref={consoleRef}
        className="flex-1 p-4 overflow-y-auto console-scroll space-y-1 bg-slate-900"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-fade-in">
            <span className="text-slate-500 shrink-0 font-bold">[{log.timestamp}]</span>
            <span
              className={`
                ${log.type === 'system' ? 'text-blue-400' : ''}
                ${log.type === 'info' ? 'text-slate-300' : ''}
                ${log.type === 'success' ? 'text-emerald-400' : ''}
                ${log.type === 'error' ? 'text-red-400' : ''}
                ${log.type === 'action' ? 'text-yellow-400 font-bold blink' : ''}
              `}
            >
              {log.type === 'action' && '> '}
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Console;