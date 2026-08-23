
export enum AppState {
  IDLE = 'IDLE', // No images
  STAGED = 'STAGED', // Images uploaded, waiting for confirm
  ANALYZING = 'ANALYZING', // Analyzing style
  ANALYZED = 'ANALYZED', // Style extracted, ready to generate
  GENERATING = 'GENERATING', // Painting
  ERROR = 'ERROR'
}

export enum RemixMode {
  REPAINT = 'REPAINT',
  RERENDER = 'RERENDER'
}

export enum TextSuggestionTone {
  WITTY = 'WITTY',
  MOTIVATIONAL = 'MOTIVATIONAL',
  FUNNY = 'FUNNY',
  MEME = 'MEME',
  SARCASTIC = 'SARCASTIC',
  IRREVERENT = 'IRREVERENT',
  CHEEKY = 'CHEEKY',
  DUMB = 'DUMB'
}

export enum FontModeOption {
  EXTRACT = 'EXTRACT',
  COMPLEMENTARY = 'COMPLEMENTARY'
}

export type ReferenceCategory = 'character' | 'font' | 'scene' | 'icon' | 'previous_scene';
export type ViewType = 'front' | 'side' | 'back';

export interface ReferenceSlot {
  category: ReferenceCategory;
  charIndex?: number;
  viewType?: ViewType;
}

export interface UploadedFile {
  id: string;
  data: string; // Base64 string
  mimeType: string;
  category?: ReferenceCategory;
  charIndex?: number;
  characterName?: string;
  viewType?: ViewType;
  isStyleInfluence?: boolean; // Global style toggle
  heightRatio?: number | string;
}

export interface TypographicDNA {
  fontFamilyType: string;
  weight: string;
  characteristics: string;
  isHandwritten: boolean;
  texture: string;
  layout: string;
  primaryColor: string;
  secondaryColor: string;
  emphasisLogic: string; 
  hierarchyBlueprint: string; 
  blacklistWords: string[];
}

export interface StyleAnalysis {
  description: string;
  mood: string[];
  technique: string;
  dimensionality: string;
  colors: string[];
  typography: TypographicDNA;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'system' | 'action' | 'success' | 'error';
}

export type ImageResolution = '1K';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  resolution?: ImageResolution;
  aspectRatio?: AspectRatio;
  baseImageUrl?: string;
  sequenceNumber: number;
  folderId?: string;
}

export interface GalleryFolder {
  id: string;
  name: string;
  timestamp: number;
}

export enum BackgroundMode {
  FULL_BACKGROUND = 'FULL_BACKGROUND',
  WHITE = 'WHITE',
  BLACK = 'BLACK',
  CUSTOM = 'CUSTOM'
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '2:1' | '8.5:11' | 'A4';

export enum FrameStyle {
  NONE = 'NONE',
  SIMPLE = 'SIMPLE',
  POLAROID = 'POLAROID',
  ORNATE = 'ORNATE',
  CINEMATIC = 'CINEMATIC',
  POSTER = 'POSTER',
  STICKER = 'STICKER',
  WASHI_TAPE = 'WASHI_TAPE'
}

export enum ShapeType {
  NONE = 'NONE',
  IMAGE_CUT = 'IMAGE_CUT',
  SQUARE = 'SQUARE',
  CIRCLE = 'CIRCLE',
  STAR = 'STAR',
  TRIANGLE = 'TRIANGLE',
  RECTANGLE = 'RECTANGLE',
  HEART = 'HEART',
  HEXAGON = 'HEXAGON'
}

export enum TextPosition {
  ABOVE = 'ABOVE',
  INSIDE = 'INSIDE',
  BELOW = 'BELOW'
}

export enum FontCategory {
  ORIGINAL = 'ORIGINAL',
  SERIOUS = 'SERIOUS',
  CUTE = 'CUTE',
  HAPPY = 'HAPPY',
  CHIBI = 'CHIBI',
  ELEGANT = 'ELEGANT',
  TECH = 'TECH',
  CLASSIC = 'CLASSIC'
}

export interface SavedPromptSeries {
  id: string;
  name: string;
  prompts: string[];
  timestamp: number;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
