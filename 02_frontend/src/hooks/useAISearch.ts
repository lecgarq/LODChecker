import { useState, useCallback } from 'react';
import type { SearchResult } from '@/types/graph';
import { fetchSearch } from '@/services/api';

interface AISearchState {
  aiResults: SearchResult[] | null;
  isSearching: boolean;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

/** Custom hook for AI-powered search. */
export function useAISearch(): AISearchState {
  const [aiResults, setAiResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query) {
      setAiResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const data = await fetchSearch(query);
      if (data.results) {
        // Show top 100 results ordered by confidence (backend sorts them)
        setAiResults(data.results.slice(0, 100));
      }
    } catch (err) {
      console.error('AI Search Error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => setAiResults(null), []);

  return { aiResults, isSearching, search, clearResults };
}
