
import React from 'react';
import { StyleAnalysis } from '../types';

interface StyleDashboardProps {
  analysis: StyleAnalysis | null;
  onUpdateColor?: (index: number, newColor: string) => void;
}

const StyleDashboard: React.FC<StyleDashboardProps> = ({ analysis, onUpdateColor }) => {
  if (!analysis) return null;

  return (
    <div className="bg-white handdrawn-border p-6 animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Style & Engine DNA Extracted
        </h3>
        <span className="text-[10px] font-mono text-slate-600 border-2 border-slate-700 px-2 py-1 rounded-lg uppercase tracking-tighter shadow-[2px_2px_0_rgba(51,65,85,1)] font-bold bg-slate-100">
          {analysis.dimensionality || 'Engine_Detected'}
        </span>
      </div>

      {/* Artistic DNA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b-2 border-slate-200 pb-6">
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Technique DNA</h4>
          <p className="text-sm text-slate-700 leading-relaxed font-mono line-clamp-3 font-bold">{analysis.description}</p>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Mood Matrix</h4>
            <div className="flex flex-wrap gap-2">
              {analysis.mood?.map((m, i) => (
                <span key={i} className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)] font-bold">#{m}</span>
              )) || <span className="text-[10px] text-slate-500 italic">None detected</span>}
            </div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Color Profile (Click to Change)</h4>
            <div className="flex gap-2">
               {analysis.colors?.map((c, i) => (
                 <input 
                   key={i} 
                   type="color" 
                   value={c} 
                   onChange={(e) => onUpdateColor?.(i, e.target.value)}
                   className="w-8 h-8 rounded-full border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)] cursor-pointer bg-transparent appearance-none p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full" 
                   title={`Edit color: ${c}`} 
                 />
               )) || null}
            </div>
          </div>
        </div>
      </div>

      {/* Typographic Structural DNA */}
      <div className="bg-blue-50 border-2 border-slate-700 rounded-xl p-4 animate-fade-in shadow-[4px_4px_0_rgba(51,65,85,1)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 5v14m1-4h10M15 11h6m-3-3v6"></path></svg>
            <h4 className="text-sm uppercase tracking-widest text-blue-700 font-black">Typographic Blueprint</h4>
          </div>
          <div className="flex gap-2">
             <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
               <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: analysis.typography?.primaryColor || '#FFF' }}></div>
               <span className="text-[10px] font-bold text-slate-700">PRI</span>
             </div>
             <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border-2 border-slate-700 shadow-[2px_2px_0_rgba(51,65,85,1)]">
               <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: analysis.typography?.secondaryColor || '#000' }}></div>
               <span className="text-[10px] font-bold text-slate-700">SEC</span>
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Emphasis Logic</span>
            <p className="text-xs text-slate-800 font-mono leading-snug font-bold">{analysis.typography?.emphasisLogic || 'Default'}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Texture Profile</span>
            <p className="text-xs text-pink-600 font-mono leading-snug uppercase font-bold">{analysis.typography?.texture || 'Smooth'}</p>
          </div>
        </div>

        <div className="pt-3 border-t-2 border-slate-300">
          <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Hierarchy Blueprint Map</span>
          <p className="text-sm text-slate-700 italic leading-relaxed font-mono font-bold">
            "{analysis.typography?.hierarchyBlueprint || 'Standard alignment'}"
          </p>
        </div>
      </div>
    </div>
  );
};

export default StyleDashboard;
