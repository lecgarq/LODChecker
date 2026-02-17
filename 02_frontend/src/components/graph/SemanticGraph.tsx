import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { getCategoryColor } from '@/lib/colors';
import type { GraphNode, LayoutMode } from '@/types/graph';
import { CANVAS_COLORS } from './graphConstants';
import { buildActiveLinks, getLayoutGroupingKey, getSafeNeighbors, isValidNodeIndex } from './graphUtils';

interface SemanticGraphProps {
  nodes: GraphNode[];
  filteredIndices: number[];
  onSelectNode: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
  layoutMode: LayoutMode;
  onStabilized?: () => void;
}

const SemanticGraph = ({
  nodes,
  filteredIndices,
  onSelectNode,
  selectedNodeId,
  layoutMode,
  onStabilized,
}: SemanticGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const hasNotifiedStable = useRef(false);

  const currentPositions = useRef(new Float32Array(0));
  const targetPositions = useRef(new Float32Array(0));

  const layoutCache = useRef(new Map<string, Float32Array>());

  const view = useRef({ x: 0, y: 0, scale: 1 });
  const targetView = useRef({ x: 0, y: 0, scale: 1 });

  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const rafId = useRef<number | null>(null);
  const isAnimating = useRef(false);
  const prevLayoutMode = useRef(layoutMode);
  const prevActiveIndicesKey = useRef('');

  const sprites = useRef(new Map<string, HTMLCanvasElement>());

  const createCircleSprite = (color: string, size: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const r = size, d = r * 2;
    canvas.width = d; canvas.height = d;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();
    return canvas;
  };

  useEffect(() => {
    const cats = new Set(nodes.map(n => n.final_category));
    cats.forEach(cat => {
      const color = getCategoryColor(cat);
      if (!sprites.current.has(color)) {
        sprites.current.set(color, createCircleSprite(color, 8));
      }
    });
    if (!sprites.current.has('grey')) {
      sprites.current.set('grey', createCircleSprite(CANVAS_COLORS.secondary, 8));
    }
  }, [nodes]);

  const grid = useRef({ size: 0.05, cells: new Map<string, number[]>() });
  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);

  const activeIndices = useMemo(() => {
    return filteredIndices || nodes.map((_, i) => i);
  }, [nodes, filteredIndices]);
  const activeIndicesKey = useMemo(() => {
    let hash = 2166136261;
    for (const idx of activeIndices) {
      hash ^= idx + 1;
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `${activeIndices.length}-${hash >>> 0}`;
  }, [activeIndices]);

  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((n, i) => map.set(n.id, i));
    return map;
  }, [nodes]);

  const activeLinks = useMemo(() => buildActiveLinks(nodes, activeIndices, layoutMode), [nodes, activeIndices, layoutMode]);

  const updateGrid = useCallback(() => {
    const g = grid.current;
    g.cells.clear();
    const pos = currentPositions.current;
    const v = view.current;
    g.size = Math.max(0.01, 60 / v.scale);
    const size = g.size;
    for (const i of activeIndices) {
      const nx = pos[i * 2], ny = pos[i * 2 + 1];
      const key = `${Math.floor(nx / size)},${Math.floor(ny / size)}`;
      if (!g.cells.has(key)) g.cells.set(key, []);
      g.cells.get(key)!.push(i);
    }
  }, [activeIndices]);

  const zoomToFit = useCallback(() => {
    const pos = targetPositions.current;
    if (!pos.length || !canvasRef.current) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const fitIdxs: number[] = selectedNodeId ? [nodeIndexMap.get(selectedNodeId) ?? -1] : [...activeIndices];
    if (selectedNodeId && fitIdxs[0] !== -1) {
      const nb = nodes[fitIdxs[0]].neighbors;
      if (nb) {
        for (let i = 0; i < Math.min(nb.length, 10); i++) {
          const nIdx = nb[i];
          if (!Number.isInteger(nIdx) || nIdx < 0 || nIdx >= nodes.length) continue;
          fitIdxs.push(nIdx);
        }
      }
    }
    for (const i of fitIdxs) {
      if (i === -1) continue;
      const x = pos[i * 2], y = pos[i * 2 + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (minX === Infinity) return;
    const dataW = (maxX - minX) || 0.01, dataH = (maxY - minY) || 0.01;

    const cW = canvasRef.current.clientWidth || 1000;
    const cH = canvasRef.current.clientHeight || 800;

    // Sidebar consideration (420px width + 24px margin = ~444px)
    const sidebarWidth = selectedNodeId ? 440 : 0;
    const effectiveCW = cW - sidebarWidth;
    const fitS = Math.min(effectiveCW / dataW, cH / dataH) * 0.75;
    
    // Offset center to the left if sidebar is open
    const centerX = (minX + maxX) / 2;
    const offsetX = (sidebarWidth / 2) / fitS;

    targetView.current = { 
      x: centerX + offsetX, 
      y: (minY + maxY) / 2, 
      scale: fitS 
    };
  }, [activeIndices, nodes, selectedNodeId, nodeIndexMap]);

  // Track previous node mapping to preserve positions on delete/update
  const prevNodeIndexMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!nodes.length) return;
    const count = nodes.length;

    let sizeChanged = false;

    // Preserve positions if array size changes (e.g. deletion)
    if (currentPositions.current.length !== count * 2) {
      sizeChanged = true;
      const newCurrent = new Float32Array(count * 2);
      const newTarget = new Float32Array(count * 2);
      const oldPositions = currentPositions.current;
      const oldMap = prevNodeIndexMap.current;

      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        const oldIdx = oldMap.get(node.id);
        
        // If node existed, copy its last position
        if (oldIdx !== undefined && oldIdx * 2 < oldPositions.length) {
          newCurrent[i * 2] = oldPositions[oldIdx * 2];
          newCurrent[i * 2 + 1] = oldPositions[oldIdx * 2 + 1];
        } else {
          // New node or fallback: separate start pos by small random or use UMAP
          newCurrent[i * 2] = node.x ?? 0;
          newCurrent[i * 2 + 1] = node.y ?? 0;
        }
      }
      
      currentPositions.current = newCurrent;
      targetPositions.current = newTarget;
      
      // Update mapping for next time
      const newMap = new Map<string, number>();
      nodes.forEach((n, i) => newMap.set(n.id, i));
      prevNodeIndexMap.current = newMap;
    } else {
        // Even if size didn't change (e.g. swap), verify map
        const newMap = new Map<string, number>();
        nodes.forEach((n, i) => newMap.set(n.id, i));
        prevNodeIndexMap.current = newMap;
    }

    const modeChanged = prevLayoutMode.current !== layoutMode;
    const activeSetChanged = prevActiveIndicesKey.current !== activeIndicesKey;
    prevLayoutMode.current = layoutMode;
    prevActiveIndicesKey.current = activeIndicesKey;
    const layoutCacheKey = layoutMode === 'similarity' ? layoutMode : `${layoutMode}:${activeIndicesKey}`;

    if (modeChanged || activeSetChanged || sizeChanged || !isReady) {
      if (layoutCache.current.has(layoutCacheKey)) {
        const cached = layoutCache.current.get(layoutCacheKey)!;
        if (cached.length === targetPositions.current.length) {
          targetPositions.current.set(cached);
        } else {
          // Cache invalid due to node count change
          layoutCache.current.delete(layoutCacheKey);
        }
      } 
      
      if (!layoutCache.current.has(layoutCacheKey)) {
        const targets = new Float32Array(count * 2);
        if (layoutMode === 'similarity') {
          for (let i = 0; i < count; i++) {
            targets[i * 2] = nodes[i].x ?? 0;
            targets[i * 2 + 1] = nodes[i].y ?? 0;
          }
        } else {
          const keyFn = getLayoutGroupingKey(layoutMode);

          const groups = new Map<string, number[]>();
          for (const i of activeIndices) {
            const key = keyFn(nodes[i]);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(i);
          }

          const keys = Array.from(groups.keys()).sort();
          const cols = Math.ceil(Math.sqrt(keys.length));
          const sp = 4 / Math.max(cols, 1);
          keys.forEach((key, ki) => {
            const gx = (ki % cols) * sp, gy = Math.floor(ki / cols) * sp;
            const items = groups.get(key)!, iCols = Math.ceil(Math.sqrt(items.length));
            const iSp = sp * 0.8 / Math.max(iCols, 1);
            for (let ii = 0; ii < items.length; ii++) {
              const idx = items[ii];
              targets[idx * 2] = gx + (ii % iCols) * iSp;
              targets[idx * 2 + 1] = gy + Math.floor(ii / iCols) * iSp;
            }
          });
        }
        layoutCache.current.set(layoutCacheKey, targets);
        targetPositions.current.set(targets);
      }

      if (!isReady) {
        currentPositions.current.set(targetPositions.current);
      } else {
        isAnimating.current = true;
      }

      updateGrid();
      requestAnimationFrame(() => zoomToFit());
      hasNotifiedStable.current = false; // Reset stability notification for the new layout
    }

    if (!isReady) {
      requestAnimationFrame(() => {
        setIsReady(true);
        // If not animating (initial render), notify stable immediately after zoom
        setTimeout(() => {
          if (!isAnimating.current && onStabilized) {
            onStabilized();
            hasNotifiedStable.current = true;
          }
        }, 100);
      });
    }
  }, [nodes, activeIndices, activeIndicesKey, layoutMode, isReady, updateGrid, zoomToFit, onStabilized]);

  // Automated Focus: Zoom to fit whenever selection changes
  useEffect(() => {
    if (isReady && selectedNodeId) {
      // Debounce slightly to allow other transitions to start
      const timer = setTimeout(() => zoomToFit(), 250);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeId, isReady, zoomToFit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const render = () => {
      rafId.current = requestAnimationFrame(render);

      const v = view.current, tv = targetView.current;
      v.x += (tv.x - v.x) * 0.2; v.y += (tv.y - v.y) * 0.2; v.scale += (tv.scale - v.scale) * 0.2;

      if (isAnimating.current) {
        const cp = currentPositions.current, tp = targetPositions.current;
        let maxDiff = 0;
        for (let i = 0; i < cp.length; i++) {
          const diff = tp[i] - cp[i];
          if (Math.abs(diff) > 0.001) {
            cp[i] += diff * 0.2;
            maxDiff = Math.max(maxDiff, Math.abs(diff));
          } else {
            cp[i] = tp[i];
          }
        }
        if (maxDiff < 0.0005) {
          isAnimating.current = false;
          updateGrid();
          if (onStabilized && !hasNotifiedStable.current) {
            onStabilized();
            hasNotifiedStable.current = true;
          }
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;

      const wantedW = Math.floor(w * dpr), wantedH = Math.floor(h * dpr);
      if (canvas.width !== wantedW || canvas.height !== wantedH) {
        canvas.width = wantedW; canvas.height = wantedH;
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = CANVAS_COLORS.bg; ctx.fillRect(0, 0, w, h);

      ctx.translate(w / 2, h / 2);
      ctx.scale(v.scale, v.scale);
      ctx.translate(-v.x, -v.y);
      const pos = currentPositions.current;

      let selectedIdx = -1;
      const highlightSet = new Set<number>();
      const curSelectedId = selectedNodeIdRef.current;
      if (curSelectedId) {
        selectedIdx = nodeIndexMap.get(curSelectedId) ?? -1;
        if (isValidNodeIndex(selectedIdx, nodes.length)) {
          highlightSet.add(selectedIdx);
          for (const nIdx of getSafeNeighbors(nodes[selectedIdx], nodes.length, 10)) {
            highlightSet.add(nIdx);
          }
        }
      }
      const hasSelection = selectedIdx !== -1;

      const pad = 50 / v.scale;
      const minWX = v.x - (w / 2) / v.scale - pad, maxWX = v.x + (w / 2) / v.scale + pad;
      const minWY = v.y - (h / 2) / v.scale - pad, maxWY = v.y + (h / 2) / v.scale + pad;

      // Links
      const links = activeLinks;
      // High Performance Mode: When interacting or animating, reduce complexity
      const useLowQuality = isDragging.current || isAnimating.current || Math.abs(tv.x - v.x) > 0.5 || Math.abs(tv.scale - v.scale) > 0.5;
      
      if (!useLowQuality || hasSelection) {
        ctx.lineWidth = 0.5 / v.scale;

        if (hasSelection) {
          ctx.globalAlpha = 0.8;
          const c = getCategoryColor(nodes[selectedIdx].final_category);
          ctx.strokeStyle = c;
          ctx.beginPath();
          for (const t of getSafeNeighbors(nodes[selectedIdx], nodes.length, 10)) {
            ctx.moveTo(pos[selectedIdx * 2], pos[selectedIdx * 2 + 1]);
            ctx.lineTo(pos[t * 2], pos[t * 2 + 1]);
          }
          ctx.stroke();
        } else if (links.length > 0) {
          ctx.globalAlpha = 0.07;
          // Optimization: If too many links, only draw a subset or skip entirely in motion
          if (links.length < 50000) { 
            const batches = new Map<string, number[]>();
            // Draw stride for performance if massive
            const stride = links.length > 20000 ? 4 : 2;
            for (let i = 0; i < links.length; i += stride) {
              const s = links[i], t = links[i + 1];
              // Rough culling
              if (pos[s * 2] < minWX && pos[t * 2] < minWX) continue;
              
              const color = getCategoryColor(nodes[s].final_category);
              if (!batches.has(color)) batches.set(color, []);
              batches.get(color)!.push(s, t);
            }
            for (const [color, p] of batches) {
              ctx.strokeStyle = color; ctx.beginPath();
              for (let i = 0; i < p.length; i += 2) {
                ctx.moveTo(pos[p[i] * 2], pos[p[i] * 2 + 1]); ctx.lineTo(pos[p[i + 1] * 2], pos[p[i + 1] * 2 + 1]);
              }
              ctx.stroke();
            }
          }
        }
      }

      // Nodes
      const dimBatches = new Map<string, number[]>(), brightBatches = new Map<string, number[]>();
      for (const i of activeIndices) {
        const nx = pos[i * 2], ny = pos[i * 2 + 1];
        if (nx < minWX || nx > maxWX || ny < minWY || ny > maxWY) continue;
        const color = getCategoryColor(nodes[i].final_category);
        const target = (!hasSelection || highlightSet.has(i)) ? brightBatches : dimBatches;
        if (!target.has(color)) target.set(color, []);
        target.get(color)!.push(nx, ny);
      }

      const r = 0.8 / v.scale;

      if (hasSelection) {
        ctx.globalAlpha = 0.15;
        const sprite = sprites.current.get('grey');
        if (sprite) {
          const d = r * 2;
          for (const [, coords] of dimBatches) {
            for (let i = 0; i < coords.length; i += 2) {
              ctx.drawImage(sprite, coords[i] - r, coords[i + 1] - r, d, d);
            }
          }
        }
      } else {
        ctx.globalAlpha = 0.6;
        const d = r * 2;
        for (const [color, coords] of dimBatches) {
          const sprite = sprites.current.get(color);
          if (sprite) {
            for (let i = 0; i < coords.length; i += 2) {
              ctx.drawImage(sprite, coords[i] - r, coords[i + 1] - r, d, d);
            }
          }
        }
      }

      if (hasSelection) {
        const rG = 3.5 / v.scale;
        ctx.globalAlpha = 1.0;
        for (const [color, coords] of brightBatches) {
          const sprite = sprites.current.get(color);
          if (sprite) {
            const d = rG * 2;
            for (let i = 0; i < coords.length; i += 2) {
              ctx.drawImage(sprite, coords[i] - rG, coords[i + 1] - rG, d, d);
            }
          }
        }
      } else {
        const rBright = 1.5 / v.scale;
        ctx.globalAlpha = 1.0;
        for (const [color, coords] of brightBatches) {
          const sprite = sprites.current.get(color);
          if (sprite) {
            const d = rBright * 2;
            for (let i = 0; i < coords.length; i += 2) {
              ctx.drawImage(sprite, coords[i] - rBright, coords[i + 1] - rBright, d, d);
            }
          }
        }
      }

      if (hasSelection) {
        const sx = pos[selectedIdx * 2], sy = pos[selectedIdx * 2 + 1];
        const color = getCategoryColor(nodes[selectedIdx].final_category);
        ctx.globalAlpha = 0.2; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 14 / v.scale, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0; ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5 / v.scale; ctx.beginPath(); ctx.arc(sx, sy, 8 / v.scale, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 4 / v.scale, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    };
    rafId.current = requestAnimationFrame(render);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [activeLinks, activeIndices, nodes, updateGrid, nodeIndexMap]);

  // Interaction handlers
  const hitTest = useCallback((sx: number, sy: number): GraphNode | null => {
    if (!canvasRef.current) return null;
    const v = view.current;
    const w = canvasRef.current.clientWidth;
    const h = canvasRef.current.clientHeight;
    const wx = v.x + (sx - w / 2) / v.scale, wy = v.y + (sy - h / 2) / v.scale;
    const g = grid.current;
    if (!g.cells.size) return null;
    
    // Restriction: Determine which nodes are actually interactive
    const interactiveSet = new Set<number>();
    const curSelectedId = selectedNodeIdRef.current;
    if (curSelectedId) {
      const idx = nodeIndexMap.get(curSelectedId);
      if (idx !== undefined && isValidNodeIndex(idx, nodes.length)) {
        interactiveSet.add(idx);
        for (const nIdx of getSafeNeighbors(nodes[idx], nodes.length, 10)) interactiveSet.add(nIdx);
      }
    } else {
      activeIndices.forEach(idx => interactiveSet.add(idx));
    }

    const gx = Math.floor(wx / g.size), gy = Math.floor(wy / g.size);
    let bestDist = 15 / v.scale, bestIdx = -1;
    const pos = currentPositions.current;
    for (let ox = -2; ox <= 2; ox++) {
      for (let oy = -2; oy <= 2; oy++) {
        const key = `${gx + ox},${gy + oy}`, cell = g.cells.get(key);
        if (cell) for (const idx of cell) {
          if (!interactiveSet.has(idx)) continue; // ONLY interact with visible nodes
          const dx = pos[idx * 2] - wx, dy = pos[idx * 2 + 1] - wy, d = Math.hypot(dx, dy);
          if (d < bestDist) { bestDist = d; bestIdx = idx; }
        }
      }
    }
    return bestIdx !== -1 ? nodes[bestIdx] : null;
  }, [nodes, activeIndices, nodeIndexMap]);

  const clickStart = useRef({ x: 0, y: 0 });
  const handlePointerDown = (e: React.PointerEvent) => {
    if (contextMenu.visible) setContextMenu({ visible: false, x: 0, y: 0 });
    if (e.button !== 0) return;
    isDragging.current = true; setIsDraggingState(true);
    clickStart.current = { x: e.clientX, y: e.clientY }; lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ visible: true, x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
      view.current.x -= dx / view.current.scale; view.current.y -= dy / view.current.scale;
      targetView.current = { ...view.current };
      lastMouse.current = { x: e.clientX, y: e.clientY };
    } else {
      const node = hitTest(lx, ly);
      if (node !== hoveredNode) setHoveredNode(node);
      
      // Direct DOM update for performance (avoid React render loop 60fps)
      if (tooltipRef.current) {
        if (node) {
          tooltipRef.current.style.transform = `translate(${lx + 12}px, ${ly + 12}px)`;
          tooltipRef.current.style.opacity = '1';
        } else {
          tooltipRef.current.style.opacity = '0';
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDragging.current = false; setIsDraggingState(false);
    if (Math.hypot(e.clientX - clickStart.current.x, e.clientY - clickStart.current.y) < 5) onSelectNode(hoveredNode);
  };

  const middleStart = useRef({ x: 0, y: 0 }), middleLast = useRef({ x: 0, y: 0 }), middleDragging = useRef(false);
  const handleMiddleDown = useCallback((e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault(); middleDragging.current = true;
      middleStart.current = { x: e.clientX, y: e.clientY }; middleLast.current = { x: e.clientX, y: e.clientY };
      setIsDraggingState(true);
    }
  }, []);

  const handleMiddleMove = useCallback((e: MouseEvent) => {
    if (!middleDragging.current) return;
    const dx = e.clientX - middleLast.current.x, dy = e.clientY - middleLast.current.y;
    view.current.x -= dx / view.current.scale; view.current.y -= dy / view.current.scale;
    targetView.current = { ...view.current };
    middleLast.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMiddleUp = useCallback((e: MouseEvent) => {
    if (e.button === 1 && middleDragging.current) {
      middleDragging.current = false; setIsDraggingState(false);
      if (Math.hypot(e.clientX - middleStart.current.x, e.clientY - middleStart.current.y) < 5) zoomToFit();
    }
  }, [zoomToFit]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2, oldS = view.current.scale;
    const wx = view.current.x + (mx - cx) / oldS, wy = view.current.y + (my - cy) / oldS;
    const newS = Math.max(10, Math.min(500000, oldS * Math.pow(1.002, -e.deltaY)));
    view.current = { scale: newS, x: wx - (mx - cx) / newS, y: wy - (my - cy) / newS };
    targetView.current = { ...view.current };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ro = new ResizeObserver(() => {
      if (!isReady) zoomToFit();
    });
    ro.observe(canvas.parentElement!);

    const hideMenu = () => setContextMenu({ visible: false, x: 0, y: 0 });
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') hideMenu(); };

    window.addEventListener('click', hideMenu);
    window.addEventListener('keydown', handleKeyDown);

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMiddleDown);
    canvas.addEventListener('mousemove', handleMiddleMove);
    canvas.addEventListener('mouseup', handleMiddleUp);
    return () => {
      ro.disconnect();
      window.removeEventListener('click', hideMenu);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMiddleDown);
      canvas.removeEventListener('mousemove', handleMiddleMove);
      canvas.removeEventListener('mouseup', handleMiddleUp);
    };
  }, [handleWheel, handleMiddleDown, handleMiddleMove, handleMiddleUp, zoomToFit, isReady]);

  return (
    <div className={`w-full h-full relative bg-bg transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${isDraggingState ? 'cursor-grabbing' : hoveredNode ? 'cursor-pointer' : 'cursor-crosshair'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="absolute bg-white border border-secondary shadow-md rounded-lg p-[3px] z-[2000] min-w-[120px] animate-scale-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); zoomToFit(); setContextMenu({ visible: false, x: 0, y: 0 }); }}
            className="w-full px-2.5 py-[7px] border-none bg-transparent text-text text-xs font-medium text-left cursor-pointer rounded-md hover:bg-secondary transition-colors"
          >
            Zoom to Fit
          </button>
        </div>
      )}

      {/* Optimized Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white px-3 py-2 rounded-lg shadow-lg pointer-events-none border border-secondary z-30 font-sans transition-opacity duration-75 will-change-transform"
        style={{ top: 0, left: 0, opacity: hoveredNode ? 1 : 0 }}
      >
        {hoveredNode && (
          <>
            <div className="font-bold text-xs text-text mb-0.5">{hoveredNode.name}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: getCategoryColor(hoveredNode.final_category) }}>
              {hoveredNode.final_category}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(SemanticGraph);
