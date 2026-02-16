import type { GraphNode } from '@/types/graph';

export function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  return Array.from(new Map(nodes.map(n => [n.id, n])).values());
}

export function removeNodeAndRebuildNeighbors(prev: GraphNode[], id: string): GraphNode[] {
  const filtered = prev.filter(n => n.id !== id);
  const newIndexById = new Map<string, number>();
  filtered.forEach((n, i) => newIndexById.set(n.id, i));

  return filtered.map(node => {
    const rawNeighbors = Array.isArray(node.neighbors) ? node.neighbors : [];
    const nextNeighbors: number[] = [];
    for (const oldNeighborIndex of rawNeighbors) {
      if (!Number.isInteger(oldNeighborIndex)) continue;
      if (oldNeighborIndex < 0 || oldNeighborIndex >= prev.length) continue;
      const oldNeighbor = prev[oldNeighborIndex];
      if (!oldNeighbor || oldNeighbor.id === node.id) continue;
      const newNeighborIndex = newIndexById.get(oldNeighbor.id);
      if (newNeighborIndex === undefined || nextNeighbors.includes(newNeighborIndex)) continue;
      nextNeighbors.push(newNeighborIndex);
    }
    return { ...node, neighbors: nextNeighbors };
  });
}
