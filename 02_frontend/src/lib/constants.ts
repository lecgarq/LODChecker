const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function withApiBase(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

/** API & data endpoints */
export const DATA_URL = withApiBase("/vectors/graph_data.json");
export const SEARCH_API = withApiBase("/api/search");
export const ANALYZE_API = withApiBase("/api/analyze_batch");
export const PIPELINE_API = withApiBase("/api/run/local_pipeline");
export const DELETE_IMAGE_API = withApiBase("/api/delete/image");
