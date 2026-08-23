import React, { useState, useEffect, useCallback } from 'react';
import { GeneratedImage, GalleryFolder } from '../types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GalleryProps {
  images: GeneratedImage[];
  folders: GalleryFolder[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveImages: (imageIds: string[], folderId?: string) => void;
  onDelete: (id: string) => void;
  onDeleteSelected: (ids: string[]) => void;
  onDeleteAll: () => void;
  onReorderImages: (ids: string[]) => void;
  onSetAnchor?: (image: GeneratedImage) => void;
  onClearAnchor?: () => void;
  activeAnchorId?: string | null;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

const SortableGalleryItem: React.FC<SortableItemProps> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

const Gallery: React.FC<GalleryProps> = ({ images, folders, onCreateFolder, onRenameFolder, onDeleteFolder, onMoveImages, onDelete, onDeleteSelected, onDeleteAll, onReorderImages, onSetAnchor, onClearAnchor, activeAnchorId }) => {
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [filenamePrefix, setFilenamePrefix] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editFolderName, setEditFolderName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const expandedImage = images.find(img => img.id === expandedImageId);
  const displayedImages = images.filter(img => img.folderId === (activeFolderId || undefined));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedImageId(null);
      } else if (e.key === 'ArrowRight' && expandedImageId) {
        const currentIndex = displayedImages.findIndex(img => img.id === expandedImageId);
        if (currentIndex < displayedImages.length - 1) {
          setExpandedImageId(displayedImages[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowLeft' && expandedImageId) {
        const currentIndex = displayedImages.findIndex(img => img.id === expandedImageId);
        if (currentIndex > 0) {
          setExpandedImageId(displayedImages[currentIndex - 1].id);
        }
      }
    };
    if (expandedImageId) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [expandedImageId, displayedImages]);

  const closeExpanded = useCallback(() => setExpandedImageId(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = displayedImages.findIndex(img => img.id === active.id);
      const newIndex = displayedImages.findIndex(img => img.id === over.id);
      
      const newOrderIds = [...displayedImages.map(img => img.id)];
      const [removed] = newOrderIds.splice(oldIndex, 1);
      newOrderIds.splice(newIndex, 0, removed);
      
      onReorderImages(newOrderIds);
    }
  };

  const handleSaveAll = () => {
    const sorted = [...displayedImages].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    sorted.forEach((img, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = img.url;
        const prefix = filenamePrefix.trim() || 'Image';
        const filename = `${prefix}_${img.sequenceNumber.toString().padStart(2, '0')}.png`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 400); 
    });
  };

  const handleDownloadZip = async () => {
    if (displayedImages.length === 0) return;
    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const sorted = [...displayedImages].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      const promises = sorted.map(async (img) => {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const prefix = filenamePrefix.trim() || 'Image';
        const filename = `${prefix}_${img.sequenceNumber.toString().padStart(2, '0')}.png`;
        zip.file(filename, blob);
      });
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      const prefix = filenamePrefix.trim() || 'Image';
      link.download = `${prefix}_Collection.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to create zip:", error);
    } finally {
      setIsZipping(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedImageIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreateFolderSubmit = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  if (images.length === 0 && folders.length === 0) return null;

  return (
    <div className="mt-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4 bg-white p-4 rounded-xl border-2 border-slate-700 shadow-[4px_4px_0_rgba(51,65,85,1)]">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
            Session Gallery
          </h2>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">{displayedImages.length} assets in view</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setSelectedImageIds(selectedImageIds.length === displayedImages.length && displayedImages.length > 0 ? [] : displayedImages.map(img => img.id))}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-100 hover:bg-blue-200 border-2 border-slate-700 text-blue-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
          >
            {selectedImageIds.length === displayedImages.length && displayedImages.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          {selectedImageIds.length > 0 && (
            <div className="flex gap-2 relative">
              <button 
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="px-4 py-2 bg-pink-100 hover:bg-pink-200 border-2 border-pink-500 text-pink-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(236,72,153,1)]"
              >
                Move {selectedImageIds.length} Selected...
              </button>
              <button 
                onClick={() => setShowDeleteSelectedConfirm(true)}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 border-2 border-red-500 text-red-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(239,68,68,1)]"
              >
                Delete Selected
              </button>
              {showMoveMenu && (
                <div className="absolute top-full right-0 mt-2 bg-white border-2 border-slate-700 rounded-lg shadow-[4px_4px_0_rgba(51,65,85,1)] z-50 min-w-[200px] overflow-hidden">
                  {activeFolderId !== null && (
                    <button 
                      onClick={() => { onMoveImages(selectedImageIds, undefined); setSelectedImageIds([]); setShowMoveMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 border-b-2 border-slate-100 text-sm font-bold text-slate-700"
                    >
                      ← Back to Root Gallery
                    </button>
                  )}
                  {folders.filter(f => f.id !== activeFolderId).map(f => (
                    <button 
                      key={f.id}
                      onClick={() => { onMoveImages(selectedImageIds, f.id); setSelectedImageIds([]); setShowMoveMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 border-b-2 border-slate-100 text-sm font-bold text-slate-700"
                    >
                      📁 {f.name}
                    </button>
                  ))}
                  {folders.filter(f => f.id !== activeFolderId).length === 0 && activeFolderId === null && (
                    <div className="px-4 py-3 text-xs text-slate-500 italic">No other folders available</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mr-2 ml-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Prefix:</label>
            <input 
              type="text" 
              value={filenamePrefix} 
              onChange={(e) => setFilenamePrefix(e.target.value)}
              placeholder="e.g. Kpop"
              className="w-24 px-2 py-1 text-xs border-2 border-slate-400 rounded focus:outline-none focus:border-indigo-500 font-bold text-slate-800"
            />
          </div>
          <button 
            onClick={handleSaveAll}
            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-100 hover:bg-emerald-200 border-2 border-slate-700 text-emerald-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
          >
            Save All
          </button>
          <button 
            onClick={handleDownloadZip}
            disabled={isZipping || displayedImages.length === 0}
            className={`flex-1 sm:flex-none px-4 py-2 ${isZipping || displayedImages.length === 0 ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'} border-2 border-slate-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]`}
          >
            {isZipping ? 'Zipping...' : 'Download Zip'}
          </button>
          
          <button 
            onClick={() => setShowDeleteAllConfirm(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-red-100 hover:bg-red-200 border-2 border-slate-700 text-red-600 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
          >
            Delete All
          </button>
        </div>
      </div>

      {/* Folders Navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
        <button 
          onClick={() => { setActiveFolderId(null); setSelectedImageIds([]); setShowMoveMenu(false); }}
          className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${activeFolderId === null ? 'bg-indigo-500 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'}`}
        >
          All Images (Root)
        </button>
        {folders.map(f => (
          <div key={f.id} className="flex items-center">
            {editingFolderId === f.id ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  className="px-3 py-2 text-sm border-2 border-slate-400 rounded-l-lg focus:outline-none focus:border-indigo-500 font-bold w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRenameFolder(f.id, editFolderName || f.name);
                      setEditingFolderId(null);
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => { onRenameFolder(f.id, editFolderName || f.name); setEditingFolderId(null); }}
                  className="px-2 py-2 bg-emerald-100 text-emerald-700 border-y-2 border-slate-400 text-sm font-bold shadow-[2px_2px_0_rgba(51,65,85,1)]"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingFolderId(null)}
                  className="px-2 py-2 rounded-r-lg bg-slate-100 text-slate-600 border-2 border-l-0 border-slate-400 text-sm font-bold shadow-[2px_2px_0_rgba(51,65,85,1)]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { setActiveFolderId(f.id); setSelectedImageIds([]); setShowMoveMenu(false); }}
                  onDoubleClick={() => { setEditingFolderId(f.id); setEditFolderName(f.name); }}
                  className={`px-4 py-2 rounded-l-lg text-sm font-bold border-2 border-r-0 transition-all flex items-center gap-2 ${activeFolderId === f.id ? 'bg-indigo-500 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'}`}
                  title="Double-click to rename"
                >
                  📁 {f.name}
                </button>
                <button
                  onClick={() => setFolderToDelete(f.id)}
                  className={`px-2 py-2 rounded-r-lg border-2 transition-all ${activeFolderId === f.id ? 'bg-indigo-600 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]' : 'bg-white border-slate-300 border-l-0 text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                  title="Delete Folder"
                >
                  &times;
                </button>
              </>
            )}
          </div>
        ))}
        {isCreatingFolder ? (
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder Name"
              className="px-3 py-2 text-sm border-2 border-slate-400 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderSubmit()}
              autoFocus
            />
            <button onClick={handleCreateFolderSubmit} className="px-3 py-2 bg-emerald-100 text-emerald-700 border-2 border-slate-700 rounded-lg text-sm font-bold shadow-[2px_2px_0_rgba(51,65,85,1)]">Add</button>
            <button onClick={() => setIsCreatingFolder(false)} className="px-3 py-2 bg-slate-100 text-slate-600 border-2 border-slate-400 rounded-lg text-sm font-bold">Cancel</button>
          </div>
        ) : (
          <button 
            onClick={() => setIsCreatingFolder(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 border-dashed text-slate-600 rounded-lg text-sm font-bold transition-all"
          >
            + New Folder
          </button>
        )}
      </div>
      
      {displayedImages.length === 0 && (
        <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest border-4 border-dashed border-slate-200 rounded-xl">
          No images in this folder
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayedImages.map(img => img.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedImages.map((img) => {
              const isSelected = selectedImageIds.includes(img.id);
              return (
              <SortableGalleryItem key={img.id} id={img.id}>
                <div className={`group relative rounded-xl overflow-hidden border-4 bg-white shadow-[4px_4px_0_rgba(51,65,85,1)] aspect-square transition-all ${activeAnchorId === img.id ? 'border-pink-500 shadow-[4px_4px_0_rgba(236,72,153,1)]' : isSelected ? 'border-indigo-500 shadow-[4px_4px_0_rgba(99,102,241,1)]' : 'border-slate-700'}`} style={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px' }}>
            <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
            
            {/* Selection Checkbox */}
            <div className="absolute top-2 right-2 z-20">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleSelection(img.id); }}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-white text-white shadow-lg' : 'bg-white/80 border-slate-700 text-transparent hover:bg-white'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </button>
            </div>

            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <span className="bg-white/90 text-slate-800 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-slate-700 backdrop-blur-sm shadow-[2px_2px_0_rgba(51,65,85,1)]">
                #{img.sequenceNumber.toString().padStart(2, '0')}
              </span>
            </div>
            
            <div className={`absolute inset-0 z-10 pointer-events-none bg-white/95 transition-opacity flex flex-col justify-between p-4 duration-200 ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  {img.resolution && img.resolution !== '1K' && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">HQ {img.resolution}</span>
                  )}
                  {img.baseImageUrl && (
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">REMIX</span>
                  )}
                </div>
                <button onClick={() => onDelete(img.id)} className="pointer-events-auto p-2 bg-red-100 hover:bg-red-200 text-red-600 border-2 border-slate-700 rounded-lg transition-colors shadow-[2px_2px_0_rgba(51,65,85,1)]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
              </div>
              <div>
                <p className="text-slate-800 text-sm line-clamp-3 italic border-l-4 border-pink-500 pl-3 mb-4 font-bold">"{img.prompt}"</p>
                <div className="flex gap-2">
                  <a href={img.url} download={`${filenamePrefix.trim() || 'Image'}_${img.sequenceNumber.toString().padStart(2, '0')}.png`} className="pointer-events-auto flex-1 bg-slate-100 hover:bg-slate-200 border-2 border-slate-700 text-slate-700 text-xs font-black py-2 rounded-lg text-center transition-colors uppercase tracking-wide shadow-[2px_2px_0_rgba(51,65,85,1)]">Download</a>
                  <button onClick={(e) => { e.stopPropagation(); setExpandedImageId(img.id); }} className="pointer-events-auto flex-1 bg-blue-500 hover:bg-blue-600 border-2 border-slate-700 text-white text-xs font-black py-2 rounded-lg text-center transition-colors uppercase tracking-wide shadow-[2px_2px_0_rgba(51,65,85,1)]">{img.baseImageUrl ? 'Compare' : 'Expand'}</button>
                </div>
                {onSetAnchor && activeAnchorId !== img.id && (
                  <button onClick={() => onSetAnchor(img)} className="pointer-events-auto mt-2 w-full bg-indigo-100 hover:bg-indigo-200 border-2 border-slate-700 text-indigo-700 text-[10px] font-black py-2 rounded-lg text-center transition-colors uppercase tracking-widest flex items-center justify-center gap-1 shadow-[2px_2px_0_rgba(51,65,85,1)]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                    Set as Anchor
                  </button>
                )}
                {activeAnchorId === img.id && (
                  <button onClick={() => onClearAnchor && onClearAnchor()} className="pointer-events-auto mt-2 w-full bg-emerald-100 hover:bg-red-100 hover:text-red-700 border-2 border-slate-700 text-emerald-700 text-[10px] font-black py-2 rounded-lg text-center uppercase tracking-widest flex items-center justify-center gap-1 shadow-[2px_2px_0_rgba(51,65,85,1)] transition-colors group/anchor">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 group-hover/anchor:hidden"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 hidden group-hover/anchor:block"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    <span className="group-hover/anchor:hidden">Current Anchor</span>
                    <span className="hidden group-hover/anchor:inline">Clear Anchor</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Click overlay for selection if not hovering over controls */}
            <div 
              className="absolute inset-0 z-[5] cursor-pointer" 
              onClick={(e) => {
                 // Only select if not interacting with buttons inside the card
                 toggleSelection(img.id);
              }}
            ></div>
            
          </div>
          </SortableGalleryItem>
        )})}
          </div>
        </SortableContext>
      </DndContext>

      {expandedImage && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md overflow-y-auto animate-fade-in" onClick={closeExpanded}>
          <div className="min-h-full flex items-center justify-center p-4 md:p-10">
            <div className={`relative ${expandedImage.baseImageUrl ? 'max-w-7xl' : 'max-w-fit md:max-w-5xl'} w-full flex flex-col items-center animate-scale-in`} onClick={e => e.stopPropagation()}>
              <button onClick={closeExpanded} className="absolute -top-8 right-0 md:top-0 md:-right-8 text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-2 text-sm uppercase font-black z-10">Close <span className="text-2xl">&times;</span></button>
              
              {displayedImages.findIndex(img => img.id === expandedImage.id) > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setExpandedImageId(displayedImages[displayedImages.findIndex(img => img.id === expandedImage.id) - 1].id); }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 md:-translate-x-16 text-slate-400 hover:text-slate-800 transition-colors p-2 z-10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
              )}
              
              {displayedImages.findIndex(img => img.id === expandedImage.id) < displayedImages.length - 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setExpandedImageId(displayedImages[displayedImages.findIndex(img => img.id === expandedImage.id) + 1].id); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 md:translate-x-16 text-slate-400 hover:text-slate-800 transition-colors p-2 z-10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              )}

            <div className="w-full flex flex-col items-center gap-6">
                <div className={`flex flex-col ${expandedImage.baseImageUrl ? 'md:flex-row' : ''} gap-4 w-full items-stretch justify-center`}>
                    {expandedImage.baseImageUrl && (
                        <div className="flex-1 flex flex-col items-center gap-2">
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Before (Base)</span>
                             <div className="bg-white rounded-xl overflow-hidden border-4 border-slate-700 shadow-[8px_8px_0_rgba(51,65,85,1)] w-full h-full flex items-center justify-center p-1" style={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px' }}>
                                <img src={expandedImage.baseImageUrl} alt="Base" className="max-h-[60vh] md:max-h-[75vh] w-auto object-contain block rounded-lg" />
                             </div>
                        </div>
                    )}
                    <div className="flex-1 flex flex-col items-center gap-2">
                         <span className={`text-[10px] font-black ${expandedImage.baseImageUrl ? 'text-emerald-600' : 'text-slate-500'} uppercase tracking-widest mb-1`}>{expandedImage.baseImageUrl ? 'After (Remix)' : 'Synthesized Artwork'}</span>
                         <div className="bg-white rounded-xl overflow-hidden border-4 border-slate-700 shadow-[8px_8px_0_rgba(51,65,85,1)] w-full h-full flex items-center justify-center p-1" style={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px' }}>
                            <img src={expandedImage.url} alt={expandedImage.prompt} className="max-h-[60vh] md:max-h-[75vh] w-auto object-contain block rounded-lg" />
                         </div>
                    </div>
                </div>
                <div className="p-6 bg-yellow-50 rounded-2xl border-4 border-slate-700 w-full max-w-4xl shadow-[8px_8px_0_rgba(51,65,85,1)] flex flex-col items-center gap-4" style={{ borderRadius: '255px 15px 225px 15px/15px 225px 15px 255px' }}>
                    <div className="w-full text-center space-y-2">
                        <p className="text-slate-800 text-sm font-mono italic font-bold">"{expandedImage.prompt}"</p>
                        <div className="flex items-center justify-center gap-3">
                            {expandedImage.aspectRatio && (
                                <span className="bg-white text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-slate-700 uppercase tracking-widest shadow-[2px_2px_0_rgba(51,65,85,1)]">
                                    Ratio: {expandedImage.aspectRatio}
                                </span>
                            )}
                            {expandedImage.resolution && (
                                <span className="bg-white text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-slate-700 uppercase tracking-widest shadow-[2px_2px_0_rgba(51,65,85,1)]">
                                    Res: {expandedImage.resolution}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-center gap-4 w-full mt-2 flex-wrap">
                        <a href={expandedImage.url} download={`${filenamePrefix.trim() || 'Image'}_${expandedImage.sequenceNumber.toString().padStart(2, '0')}.png`} className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white border-2 border-slate-700 text-[10px] font-black rounded-full transition-all uppercase tracking-[0.2em] shadow-[4px_4px_0_rgba(51,65,85,1)] hover:translate-y-1 hover:shadow-[2px_2px_0_rgba(51,65,85,1)]">Download Master PNG</a>
                        {onSetAnchor && activeAnchorId !== expandedImage.id && (
                            <button onClick={() => { onSetAnchor(expandedImage); closeExpanded(); }} className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 border-2 border-slate-700 text-white text-[10px] font-black rounded-full transition-all uppercase tracking-[0.2em] shadow-[4px_4px_0_rgba(51,65,85,1)] hover:translate-y-1 hover:shadow-[2px_2px_0_rgba(51,65,85,1)] flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                                Set as Anchor
                            </button>
                        )}
                        {activeAnchorId === expandedImage.id && (
                            <button onClick={() => { onClearAnchor && onClearAnchor(); closeExpanded(); }} className="px-8 py-3 bg-emerald-100 hover:bg-red-100 hover:text-red-700 border-2 border-slate-700 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-[4px_4px_0_rgba(51,65,85,1)] flex items-center gap-2 transition-colors group/anchor">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 group-hover/anchor:hidden"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 hidden group-hover/anchor:block"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                <span className="group-hover/anchor:hidden">Current Anchor</span>
                                <span className="hidden group-hover/anchor:inline">Clear Anchor</span>
                            </button>
                        )}
                        <button onClick={closeExpanded} className="px-8 py-3 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-black rounded-full border-2 border-slate-700 transition-all uppercase tracking-[0.2em] shadow-[4px_4px_0_rgba(51,65,85,1)] hover:translate-y-1 hover:shadow-[2px_2px_0_rgba(51,65,85,1)]">Return</button>
                    </div>
                </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {folderToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl border-4 border-slate-700 shadow-[8px_8px_0_rgba(51,65,85,1)] p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-lg font-black uppercase text-slate-800 mb-2">Delete Folder?</h3>
            {images.filter(img => img.folderId === folderToDelete).length > 0 ? (
              <p className="text-sm font-bold text-slate-600 mb-6">
                This folder contains {images.filter(img => img.folderId === folderToDelete).length} image(s). Deleting it will move them out to the Root folder. Do you wish to proceed?
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-600 mb-6">
                Are you sure you want to delete this empty folder?
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border-2 border-slate-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeFolderId === folderToDelete) setActiveFolderId(null);
                  onDeleteFolder(folderToDelete);
                  setFolderToDelete(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 border-2 border-slate-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSelectedConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-[8px_8px_0_rgba(51,65,85,1)]">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-widest">Delete Selected?</h3>
            <p className="text-slate-600 font-bold mb-6">Are you sure you want to delete {selectedImageIds.length} selected image(s)? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteSelectedConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 border-2 border-slate-700 text-slate-700 rounded-lg text-sm font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteSelected(selectedImageIds);
                  setSelectedImageIds([]);
                  setShowDeleteSelectedConfirm(false);
                }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 border-2 border-slate-700 text-white rounded-lg text-sm font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-[8px_8px_0_rgba(51,65,85,1)]">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-widest">Delete All Images?</h3>
            <p className="text-slate-600 font-bold mb-6">Are you sure you want to completely wipe the session gallery? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 border-2 border-slate-700 text-slate-700 rounded-lg text-sm font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onDeleteAll();
                  setShowDeleteAllConfirm(false);
                }}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 border-2 border-slate-700 text-white rounded-lg text-sm font-black uppercase tracking-wider transition-all shadow-[2px_2px_0_rgba(51,65,85,1)]"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Gallery;
