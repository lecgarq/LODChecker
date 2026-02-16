import { useState, useCallback } from 'react';
import { useGraphData } from '@/hooks/useGraphData';
import { useAISearch } from '@/hooks/useAISearch';
import { useKeyboard } from '@/hooks/useKeyboard';
import Spinner from '@/components/ui/Spinner';
import MinimalLoading from '@/components/ui/MinimalLoading';
import LandingPage from '@/pages/LandingPage';
import GraphPage from '@/pages/GraphPage';
import type { GraphNode, LayoutMode } from '@/types/graph';

function App() {
  const [page, setPage] = useState<'landing' | 'graph'>('landing');
  const [initialQuery, setInitialQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('similarity');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isSearchTransitioning, setIsSearchTransitioning] = useState(false);
  const [isGraphStable, setIsGraphStable] = useState(false);

  const { nodes, loading: graphLoading, removeNode } = useGraphData();
  const { aiResults, isSearching, search, clearResults } = useAISearch();

  // Escape key closes detail panel
  useKeyboard('Escape', () => {
    setSelectedNodeId(null);
    setIsDetailsOpen(false);
  });

  const handleSelectNode = useCallback((node: GraphNode | null) => {
    setSelectedNodeId(node ? node.id : null);
    if (node) setIsDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedNodeId(null), 300);
  }, []);

  const handleLandingSearch = useCallback((query: string) => {
    setInitialQuery(query);
    setIsSearchTransitioning(true);
    setIsGraphStable(false); // Reset stability for the new layout
    search(query);
  }, [search]);

  /** Reveal the graph page as the swipe starts */
  const handleSwipeStart = useCallback(() => {
    setPage('graph');
  }, []);

  /** Remove the loading overlay once the swipe completes */
  const handleLoadingFinished = useCallback(() => {
    setIsSearchTransitioning(false);
  }, []);

  const handleBack = useCallback(() => {
    setPage('landing');
    clearResults();
    setSelectedNodeId(null);
  }, [clearResults]);

  const handleSelectNodeFromLanding = useCallback((id: string) => {
    setPage('graph');
    // Small timeout to allow graph to mount before selecting
    setTimeout(() => {
        setSelectedNodeId(id);
        setIsDetailsOpen(true);
    }, 100);
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setIsDetailsOpen(false);
    setSelectedNodeId(null);
    removeNode(id);
  }, [removeNode]);

  // Initial Graph Data Loading
  if (graphLoading) return <Spinner />;

  return (
    <div className="w-full h-full relative">
      {/* Search Transition Loading Layer */}
      {isSearchTransitioning && (
        <MinimalLoading 
          isSearching={isSearching} 
          isGraphStable={isGraphStable}
          onSwipeStart={handleSwipeStart}
          onFinished={handleLoadingFinished} 
        />
      )}

      {/* Pages */}
      {page === 'landing' ? (
        <LandingPage 
          onSearch={handleLandingSearch} 
          onSelectNode={handleSelectNodeFromLanding}
        />
      ) : (
        <GraphPage
          nodes={nodes}
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          onBack={handleBack}
          onSearch={search}
          initialQuery={initialQuery}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
          isDetailsOpen={isDetailsOpen}
          onCloseDetails={handleCloseDetails}
          aiResults={aiResults}
          onClearResults={clearResults}
          onStabilized={() => setIsGraphStable(true)}
          onDeleteNode={handleDeleteNode}
        />
      )}
    </div>
  );
}

export default App;
