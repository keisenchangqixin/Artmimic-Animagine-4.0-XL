
// Import React to fix namespace error on line 13
import React, { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { AppState, UploadedFile, LogEntry, StyleAnalysis, GeneratedImage, BackgroundMode, AspectRatio, FrameStyle, ImageResolution, ShapeType, TextPosition, FontCategory, RemixMode, FontModeOption, GalleryFolder } from './types.ts';
import { FAKE_THOUGHTS_ANALYSIS, FAKE_THOUGHTS_GENERATION } from './constants.ts';
import { analyzeStyle, generateArt, ensureApiKey, describeBaseImage } from './services/geminiService.ts';

import UploadSection from './components/UploadSection.tsx';
import Console from './components/Console.tsx';
import StyleDashboard from './components/StyleDashboard.tsx';
import ArtGenerator from './components/ArtGenerator.tsx';
import Gallery from './components/Gallery.tsx';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [folders, setFolders] = useState<GalleryFolder[]>([]);
  const [imageCounter, setImageCounter] = useState(1);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [anchorPrompt, setAnchorPrompt] = useState<string | null>(null);

  useEffect(() => {
    get('generatedImages').then((val) => {
      if (val && Array.isArray(val) && val.length > 0) {
        setGeneratedImages(val);
        setImageCounter(val[0].sequenceNumber + 1);
      }
      setIsDbLoaded(true);
    }).catch(err => {
      console.error('Failed to load images from DB', err);
      setIsDbLoaded(true);
    });
    get('galleryFolders').then((val) => {
      if (val && Array.isArray(val)) setFolders(val);
    });
  }, []);

  useEffect(() => {
    if (isDbLoaded) {
      set('generatedImages', generatedImages).catch(err => console.error('Failed to save images to DB', err));
      set('galleryFolders', folders).catch(err => console.error('Failed to save folders to DB', err));
    }
  }, [generatedImages, folders, isDbLoaded]);

  const analysisInterval = useRef<number | null>(null);
  const generationInterval = useRef<number | null>(null);
  const stopGenerationRef = useRef<boolean>(false);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      type
    }]);
  };

  const handleFilesAdded = (newFiles: UploadedFile[]) => {
    if (appState === AppState.IDLE) {
        setAppState(AppState.STAGED);
        addLog('System: Initializing staging environment...', 'system');
    } else if (appState === AppState.ANALYZED) {
        addLog(`System: Hot-swapped ${newFiles[0].category} reference into active session.`, 'action');
    }
    
    setFiles(prev => {
      const fileMap = new Map();
      prev.forEach(f => {
        const key = f.category === 'character' ? `char_${f.charIndex}_${f.viewType}` : f.category;
        fileMap.set(key, f);
      });
      
      const isUploadingScene = newFiles.some(f => f.category === 'scene');

      newFiles.forEach(f => {
        const key = f.category === 'character' ? `char_${f.charIndex}_${f.viewType}` : f.category;
        fileMap.set(key, f);
      });
      
      let combined = Array.from(fileMap.values());
      
      if (isUploadingScene) {
        combined = combined.filter(f => f.category !== 'previous_scene');
      }

      addLog(`User: Updated reference asset(s).`, 'info');
      return combined;
    });
  };



  const handleToggleStyleInfluence = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isStyleInfluence: !f.isStyleInfluence } : f));
    addLog('System: Toggled global style influence for reference.', 'action');
  };

  const handleUpdateHeightRatio = (charIndex: number, ratio: number | string) => {
    setFiles(prev => prev.map(f => f.category === 'character' && f.charIndex === charIndex ? { ...f, heightRatio: ratio } : f));
  };

  const handleUpdateCharacterName = (charIndex: number, name: string) => {
    setFiles(prev => prev.map(f => f.category === 'character' && f.charIndex === charIndex ? { ...f, characterName: name } : f));
  };

  const handleUpdateAnalysisColor = (index: number, newColor: string) => {
    if (!analysis) return;
    setAnalysis(prev => {
      if (!prev) return null;
      const nextColors = [...prev.colors];
      nextColors[index] = newColor;
      return { ...prev, colors: nextColors };
    });
    addLog(`System: Overriding color DNA palette [${index}] -> ${newColor}`, 'action');
  };

  const handleRemoveFile = (id: string) => {
    setFiles(prev => {
        const remaining = prev.filter(f => f.id !== id);
        if (remaining.length === 0) {
            setAppState(AppState.IDLE);
            setAnalysis(null);
            addLog('System: Staging area cleared.', 'system');
        } else if (appState === AppState.ANALYZED) {
            addLog('System: Reference removed. Active Engine DNA preserved.', 'info');
        }
        return remaining;
    });
  };

  const handleClearAll = () => {
    setFiles([]);
    setAppState(AppState.IDLE);
    setAnalysis(null);
    setLogs([]);
    setAnchorPrompt(null);
    addLog('System: Session reset.', 'system');
  };

  const startAnalysis = async () => {
    if (appState === AppState.ANALYZING) return;
    if (files.length === 0) return;
    
    // Set state immediately to prevent multiple clicks during API key check
    setAppState(AppState.ANALYZING);
    
    const hasKey = await ensureApiKey();
    if (!hasKey) {
        setAppState(AppState.STAGED);
        addLog('Error: API Key required to proceed.', 'error');
        return;
    }
    
    addLog('System: Starting categorized style analysis...', 'system');
    let thoughtIndex = 0;
    analysisInterval.current = window.setInterval(() => {
        if (thoughtIndex < FAKE_THOUGHTS_ANALYSIS.length) {
            addLog(FAKE_THOUGHTS_ANALYSIS[thoughtIndex], 'info');
            thoughtIndex++;
        }
    }, 400);
    try {
        const result = await analyzeStyle(files);
        if (analysisInterval.current) clearInterval(analysisInterval.current);
        setAnalysis(result);
        setAppState(AppState.ANALYZED);
        addLog('Success: Style DNA extracted and locked.', 'success');
        addLog('System: Generator unlocked.', 'action');
    } catch (error: any) {
        if (analysisInterval.current) clearInterval(analysisInterval.current);
        setAppState(AppState.STAGED);
        addLog(`Error: Analysis failed. ${error.message || 'Check console for details.'}`, 'error');
    }
  };

  const handleStopGeneration = () => {
    stopGenerationRef.current = true;
    addLog('User: Emergency Stop triggered. Finishing current render...', 'error');
  };

  const handleSetAnchor = (image: GeneratedImage) => {
    if (!image.url || !image.url.includes(',')) {
      addLog('Error: Cannot set anchor. Image data is invalid or not base64.', 'error');
      return;
    }
    
    setAnchorPrompt(image.prompt || null);

    setFiles(prev => {
      const filtered = prev.filter(f => f.category !== 'previous_scene' && f.category !== 'scene');
      return [...filtered, {
        id: `anchor-${image.id}`,
        data: image.url.split(',')[1],
        mimeType: 'image/png',
        category: 'previous_scene'
      }];
    });
    
    if (appState === AppState.IDLE || appState === AppState.STAGED) {
      if (!analysis) {
        setAnalysis({
          technique: "Art style defined by the anchor image",
          colors: ["Original colors from anchor"],
          isColoringBook: false,
          isWhiteBackground: false
        });
      }
      setAppState(AppState.ANALYZED);
      addLog('System: Generator unlocked via continuity anchor.', 'action');
    }
    
    addLog(`System: Image #${image.sequenceNumber.toString().padStart(2, '0')} set as continuity anchor.`, 'system');
  };

  const handleClearAnchor = () => {
    setFiles(prev => prev.filter(f => f.category !== 'previous_scene'));
    setAnchorPrompt(null);
    addLog('System: Continuity anchor cleared.', 'system');
  };

  const handleGenerate = async (
    prompts: string[], 
    influence: string, 
    bgMode: BackgroundMode, 
    bgColor: string,
    aspectRatio: AspectRatio,
    resolution: ImageResolution,
    useStagingCharacter: boolean,
    isSequential: boolean,
    isRemix: boolean
  ) => {
    if (appState === AppState.GENERATING) return;
    
    // Set state immediately to prevent multiple clicks during API key check
    setAppState(AppState.GENERATING);
    
    const hasKey = await ensureApiKey();
    if (!hasKey) {
        setAppState(AppState.ANALYZED);
        return;
    }

    stopGenerationRef.current = false;
    const isBatch = prompts.length > 1;
    
    if (isBatch) addLog(`System: Initiating Batch Render for ${prompts.length} subjects...`, 'system');
    const effectivePrompts = prompts.length > 0 ? prompts : [""];

    let currentCounter = imageCounter;
    let currentUseStagingCharacter = useStagingCharacter;
    let currentReferenceFiles = [...files];

    for (let i = 0; i < effectivePrompts.length; i++) {
        if (stopGenerationRef.current) {
            addLog(`System: Batch stopped at ${i}/${effectivePrompts.length}.`, 'error');
            break;
        }

        let currentPrompt = effectivePrompts[i];
        if (isBatch) addLog(`System: Rendering Subject ${i + 1}/${effectivePrompts.length}...`, 'action');
        
        const safePrompt = currentPrompt || "[Subject]";
        let thoughtIndex = 0;
        if (generationInterval.current) clearInterval(generationInterval.current);
        generationInterval.current = window.setInterval(() => {
            if (thoughtIndex < FAKE_THOUGHTS_GENERATION.length) {
                addLog(FAKE_THOUGHTS_GENERATION[thoughtIndex], 'info');
                thoughtIndex++;
            }
        }, 600);
        try {
            const base64Image = await generateArt(
              currentPrompt, influence, bgMode, bgColor, aspectRatio, resolution, 
              analysis, currentReferenceFiles, currentUseStagingCharacter, isSequential, isRemix
            );
            if (generationInterval.current) clearInterval(generationInterval.current);
            const newImage: GeneratedImage = {
                id: Math.random().toString(36).substr(2, 9),
                url: base64Image,
                prompt: safePrompt,
                timestamp: Date.now(),
                resolution,
                aspectRatio,
                sequenceNumber: currentCounter
            };
            setGeneratedImages(prev => [newImage, ...prev]);
            addLog(`Success: Render ${i + 1} completed as asset #${currentCounter.toString().padStart(2, '0')}.`, 'success');
            
            if (isSequential) {
                // Remove any existing previous_scene reference
                currentReferenceFiles = currentReferenceFiles.filter(f => f.category !== 'previous_scene');
                
                // Add the newly generated image as the previous_scene reference for the next iteration
                currentReferenceFiles.push({
                    id: `previous-scene-${currentCounter}`,
                    data: base64Image.split(',')[1],
                    mimeType: 'image/png',
                    category: 'previous_scene'
                });
                addLog(`System: Locked frame #${currentCounter.toString().padStart(2, '0')} as story continuity anchor for next scene.`, 'system');
            }

            if (i === 0 && isSequential && !useStagingCharacter) {
                addLog('System: Story Mode continuity active. Locking frame #01 as character anchor.', 'system');
                currentUseStagingCharacter = true; 
                
                // Remove existing characters because the user opted out of using them
                currentReferenceFiles = currentReferenceFiles.filter(f => f.category !== 'character');

                // We don't overwrite currentReferenceFiles entirely anymore, we just add the character ref
                currentReferenceFiles.push({
                    id: 'sequential-anchor-ref',
                    data: base64Image.split(',')[1],
                    mimeType: 'image/png',
                    category: 'character',
                    charIndex: 0,
                    characterName: 'C1'
                });
            }

            currentCounter++;
        } catch (error: any) {
            if (generationInterval.current) clearInterval(generationInterval.current);
            addLog(`Error: Render failed. ${error.message || ''}`, 'error');
        }
    }
    setImageCounter(currentCounter);
    setAppState(AppState.ANALYZED);
    stopGenerationRef.current = false;
  };

  const handleMoveImagesToFolder = (imageIds: string[], folderId?: string) => {
    setGeneratedImages(prev => prev.map(img => imageIds.includes(img.id) ? { ...img, folderId } : img));
    addLog(`User: Moved ${imageIds.length} image(s) to folder.`, 'info');
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: GalleryFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      timestamp: Date.now()
    };
    setFolders(prev => [...prev, newFolder]);
    addLog(`User: Created folder "${name}".`, 'info');
  };

  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setGeneratedImages(prev => prev.map(img => img.folderId === id ? { ...img, folderId: undefined } : img));
    addLog('User: Deleted folder.', 'info');
  };

  const handleRenameFolder = (id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    addLog(`User: Renamed folder to "${newName}".`, 'info');
  };

  const handleDeleteImage = (id: string) => {
    setGeneratedImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const reversed = [...filtered].reverse();
      const reindexed = reversed.map((img, idx) => ({
        ...img,
        sequenceNumber: idx + 1
      }));
      const final = reindexed.reverse();
      setImageCounter(final.length + 1);
      return final;
    });
    addLog('User: Removed image asset and recalculated gallery sequence.', 'info');
  };

  const handleDeleteSelectedImages = (ids: string[]) => {
    setGeneratedImages(prev => {
      const filtered = prev.filter(img => !ids.includes(img.id));
      const reversed = [...filtered].reverse();
      const reindexed = reversed.map((img, idx) => ({
        ...img,
        sequenceNumber: idx + 1
      }));
      const final = reindexed.reverse();
      setImageCounter(final.length + 1);
      return final;
    });
    addLog(`User: Removed ${ids.length} selected image(s) and recalculated gallery sequence.`, 'info');
  };

  const handleReorderImages = (newOrderIds: string[]) => {
    setGeneratedImages(prev => {
        const next = [...prev];
        const indices = next.map((img, index) => newOrderIds.includes(img.id) ? index : -1).filter(i => i !== -1);
        for (let i = 0; i < indices.length; i++) {
             const img = prev.find(x => x.id === newOrderIds[i])!;
             next[indices[i]] = img;
        }
        return next.map((img, idx) => ({ ...img, sequenceNumber: next.length - idx }));
    });
  };

  const handleDeleteAllImages = () => {
    setGeneratedImages([]);
    setImageCounter(1); 
    addLog('System: Gallery session wiped. Counter reset to 01.', 'system');
  };

  useEffect(() => {
    return () => {
        if (analysisInterval.current) clearInterval(analysisInterval.current);
        if (generationInterval.current) clearInterval(generationInterval.current);
    };
  }, []);

  const hasMinimumRequirements = files.some(f => f.category === 'character' || f.category === 'font' || f.category === 'scene' || f.category === 'icon');

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans selection:bg-pink-300 relative">
        {/* Floating Motifs - Cute Cartoon Characters */}
        <div className="floating-motif text-5xl" style={{ top: '8%', left: '4%', animationDelay: '0s' }}>🐰</div>
        <div className="floating-motif text-6xl" style={{ top: '15%', right: '8%', animationDelay: '1.2s' }}>🐸</div>
        <div className="floating-motif text-5xl" style={{ bottom: '12%', left: '10%', animationDelay: '2.4s' }}>🐱</div>
        <div className="floating-motif text-7xl" style={{ bottom: '20%', right: '6%', animationDelay: '3.1s' }}>🐼</div>
        <div className="floating-motif text-6xl" style={{ top: '45%', left: '3%', animationDelay: '1.8s' }}>🐶</div>
        <div className="floating-motif text-5xl" style={{ top: '55%', right: '4%', animationDelay: '2.7s' }}>🦊</div>
        <div className="floating-motif text-4xl" style={{ top: '30%', left: '12%', animationDelay: '0.5s' }}>🦄</div>
        <div className="floating-motif text-6xl" style={{ bottom: '40%', right: '12%', animationDelay: '1.5s' }}>🐻</div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
            <div className="lg:col-span-12 flex items-center justify-between border-b-4 border-slate-700 pb-6 mb-4">
                <div>
                    <h1 className="text-4xl font-bold text-pink-500 drop-shadow-[2px_2px_0_rgba(51,65,85,1)] tracking-wide">ArtMimic Studio 🎨✨</h1>
                    <p className="text-slate-700 mt-1 font-bold text-lg">AI-Powered Style Replication Workstation 🖌️</p>
                </div>
                <div className="flex gap-2">
                    <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 shadow-[2px_2px_0_rgba(51,65,85,1)] ${
                        appState === AppState.IDLE ? 'border-slate-700 bg-white text-slate-700' :
                        appState === AppState.STAGED ? 'border-yellow-600 bg-yellow-100 text-yellow-700' :
                        appState === AppState.ANALYZING ? 'border-blue-600 bg-blue-100 text-blue-700 animate-pulse' :
                        appState === AppState.ANALYZED ? 'border-emerald-600 bg-emerald-100 text-emerald-700' :
                        appState === AppState.GENERATING ? 'border-purple-600 bg-purple-100 text-purple-700 animate-pulse' :
                        'border-red-600 bg-red-100 text-red-700'
                    }`}>STATUS: {appState}</span>
                </div>
            </div>
            <div className="lg:col-span-5 space-y-8">
                <UploadSection 
                    files={files} 
                    onFilesAdded={handleFilesAdded} 
                    onRemoveFile={handleRemoveFile} 
                    onClearAll={handleClearAll} 
                    onToggleStyle={handleToggleStyleInfluence}
                    onUpdateHeightRatio={handleUpdateHeightRatio}
                    onUpdateCharacterName={handleUpdateCharacterName}
                    appState={appState} 
                />
                {(appState === AppState.STAGED || appState === AppState.ANALYZED) && hasMinimumRequirements && (
                    <button 
                        onClick={startAnalysis} 
                        className={`w-full py-4 text-lg font-bold handdrawn-button animate-fade-in uppercase tracking-widest ${appState === AppState.ANALYZED ? 'bg-indigo-400 text-white' : 'bg-yellow-300 text-slate-800'}`}
                    >
                        {appState === AppState.ANALYZED ? 'RE-SYNC ENGINE DNA (Update Analysis)' : 'CONFIRM & BEGIN STUDY'}
                    </button>
                )}
                {!hasMinimumRequirements && appState === AppState.STAGED && (
                    <div className="w-full py-4 bg-white text-slate-500 font-bold text-center handdrawn-border uppercase tracking-widest text-sm">
                        Upload a Character, Icon, Font, or Scene to proceed
                    </div>
                )}
                <Console logs={logs} />
                <StyleDashboard 
                  analysis={analysis} 
                  onUpdateColor={handleUpdateAnalysisColor}
                />
            </div>
            <div className="lg:col-span-7 space-y-8">
                <ArtGenerator 
                  onGenerate={handleGenerate} 
                  onStop={handleStopGeneration} 
                  appState={appState} 
                  stagingFiles={files} 
                  onSetFiles={setFiles} 
                  latestResult={generatedImages[0]} 
                  onClearAnchor={handleClearAnchor} 
                  analysis={analysis} 
                  activeAnchorPrompt={anchorPrompt}
                />
                <Gallery 
                  images={generatedImages} 
                  folders={folders}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onMoveImages={handleMoveImagesToFolder}
                  onDelete={handleDeleteImage} 
                  onDeleteSelected={handleDeleteSelectedImages}
                  onDeleteAll={handleDeleteAllImages} 
                  onReorderImages={handleReorderImages}
                  onSetAnchor={handleSetAnchor} 
                  onClearAnchor={handleClearAnchor}
                  activeAnchorId={files.find(f => f.category === 'previous_scene')?.id?.replace('anchor-', '') || null}
                />
            </div>
        </div>
    </div>
  );
};

export default App;
