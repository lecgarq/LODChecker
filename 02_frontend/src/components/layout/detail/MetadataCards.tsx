import type { GraphNode } from '@/types/graph';
import { getCategoryColor } from '@/lib/colors';
import { getLodLabel } from '@/lib/helpers';
import { ExternalLink, Info } from 'lucide-react';

interface MetadataCardsProps {
  node: GraphNode;
  onLayoutChange: (mode: 'category' | 'lod' | 'provider' | 'similarity') => void;
}

export default function MetadataCards({ node, onLayoutChange }: MetadataCardsProps) {
  const items = [
    { k: 'Category', v: node.final_category, icon: <Info size={12} />, mode: 'category', isCat: true },
    { k: 'Level of Detail', v: getLodLabel(node.lod_label), icon: <ExternalLink size={12} />, mode: 'lod' },
    { k: 'Manufacturer', v: node.provider || 'N/A', icon: <ExternalLink size={12} />, mode: 'provider' },
  ].filter(i => i.v);

  return (
    <div className="grid grid-cols-1 gap-3 mb-10 select-none">
      {items.map(item => {
        const catColor = item.isCat ? getCategoryColor(item.v as string) : null;
        return (
          <button
            key={item.k}
            onClick={() => onLayoutChange(item.mode as 'category' | 'lod' | 'provider')}
            onMouseEnter={(e) => {
              if (!catColor) return;
              e.currentTarget.style.borderColor = `${catColor}40`;
              const text = e.currentTarget.querySelector('.item-value') as HTMLElement | null;
              const icon = e.currentTarget.querySelector('.item-icon') as HTMLElement | null;
              if (text) text.style.color = catColor;
              if (icon) icon.style.color = catColor;
            }}
            onMouseLeave={(e) => {
              if (!catColor) return;
              e.currentTarget.style.borderColor = '';
              const text = e.currentTarget.querySelector('.item-value') as HTMLElement | null;
              const icon = e.currentTarget.querySelector('.item-icon') as HTMLElement | null;
              if (text) text.style.color = '';
              if (icon) icon.style.color = '';
            }}
            className="w-full flex items-center justify-between p-4 bg-secondary/20 rounded-2xl border border-secondary/40 group hover:border-primary/40 hover:bg-secondary/40 transition-all duration-300 cursor-pointer text-left"
          >
            <div className="flex flex-col gap-0.5 pointer-events-none">
              <span className="text-[9px] font-black text-primary/20 uppercase tracking-widest transition-colors duration-300 group-hover:text-primary/40">{item.k}</span>
              <span className="item-value text-xs font-black text-primary transition-colors duration-300">{item.v}</span>
            </div>
            <div className="item-icon p-2 rounded-xl bg-white text-primary/20 transition-colors duration-300 pointer-events-none">
              {item.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
}
