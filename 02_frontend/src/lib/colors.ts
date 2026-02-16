/**
 * Category color mapping.
 * Deterministic: same category always gets same color.
 */

const VIBRANT_COLORS: string[] = [
  '#E63946', '#F4A261', '#2A9D8F', '#264653', '#A8DADC',
  '#D62828', '#F77F00', '#FCBF49', '#003049', '#FF9F1C',
  '#2EC4B6', '#FFBF69', '#FF99C8', '#9B5DE5', '#F15BB5',
  '#FEE440', '#00BBF9', '#00F5D4', '#4361EE', '#3A0CA3',
  '#7209B7', '#560BAD', '#480CA8', '#B5179E', '#F72585',
  '#4CC9F0', '#8338EC', '#FF006E', '#FB5607', '#3D5A40',
];

const colorCache = new Map<string, string>();

/** Returns a deterministic vibrant color for a given category string. */
export const getCategoryColor = (category?: string): string => {
  if (!category) return '#E9E7E2'; // secondary fallback

  if (!colorCache.has(category)) {
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % VIBRANT_COLORS.length;
    colorCache.set(category, VIBRANT_COLORS[index]);
  }

  return colorCache.get(category)!;
};
