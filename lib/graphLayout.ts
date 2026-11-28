import type { Paper } from '@/types';

export const QUERY_NODE_WIDTH = 200;
export const QUERY_NODE_HEIGHT = 76;
export const PAPER_NODE_WIDTH = 216;
export const PAPER_NODE_HEIGHT = 144;

const COLLISION_PAD_X = 40;
const COLLISION_PAD_Y = 38;
const HUB_SAFE_RADIUS_X = Math.ceil(QUERY_NODE_WIDTH / 2 + PAPER_NODE_WIDTH / 2 + 26);
const HUB_SAFE_RADIUS_Y = Math.ceil(QUERY_NODE_HEIGHT / 2 + PAPER_NODE_HEIGHT / 2 + 24);

export interface Point2D {
  x: number;
  y: number;
}

export interface RadialNeighborEdgeSpec {
  id: string;
  sourcePaperId: string;
  targetPaperId: string;
  sharedLabel: string;
}

export interface RadialLayoutResult {
  queryPosition: Point2D;
  paperPositions: Map<string, Point2D>;
  neighborEdges: RadialNeighborEdgeSpec[];
  connectedNeighbors: Map<string, Set<string>>;
}

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const SHARED_TECH_KEYWORDS = [
  'cnn',
  'svm',
  'lstm',
  'bert',
  'yolov8',
  'yolo',
  'transformer',
  'random forest',
  'naive bayes',
  'xgboost',
  'u-net',
  'knn',
  'kmeans',
  'sentiment',
  'classification',
  'segmentation',
  'nlp',
  'regression',
  'decision tree',
  'deep learning',
];

/**
 * Deterministic 32-bit FNV-1a hash returning [0, 1).
 */
export function deterministicUnitHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function extractPrimaryMethodTag(paper: Paper): string | null {
  const haystack = `${paper.method} ${paper.problem}`.toLowerCase();
  for (const kw of SHARED_TECH_KEYWORDS) {
    if (haystack.includes(kw)) {
      return kw.toUpperCase();
    }
  }
  return null;
}

export function findSharedMethodologyLabel(a: Paper, b: Paper): string | null {
  const textA = `${a.method} ${a.problem}`.toLowerCase();
  const textB = `${b.method} ${b.problem}`.toLowerCase();
  for (const kw of SHARED_TECH_KEYWORDS) {
    if (textA.includes(kw) && textB.includes(kw)) {
      return `Shared: ${kw.toUpperCase()}`;
    }
  }
  return null;
}

/**
 * Selects optimal source & target cardinal handles based on vector between node centers.
 */
export function pickRadialHandles(
  sourceCenter: Point2D,
  targetCenter: Point2D
): { sourceHandle: string; targetHandle: string } {
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  let outSide: HandleSide;
  let inSide: HandleSide;

  if (Math.abs(dx) >= Math.abs(dy)) {
    outSide = dx >= 0 ? 'right' : 'left';
    inSide = dx >= 0 ? 'left' : 'right';
  } else {
    outSide = dy >= 0 ? 'bottom' : 'top';
    inSide = dy >= 0 ? 'top' : 'bottom';
  }

  return {
    sourceHandle: `s-${outSide}`,
    targetHandle: `t-${inSide}`,
  };
}

interface WorkingNode {
  paper: Paper;
  cx: number;
  cy: number;
  tag: string;
  pinned: boolean;
}

