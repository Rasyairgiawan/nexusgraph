'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, Maximize2, Minus, Plus, X } from 'lucide-react';
import {
  getActiveClaimsForThesis,
  getThesisGapSummary,
  type GapClaim,
} from '@/lib/claims';
import {
  computeRadialGraphLayout,
  computeSymmetricBounds,
  PAPER_NODE_HEIGHT,
  PAPER_NODE_WIDTH,
  pickRadialHandles,
  QUERY_NODE_HEIGHT,
  QUERY_NODE_WIDTH,
  type Point2D,
  type RadialLayoutResult,
} from '@/lib/graphLayout';
import { useLanguage } from '@/lib/i18n';
import type { Paper } from '@/types';
import { Legend } from './Legend';
import { QueryNode } from './nodes/QueryNode';
import { PaperNode } from './nodes/PaperNode';
import { CurvedEdge } from './edges/CurvedEdge';

interface GraphCanvasProps {
  query: string;
  papers: Paper[];
  allPapers: Paper[];
  claims: GapClaim[];
  claimsNow: number;
  selectedPaperId: string | null;
  onSelectPaper: (paperId: string | null) => void;
  isLoading: boolean;
}

const nodeTypes = {
  queryNode: QueryNode,
  paperNode: PaperNode,
};

const edgeTypes = {
  curvedEdge: CurvedEdge,
};

function getPapersSignature(papers: Paper[], query: string): string {
  const sortedKey = papers
    .map((p) => `${p.id}:${p.similarity.toFixed(1)}`)
    .sort()
    .join('|');
  return `${query.trim().toLowerCase()}::${sortedKey}`;
}

