import type { LayoutMode, ModeTab, GraphNode } from '@/types/graph';
import { ChevronLeft } from 'lucide-react';

interface ToolbarProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onBack: () => void;
  onSearch: (query: string) => void;
  initialQuery: string;
  selectedNode: GraphNode | null;
  filteredCount: number;
  centerOffset?: number; // Added offset prop
  isLayoutSwitchLocked?: boolean;
}

const MODES: ModeTab[] = [
  { id: 'similarity', label: 'Network' },
  { id: 'category',   label: 'Category' },
  { id: 'lod',        label: 'LOD' },
  { id: 'provider',   label: 'Source' },
];

/** 
 * Professional, high-fidelity Toolbar.
 * Features a sliding highlight and snappy micro-interactions.
 */
export default function Toolbar({
  layoutMode, onLayoutChange, onBack, selectedNode, filteredCount, centerOffset = 0, isLayoutSwitchLocked = false,
}: ToolbarProps) {
  return (
    <div 
      className="absolute top-4 left-1/2 z-[1200] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.2,1)]"
      style={{ transform: `translateX(calc(-50% + ${centerOffset}px))` }}
    >
      <div className="flex items-center gap-1 p-1 bg-white border border-secondary/60 rounded-full shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.02] animate-fade-down transform-gpu origin-top">
      
        {/* Back Button */}
        <button
          onClick={onBack}
          title="Back to search"
          className="group relative w-8 h-8 border-none rounded-full bg-transparent cursor-pointer flex items-center justify-center text-primary/40 hover:text-primary transition-all duration-150"
        >
          <div className="absolute inset-0 rounded-full bg-secondary/0 group-hover:bg-secondary/60 transition-all duration-200 scale-90 group-hover:scale-100" />
          <ChevronLeft size={16} strokeWidth={2.5} className="relative z-10 group-active:-translate-x-0.5 transition-transform" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-secondary/80 mx-1" />

        {/* Mode Tabs Container */}
        <div className="flex bg-secondary/30 rounded-full p-0.5 relative">
          {MODES.map(m => {
            const isActive = layoutMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onLayoutChange(m.id)}
                disabled={isLayoutSwitchLocked}
                className={`relative px-4 py-1.5 border-none rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer whitespace-nowrap z-10 transition-all duration-150 ${
                  isActive
                    ? 'text-white'
                    : 'text-primary/30 hover:text-primary'
                } ${isLayoutSwitchLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {/* Active Background Slide */}
                {isActive && (
                  <div 
                    className="absolute inset-0 bg-primary rounded-full z-[-1] shadow-md"
                    style={{ 
                      viewTransitionName: 'active-tab',
                      animation: 'scale-in 0.2s cubic-bezier(0.2, 1, 0.2, 1)' 
                    }}
                  />
                )}
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-secondary/80 mx-1" />

        {/* Impactful Counter */}
        <div className="group flex items-center gap-2 px-3 py-1 text-[9px] font-black text-primary whitespace-nowrap uppercase tracking-wider cursor-default select-none transition-all duration-300">
          <div className="relative">
             <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-125 transition-transform duration-300" />
             <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-accent animate-ping-custom opacity-40" />
          </div>
          <div className="flex flex-col gap-0 leading-tight transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-primary/70">
             {selectedNode ? (
                <>
                   <span className="text-accent tracking-normal group-hover:text-accent/80 transition-colors">Selection Active</span>
                   <span className="text-[7px] opacity-40 tracking-tight group-hover:opacity-60 transition-opacity">Isolated View</span>
                </>
             ) : (
                <>
                   <span>{filteredCount.toLocaleString()} Elements</span>
                   <span className="text-[7px] opacity-40 tracking-tight group-hover:opacity-60 transition-opacity">Total Found</span>
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
