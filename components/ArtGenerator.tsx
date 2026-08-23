import React, { useState, useEffect, useRef } from "react";
import { get, set } from "idb-keyval";
import {
  BackgroundMode,
  AppState,
  AspectRatio,
  FrameStyle,
  ImageResolution,
  UploadedFile,
  ShapeType,
  TextPosition,
  FontCategory,
  RemixMode,
  GeneratedImage,
  TextSuggestionTone,
  FontModeOption,
  SavedPromptSeries,
  StyleAnalysis,
} from "../types.ts";
import {
  generateMagicRoll,
  generateSequelStoryAndCharacters,
  generateSeriesName,
  generateArt,
} from "../services/geminiService.ts";

interface ArtGeneratorProps {
  onGenerate: (
    prompts: string[],
    influence: string,
    bgMode: BackgroundMode,
    bgColor: string,
    ratio: AspectRatio,
    resolution: ImageResolution,
    useStagingCharacter: boolean,
    isSequential: boolean,
    isRemix: boolean,
  ) => void;
  onStop: () => void;
  appState: AppState;
  stagingFiles: UploadedFile[];
  onSetFiles: (files: UploadedFile[]) => void;
  latestResult?: GeneratedImage;
  onClearAnchor?: () => void;
  analysis?: StyleAnalysis | null;
  activeAnchorPrompt?: string | null;
}

const shapeDescriptions: Record<ShapeType, string> = {
  [ShapeType.NONE]: "No masking: The full image extends to all edges.",
  [ShapeType.IMAGE_CUT]:
    "Graphic Asset Mode: Isolated subject with clean edges and zero background environment.",
  [ShapeType.SQUARE]: "Perfectly centered square geometric frame.",
  [ShapeType.CIRCLE]: "Soft circular vignette mask for portraits.",
  [ShapeType.STAR]: "Dynamic multi-point star shape cutout.",
  [ShapeType.TRIANGLE]: "Bold geometric triangular silhouette.",
  [ShapeType.RECTANGLE]: "Standard internal rectangular border.",
  [ShapeType.HEART]: "Stylized heart-shaped framing.",
  [ShapeType.HEXAGON]: "Modern honeycomb geometric border.",
};