function InnerGraph({
  query,
  papers,
  claims,
  claimsNow,
  selectedPaperId,
  onSelectPaper,
  isLoading,
}: GraphCanvasProps) {
  const { fitBounds, zoomIn, zoomOut } = useReactFlow();
  const { t } = useLanguage();

  const [hoveredPaperId, setHoveredPaperId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [showHubSummary, setShowHubSummary] = useState(false);

  const papersSig = useMemo(() => getPapersSignature(papers, query), [papers, query]);

  // Recompute the complete radial layout whenever the visible papers or query changes.
  const [layoutState, setLayoutState] = useState<{
    sig: string;
    result: RadialLayoutResult;
  }>(() => ({
    sig: papersSig,
    result: computeRadialGraphLayout(papers),
  }));

  if (layoutState.sig !== papersSig) {
    setLayoutState({
      sig: papersSig,
      result: computeRadialGraphLayout(papers),
    });
  }

  const layout = layoutState.result;

  const lastFittedSigRef = useRef<string>('');
  useEffect(() => {
    if (papers.length === 0) return;
    if (lastFittedSigRef.current === papersSig) return;
    lastFittedSigRef.current = papersSig;
    const timer = setTimeout(() => {
      const bounds = computeSymmetricBounds(layout, papers);
      fitBounds(bounds, { padding: 0.1, duration: 240 });
    }, 60);
    return () => clearTimeout(timer);
  }, [papers, papersSig, layout, fitBounds]);

  const effectiveSelectedId =
    selectedPaperId && papers.some((p) => p.id === selectedPaperId)
      ? selectedPaperId
      : null;

  const connectedToSelected = useMemo(
    () =>
      effectiveSelectedId
        ? layout.connectedNeighbors.get(effectiveSelectedId) ?? new Set<string>()
        : new Set<string>(),
    [effectiveSelectedId, layout.connectedNeighbors]
  );

  const { nodes, edges } = useMemo(() => {
    if (papers.length === 0) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const hasActiveQuery = Boolean(query.trim());
    const builtNodes: Node[] = [];
    const builtEdges: Edge[] = [];

    const queryCenter: Point2D = {
      x: layout.queryPosition.x + QUERY_NODE_WIDTH / 2,
      y: layout.queryPosition.y + QUERY_NODE_HEIGHT / 2,
    };

    builtNodes.push({
      id: 'query-root',
      type: 'queryNode',
      position: layout.queryPosition,
      data: { query, resultCount: papers.length },
    });

    for (const paper of papers) {
      const pos = layout.paperPositions.get(paper.id) ?? { x: 260, y: 0 };
      const paperCenter: Point2D = {
        x: pos.x + PAPER_NODE_WIDTH / 2,
        y: pos.y + PAPER_NODE_HEIGHT / 2,
      };

      const isSelected = paper.id === effectiveSelectedId;
      const isNeighbor = connectedToSelected.has(paper.id);
      const isDimmed = Boolean(effectiveSelectedId && !isSelected && !isNeighbor);
      const activeClaims = getActiveClaimsForThesis(claims, paper.id, claimsNow);

      builtNodes.push({
        id: `paper-${paper.id}`,
        type: 'paperNode',
        position: pos,
        data: {
          paper,
          gapSummary: getThesisGapSummary(activeClaims, claimsNow),
          isSelected,
          isDimmed,
        },
      });

      const radialEdgeId = `edge-query-${paper.id}`;
      const isRadialActive =
        paper.id === effectiveSelectedId ||
        paper.id === hoveredPaperId ||
        hoveredEdgeId === radialEdgeId;
      const { sourceHandle, targetHandle } = pickRadialHandles(queryCenter, paperCenter);
      const isStrong = paper.similarity >= 70;

      builtEdges.push({
        id: radialEdgeId,
        source: 'query-root',
        target: `paper-${paper.id}`,
        sourceHandle,
        targetHandle,
        type: 'curvedEdge',
        data: {
          label: hasActiveQuery ? `${Math.round(paper.similarity)}% match` : undefined,
          showLabel: false,
          kind: 'query',
          strength: isStrong ? 'strong' : 'weak',
          isHighlighted: isRadialActive,
          isHovered: hoveredEdgeId === radialEdgeId || hoveredPaperId === paper.id,
          isDimmed: Boolean(effectiveSelectedId && !isSelected),
        },
      });
    }

    for (const edgeSpec of layout.neighborEdges) {
      const posA = layout.paperPositions.get(edgeSpec.sourcePaperId);
      const posB = layout.paperPositions.get(edgeSpec.targetPaperId);
      if (!posA || !posB) continue;

      const centerA: Point2D = {
        x: posA.x + PAPER_NODE_WIDTH / 2,
        y: posA.y + PAPER_NODE_HEIGHT / 2,
      };
      const centerB: Point2D = {
        x: posB.x + PAPER_NODE_WIDTH / 2,
        y: posB.y + PAPER_NODE_HEIGHT / 2,
      };
      const { sourceHandle, targetHandle } = pickRadialHandles(centerA, centerB);

      const touchesSelected =
        effectiveSelectedId === edgeSpec.sourcePaperId ||
        effectiveSelectedId === edgeSpec.targetPaperId;
      const touchesHover =
        hoveredPaperId === edgeSpec.sourcePaperId ||
        hoveredPaperId === edgeSpec.targetPaperId ||
        hoveredEdgeId === edgeSpec.id;

      builtEdges.push({
        id: edgeSpec.id,
        source: `paper-${edgeSpec.sourcePaperId}`,
        target: `paper-${edgeSpec.targetPaperId}`,
        sourceHandle,
        targetHandle,
        type: 'curvedEdge',
        data: {
          label: edgeSpec.sharedLabel,
          showLabel: false,
          kind: 'method',
          strength: touchesSelected || touchesHover ? 'strong' : 'weak',
          isHighlighted: touchesSelected,
          isHovered: touchesHover,
          isDimmed: Boolean(effectiveSelectedId && !touchesSelected),
        },
      });
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [
    papers,
    query,
    layout,
    claims,
    claimsNow,
    effectiveSelectedId,
    connectedToSelected,
    hoveredPaperId,
    hoveredEdgeId,
  ]);

  const hubSummaryStats = useMemo(() => {
    const total = papers.length;
    const verified = papers.filter((p) => p.verified).length;
    const availableGaps = papers.filter(
      (p) => getActiveClaimsForThesis(claims, p.id, claimsNow).length === 0
    ).length;
    return { total, verified, availableGaps };
  }, [papers, claims, claimsNow]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === 'query-root') {
      onSelectPaper(null);
      setShowHubSummary((prev) => !prev);
      return;
    }
    if (node.id.startsWith('paper-')) {
      setShowHubSummary(false);
      const paperId = node.id.replace('paper-', '');
      onSelectPaper(effectiveSelectedId === paperId ? null : paperId);
    }
  };

  return (
    <div className="relative h-full w-full flex-1 overflow-hidden bg-transparent">
      {papers.length === 0 && !isLoading ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-[#DCE4F0] bg-white px-6 py-5 shadow-xs max-w-md">
            <h2 className="text-[15px] font-bold text-[#0F172A]">
              {t('noMatchingTheses')}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B6B82]">
              {t('adjustSearch')}{' '}
              <strong className="text-[#0F172A]">+ {t('addThesis')}</strong>{' '}
              {t('graphUploadDescription')}
            </p>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={(_, node) => {
            if (node.id.startsWith('paper-')) {
              setHoveredPaperId(node.id.replace('paper-', ''));
            }
          }}
          onNodeMouseLeave={(_, node) => {
            if (node.id.startsWith('paper-')) {
              setHoveredPaperId((prev) =>
                prev === node.id.replace('paper-', '') ? null : prev
              );
            }
          }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={(_, edge) =>
            setHoveredEdgeId((prev) => (prev === edge.id ? null : prev))
          }
          onPaneClick={() => {
            onSelectPaper(null);
            setShowHubSummary(false);
          }}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          minZoom={0.25}
          maxZoom={1.7}
          style={{ backgroundColor: 'transparent' }}
          className="light"
        >
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              if (n.type === 'queryNode') return '#1E2A5A';
              if (n.type === 'paperNode') return '#1E2A5A';
              return '#CBD5E1';
            }}
            className="hidden sm:block"
          />

          <Panel position="top-left" className="!m-3 hidden sm:block">
            <Legend />
          </Panel>

          {showHubSummary && (
            <Panel position="top-center" className="!m-3">
              <div className="inline-flex items-center gap-3 rounded-xl border border-[#DCE4F0] bg-white/95 px-4 py-2 text-[12px] shadow-[0_4px_14px_rgba(15,23,42,0.08)] backdrop-blur-xs">
                <span className="font-bold text-[#1E2A5A]">
                  {hubSummaryStats.total} {t('mappedTheses')}
                </span>
                <span className="text-[#CBD5E1]">|</span>
                <span className="font-medium text-[#15803D]">
                  {hubSummaryStats.verified} {t('verified')}
                </span>
                <span className="text-[#CBD5E1]">|</span>
                <span className="font-medium text-[#1E2A5A]">
                  {hubSummaryStats.availableGaps} {t('availableGaps')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowHubSummary(false)}
                  aria-label={t('closeCorpusSummary')}
                  className="ml-1 rounded p-0.5 text-[#8A97AB] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Panel>
          )}

          <Panel position="bottom-left" className="!m-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#DCE4F0] bg-white p-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
              <button
                type="button"
                onClick={() => zoomIn({ duration: 150 })}
                title={t('zoomIn')}
                aria-label={t('zoomIn')}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomOut({ duration: 150 })}
                title={t('zoomOut')}
                aria-label={t('zoomOut')}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  fitBounds(computeSymmetricBounds(layout, papers), {
                    padding: 0.1,
                    duration: 220,
                  })
                }
                title={t('fitView')}
                aria-label={t('fitGraphToView')}
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t('fitView')}</span>
              </button>
            </div>
          </Panel>
        </ReactFlow>
      )}

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2.5 text-[12.5px] font-medium text-[#0F172A] shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-[#1E2A5A]" />
            <span>{t('loadingGraph')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerGraph {...props} />
    </ReactFlowProvider>
  );
}
