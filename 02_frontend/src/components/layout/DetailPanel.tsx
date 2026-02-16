import type { GraphNode } from '@/types/graph';
import { getLodLabel, getNodeImageUrl } from '@/lib/helpers';
import { getCategoryColor } from '@/lib/colors';
import DetailImage from '@/components/ui/DetailImage';
import { X, ExternalLink, Info, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface DetailPanelProps {
  node: GraphNode;
  nodes: GraphNode[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onLayoutChange: (mode: 'category' | 'lod' | 'provider' | 'similarity') => void;
  onDeleteNode: (id: string) => void;
}

/** 
 * High-Impact Detail Panel.
 * Featuring premium typography, professional layout, and improved accessibility.
 */
export default function DetailPanel({ node, nodes, isOpen, onClose, onSelectNode, onLayoutChange, onDeleteNode }: DetailPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
       const filename = (node.img || '').split('/').pop() || node.id;
       const res = await fetch(`/api/delete/image`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }) 
       });
       if(res.ok) {
          onDeleteNode(node.id); // Remove from graph immediately
          onClose(); 
          setShowConfirm(false);
       } else {
          alert('Failed to delete image.');
       }
    } catch(e) {
       console.error(e);
       alert('Error deleting image.');
    } finally {
       setIsDeleting(false);
    }
  };

  return (
    <div
      className={`absolute top-6 right-6 bottom-6 w-[420px] bg-white border border-secondary/60 rounded-[28px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.14)] z-[1400] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,1,0.2,1)] ${
        isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-[120%] opacity-0 scale-95'
      }`}
    >
      {/* Premium Close Button - Large Hit Area */}
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-20 w-11 h-11 rounded-full bg-white/80 backdrop-blur-md border border-secondary/80 text-primary shadow-sm cursor-pointer hover:bg-primary hover:text-white transition-all duration-200 flex items-center justify-center group"
      >
        <X size={20} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      <div className="h-full overflow-y-auto custom-scrollbar flex flex-col">
        
        {/* Massive Image Hero Section */}
        <div className="relative w-full aspect-[16/10] bg-bg overflow-hidden group">
          <DetailImage src={getNodeImageUrl(node)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Content Section */}
        <div className="p-8 flex-1">
          {/* Header */}
          <div className="mb-8 select-none group cursor-default">
            <h2 className="m-0 text-2xl font-black leading-none text-primary tracking-tight mb-2 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary/70">
              {node.name}
            </h2>
            {/* Subtitle removed as requested */}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-3 mb-10 select-none">
            {[
              { k: 'Category', v: node.final_category, icon: <Info size={12} />, mode: 'category', isCat: true },
              { k: 'Level of Detail', v: getLodLabel(node.lod_label), icon: <ExternalLink size={12} />, mode: 'lod' },
              { k: 'Manufacturer', v: node.provider || 'N/A', icon: <ExternalLink size={12} />, mode: 'provider' },
            ].filter(i => i.v).map((item) => {
              const catColor = item.isCat ? getCategoryColor(item.v as string) : null;
              return (
                <button 
                  key={item.k} 
                  onClick={() => onLayoutChange(item.mode as any)}
                  onMouseEnter={(e) => { 
                    if(catColor) {
                      e.currentTarget.style.borderColor = `${catColor}40`;
                      const text = e.currentTarget.querySelector('.item-value') as HTMLElement;
                      const icon = e.currentTarget.querySelector('.item-icon') as HTMLElement;
                      if(text) text.style.color = catColor;
                      if(icon) icon.style.color = catColor;
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if(catColor) {
                      e.currentTarget.style.borderColor = '';
                      const text = e.currentTarget.querySelector('.item-value') as HTMLElement;
                      const icon = e.currentTarget.querySelector('.item-icon') as HTMLElement;
                      if(text) text.style.color = '';
                      if(icon) icon.style.color = '';
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-secondary/20 rounded-2xl border border-secondary/40 group hover:border-primary/40 hover:bg-secondary/40 transition-all duration-300 cursor-pointer text-left"
                >
                  <div className="flex flex-col gap-0.5 pointer-events-none">
                     <span className="text-[9px] font-black text-primary/20 uppercase tracking-widest transition-colors duration-300 group-hover:text-primary/40">{item.k}</span>
                     <span className="item-value text-xs font-black text-primary transition-colors duration-300">
                        {item.v}
                     </span>
                  </div>
                  <div className="item-icon p-2 rounded-xl bg-white text-primary/20 transition-colors duration-300 pointer-events-none">
                     {item.icon}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Related Items - Impactful Slider */}
          {node.neighbors && node.neighbors.length > 0 && (
            <div className="mb-0 select-none">
              <div 
                className="flex items-center justify-between mb-4 pr-1 group cursor-default p-2 rounded-xl transition-all duration-300"
                onMouseEnter={(e) => {
                  const color = getCategoryColor(node.final_category);
                  e.currentTarget.style.backgroundColor = `${color}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <div 
                  className="text-[11px] font-black text-primary uppercase tracking-[0.2em] transition-all duration-300 group-hover:translate-x-0.5"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = getCategoryColor(node.final_category);
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '';
                  }}
                >
                  Related Elements
                </div>
                <div className="text-[10px] font-bold text-primary/30 transition-all duration-300 group-hover:text-primary/60 group-hover:-translate-x-0.5">
                  10 Suggestions
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {node.neighbors
                  .map(idx => (Number.isInteger(idx) && idx >= 0 && idx < nodes.length ? nodes[idx] : null))
                  .filter((n): n is GraphNode => !!n && n.id !== node.id && n.img !== node.img)
                  .slice(0, 10)
                  .map((neighbor) => {
                  
                  const nCatColor = getCategoryColor(neighbor.final_category);
                  
                  return (
                    <div
                      key={neighbor.id}
                      onClick={() => onSelectNode(neighbor)}
                      className="cursor-pointer relative group"
                    >
                      <div 
                        className="aspect-square bg-bg rounded-xl overflow-hidden border border-secondary/60 transition-all duration-300 group-hover:scale-95"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = nCatColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '';
                        }}
                      >
                        <DetailImage src={getNodeImageUrl(neighbor)} />
                      </div>
                      
                      {/* Tooltip on hover with associated color */}
                      <div 
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 text-white text-[9px] font-black p-2 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-300 z-10 shadow-xl text-center uppercase tracking-tighter"
                        style={{ backgroundColor: nCatColor }}
                      >
                         {neighbor.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delete Action (Bottom) */}
          <div className="mt-12 mb-4">
             {showConfirm ? (
               <div className="p-4 bg-red-50 rounded-xl border border-red-200 animate-fade-in">
                  <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                     <AlertTriangle size={16} />
                     <span className="text-sm">Confirm Deletion?</span>
                  </div>
                  <p className="text-xs text-red-500/80 mb-3 font-medium">This is permanent. Image and data will be removed.</p>
                  <div className="flex gap-2">
                     <button 
                        onClick={() => setShowConfirm(false)} 
                        className="flex-1 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={handleDelete} 
                        disabled={isDeleting} 
                        className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                     >
                       {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                     </button>
                  </div>
               </div>
             ) : (
               <button 
                  onClick={() => setShowConfirm(true)} 
                  className="w-full flex items-center justify-center gap-2 p-3 text-red-400 font-bold text-xs bg-red-50/10 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-300 border border-transparent hover:border-red-100 group"
               >
                  <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> 
                  Delete Image
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
