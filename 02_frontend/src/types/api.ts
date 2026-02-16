import type { GraphNode, SearchResult } from '@/types/graph';

export interface GraphDataResponse {
  meta?: Record<string, unknown>;
  nodes: GraphNode[];
}

export interface SearchResponse {
  query: string;
  expandedQuery: string;
  results: SearchResult[];
}

export interface PipelineRecord {
  id: string;
  name_of_file: string;
  final_category: string;
  provider: string;
  lod: string;
  output_path?: string;
  path_to_image?: string;
}

export interface PipelineRunResponse {
  success: boolean;
  message?: string;
  error?: string;
  count?: number;
  results?: PipelineRecord[];
}

export interface AnalyzeBatchResponse {
  analysis: string;
}
