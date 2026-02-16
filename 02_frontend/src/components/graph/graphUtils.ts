import type { GraphNode, LayoutMode } from '@/types/graph';
import { getLodLabel } from '@/lib/helpers';

export function isValidNodeIndex(index: number, totalNodes: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < totalNodes;
}

export function getSafeNeighbors(node: GraphNode, totalNodes: number, limit = 10): number[] {
  const neighbors = Array.isArray(node.neighbors) ? node.neighbors : [];
  const out: number[] = [];
  for (let i = 0; i < Math.min(neighbors.length, limit); i++) {
    const idx = neighbors[i];
    if (!isValidNodeIndex(idx, totalNodes)) continue;
    out.push(idx);
  }
  return out;
}

export function buildActiveLinks(nodes: GraphNode[], activeIndices: number[], layoutMode: LayoutMode): Uint32Array {
  if (layoutMode !== 'similarity') return new Uint32Array(0);
  const indexSet = new Set(activeIndices);
  const links: number[] = [];
  for (const i of activeIndices) {
    const node = nodes[i];
    const safeNeighbors = getSafeNeighbors(node, nodes.length, 10);
    for (const tIdx of safeNeighbors) {
      if (indexSet.has(tIdx)) links.push(i, tIdx);
    }
  }
  return new Uint32Array(links);
}

export function getLayoutGroupingKey(mode: LayoutMode): (n: GraphNode) => string {
  if (mode === 'category') return n => n.final_category ?? '';
  if (mode === 'lod') return n => getLodLabel(n.lod_label);
  return n => n.provider || 'Unknown';
}
