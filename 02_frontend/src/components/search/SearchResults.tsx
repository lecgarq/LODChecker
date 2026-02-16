import { useState } from 'react';
import type { GraphNode, SearchResult } from '@/types/graph';
import { getNodeImageUrl } from '@/lib/helpers';
import { getCategoryColor } from '@/lib/colors';
import DetailImage from '@/components/ui/DetailImage';
import { ChevronLeft, ChevronRight, Filter, Layers, X } from 'lucide-react';

interface SearchResultsProps {
  results: SearchResult[];
  nodes: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
  onClose: () => void;
  
  // New props
  onFilterGraph: (ids: string[] | null) => void;
  isGraphFiltered: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function SearchResults({ 
  results, nodes, onSelectNode, onClose, 
  onFilterGraph, isGraphFiltered, isCollapsed, onToggleCollapse 
}: SearchResultsProps) {
  const [hovered, setHovered] = useState<{ node: GraphNode, top: number } | null>(null);

  // If collapsed, exact minimal rendering
  if (isCollapsed) {
     return (
        <div className="absolute left-6 top-24 z-[1300] flex flex-col animate-fade-in origin-left">
           <button 
              onClick={onToggleCollapse}
              className="flex flex-col items-center gap-2 p-2 bg-white/90 backdrop-blur-xl border border-white/40 shadow-lg rounded-2xl w-10 hover:bg-white transition-all group"
              title="Expand Results"
           >
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary/20 text-primary/60 group-hover:bg-primary/10 group-hover:text-primary">
                 <ChevronRight size={16} />
              </div>
              <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest writing-vertical-rl py-2">
                 AI ({results.length})
              </span>
           </button>
        </div>
     );
  }

  // Expanded View
  const top10 = results.slice(0, 10);
  const rest = results.slice(10);

  const handleToggleFilter = () => {
     if (isGraphFiltered) {
        onFilterGraph(null);
     } else {
        const ids = results.map(r => r.id);
        onFilterGraph(ids);
     }
  };

  return (
    <div className="absolute left-6 top-24 z-[1300] flex flex-col animate-fade-in origin-left">
      <div className="flex flex-col items-center gap-3 p-3 bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl w-[72px] max-h-[calc(100vh-140px)]">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-0.5 pb-2 border-b border-secondary/40 w-full select-none shrink-0 cursor-default">
             <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest text-center leading-tight">
                AI
             </span>
             <span className="text-[8px] font-bold text-primary/20 uppercase tracking-[0.2em]">
                {results.length}
             </span>
        </div>

        {/* Scrollable Results List */}
        <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar w-full items-center py-1 pr-1 -mr-1">
          
          {/* Top 10 Group */}
          <div className="flex flex-col gap-2 p-1.5 border-2 border-primary/10 bg-primary/5 rounded-xl w-full items-center mb-1">
             <span className="text-[7px] font-black text-primary/30 uppercase tracking-widest mb-0.5 w-full text-center">Top 10</span>
             {top10.map((res) => renderItem(res, nodes, onSelectNode, onClose, setHovered, true))}
          </div>
          
          {/* Rest */}
          {rest.map((res) => renderItem(res, nodes, onSelectNode, onClose, setHovered, false))}
        
        </div>

        {/* Divider */}
        <div className="w-6 h-px bg-secondary/40 my-1 shrink-0" />

        {/* Actions Footer */}
        <div className="flex flex-col gap-2 shrink-0">
           {/* Filter Toggle */}
           <button
              onClick={handleToggleFilter}
              title={isGraphFiltered ? 'Show All' : 'Filter Graph'}
              className={`group w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
                 isGraphFiltered 
                 ? 'bg-primary text-white shadow-md' 
                 : 'bg-secondary/20 text-primary/40 hover:bg-primary/10 hover:text-primary'
              }`}
           >
              {isGraphFiltered ? <Layers size={14} /> : <Filter size={14} />}
           </button>
           
           {/* Collapse (Hide) */}
           <button
             onClick={onToggleCollapse}
             title="Hide Sidebar"
             className="group w-8 h-8 rounded-full bg-secondary/20 text-primary/40 flex items-center justify-center cursor-pointer hover:bg-primary/10 hover:text-primary transition-all duration-200"
           >
             <ChevronLeft size={16} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
           </button>
        </div>
      </div>

      {/* FIXED POPOUT PREVIEW */}
      {hovered && (
        <div 
            className="fixed left-[calc(24px+72px+16px)] w-64 bg-white/95 backdrop-blur-md border border-white/60 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-200 z-[1600] p-3 flex flex-col pointer-events-none"
            style={{ top: hovered.top }}
        >
            <div className="absolute top-4 -left-1.5 w-3 h-3 bg-white/95 border-l border-b border-white/60 rotate-45" />

            <div className="aspect-video w-full rounded-xl overflow-hidden bg-bg border border-secondary/20 shadow-inner mb-3">
                <DetailImage src={getNodeImageUrl(hovered.node)} />
            </div>
            
            <div className="flex flex-col gap-1">
                <div className="text-xs font-black text-primary leading-tight uppercase tracking-tight line-clamp-2">
                    {hovered.node.name}
                </div>
                
                <div 
                    className="text-[10px] font-bold uppercase tracking-wide truncate"
                    style={{ color: getCategoryColor(hovered.node.final_category) }}
                >
                    {hovered.node.final_category || 'Uncategorized'}
                </div>
                
                <div className="flex justify-between items-center border-t border-secondary/20 pt-2 mt-2">
                    <span className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">Match Score</span>
                    <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                        Match Found
                    </span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// Helper to render items avoids duplication
function renderItem(
    res: SearchResult, 
    nodes: GraphNode[], 
    onSelectNode: (n: GraphNode) => void, 
    onClose: () => void,
    setHovered: (v: { node: GraphNode, top: number } | null) => void,
    isTop10: boolean
) {
    const node = nodes.find(n => n.id === res.id);
    if (!node) return null;
    const catColor = getCategoryColor(node.final_category);

    return (
      <div
        key={res.id}
        onClick={() => { onSelectNode(node); }}
        onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHovered({ node, top: rect.top });
        }}
        onMouseLeave={() => setHovered(null)}
        className="group relative cursor-pointer w-10 h-10 shrink-0"
      >
        <div className={`w-full h-full rounded-lg overflow-hidden bg-bg transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${
            isTop10 
            ? 'border border-primary/40' // Inner border for group items
            : 'border border-secondary/80 group-hover:border-primary'
        }`}>
          <DetailImage src={getNodeImageUrl(node)} />
        </div>
        
        <div 
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 rounded-full transition-all duration-300 group-hover:w-full opacity-0 group-hover:opacity-100"
            style={{ backgroundColor: catColor }}
        />
      </div>
    );
}
