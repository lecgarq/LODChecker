// ── Graph Node (from master_registry.json via graph_data.json) ──

export interface GraphNode {
  id: string;
  name: string;
  family_name?: string;
  final_category?: string;
  lod_label?: string;
  provider?: string;
  img?: string;
  name_of_file?: string;
  original_file?: string;
  file_size_kb?: number;
  full_description?: string;
  confidence_level?: string;
  possible_categories?: string | string[];
  x?: number;
  y?: number;
  z?: number;
  neighbors?: number[];
  caption?: string;
}

// ── AI Search Result ──

export interface SearchResult {
  id: string;
  score: number;
}

// ── Layout Mode ──

export type LayoutMode = 'similarity' | 'category' | 'lod' | 'provider';

// ── Mode Tab Definition ──

export interface ModeTab {
  id: LayoutMode;
  label: string;
}
