'use client';

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { CurvedEdgeData } from '@/types';

export type CurvedFlowEdge = Edge<CurvedEdgeData, 'curvedEdge'>;

export function CurvedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<CurvedFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.32,
  });

  const isHighlighted = Boolean(data?.isHighlighted);
  const isHovered = Boolean(data?.isHovered);
  const isDimmed = Boolean(data?.isDimmed);
  const isStrong = data?.strength === 'strong';
  const kind = data?.kind || 'entity';
  const showLabel = Boolean(data?.label && (data?.showLabel || isHighlighted || isHovered));
  const gradId = `ng-edge-grad-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  let stroke = '#1E2A5A';
  let strokeWidth = 1.3;
  let strokeDasharray: string | undefined;
  let opacity = 0.14;

  if (kind === 'method') {
    stroke = isHighlighted || isHovered ? `url(#${gradId})` : '#1E2A5A';
    strokeWidth = isHighlighted || isHovered ? 2.4 : 1.35;
    strokeDasharray = '5 4';
    opacity = isHighlighted || isHovered ? 1 : isDimmed ? 0.06 : 0.15;
  } else if (kind === 'similarity' || kind === 'query') {
    if (isHighlighted || isHovered) {
      stroke = `url(#${gradId})`;
      strokeWidth = 2.6;
      opacity = 1;
    } else if (isStrong) {
      stroke = '#1E2A5A';
      strokeWidth = 1.6;
      opacity = isDimmed ? 0.07 : 0.22;
    } else {
      stroke = '#1E2A5A';
      strokeWidth = 1.25;
      opacity = isDimmed ? 0.05 : 0.14;
    }
  } else if (isHighlighted || isHovered) {
    stroke = `url(#${gradId})`;
    strokeWidth = 2.4;
    opacity = 1;
  }

  return (
    <>
      {(isHighlighted || isHovered) && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bde3fb" />
            <stop offset="100%" stopColor="#92bcfa" />
          </linearGradient>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
          opacity,
          transition: 'stroke 150ms ease, stroke-width 150ms ease, opacity 150ms ease',
        }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-2xs ${
              kind === 'method'
                ? 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]'
                : isStrong
                  ? 'border-[#BFDBFE] bg-[#EAF1FE] text-[#1D4ED8]'
                  : 'border-[#DCE4F0] bg-white/95 text-[#64748B]'
            }`}
          >
            {data?.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
