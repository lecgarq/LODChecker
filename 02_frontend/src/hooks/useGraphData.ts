import { useState, useEffect } from 'react';
import { DATA_URL } from '@/lib/constants';
import type { GraphNode } from '@/types/graph';

interface GraphDataState {
  nodes: GraphNode[];
  loading: boolean;
  removeNode: (id: string) => void;
}

/** Fetch and cache graph data from the backend. */
export function useGraphData(): GraphDataState {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(DATA_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data?.nodes) throw new Error('Invalid data');
        // Deduplicate nodes by ID
        const uniqueNodes = Array.from(new Map((data.nodes as GraphNode[]).map(n => [n.id, n])).values());
        setNodes(uniqueNodes);
        setLoading(false);
      })
      .catch(err => {
        console.error('Load failed:', err);
        setLoading(false);
      });
  }, []);

  const removeNode = (id: string) => {
    setNodes(prev => {
      const oldIndexById = new Map<string, number>();
      prev.forEach((n, i) => oldIndexById.set(n.id, i));

      const filtered = prev.filter(n => n.id !== id);
      const newIndexById = new Map<string, number>();
      filtered.forEach((n, i) => newIndexById.set(n.id, i));

      return filtered.map((node) => {
        const rawNeighbors = Array.isArray(node.neighbors) ? node.neighbors : [];
        const nextNeighbors: number[] = [];

        for (const oldNeighborIndex of rawNeighbors) {
          if (!Number.isInteger(oldNeighborIndex)) continue;
          if (oldNeighborIndex < 0 || oldNeighborIndex >= prev.length) continue;

          const oldNeighbor = prev[oldNeighborIndex];
          if (!oldNeighbor || oldNeighbor.id === node.id) continue;

          const newNeighborIndex = newIndexById.get(oldNeighbor.id);
          if (newNeighborIndex === undefined) continue;
          if (nextNeighbors.includes(newNeighborIndex)) continue;

          nextNeighbors.push(newNeighborIndex);
        }

        return { ...node, neighbors: nextNeighbors };
      });
    });
  };

  return { nodes, loading, removeNode };
}
