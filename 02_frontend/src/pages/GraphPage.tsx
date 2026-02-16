import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import SemanticGraph from '@/components/graph/SemanticGraph';
import Toolbar from '@/components/layout/Toolbar';
import DetailPanel from '@/components/layout/DetailPanel';
import SearchResults from '@/components/search/SearchResults';
import type { GraphNode, LayoutMode, SearchResult } from '@/types/graph';

interface GraphPageProps {
  nodes: GraphNode[];
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onBack: () => void;
  onSearch: (query: string) => void;
  initialQuery: string;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  isDetailsOpen: boolean;
  onCloseDetails: () => void;
  aiResults: SearchResult[] | null;
  onClearResults: () => void;
  onStabilized?: () => void;
  onDeleteNode: (id: string) => void;
}

/** Main graph visualization page — composes toolbar, graph, panels. */
export default function GraphPage({
  nodes, layoutMode, onLayoutChange, onBack, onSearch, initialQuery,
  selectedNodeId, onSelectNode, isDetailsOpen, onCloseDetails,
  aiResults, onClearResults, onStabilized, onDeleteNode,
}: GraphPageProps) {
  
  // State for filtering the graph to show only specific nodes (e.g. search results)
  const [activeFilterIds, setActiveFilterIds] = useState<Set<string> | null>(null);
  
  // State for sidebar collapse (Left AI Results)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isLayoutSwitchLocked, setIsLayoutSwitchLocked] = useState(false);
  const layoutDebounceRef = useRef<number | null>(null);
  const layoutUnlockRef = useRef<number | null>(null);

  // Filter logic
  const filteredIndices = useMemo(() => {
    if (!activeFilterIds) {
       return nodes.length ? nodes.map((_, i) => i) : [];
    }
    const visible: number[] = [];
    nodes.forEach((n, i) => {
       if (activeFilterIds.has(n.id)) visible.push(i);
    });
    return visible;
  }, [nodes, activeFilterIds]);

  const selectedNode = useMemo(() =>
    selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null
  , [nodes, selectedNodeId]);

  const handleSelectNode = useCallback((node: GraphNode | null) => {
    onSelectNode(node);
  }, [onSelectNode]);

  // When filtering is triggered from SearchResults
  const handleFilterGraph = useCallback((ids: string[] | null) => {
      if (ids) {
          setActiveFilterIds(new Set(ids));
      } else {
          setActiveFilterIds(null);
      }
  }, []);

  const handleLayoutChangeSafe = useCallback((mode: LayoutMode) => {
    if (mode === layoutMode || isLayoutSwitchLocked) return;
    if (layoutDebounceRef.current !== null) {
      window.clearTimeout(layoutDebounceRef.current);
    }
    layoutDebounceRef.current = window.setTimeout(() => {
      setIsLayoutSwitchLocked(true);
      onLayoutChange(mode);
      if (layoutUnlockRef.current !== null) {
        window.clearTimeout(layoutUnlockRef.current);
      }
      // Hard unlock fallback in case stabilization callback is missed.
      layoutUnlockRef.current = window.setTimeout(() => {
        setIsLayoutSwitchLocked(false);
      }, 450);
    }, 120);
  }, [layoutMode, onLayoutChange, isLayoutSwitchLocked]);

  const handleGraphStabilized = useCallback(() => {
    setIsLayoutSwitchLocked(false);
    onStabilized?.();
  }, [onStabilized]);

  useEffect(() => {
    return () => {
      if (layoutDebounceRef.current !== null) {
        window.clearTimeout(layoutDebounceRef.current);
      }
      if (layoutUnlockRef.current !== null) {
        window.clearTimeout(layoutUnlockRef.current);
      }
    };
  }, []);

  // Calculate center offset for Toolbar
  // Left Sidebar Width: 
  //   - If Not Showing: 0
  //   - If Showing & Expanded: ~96px (72 width + margins/padding)
  //   - If Showing & Collapsed: ~48px (Icon width + margins)
  const leftWidth = (aiResults && aiResults.length > 0) 
     ? (isLeftCollapsed ? 48 : 96) 
     : 0;
     
  // Right Sidebar Width:
  //   - If Open: ~444px
  //   - Else: 0
  const rightWidth = (selectedNode && isDetailsOpen) ? 444 : 0;
  
  const centerOffset = (leftWidth - rightWidth) / 2;

  return (
    <div className="w-screen h-screen overflow-hidden relative font-sans bg-bg">

      {/* Graph Canvas */}
      <div className="w-full h-full">
        <SemanticGraph
          key="neural-graph"
          nodes={nodes}
          filteredIndices={filteredIndices}
          onSelectNode={handleSelectNode}
          selectedNodeId={selectedNodeId}
          layoutMode={layoutMode}
          onStabilized={handleGraphStabilized}
        />
      </div>

      {/* Toolbar - Centered dynamically */}
      <Toolbar
        layoutMode={layoutMode}
        onLayoutChange={handleLayoutChangeSafe}
        onBack={onBack}
        onSearch={onSearch}
        initialQuery={initialQuery}
        selectedNode={selectedNode}
        filteredCount={filteredIndices.length}
        centerOffset={centerOffset}
        isLayoutSwitchLocked={isLayoutSwitchLocked}
      />

      {/* AI Search Results */}
      {aiResults && aiResults.length > 0 && (
        <SearchResults
          results={aiResults}
          nodes={nodes}
          onSelectNode={(node) => { handleSelectNode(node); }}
          onClose={onClearResults}
          
          // Filtering Props
          onFilterGraph={handleFilterGraph}
          isGraphFiltered={!!activeFilterIds}
          
          // Collapse Props
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
        />
      )}

      {/* Detail Panel */}
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          nodes={nodes}
          isOpen={isDetailsOpen}
          onClose={onCloseDetails}
          onSelectNode={handleSelectNode}
          onLayoutChange={onLayoutChange}
          onDeleteNode={onDeleteNode}
        />
      )}
    </div>
  );
}
