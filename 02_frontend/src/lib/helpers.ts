/**
 * Pure utility helpers — no React, no JSX.
 */

/** Map a raw LOD string to a numeric label. */
export const getLodLabel = (lod: string | undefined): string => {
  if (!lod) return '';
  const lower = String(lod).toLowerCase();
  if (lower.includes('low') && lower.includes('medium')) return '200';
  if (lower.includes('medium') && lower.includes('high')) return '300';
  if (lower === 'low') return '100';
  if (lower === 'medium') return '250';
  if (lower.includes('high')) return '400';
  if (lower.includes('complex')) return '400';
  return lod;
};

/** Get the thumbnail URL for a node. */
export const getNodeImageUrl = (node: { img?: string; name_of_file?: string }): string => {
  const filename = (node.img || node.name_of_file || '').split('/').pop() || '';
  return `/img/${filename}`;
};
