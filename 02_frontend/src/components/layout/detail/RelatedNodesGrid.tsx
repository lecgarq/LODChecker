import type { GraphNode } from '@/types/graph';
import { getCategoryColor } from '@/lib/colors';
import { getNodeImageUrl } from '@/lib/helpers';
import DetailImage from '@/components/ui/DetailImage';

interface RelatedNodesGridProps {
  node: GraphNode;
  nodes: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
}

export default function RelatedNodesGrid({ node, nodes, onSelectNode }: RelatedNodesGridProps) {
  if (!node.neighbors || node.neighbors.length === 0) return null;

  const related = node.neighbors
    .map(idx => (Number.isInteger(idx) && idx >= 0 && idx < nodes.length ? nodes[idx] : null))
    .filter((n): n is GraphNode => !!n && n.id !== node.id && n.img !== node.img)
    .slice(0, 10);

  return (
    <div className="mb-0 select-none">
      <div
        className="flex items-center justify-between mb-4 pr-1 group cursor-default p-2 rounded-xl transition-all duration-300"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${getCategoryColor(node.final_category)}10`; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      >
        <div
          className="text-[11px] font-black text-primary uppercase tracking-[0.2em] transition-all duration-300 group-hover:translate-x-0.5"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = getCategoryColor(node.final_category); }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
        >
          Related Elements
        </div>
        <div className="text-[10px] font-bold text-primary/30 transition-all duration-300 group-hover:text-primary/60 group-hover:-translate-x-0.5">
          10 Suggestions
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {related.map((neighbor) => {
          const nCatColor = getCategoryColor(neighbor.final_category);
          return (
            <div key={neighbor.id} onClick={() => onSelectNode(neighbor)} className="cursor-pointer relative group">
              <div
                className="aspect-square bg-bg rounded-xl overflow-hidden border border-secondary/60 transition-all duration-300 group-hover:scale-95"
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = nCatColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
              >
                <DetailImage src={getNodeImageUrl(neighbor)} />
              </div>
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
  );
}