const ArtGenerator: React.FC<ArtGeneratorProps> = ({
  onGenerate,
  onStop,
  appState,
  stagingFiles,
  onSetFiles,
  latestResult,
  onClearAnchor,
  analysis,
  activeAnchorPrompt,
}) => {
  const [prompt, setPrompt] = useState("");
  const [magicKeywords, setMagicKeywords] = useState("");
  const [useStagingCharacter, setUseStagingCharacter] = useState(true);
  const [followInputs, setFollowInputs] = useState(false);
  const [smartImport, setSmartImport] = useState(false);
  const [isRemix, setIsRemix] = useState(false);
  const [bgMode, setBgMode] = useState<BackgroundMode>(
    BackgroundMode.FULL_BACKGROUND,
  );
  const [customBgColor, setCustomBgColor] = useState("#0f172a");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [resolution, setResolution] = useState<ImageResolution>("1K");
  const [rememberSettings, setRememberSettings] = useState(false);

  useEffect(() => {
    get("rememberSettings").then((val) => {
      if (val) {
        setRememberSettings(true);
        get("savedAspectRatio").then((ratio) => {
          if (ratio) setAspectRatio(ratio as AspectRatio);
        });
        get("savedResolution").then((res) => {
          if (res) setResolution(res as ImageResolution);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (rememberSettings) {
      set("rememberSettings", true);
      set("savedAspectRatio", aspectRatio);
      set("savedResolution", resolution);
    } else {
      set("rememberSettings", false);
    }
  }, [rememberSettings, aspectRatio, resolution]);

  const [isMagicRolling, setIsMagicRolling] = useState(false);
  const [magicRollOptions, setMagicRollOptions] = useState<string[]>([]);
  const [magicRollCount, setMagicRollCount] = useState<number | string>(10);
  const [storyMode, setStoryMode] = useState(false);
  const [includeCovers, setIncludeCovers] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorStyle, setAuthorStyle] = useState("");
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [sequelFile, setSequelFile] = useState<File | null>(null);
  const [influenceStory, setInfluenceStory] = useState("");
  const [sequelPageCountOverride, setSequelPageCountOverride] = useState<number | "">("");
  const [isGeneratingSequelStory, setIsGeneratingSequelStory] = useState(false);
  const [pendingCharacters, setPendingCharacters] = useState<{name: string, description: string}[]>([]);
  const [selectedPendingChars, setSelectedPendingChars] = useState<Set<string>>(new Set());
  const [isGeneratingCharacters, setIsGeneratingCharacters] = useState(false);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [lastFocusedField, setLastFocusedField] = useState<
    "prompt" | "influence"
  >("prompt");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const influenceRef = useRef<HTMLTextAreaElement>(null);
  const influenceStoryRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (influenceStoryRef.current) {
      influenceStoryRef.current.style.height = 'auto';
      influenceStoryRef.current.style.height = influenceStoryRef.current.scrollHeight + 'px';
    }
  }, [influenceStory]);

  const [hasCopied, setHasCopied] = useState(false);

  const [savedSeries, setSavedSeries] = useState<SavedPromptSeries[]>([]);
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editingSeriesName, setEditingSeriesName] = useState("");
  const [newSeriesName, setNewSeriesName] = useState("");

  useEffect(() => {
    get("savedPromptSeries")
      .then((val) => {
        if (val && Array.isArray(val)) {
          setSavedSeries(val);
        }
      })
      .catch((err) => console.error("Failed to load saved series", err));
  }, []);

  useEffect(() => {
    if (activeAnchorPrompt) {
      setPrompt(activeAnchorPrompt);
      const index = magicRollOptions.findIndex((opt) => opt === activeAnchorPrompt);
      if (index !== -1) {
        setSelectedIndices(new Set([index]));
      } else {
        setSelectedIndices(new Set());
      }
    }
  }, [activeAnchorPrompt]);

  const saveSeriesToDb = async (newSeries: SavedPromptSeries[]) => {
    setSavedSeries(newSeries);
    try {
      await set("savedPromptSeries", newSeries);
    } catch (err) {
      console.error("Failed to save series to DB", err);
    }
  };

  const handleSaveInline = async () => {
    if (!newSeriesName.trim()) {
      addLog('System: Please enter a name to save the prompt.', 'error');
      return;
    }
    const promptsToSave = magicRollOptions.length > 0 ? magicRollOptions : (prompt.trim() ? [prompt] : []);
    if (promptsToSave.length === 0) {
      addLog('System: No prompts to save.', 'error');
      return;
    }
    setIsSavingSeries(true);
    try {
      const newSeries: SavedPromptSeries = {
        id: Math.random().toString(36).substr(2, 9),
        name: newSeriesName.trim(),
        prompts: [...promptsToSave],
        timestamp: Date.now(),
      };
      await saveSeriesToDb([newSeries, ...savedSeries]);
      setNewSeriesName("");
      addLog(`System: Saved prompt "${newSeriesName.trim()}".`, 'success');
    } catch (error) {
      console.error("Failed to save series:", error);
    } finally {
      setIsSavingSeries(false);
    }
  };

  const handleLoadSeries = (series: SavedPromptSeries) => {
    if (series.prompts.length === 1 && magicRollOptions.length === 0) {
      setPrompt(series.prompts[0]);
    } else {
      setMagicRollOptions([...series.prompts]);
      setSelectedIndices(new Set(series.prompts.map((_, i) => i)));
    }
    addLog(`User: Loaded prompt "${series.name}".`, 'info');
  };

  const handleDeleteSeries = async (id: string) => {
    const newSeries = savedSeries.filter((s) => s.id !== id);
    await saveSeriesToDb(newSeries);
  };

  const handleStartEditSeriesName = (series: SavedPromptSeries) => {
    setEditingSeriesId(series.id);
    setEditingSeriesName(series.name);
  };

  const handleSaveSeriesName = async (id: string) => {
    const newSeries = savedSeries.map((s) =>
      s.id === id ? { ...s, name: editingSeriesName } : s,
    );
    await saveSeriesToDb(newSeries);
    setEditingSeriesId(null);
  };

  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    startIndex: number;
    field: "prompt" | "magicKeywords" | `roll_${number}` | null;
    selectedIndex: number;
  }>({
    isOpen: false,
    query: "",
    startIndex: -1,
    field: null,
    selectedIndex: 0,
  });

  const isLocked = false; // Always active even when no image is uploaded
  const isGenerating = appState === AppState.GENERATING;

  // Ref for the dynamic textareas
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Filter character indices to ONLY those that have at least one uploaded image
  const activeCharIndices: number[] = Array.from(
    new Set<number>(
      stagingFiles
        .filter((f) => f.category === "character")
        .map((f) => f.charIndex ?? 0),
    ),
  ).sort((a: number, b: number) => a - b);

  const hasIconRef = stagingFiles.some((f) => f.category === "icon");

  const availableMentions = [
    ...activeCharIndices.map((idx) => {
      const charFile = stagingFiles.find(
        (f) => f.category === "character" && f.charIndex === idx,
      );
      return charFile?.characterName || `C${idx + 1}`;
    }),
    ...pendingCharacters.map(c => c.name)
  ];
  if (hasIconRef) availableMentions.push("icon");

  const filteredMentions = availableMentions.filter((m) =>
    m.toLowerCase().includes(mentionState.query.toLowerCase()),
  );

  const checkMention = (
    textarea: HTMLTextAreaElement,
    field: "prompt" | "magicKeywords" | `roll_${number}`,
    val: string,
  ) => {
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      const startIndex = cursorPosition - lastWord.length;
      setMentionState({
        isOpen: true,
        query,
        startIndex,
        field,
        selectedIndex: 0,
      });
    } else {
      setMentionState((prev) =>
        prev.isOpen ? { ...prev, isOpen: false } : prev,
      );
    }
  };

  const handleTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    field: "prompt" | "magicKeywords",
    setter: (val: string) => void,
  ) => {
    const val = e.target.value;
    setter(val);
    checkMention(e.target, field, val);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!smartImport) return;

    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const lines = pastedText
      .split(/(?=(?:^|\n)\s*Scene\s+\d+)/i)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 1 || pastedText.match(/(?:^|\n)\s*Scene\s+\d+/i)) {
      e.preventDefault();
      setMagicRollOptions(lines);
      setSelectedIndices(new Set(lines.map((_, i) => i)));

      if (storyMode) {
        setMagicKeywords("");
      } else {
        setPrompt("");
      }
    }
  };

  const handleSelectMention = (mention: string) => {
    if (!mentionState.isOpen || mentionState.field === null) return;

    const insertText = `@${mention} `;
    const newCursorPos = mentionState.startIndex + insertText.length;

    if (mentionState.field === "prompt") {
      const before = prompt.slice(0, mentionState.startIndex);
      const after = prompt.slice(
        mentionState.startIndex + mentionState.query.length + 1,
      );
      setPrompt(before + insertText + after);
      setTimeout(() => {
        if (promptRef.current) {
          promptRef.current.focus();
          promptRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else if (mentionState.field === "magicKeywords") {
      const before = magicKeywords.slice(0, mentionState.startIndex);
      const after = magicKeywords.slice(
        mentionState.startIndex + mentionState.query.length + 1,
      );
      setMagicKeywords(before + insertText + after);
      setTimeout(() => {
        if (influenceRef.current) {
          influenceRef.current.focus();
          influenceRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else if (mentionState.field.startsWith("roll_")) {
      const idx = parseInt(mentionState.field.split("_")[1]);
      const currentVal = magicRollOptions[idx];
      const before = currentVal.slice(0, mentionState.startIndex);
      const after = currentVal.slice(
        mentionState.startIndex + mentionState.query.length + 1,
      );
      handleEditRoll(idx, before + insertText + after);
      setTimeout(() => {
        if (textareaRefs.current[idx]) {
          textareaRefs.current[idx]?.focus();
          textareaRefs.current[idx]?.setSelectionRange(
            newCursorPos,
            newCursorPos,
          );
        }
      }, 0);
    }

    setMentionState({
      isOpen: false,
      query: "",
      startIndex: -1,
      field: null,
      selectedIndex: 0,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.isOpen && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % filteredMentions.length,
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + filteredMentions.length) %
            filteredMentions.length,
        }));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectMention(filteredMentions[mentionState.selectedIndex]);
      } else if (e.key === "Escape") {
        setMentionState((prev) => ({ ...prev, isOpen: false }));
      }
    }
  };

  const MentionDropdown = ({ field }: { field: string }) => {
    if (
      !mentionState.isOpen ||
      mentionState.field !== field ||
      filteredMentions.length === 0
    )
      return null;
    return (
      <div className="absolute z-50 w-48 bg-slate-800 border border-indigo-500/50 rounded-lg shadow-xl mt-1 overflow-hidden max-h-40 overflow-y-auto">
        {filteredMentions.map((mention, idx) => (
          <div
            key={mention}
            onClick={() => handleSelectMention(mention)}
            className={`px-3 py-2 text-xs cursor-pointer font-bold transition-colors ${idx === mentionState.selectedIndex ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}
          >
            @{mention}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (isLocked || isGenerating) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Base image paste logic removed
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isLocked, isGenerating]);

  // Adjust heights of all textareas when magicRollOptions changes
  useEffect(() => {
    magicRollOptions.forEach((_, i) => {
      const el = textareaRefs.current[i];
      if (el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    });
  }, [magicRollOptions]);

  const handleCreatePages = () => {
    const count = parseInt(String(magicRollCount)) || 1;
    const newPages = new Array(count).fill("");
    setMagicRollOptions(newPages);
    setSelectedIndices(new Set(newPages.map((_, i) => i)));
    addLog(`System: Created ${count} blank prompt pages.`, "action");
  };

  const handleGenerateSequelStory = async () => {
    if (!sequelFile) return;
    setIsGeneratingSequelStory(true);
    try {
      const { story, characters, pageCount } = await generateSequelStoryAndCharacters(sequelFile, influenceStory, sequelPageCountOverride === "" ? null : sequelPageCountOverride);
      setMagicKeywords(story);
      if (pageCount) {
        setMagicRollCount(includeCovers ? pageCount + 2 : pageCount);
      }
      
      let charText = characters.map(c => `- ${c.name}: ${c.description}`).join('\n');
      if (charText) {
        setMagicKeywords(prev => prev + '\n\n*** CHARACTER DESCRIPTIONS ***\n' + charText);
      }
      
      setPendingCharacters(characters);
      setSelectedPendingChars(new Set(characters.map(c => c.name)));
      addLog(`System: Generated sequel story and extracted ${characters.length} character descriptions. You can now generate their designs.`, "success");

      setSequelFile(null);
      setInfluenceStory("");
    } catch (error) {
      console.error("Sequel generation failed:", error);
      addLog(`System: Sequel generation failed.`, "error");
    } finally {
      setIsGeneratingSequelStory(false);
    }
  };

  const handleGenerateCharacterDesigns = async () => {
    const charsToGenerate = pendingCharacters.filter(c => selectedPendingChars.has(c.name));
    if (charsToGenerate.length === 0) return;
    setIsGeneratingCharacters(true);
    const newFiles: UploadedFile[] = [];
    
    // Find the next available character index
    let nextCharIndex = stagingFiles.reduce((max, f) => {
      if (f.category === 'character' && f.charIndex !== undefined) {
        return Math.max(max, f.charIndex);
      }
      return max;
    }, -1) + 1;

    try {
      let currentUpdatedFiles = [...stagingFiles];
      const styleMasters = stagingFiles.filter(f => f.isStyleInfluence);
      const anchorChar = stagingFiles.find(f => f.category === 'character' && f.charIndex === 0);
      const refsToPass: UploadedFile[] = [...styleMasters];
      
      if (anchorChar && !refsToPass.find(f => f.id === anchorChar.id)) {
        refsToPass.push({
          ...anchorChar,
          isStyleInfluence: true,
          category: 'scene' // to avoid being treated as a character constraint
        });
      }

      for (let i = 0; i < charsToGenerate.length; i++) {
        const char = charsToGenerate[i];
        try {
          addLog(`System: Generating image for ${char.name}...`, "action");
          const charImage = await generateArt(
            `A clear, professional character design sheet or portrait of: ${char.description}. Clean background, highly detailed. CRITICAL: DO NOT copy the appearance, face, or clothing of the anchor character reference. ONLY use it for art style.`,
            "",
            BackgroundMode.WHITE,
            "#ffffff",
            "1:1",
            "1K",
            analysis || { colors: [], description: "", mood: [], technique: "", dimensionality: "", typography: { fontFamilyType: "", weight: "", characteristics: "", isHandwritten: false, texture: "", layout: "", primaryColor: "", secondaryColor: "", emphasisLogic: "", hierarchyBlueprint: "", blacklistWords: [] } } as any,
            refsToPass,
            false,
            false
          );
          if (charImage) {
            const existingIndex = currentUpdatedFiles.findIndex(f => f.category === 'character' && f.characterName === char.name);
            if (existingIndex >= 0) {
              currentUpdatedFiles[existingIndex] = {
                ...currentUpdatedFiles[existingIndex],
                data: charImage.split(',')[1] || charImage,
              };
            } else {
              currentUpdatedFiles.push({
                id: Date.now().toString() + "_" + i,
                data: charImage.split(',')[1] || charImage,
                mimeType: 'image/png',
                category: 'character',
                viewType: 'front',
                charIndex: nextCharIndex++,
                characterName: char.name
              });
            }
            onSetFiles([...currentUpdatedFiles]); // Update UI immediately per character
          }
          // Delay to prevent hitting rate limits
          if (i < charsToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 15000));
          }
        } catch (e) {
          console.error(`Failed to generate character image for ${char.name}`, e);
          addLog(`System: Failed to generate image for ${char.name}.`, "error");
        }
      }

      addLog(`System: Finished generating character references.`, "success");
      
      const generatedNames = new Set(charsToGenerate.map(c => c.name));
      setSelectedPendingChars(prev => {
        const next = new Set(prev);
        generatedNames.forEach(name => next.delete(name));
        return next;
      });
    } catch (error) {
      console.error("Character generation failed:", error);
      addLog(`System: Character generation failed.`, "error");
    } finally {
      setIsGeneratingCharacters(false);
    }
  };

  const handleMagicRoll = async () => {
    setIsMagicRolling(true);
    setMagicRollOptions([]);
    setSelectedIndices(new Set());
    const charRefs = stagingFiles.filter((f) => f.category === "character");
    const hasStyleMaster = stagingFiles.some((f) => f.isStyleInfluence);

    try {
      const count = parseInt(String(magicRollCount)) || 1;
      const keywordsToUse = storyMode ? magicKeywords : prompt;
      const options = await generateMagicRoll(
        keywordsToUse,
        charRefs,
        count,
        storyMode,
        useStagingCharacter,
        authorStyle,
        manuscriptFile,
        followInputs,
        hasStyleMaster,
        storyMode ? includeCovers : false,
        storyMode ? bookTitle : "",
        storyMode ? authorName : "",
      );
      setMagicRollOptions(options);
      setSelectedIndices(new Set(options.map((_, i) => i)));
    } catch (error) {
      console.error("Magic Roll failed:", error);
    } finally {
      setIsMagicRolling(false);
    }
  };

  const handleEditRoll = (idx: number, newVal: string) => {
    const next = [...magicRollOptions];
    next[idx] = newVal;
    setMagicRollOptions(next);

    // Auto-resize specifically for the one being edited
    const el = textareaRefs.current[idx];
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }

    if (selectedIndices.size === 1 && selectedIndices.has(idx)) {
      setPrompt(newVal);
    }
  };

  const handleToggleRoll = (idx: number) => {
    if (activeAnchorPrompt && onClearAnchor) {
      onClearAnchor();
    }
    const next = new Set(selectedIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedIndices(next);
    if (next.size === 1) {
      setPrompt(magicRollOptions[Array.from(next)[0]]);
    }
  };

  const handleSelectAll = () => {
    if (activeAnchorPrompt && onClearAnchor) {
      onClearAnchor();
    }
    if (selectedIndices.size === magicRollOptions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(magicRollOptions.map((_, i) => i)));
    }
  };

  const handleCopyAll = () => {
    if (magicRollOptions.length === 0) return;
    const textToCopy = magicRollOptions
      .map(
        (opt, i) =>
          `${storyMode ? `Scene ${i + 1}` : `Idea ${i + 1}`}:\n${opt}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(textToCopy).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
  };

  const handleDeleteTextOverlays = () => {
    if (magicRollOptions.length === 0) return;

    // Catch variants like: Text Overlay: "Text", Text overlay: Text, OverlayText: "Text", etc.
    const textOverlayRegex =
      /\s*(?:Text\s+overlay|TextOverlay|OverlayText|Text\s+overlay\s+text):\s*(?:"[^"]*"|[^\n\r,]+)/gi;

    const next = magicRollOptions.map((opt) => {
      return opt.replace(textOverlayRegex, "").trim();
    });

    setMagicRollOptions(next);
    if (selectedIndices.size === 1) {
      setPrompt(next[Array.from(selectedIndices)[0]]);
    }
    addLog("System: Stripped text overlays from all scenes.", "action");
  };

  const insertMention = (tag: string) => {
    const mention = `${tag} `;
    if (lastFocusedField === "influence") {
      setMagicKeywords((prev) => {
        const next = prev + mention;
        setTimeout(() => {
          if (influenceRef.current) {
            influenceRef.current.focus();
            influenceRef.current.setSelectionRange(next.length, next.length);
          }
        }, 0);
        return next;
      });
    } else {
      setPrompt((prev) => {
        const next = prev + mention;
        setTimeout(() => {
          if (promptRef.current) {
            promptRef.current.focus();
            promptRef.current.setSelectionRange(next.length, next.length);
          }
        }, 0);
        return next;
      });
    }
  };

  const handleGenerateClick = () => {
    let promptsToRun: string[] = [];
    let influenceToPass = magicKeywords;

    if (selectedIndices.size > 0) {
      promptsToRun = Array.from(selectedIndices)
        .sort((a: number, b: number) => a - b)
        .map((idx) => magicRollOptions[idx]);
      influenceToPass = ""; // Do not pass overarching story as influence to individual scenes
    } else if (prompt.trim()) {
      promptsToRun = [prompt];
    }

    if (promptsToRun.length > 0) {
      onGenerate(
        promptsToRun,
        influenceToPass,
        bgMode,
        customBgColor,
        aspectRatio,
        resolution,
        useStagingCharacter,
        storyMode,
        storyMode ? false : isRemix,
      );
    }
  };

  const addLog = (
    message: string,
    type: "info" | "system" | "action" | "success" | "error" = "info",
  ) => {
    console.log(`[ArtGenerator] ${type.toUpperCase()}: ${message}`);
  };

  const isButtonDisabled =
    isGenerating || (!prompt.trim() && selectedIndices.size === 0);

  // Show single prompt override only if no pages exist and story mode is not active
  const hideSingleOverride = magicRollOptions.length > 0 || storyMode;

  const MentionButtons = () => {
    // Combine characters from stagingFiles and pendingCharacters
    const allMentions: { name: string, isPending: boolean, isGenerated: boolean, charIndex?: number }[] = [];
    
    activeCharIndices.forEach((idx) => {
      const charFile = stagingFiles.find((f) => f.category === "character" && f.charIndex === idx);
      const charName = charFile?.characterName || `C${idx + 1}`;
      const isPending = pendingCharacters.some(p => p.name === charName);
      allMentions.push({ name: charName, isPending, isGenerated: true, charIndex: idx });
    });
    
    pendingCharacters.forEach((char) => {
      if (!allMentions.some(m => m.name === char.name)) {
        allMentions.push({ name: char.name, isPending: true, isGenerated: false });
      }
    });

    const pendingNames = pendingCharacters.map(c => c.name);
    const allSelected = pendingNames.length > 0 && pendingNames.every(name => selectedPendingChars.has(name));
    
    const handleSelectDeselectAll = () => {
      if (allSelected) {
        setSelectedPendingChars(new Set());
      } else {
        setSelectedPendingChars(new Set(pendingNames));
      }
    };

    return (
      <div
        className="flex flex-col sm:flex-row sm:items-start sm:items-center gap-2 bg-white p-1.5 px-3 rounded-lg border-2 border-slate-300 shadow-sm"
        title="Click to insert a character mention into the active text field."
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
            Mentions:
          </span>
          <div className="flex gap-1.5 flex-wrap items-center">
            {allMentions.map((mention, i) => {
              const isSelected = selectedPendingChars.has(mention.name);
              const buttonClasses = mention.isGenerated
                ? "text-[10px] bg-indigo-100 hover:bg-indigo-500 text-indigo-700 hover:text-white px-2 py-0.5 rounded font-black border border-indigo-200 transition-all"
                : "text-[10px] bg-indigo-100 hover:bg-indigo-500 text-indigo-700 hover:text-white px-2 py-0.5 rounded font-black border border-indigo-200 transition-all border-dashed";

              if (mention.isPending) {
                return (
                  <div key={`mention_${i}`} className={`flex items-center rounded border transition-all ${isSelected ? 'bg-indigo-100 border-indigo-300' : 'bg-slate-100 border-slate-300'}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        const next = new Set(selectedPendingChars);
                        if (next.has(mention.name)) next.delete(mention.name);
                        else next.add(mention.name);
                        setSelectedPendingChars(next);
                      }}
                      className="ml-1 cursor-pointer"
                      title={mention.isGenerated ? "Select to regenerate design" : "Select for generation"}
                    />
                    <button
                      onClick={() => insertMention(`@${mention.name}`)}
                      className={`text-[10px] px-2 py-0.5 font-black transition-all ${isSelected ? 'text-indigo-700 hover:text-indigo-900' : 'text-slate-500 hover:text-slate-700'}`}
                      title={mention.isGenerated ? "Insert mention (already generated)" : "Insert mention"}
                    >
                      @{mention.name}
                    </button>
                  </div>
                );
              } else {
                return (
                  <button
                    key={`mention_${i}`}
                    onClick={() => insertMention(`@${mention.name}`)}
                    className={buttonClasses}
                    title="Insert mention"
                  >
                    @{mention.name}
                  </button>
                );
              }
            })}
            {hasIconRef && (
              <button
                onClick={() => insertMention("@icon")}
                className="text-[10px] bg-amber-100 hover:bg-amber-500 text-amber-700 hover:text-white px-2 py-0.5 rounded font-black border border-amber-200 transition-all"
              >
                @icon
              </button>
            )}
          </div>
        </div>
        {pendingCharacters.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectDeselectAll}
              className="text-[10px] px-2 py-1 rounded font-black uppercase transition-all bg-slate-200 hover:bg-slate-300 text-slate-600 whitespace-nowrap"
            >
              {allSelected ? "Unselect All" : "Select All"}
            </button>
            <button
              onClick={handleGenerateCharacterDesigns}
              disabled={isGeneratingCharacters || selectedPendingChars.size === 0}
              className={`text-[10px] px-3 py-1 rounded font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                isGeneratingCharacters || selectedPendingChars.size === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]"
              }`}
            >
              {isGeneratingCharacters ? "Generating Designs..." : "Generate Character Designs"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`relative transition-opacity duration-500 ${isLocked ? "opacity-40 pointer-events-none grayscale" : "opacity-100"}`}
    >
      <h2 className="text-2xl font-bold text-slate-800 mb-4 drop-shadow-[1px_1px_0_rgba(255,255,255,1)]">
        2. Art Generator
      </h2>
      <div className="bg-white handdrawn-border p-6 space-y-6 pb-24 relative overflow-visible shadow-2xl">
        {/* Environment & Background Section */}
        <div className="p-4 bg-yellow-50 rounded-xl border-2 border-slate-700 space-y-4 shadow-[4px_4px_0_rgba(51,65,85,1)]">
          <div className="flex justify-between items-center">
            <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold">
              Background Environment
            </label>
            <div className="flex gap-2">
              {[
                BackgroundMode.FULL_BACKGROUND,
                BackgroundMode.WHITE,
                BackgroundMode.BLACK,
                BackgroundMode.CUSTOM,
              ].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBgMode(mode)}
                  title={
                    mode === BackgroundMode.FULL_BACKGROUND
                      ? "Generates a full scene with a background."
                      : mode === BackgroundMode.WHITE
                        ? "Generates the subject on a pure white background."
                        : mode === BackgroundMode.BLACK
                          ? "Generates the subject on a pure black background."
                          : "Generates the subject on a custom color background."
                  }
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all border-2 ${bgMode === mode ? "bg-blue-500 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-white border-slate-400 text-slate-600 shadow-[2px_2px_0_rgba(51,65,85,1)]"}`}
                >
                  {mode === BackgroundMode.FULL_BACKGROUND
                    ? "Full Art"
                    : mode === BackgroundMode.CUSTOM
                      ? "Picker"
                      : mode}
                </button>
              ))}
            </div>
          </div>
          {bgMode === BackgroundMode.CUSTOM && (
            <div className="flex items-center gap-4 animate-fade-in bg-white p-3 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
              <input
                type="color"
                value={customBgColor}
                onChange={(e) => setCustomBgColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-none"
              />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-600 font-bold uppercase">
                  Custom Backdrop Hex
                </span>
                <input
                  type="text"
                  value={customBgColor}
                  onChange={(e) => setCustomBgColor(e.target.value)}
                  className="bg-transparent text-sm font-mono text-blue-600 focus:outline-none font-bold"
                />
              </div>
            </div>
          )}
          {(bgMode === BackgroundMode.WHITE ||
            bgMode === BackgroundMode.BLACK ||
            bgMode === BackgroundMode.CUSTOM) && (
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest animate-pulse">
              *** Strict Background Protocol Enabled: Zero Scenery Mode ***
            </p>
          )}
        </div>

        {/* Base Image Section Removed */}

        {/* Prompt Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex flex-wrap items-center gap-3">
              <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold">
                Subject Prompt
              </label>
              <div className="flex flex-col gap-1">
                <div
                  className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]"
                  title="When ON, the AI uses the Main Character reference for identity. When OFF, it only uses the reference for rendering style."
                >
                  <input
                    type="checkbox"
                    id="useStagingCharacter"
                    checked={useStagingCharacter}
                    onChange={(e) => setUseStagingCharacter(e.target.checked)}
                    className="w-3 h-3 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="useStagingCharacter"
                    className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600"
                  >
                    Use Main Ref
                  </label>
                </div>
                <div
                  className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]"
                  title="When ON, Magic Roll strictly follows the lines of text provided."
                >
                  <input
                    type="checkbox"
                    id="followInputs"
                    checked={followInputs}
                    onChange={(e) => setFollowInputs(e.target.checked)}
                    className="w-3 h-3 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="followInputs"
                    className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600"
                  >
                    Follow Inputs
                  </label>
                </div>
                <div
                  className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]"
                  title="When ON, pasting multiple lines automatically distributes them to pages."
                >
                  <input
                    type="checkbox"
                    id="smartImport"
                    checked={smartImport}
                    onChange={(e) => setSmartImport(e.target.checked)}
                    className="w-3 h-3 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="smartImport"
                    className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600"
                  >
                    Smart Import
                  </label>
                </div>
              </div>
              {!storyMode && (
                <div
                  className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]"
                  title="When ON, allows the AI to remix physical attributes, components, and locations from the references. When OFF, strictly forbids copying physical attributes."
                >
                  <input
                    type="checkbox"
                    id="isRemix"
                    checked={isRemix}
                    onChange={(e) => setIsRemix(e.target.checked)}
                    className="w-3 h-3 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="isRemix"
                    className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600"
                  >
                    Remix
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setStoryMode(!storyMode);
                }}
                title="Toggle Story Mode to generate a sequence of images based on a manuscript or continuous narrative."
                className={`px-3 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${storyMode ? "bg-indigo-500 text-white border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-white border-slate-700 text-indigo-600 hover:bg-indigo-50 shadow-[2px_2px_0_rgba(51,65,85,1)]"}`}
              >
                {storyMode
                  ? "Close Story Mode"
                  : magicKeywords.trim()
                    ? "✨ Story Mode Set"
                    : "Story Mode"}
              </button>
              {stagingFiles.some((f) => f.category === "previous_scene") && (
                <span
                  className="px-2 py-1 bg-emerald-100 border-2 border-slate-700 text-emerald-700 shadow-[2px_2px_0_rgba(51,65,85,1)] text-[9px] font-black rounded-full uppercase tracking-widest flex items-center gap-1"
                  title="A continuity anchor is active. The next generation will use it to maintain visual consistency."
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-3 h-3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                    />
                  </svg>
                  Anchor Active
                  <button
                    onClick={() => {
                      if (onClearAnchor) onClearAnchor();
                    }}
                    className="ml-1 hover:text-slate-900 transition-colors"
                  >
                    &times;
                  </button>
                </span>
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex items-center gap-1 bg-white border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)] rounded-full px-2 py-0.5"
                  title="Number of prompt variations to generate."
                >
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">
                    Page No:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={magicRollCount}
                    onChange={(e) => setMagicRollCount(e.target.value)}
                    className="w-10 bg-transparent text-[10px] font-mono text-slate-800 font-bold focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleCreatePages}
                  title="Create blank pages for manual prompt entry."
                  className="w-full text-[7px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)] font-black uppercase tracking-widest transition-all"
                >
                  Create Pages
                </button>
                {storyMode && (
                  <div className="w-full flex flex-col items-center justify-center gap-1 mt-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        id="includeCovers"
                        checked={includeCovers}
                        onChange={(e) => setIncludeCovers(e.target.checked)}
                        className="w-2.5 h-2.5 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor="includeCovers"
                        className="text-[7px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600 tracking-wider"
                      >
                        Include Covers?
                      </label>
                    </div>
                    {includeCovers && (
                      <div className="w-full flex flex-col gap-1 mt-1">
                        <input
                          type="text"
                          placeholder="Book Title"
                          value={bookTitle}
                          onChange={(e) => setBookTitle(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[8px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Author's Name"
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[8px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleMagicRoll}
                disabled={isLocked || isGenerating || isMagicRolling}
                title="Auto-generate multiple prompt variations based on your keywords and references."
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${isMagicRolling ? "bg-indigo-500 border-slate-700 text-white animate-pulse shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-indigo-100 border-slate-700 text-indigo-700 hover:bg-indigo-200 shadow-[2px_2px_0_rgba(51,65,85,1)] active:scale-95"}`}
              >
                {isMagicRolling ? "Synthesizing..." : `🎲 Magic Roll`}
              </button>
            </div>
          </div>
          {storyMode && (
            <div className="animate-fade-in-down border-l-4 border-indigo-500 pl-4 bg-indigo-50 p-4 rounded-r-xl space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    Story Render
                  </label>
                  <MentionButtons />
                </div>
              </div>
              <div className="relative">
                <textarea
                  ref={influenceRef}
                  value={magicKeywords}
                  onChange={(e) =>
                    handleTextChange(e, "magicKeywords", setMagicKeywords)
                  }
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onFocus={() => setLastFocusedField("influence")}
                  title="Enter your full story or manuscript here. ArtMimic will generate sequential scenes with narrative overlays."
                  placeholder={
                    "INSERT YOUR FULL STORY HERE. ArtMimic will generate sequential scenes with narrative overlays."
                  }
                  className="w-full bg-white border-2 border-slate-700 rounded-lg px-4 py-3 text-indigo-800 text-xs focus:outline-none focus:border-indigo-500 shadow-inner min-h-[160px] resize-y font-mono leading-relaxed font-bold"
                  rows={8}
                />
                <MentionDropdown field="magicKeywords" />
              </div>
              <div className="flex flex-col gap-2 mt-2 p-3 bg-indigo-100 rounded-xl border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
                <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Create Sequel
                </label>
                <div className="flex flex-col gap-3">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx,.ppt,.pptx"
                      onChange={(e) => {
                        setSequelFile(e.target.files?.[0] || null);
                      }}
                      title="Upload a manuscript file to generate a sequel story from."
                      className="w-full text-xs text-indigo-700 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-2 file:border-slate-700 file:text-xs file:font-bold file:bg-white file:text-indigo-700 hover:file:bg-indigo-50 cursor-pointer"
                    />
                  </div>
                  <textarea
                    ref={influenceStoryRef}
                    value={influenceStory}
                    onChange={(e) => setInfluenceStory(e.target.value)}
                    title="Enter your own story direction to influence the sequel."
                    placeholder="Influence Story (e.g. They discover a hidden world...)"
                    className="flex-1 bg-white border-2 border-slate-700 rounded-lg px-3 py-2 text-xs text-indigo-800 font-bold focus:outline-none focus:border-indigo-500 shadow-inner resize-none overflow-hidden min-h-[40px]"
                    rows={1}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-700 uppercase">Pages:</span>
                    <input
                      type="number"
                      min={1}
                      value={sequelPageCountOverride}
                      onChange={(e) => setSequelPageCountOverride(e.target.value === "" ? "" : parseInt(e.target.value) || "")}
                      className="w-16 bg-white border-2 border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-bold focus:outline-none focus:border-indigo-500"
                      placeholder="Auto"
                      title="Leave blank to follow the original manuscript's page count."
                    />
                  </div>
                  <button
                    onClick={handleGenerateSequelStory}
                    disabled={!sequelFile || isGeneratingSequelStory}
                    className={`w-full py-2 text-xs font-black uppercase tracking-widest rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)] transition-all ${
                      !sequelFile || isGeneratingSequelStory
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-indigo-500 text-white hover:bg-indigo-600 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(51,65,85,1)]"
                    }`}
                  >
                    {isGeneratingSequelStory ? "Generating..." : "Generate Sequel"}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-2 p-3 bg-indigo-100 rounded-xl border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
                <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Writing Style Influence
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={authorStyle}
                    onChange={(e) => setAuthorStyle(e.target.value)}
                    title="Enter an author or writing style to influence the generated narrative text."
                    placeholder="Author's Name (e.g., J.K. Rowling, Stephen King)"
                    className="flex-1 bg-white border-2 border-slate-700 rounded-lg px-3 py-2 text-xs text-indigo-800 font-bold focus:outline-none focus:border-indigo-500 shadow-inner"
                  />
                  <span className="text-xs text-indigo-600 font-bold uppercase text-center">
                    OR
                  </span>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept=".txt,.pdf"
                      onChange={(e) => {
                        setManuscriptFile(e.target.files?.[0] || null);
                      }}
                      title="Upload a manuscript file (.txt or .pdf) to influence the generated narrative text."
                      className="w-full text-xs text-indigo-700 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-2 file:border-slate-700 file:text-xs file:font-bold file:bg-white file:text-indigo-700 hover:file:bg-indigo-50 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hideSingleOverride && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-600 font-bold uppercase tracking-widest ml-1">
                  Single Image Render
                </label>
                <MentionButtons />
              </div>
              <div className="relative">
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => handleTextChange(e, "prompt", setPrompt)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onFocus={() => setLastFocusedField("prompt")}
                  title="Describe the subject and scene you want to generate."
                  placeholder={
                    "Describe the subject scenario... Use @C1 to mention Character 1."
                  }
                  className="w-full bg-white border-2 border-slate-700 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-blue-500 shadow-inner resize-y font-mono text-sm leading-relaxed font-bold"
                  rows={6}
                  disabled={isLocked || isGenerating}
                />
                <MentionDropdown field="prompt" />
              </div>
            </div>
          )}

          {magicRollOptions.length > 0 && (
            <div className="bg-indigo-50 border-2 border-slate-700 shadow-[4px_4px_0_rgba(51,65,85,1)] rounded-xl p-4 space-y-4 max-h-[600px] overflow-y-auto console-scroll animate-fade-in mb-4">
              <div className="flex justify-between items-center mb-2 pb-2 border-b-2 border-slate-300 sticky top-0 bg-indigo-50 z-10">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    {storyMode ? "Storyboards" : "Prompt Pages"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] bg-white border-2 border-slate-700 text-slate-600 shadow-[2px_2px_0_rgba(51,65,85,1)] px-3 py-1 rounded-lg hover:bg-slate-50 transition-colors uppercase font-bold"
                      title="Select or deselect all prompt pages."
                    >
                      {selectedIndices.size === magicRollOptions.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                    <button
                      onClick={handleCopyAll}
                      className={`text-[10px] ${hasCopied ? "bg-emerald-500 border-2 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-white border-2 border-slate-700 text-slate-600 shadow-[2px_2px_0_rgba(51,65,85,1)]"} px-3 py-1 rounded-lg hover:opacity-80 transition-all uppercase font-bold flex items-center gap-1`}
                      title="Copy all selected prompts to clipboard."
                    >
                      {hasCopied ? "Copy All" : "Copy All"}
                    </button>
                    <button
                      onClick={handleDeleteTextOverlays}
                      className="text-[10px] bg-red-100 border-2 border-slate-700 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 shadow-[2px_2px_0_rgba(51,65,85,1)] transition-colors uppercase font-bold"
                      title="Remove 'Text Overlay' fields from all prompts"
                    >
                      Del Text
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMagicRollOptions([]);
                    setSelectedIndices(new Set());
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-800 uppercase font-bold"
                  title="Clear all generated prompt pages."
                >
                  Wipe Gallery
                </button>
              </div>
              {magicRollOptions.map((opt, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-4 rounded-xl transition-all border-2 ${selectedIndices.has(i) ? "bg-indigo-100 border-pink-500 shadow-[4px_4px_0_rgba(236,72,153,1)]" : "bg-white border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]"}`}
                >
                  <div
                    onClick={() => handleToggleRoll(i)}
                    className="mt-1 shrink-0 cursor-pointer"
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedIndices.has(i) ? "bg-pink-500 border-pink-600" : "bg-slate-200 border-slate-400"}`}
                    >
                      {selectedIndices.has(i) && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter opacity-70">
                        {storyMode ? `Scene ${i + 1}` : `Page ${i + 1}`}
                      </div>
                      {selectedIndices.has(i) && (
                        <span className="text-[8px] text-emerald-600 font-black uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="relative w-full">
                      <textarea
                        ref={(el) => (textareaRefs.current[i] = el)}
                        value={opt}
                        onChange={(e) => {
                          handleEditRoll(i, e.target.value);
                          checkMention(e.target, `roll_${i}`, e.target.value);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter prompt for this page..."
                        className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg p-3 text-xs text-slate-800 leading-relaxed font-mono font-bold focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none overflow-hidden transition-all duration-200 shadow-inner"
                        style={{ minHeight: "80px" }}
                      />
                      <MentionDropdown field={`roll_${i}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-amber-50 border-2 border-slate-700 shadow-[4px_4px_0_rgba(51,65,85,1)] rounded-xl p-4 space-y-4 max-h-[400px] overflow-y-auto console-scroll animate-fade-in mb-4">
            <div className="flex justify-between items-center mb-2 pb-2 border-b-2 border-slate-300 sticky top-0 bg-amber-50 z-10 flex-wrap gap-2">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                Saved Prompts
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveInline();
                  }}
                  placeholder="Enter a prompt name..."
                  className="w-48 bg-white border-2 border-slate-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-inner"
                  disabled={isLocked || isGenerating || (!prompt.trim() && magicRollOptions.length === 0)}
                />
                <button
                  onClick={handleSaveInline}
                  disabled={isSavingSeries || isLocked || isGenerating || (!prompt.trim() && magicRollOptions.length === 0)}
                  className={`text-[10px] ${isSavingSeries ? "bg-slate-300 text-slate-500" : "bg-amber-100 text-amber-700 hover:bg-amber-200"} border-2 border-slate-700 px-3 py-1.5 rounded-lg shadow-[2px_2px_0_rgba(51,65,85,1)] transition-colors uppercase font-bold`}
                  title="Save current prompt or series"
                >
                  {isSavingSeries ? "Saving..." : "Save Current"}
                </button>
              </div>
            </div>
            
            {savedSeries.length === 0 ? (
              <p className="text-xs text-slate-500 italic font-bold">No saved prompts yet. Create a prompt and enter a name to save it!</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {savedSeries.map((series) => (
                  <div
                    key={series.id}
                    className="flex items-center justify-between p-3 bg-white border-2 border-slate-700 rounded-lg shadow-[2px_2px_0_rgba(51,65,85,1)]"
                  >
                    <div className="flex-1 mr-4">
                      {editingSeriesId === series.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingSeriesName}
                            onChange={(e) =>
                              setEditingSeriesName(e.target.value)
                            }
                            className="w-full bg-slate-100 border-2 border-slate-400 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleSaveSeriesName(series.id);
                              if (e.key === "Escape") setEditingSeriesId(null);
                            }}
                          />
                          <button
                            onClick={() => handleSaveSeriesName(series.id)}
                            className="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded font-bold uppercase"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSeriesId(null)}
                            className="text-[10px] bg-slate-300 text-slate-700 px-2 py-1 rounded font-bold uppercase"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {series.name}
                          </span>
                          <button
                            onClick={() => handleStartEditSeriesName(series)}
                            className="text-slate-400 hover:text-amber-600"
                            title="Edit name"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-3 h-3"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                      <div className="text-[9px] text-slate-500 font-mono mt-1">
                        {new Date(series.timestamp).toLocaleString()} •{" "}
                        {series.prompts.length} prompts
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadSeries(series)}
                        className="text-[10px] bg-indigo-100 text-indigo-700 border-2 border-slate-700 px-3 py-1 rounded-lg hover:bg-indigo-200 shadow-[2px_2px_0_rgba(51,65,85,1)] transition-colors uppercase font-bold"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSeries(series.id)}
                        className="text-[10px] bg-red-100 text-red-600 border-2 border-slate-700 px-2 py-1 rounded-lg hover:bg-red-200 shadow-[2px_2px_0_rgba(51,65,85,1)] transition-colors uppercase font-bold"
                        title="Delete series"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dimensions & Quality */}
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs uppercase tracking-wider text-slate-600 font-bold">
            Dimensions & Quality
          </label>
          <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
            <input
              type="checkbox"
              id="rememberSettings"
              checked={rememberSettings}
              onChange={(e) => setRememberSettings(e.target.checked)}
              className="w-3 h-3 text-indigo-500 rounded border-slate-600 focus:ring-indigo-500"
            />
            <label
              htmlFor="rememberSettings"
              className="text-[9px] font-black text-slate-600 uppercase cursor-pointer hover:text-indigo-600"
            >
              Remember Settings
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  "1:1",
                  "3:4",
                  "4:3",
                  "9:16",
                  "16:9",
                  "2:1",
                  "8.5:11",
                  "A4",
                ] as AspectRatio[]
              ).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-1 rounded-lg border-2 text-[10px] font-black transition-all ${aspectRatio === ratio ? "bg-blue-500 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-white border-slate-400 text-slate-600 shadow-[2px_2px_0_rgba(51,65,85,1)]"}`}
                >
                  {ratio === "8.5:11"
                    ? '8.5x11"'
                    : ratio === "A4"
                      ? "A4 Print"
                      : ratio}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-2">
              {(["1K", "2K", "4K"] as ImageResolution[]).map((res) => (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all ${resolution === res ? "bg-emerald-500 border-slate-700 text-white shadow-[2px_2px_0_rgba(51,65,85,1)]" : "bg-white border-slate-400 text-slate-600 shadow-[2px_2px_0_rgba(51,65,85,1)]"}`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none sticky z-20 flex gap-4">
          {!isGenerating ? (
            <button
              onClick={handleGenerateClick}
              disabled={isButtonDisabled}
              className={`w-full py-4 text-xl uppercase tracking-widest pointer-events-auto ${isButtonDisabled ? "bg-slate-300 text-slate-500 handdrawn-button cursor-not-allowed opacity-50" : "bg-pink-500 text-white handdrawn-button"}`}
            >
              {selectedIndices.size > 1
                ? `Generate Batch (${selectedIndices.size})`
                : "Generate Artwork"}
            </button>
          ) : (
            <>
              <button
                disabled
                className="flex-[2] py-4 bg-slate-200 handdrawn-button text-xl uppercase tracking-widest flex items-center justify-center gap-3 text-slate-800 cursor-wait pointer-events-auto"
              >
                <svg
                  className="animate-spin h-6 w-6 text-slate-800"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {selectedIndices.size > 1
                  ? `Rendering Batch...`
                  : "Synthesizing..."}
              </button>
              <button
                onClick={onStop}
                className="flex-1 py-4 bg-red-500 text-white handdrawn-button text-xl uppercase tracking-widest pointer-events-auto"
              >
                STOP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtGenerator;
