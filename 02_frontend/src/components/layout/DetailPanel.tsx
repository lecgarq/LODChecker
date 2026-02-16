import type { GraphNode } from '@/types/graph';
import { getNodeImageUrl } from '@/lib/helpers';
import DetailImage from '@/components/ui/DetailImage';
import { X } from 'lucide-react';
import MetadataCards from '@/components/layout/detail/MetadataCards';
import RelatedNodesGrid from '@/components/layout/detail/RelatedNodesGrid';
import DeleteAction from '@/components/layout/detail/DeleteAction';
import { useNodeDeletion } from '@/hooks/useNodeDeletion';

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
  const { isDeleting, showConfirm, setShowConfirm, confirmDelete } = useNodeDeletion(onDeleteNode, onClose);

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

          <MetadataCards node={node} onLayoutChange={onLayoutChange} />

          <RelatedNodesGrid node={node} nodes={nodes} onSelectNode={onSelectNode} />

          <DeleteAction
            isDeleting={isDeleting}
            showConfirm={showConfirm}
            onConfirm={() => confirmDelete(node.id, node.img)}
            onShowConfirm={setShowConfirm}
          />

        </div>
      </div>
    </div>
  );
}