function resolveOverlaps(nodes: WorkingNode[]): void {
  const minDx = PAPER_NODE_WIDTH + COLLISION_PAD_X;
  const minDy = PAPER_NODE_HEIGHT + COLLISION_PAD_Y;

  for (let iter = 0; iter < 140; iter++) {
    let moved = false;

    // 1. Repel away from center Query hub (0, 0)
    const pushAwayFromHub = () => {
      for (const n of nodes) {
        if (n.pinned) continue;
        const absX = Math.abs(n.cx);
        const absY = Math.abs(n.cy);
        if (absX < HUB_SAFE_RADIUS_X && absY < HUB_SAFE_RADIUS_Y) {
          const pushX = HUB_SAFE_RADIUS_X - absX;
          const pushY = HUB_SAFE_RADIUS_Y - absY;
          const signX = n.cx >= 0 ? 1 : -1;
          const signY = n.cy >= 0 ? 1 : -1;
          if (pushX * (HUB_SAFE_RADIUS_Y / HUB_SAFE_RADIUS_X) <= pushY) {
            n.cx += signX * (pushX + 4);
          } else {
            n.cy += signY * (pushY + 4);
          }
          moved = true;
        }
      }
    };
    pushAwayFromHub();

    // 2. Weak method-cluster pull on early passes so shared methods group naturally
    if (iter < 45) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.tag === 'GENERAL' || a.tag !== b.tag) continue;
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy);
          if (dist > 340) {
            const pull = 0.012;
            if (!a.pinned) {
              a.cx += dx * pull;
              a.cy += dy * pull;
            }
            if (!b.pinned) {
              b.cx -= dx * pull;
              b.cy -= dy * pull;
            }
          }
        }
      }
    }

    // 3. Strict AABB overlap resolution between all thesis cards
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const signY = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);

          // Push along minimum-penetration axis
          const moveOnX = overlapX * (PAPER_NODE_HEIGHT / PAPER_NODE_WIDTH) <= overlapY;
          const sepX = moveOnX ? overlapX + 2 : 0;
          const sepY = moveOnX ? 0 : overlapY + 2;

          if (a.pinned && !b.pinned) {
            b.cx += signX * sepX;
            b.cy += signY * sepY;
          } else if (!a.pinned && b.pinned) {
            a.cx -= signX * sepX;
            a.cy -= signY * sepY;
          } else {
            a.cx -= signX * sepX * 0.52;
            a.cy -= signY * sepY * 0.52;
            b.cx += signX * sepX * 0.52;
            b.cy += signY * sepY * 0.52;
          }
        }
      }
    }

    // Re-enforce hub clear zone after pairwise pushes
    pushAwayFromHub();

    if (!moved && iter > 20) break;
  }
}

/**
 * Computes a deterministic, non-overlapping organic radial layout centered at (0, 0).
 * - Higher similarity sits closer to (0, 0); lower similarity sits further out across 3 rings.
 * - Shared methodology tags draw cards gently into adjacent angular sectors.
 * - When anchorPositions is supplied (new papers added incrementally), existing nodes keep
 *   their previous coordinates and only newly added nodes settle around them.
 */
