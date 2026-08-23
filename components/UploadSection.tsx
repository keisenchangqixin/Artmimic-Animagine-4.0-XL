
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { UploadedFile, AppState, ReferenceSlot, ReferenceCategory, ViewType } from '../types';

interface UploadSectionProps {
  files: UploadedFile[];
  onFilesAdded: (files: UploadedFile[]) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onToggleStyle: (id: string) => void;
  onUpdateHeightRatio?: (charIndex: number, ratio: number | string) => void;
  onUpdateCharacterName?: (charIndex: number, name: string) => void;
  appState: AppState;
}



const UploadSection: React.FC<UploadSectionProps> = ({ 
  files, onFilesAdded, onRemoveFile, onClearAll, onToggleStyle, onUpdateHeightRatio, onUpdateCharacterName, appState 
}) => {
  const isProcessing = appState === AppState.ANALYZING || appState === AppState.GENERATING;
  const [selectedSlot, setSelectedSlot] = useState<ReferenceSlot | null>({ category: 'character', charIndex: 0, viewType: 'front' });
  const [characterCount, setCharacterCount] = useState(1);

  useEffect(() => {
    const maxIndex = files.reduce((max, f) => {
      if (f.category === 'character' && f.charIndex !== undefined) {
        return Math.max(max, f.charIndex);
      }
      return max;
    }, -1);
    if (maxIndex + 1 > characterCount) {
      setCharacterCount(maxIndex + 1);
    }
  }, [files, characterCount]);

  const [enlargedFileId, setEnlargedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enlargedFile = files.find(f => f.id === enlargedFileId);

  const getFileAtSlot = (category: ReferenceCategory, charIndex?: number, viewType?: ViewType) => {
    return files.find(f => 
      f.category === category && 
      (category === 'character' ? f.charIndex === charIndex && f.viewType === viewType : true)
    );
  };

  const processFiles = useCallback((fileList: FileList | File[], targetSlot: ReferenceSlot) => {
    const filesArray = Array.from(fileList);
    const validFiles = filesArray.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const file = validFiles[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const newFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        data: base64.split(',')[1],
        mimeType: file.type,
        category: targetSlot.category,
        charIndex: targetSlot.charIndex,
        viewType: targetSlot.viewType,
        isStyleInfluence: targetSlot.category === 'character' && targetSlot.charIndex === 0 && !files.some(f => f.isStyleInfluence)
      };
      
      onFilesAdded([newFile]);
    };
    reader.readAsDataURL(file);
  }, [onFilesAdded, files]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedSlot) {
      processFiles(e.target.files, selectedSlot);
      e.target.value = '';
    }
  };

  const triggerUpload = (slot: ReferenceSlot) => {
    if (isProcessing) return;
    setSelectedSlot(slot);
    fileInputRef.current?.click();
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (isProcessing || !selectedSlot) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const filesToProcess: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) filesToProcess.push(blob);
        }
      }
      if (filesToProcess.length > 0) {
        processFiles(filesToProcess, selectedSlot);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isProcessing, selectedSlot, processFiles]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargedFileId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const renderSlot = (slot: ReferenceSlot, label?: string) => {
    const file = getFileAtSlot(slot.category, slot.charIndex, slot.viewType);
    const isSelected = selectedSlot && 
      selectedSlot.category === slot.category && 
      selectedSlot.charIndex === slot.charIndex && 
      selectedSlot.viewType === slot.viewType;

    return (
      <div 
        key={`${slot.category}-${slot.charIndex}-${slot.viewType}`}
        onClick={() => !isProcessing && setSelectedSlot(slot)}
        className={`
          relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 transition-all cursor-pointer group flex flex-col items-center justify-center
          ${isSelected ? 'border-pink-500 ring-4 ring-pink-500/30 shadow-[4px_4px_0_rgba(236,72,153,1)]' : 'border-slate-700 bg-white hover:border-slate-500 shadow-[2px_2px_0_rgba(51,65,85,1)]'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px' }}
      >
        {file ? (
          <>
            <img 
              src={`data:${file.mimeType};base64,${file.data}`} 
              alt="Reference" 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              onClick={(e) => { e.stopPropagation(); setEnlargedFileId(file.id); }}
            />
            {file.isStyleInfluence && (
              <div className="absolute top-1 right-1 z-20 bg-emerald-500 rounded-full p-0.5 shadow-lg border-2 border-slate-700">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
              </div>
            )}
            <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleStyle(file.id); }}
                className={`w-full ${file.isStyleInfluence ? 'bg-emerald-500' : 'bg-slate-600'} text-white text-[9px] font-bold uppercase tracking-widest rounded-lg py-1 transition-colors border-2 border-slate-800`}
              >
                {file.isStyleInfluence ? 'Style Master' : 'Set Master Style'}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setEnlargedFileId(file.id); }}
                className="w-full bg-white/20 hover:bg-white/40 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg py-1 transition-colors backdrop-blur-sm border-2 border-slate-800"
              >
                Enlarge
              </button>
              <div className="flex w-full gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); triggerUpload(slot); }}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors border-2 border-slate-800"
                >
                  Swap
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(file.id); }}
                  className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors border-2 border-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>
          </>
        ) : (
          <div 
            onClick={(e) => { e.stopPropagation(); triggerUpload(slot); }}
            className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-slate-600 w-full h-full justify-center transition-colors"
          >
            <span className="text-3xl font-bold">+</span>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{label || 'Upload'}</span>
          </div>
        )}
        {isSelected && !file && (
          <div className="absolute bottom-1 px-2 bg-pink-500 text-[9px] text-white font-bold uppercase rounded-full animate-pulse border-2 border-slate-800">Select Target</div>
        )}
      </div>
    );
  };

  const renderCharacterRow = (index: number) => {
    const charFiles = files.filter(f => f.category === 'character' && f.charIndex === index);
    const heightRatio = charFiles.length > 0 ? (charFiles[0].heightRatio ?? 1.0) : 1.0;
    const characterName = charFiles.length > 0 ? (charFiles[0].characterName || '') : '';

    return (
      <div key={index} className="space-y-2 animate-fade-in border-b-2 border-slate-200 pb-4 last:border-0 last:pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                  {index === 0 ? '⚓ Anchor Identity' : `Identity #${index + 1}`}
              </span>
              <input 
                type="text" 
                placeholder={`Name (e.g. C${index + 1})`}
                value={characterName}
                onChange={(e) => onUpdateCharacterName?.(index, e.target.value)}
                className="bg-white border-2 border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-pink-500 placeholder:text-slate-400 w-32 shadow-[2px_2px_0_rgba(51,65,85,1)]"
              />
          </div>
          {index > 0 && charFiles.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Scale vs Anchor:</label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1" 
                max="5.0" 
                value={heightRatio}
                onChange={(e) => onUpdateHeightRatio?.(index, e.target.value)}
                className="w-14 bg-white border-2 border-slate-400 rounded px-1 py-0.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-pink-500 text-center"
              />
              <span className="text-[10px] text-slate-600 font-bold">x</span>
            </div>
          )}
        </div>
        <div className="flex gap-4">
          {renderSlot({ category: 'character', charIndex: index, viewType: 'front' }, "Front")}
          {renderSlot({ category: 'character', charIndex: index, viewType: 'side' }, "Side")}
          {renderSlot({ category: 'character', charIndex: index, viewType: 'back' }, "Back")}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileInputChange} 
      />

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 drop-shadow-[1px_1px_0_rgba(255,255,255,1)]">1. Staging Area</h2>
          <p className="text-xs text-slate-600 uppercase tracking-widest font-bold">Configure Visual Anchors</p>
        </div>
        {files.length > 0 && (
          <button onClick={onClearAll} className="text-sm text-red-500 hover:text-red-600 uppercase tracking-wider font-bold transition-colors bg-white px-3 py-1 border-2 border-slate-700 rounded-lg shadow-[2px_2px_0_rgba(51,65,85,1)]" disabled={isProcessing}>
            Reset Stage
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="handdrawn-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500 border border-slate-700"></div>
              Characters / Subjects
            </h3>
            <button 
              onClick={() => setCharacterCount(prev => Math.min(prev + 1, 10))}
              className="text-[10px] bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-1.5 rounded-lg border-2 border-slate-700 font-bold uppercase tracking-tighter transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              disabled={isProcessing}
            >
              + New Character (Max 5 Recommended)
            </button>
          </div>
          <div className="space-y-6 max-h-[400px] overflow-y-auto console-scroll pr-2">
            {Array.from({ length: characterCount }).map((_, i) => renderCharacterRow(i))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="handdrawn-border p-5 space-y-3">
            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 border border-slate-700"></div>
              Scene / Mood
            </h3>
            {renderSlot({ category: 'scene' }, "Style Ref")}
            <p className="text-[10px] text-slate-500 font-bold uppercase leading-tight">Mood & Medium DNA.</p>
          </div>
        </div>
      </div>

      <div className="handdrawn-border p-3 flex flex-col items-center gap-2 bg-blue-50">
        <p className="text-[11px] text-slate-600 text-center uppercase font-bold tracking-widest flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-5 h-5 bg-white border-2 border-slate-700 rounded-full flex items-center justify-center text-[10px] shadow-[1px_1px_0_rgba(51,65,85,1)]">1</span> Select Slot</span>
          <span className="text-slate-400">•</span>
          <span className="flex items-center gap-1"><span className="w-5 h-5 bg-white border-2 border-slate-700 rounded-full flex items-center justify-center text-[10px] shadow-[1px_1px_0_rgba(51,65,85,1)]">2</span> Upload or <span className="text-blue-600 bg-blue-100 px-1 rounded border border-blue-300">Ctrl+V</span></span>
        </p>
        <p className="text-[10px] text-emerald-600 text-center uppercase font-bold tracking-[0.2em] animate-pulse">
          Click "Set Master Style" to influence entire render globally.
        </p>
      </div>

      {enlargedFile && (
        <div 
          className="fixed inset-0 z-[110] bg-slate-900/80 flex items-center justify-center p-8 animate-fade-in backdrop-blur-sm"
          onClick={() => setEnlargedFileId(null)}
        >
          <div className="relative max-w-4xl max-h-full flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setEnlargedFileId(null)}
              className="absolute -top-12 right-0 text-white hover:text-pink-300 transition-colors uppercase font-bold tracking-widest text-sm flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border-2 border-white"
            >
              Close Asset <span className="text-2xl">&times;</span>
            </button>
            <div className="handdrawn-border p-2 shadow-2xl overflow-hidden">
                <img 
                  src={`data:${enlargedFile.mimeType};base64,${enlargedFile.data}`} 
                  alt="Enlarged Reference" 
                  className="max-h-[80vh] w-auto object-contain rounded-lg"
                />
            </div>
            <div className="text-center bg-white px-6 py-2 handdrawn-border">
              <h4 className="text-pink-600 font-bold uppercase tracking-widest text-sm mb-1">
                {enlargedFile.category} Reference
              </h4>
              <p className="text-slate-600 text-xs uppercase font-bold tracking-tighter">
                {enlargedFile.category === 'character' ? `Identity #${(enlargedFile.charIndex || 0) + 1} - ${enlargedFile.viewType} perspective` : 'Anchor Reference'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadSection;
