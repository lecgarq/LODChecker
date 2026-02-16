import { useState, useEffect } from 'react';
import type { GraphNode } from '@/types/graph';
import { fetchGraphData } from '@/services/api';
import { dedupeNodes, removeNodeAndRebuildNeighbors } from '@/lib/graphNodeOps';

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
    fetchGraphData()
      .then(data => {
        if (!data?.nodes) throw new Error('Invalid data');
        setNodes(dedupeNodes(data.nodes as GraphNode[]));
        setLoading(false);
      })
      .catch(err => {
        console.error('Load failed:', err);
        setLoading(false);
      });
  }, []);

  const removeNode = (id: string) => {
    setNodes(prev => removeNodeAndRebuildNeighbors(prev, id));
  };

  return { nodes, loading, removeNode };
}