export function computeRadialGraphLayout(
  papers: Paper[],
  anchorPositions?: Map<string, Point2D>
): RadialLayoutResult {
  const queryPosition: Point2D = {
    x: -QUERY_NODE_WIDTH / 2,
    y: -QUERY_NODE_HEIGHT / 2,
  };

  const paperPositions = new Map<string, Point2D>();
  const neighborEdges: RadialNeighborEdgeSpec[] = [];
  const connectedNeighbors = new Map<string, Set<string>>();

  if (papers.length === 0) {
    return { queryPosition, paperPositions, neighborEdges, connectedNeighbors };
  }

  // Place named method clusters adjacent, and interleave unclustered items around remaining angles
  const withTag = papers
    .filter((p) => extractPrimaryMethodTag(p) !== null)
    .sort((a, b) => {
      const tagA = extractPrimaryMethodTag(a)!;
      const tagB = extractPrimaryMethodTag(b)!;
      return tagA.localeCompare(tagB) || b.similarity - a.similarity || a.id.localeCompare(b.id);
    });
  const withoutTag = papers
    .filter((p) => extractPrimaryMethodTag(p) === null)
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));

  // Interleave unclustered cards evenly among clustered ones for 360° symmetry
  const ordered: Paper[] = [];
  const totalCount = papers.length;
  const step = withoutTag.length > 0 ? Math.max(1, Math.floor(totalCount / withoutTag.length)) : totalCount + 1;
  let ti = 0;
  let ui = 0;
  for (let slot = 0; slot < totalCount; slot++) {
    if (ui < withoutTag.length && (ti >= withTag.length || slot % step === 0)) {
      ordered.push(withoutTag[ui++]);
    } else if (ti < withTag.length) {
      ordered.push(withTag[ti++]);
    }
  }

  const minSim = Math.min(...papers.map((p) => p.similarity));
  const maxSim = Math.max(...papers.map((p) => p.similarity));
  const simSpread = maxSim - minSim;

  const working: WorkingNode[] = ordered.map((paper, idx) => {
    const anchored = anchorPositions?.get(paper.id);
    if (anchored) {
      return {
        paper,
        cx: anchored.x + PAPER_NODE_WIDTH / 2,
        cy: anchored.y + PAPER_NODE_HEIGHT / 2,
        tag: extractPrimaryMethodTag(paper) || 'GENERAL',
        pinned: true,
      };
    }

    const h1 = deterministicUnitHash(`${paper.id}:angle`);
    const h2 = deterministicUnitHash(`${paper.id}:radius`);

    // Determine ring (0 = inner, 1 = middle, 2 = outer) from similarity or hash when equal
    let ringIndex: number;
    if (simSpread >= 6) {
      const normalized = (maxSim - paper.similarity) / simSpread; // 0 = highest sim -> closest
      ringIndex = normalized < 0.34 ? 0 : normalized < 0.68 ? 1 : 2;
    } else {
      ringIndex = idx % 3;
    }

    // Balanced 360° angle per item + organic ID-seeded jitter
    const baseAngle = (idx / ordered.length) * Math.PI * 2 - Math.PI / 2;
    const ringPhase = ringIndex * 0.42;
    const angleJitter = (h1 - 0.5) * 0.65;
    const angle = baseAngle + ringPhase + angleJitter;

    const scale = Math.max(1, Math.sqrt(ordered.length / 20));
    const ringBaseRadii = [
      Math.round(280 * scale),
      Math.round(455 * scale),
      Math.round(635 * scale),
    ];
    const radius = ringBaseRadii[ringIndex] + (h2 - 0.5) * 85;

    return {
      paper,
      cx: Math.cos(angle) * radius * 1.16, // Slightly wider horizontally for the card aspect
      cy: Math.sin(angle) * radius * 0.94,
      tag: extractPrimaryMethodTag(paper) || 'GENERAL',
      pinned: false,
    };
  });

  resolveOverlaps(working);

  // Convert centers back to React Flow top-left node coordinates
  const centerById = new Map<string, Point2D>();
  for (const w of working) {
    centerById.set(w.paper.id, { x: w.cx, y: w.cy });
    paperPositions.set(w.paper.id, {
      x: Math.round(w.cx - PAPER_NODE_WIDTH / 2),
      y: Math.round(w.cy - PAPER_NODE_HEIGHT / 2),
    });
    connectedNeighbors.set(w.paper.id, new Set<string>());
  }

  // Build sparse, clean edges: connect each card at most to its 1 closest relevant method peer
  // without creating dense mesh clutter.
  const addedPairKeys = new Set<string>();
  for (const a of papers) {
    const cA = centerById.get(a.id);
    if (!cA) continue;

    let bestCandidate: {
      paper: Paper;
      label: string;
      dist: number;
    } | null = null;

    for (const b of papers) {
      if (a.id === b.id) continue;
      const label = findSharedMethodologyLabel(a, b);
      if (!label) continue;

      const cB = centerById.get(b.id);
      if (!cB) continue;

      const dist = Math.hypot(cB.x - cA.x, cB.y - cA.y);
      if (!bestCandidate || dist < bestCandidate.dist) {
        bestCandidate = { paper: b, label, dist };
      }
    }

    if (bestCandidate) {
      const [id1, id2] =
        a.id < bestCandidate.paper.id
          ? [a.id, bestCandidate.paper.id]
          : [bestCandidate.paper.id, a.id];
      const pairKey = `${id1}::${id2}`;

      if (!addedPairKeys.has(pairKey)) {
        addedPairKeys.add(pairKey);
        neighborEdges.push({
          id: `edge-method-${id1}-${id2}`,
          sourcePaperId: id1,
          targetPaperId: id2,
          sharedLabel: bestCandidate.label,
        });
        connectedNeighbors.get(id1)?.add(id2);
        connectedNeighbors.get(id2)?.add(id1);
      }
    }
  }

  return {
    queryPosition,
    paperPositions,
    neighborEdges,
    connectedNeighbors,
  };
}

/**
 * Computes a bounding rectangle centered strictly at (0, 0) covering the hub
 * and every thesis card so React Flow fitBounds centers "All Theses" exactly.
 */
export function computeSymmetricBounds(
  layout: RadialLayoutResult,
  papers: Paper[]
): { x: number; y: number; width: number; height: number } {
  let halfW = QUERY_NODE_WIDTH / 2 + 40;
  let halfH = QUERY_NODE_HEIGHT / 2 + 40;

  for (const p of papers) {
    const pos = layout.paperPositions.get(p.id);
    if (!pos) continue;
    halfW = Math.max(halfW, Math.abs(pos.x), Math.abs(pos.x + PAPER_NODE_WIDTH));
    halfH = Math.max(halfH, Math.abs(pos.y), Math.abs(pos.y + PAPER_NODE_HEIGHT));
  }

  return {
    x: -halfW,
    y: -halfH,
    width: halfW * 2,
    height: halfH * 2,
  };
}

