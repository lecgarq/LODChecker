import { ANALYZE_API, DATA_URL, DELETE_IMAGE_API, PIPELINE_API, SEARCH_API } from '@/lib/constants';
import type {
  AnalyzeBatchResponse,
  GraphDataResponse,
  PipelineRunResponse,
  SearchResponse,
} from '@/types/api';

async function parseJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchGraphData(): Promise<GraphDataResponse> {
  const res = await fetch(DATA_URL);
  return parseJsonResponse<GraphDataResponse>(res);
}

export async function fetchSearch(query: string): Promise<SearchResponse> {
  const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(query)}`);
  return parseJsonResponse<SearchResponse>(res);
}

export async function runLocalPipeline(files: File[]): Promise<PipelineRunResponse> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const res = await fetch(PIPELINE_API, {
    method: 'POST',
    body: formData,
  });
  if (res.status === 404 || res.status === 405) {
    throw new Error('Backend stale. Please restart run_viz.py terminal.');
  }
  return parseJsonResponse<PipelineRunResponse>(res);
}

export async function fetchBatchAnalysis(payload: { lods: unknown[]; categories: unknown[] }): Promise<AnalyzeBatchResponse> {
  const res = await fetch(ANALYZE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<AnalyzeBatchResponse>(res);
}

export async function deleteImage(filename: string): Promise<Response> {
  return fetch(DELETE_IMAGE_API, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
}
