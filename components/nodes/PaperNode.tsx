'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Check, Sparkles } from 'lucide-react';
import {
  getSimilarityMeta,
  getSourceBadgeMeta,
  type PaperNodeData,
} from '@/types';

export type PaperFlowNode = Node<PaperNodeData, 'paperNode'>;

export const PaperNode = memo(function PaperNode({ data }: NodeProps<PaperFlowNode>) {
  const { paper, gapSummary, isSelected, isDimmed } = data;
  const simMeta = getSimilarityMeta(paper.similarity);
  const sourceBadge = getSourceBadgeMeta(paper.sourceType);
  const isPersonalUnverified = paper.sourceType === 'personal' && !paper.verified;
  const summaryLabel = gapSummary || 'Available';
  const summaryClass = summaryLabel.startsWith('In Progress')
    ? 'border-[#F5D77A] bg-[#FEF3C7] text-[#B45309]'
    : summaryLabel.startsWith('Exploring')
      ? 'border-[#BFDBFE] bg-[#EAF1FE] text-[#1D4ED8]'
      : 'border-[#DCE4F0] bg-[#F8FAFC] text-[#475569]';

  return (
    <div
      style={
        isSelected
          ? {
              background: 'linear-gradient(135deg, #9db2dc 0%, #0e2d6c 100%)',
              padding: '2px',
            }
          : undefined
      }
      className={`relative w-[210px] rounded-[11px] text-left transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'shadow-[0_6px_18px_rgba(14,45,108,0.22)]'
          : isPersonalUnverified
            ? 'border border-dashed border-[#6366F1] bg-[#FAFAFF] p-3 shadow-[0_1px_4px_rgba(99,102,241,0.08)] hover:border-[#4F46E5]'
            : 'border border-[#DCE4F0] bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)] hover:border-[#1E2A5A]/45'
      } ${isDimmed ? 'opacity-45 hover:opacity-85' : 'opacity-100'}`}
    >
      <div className={isSelected ? 'rounded-[9px] bg-white p-[10px]' : ''}>
      {/* 4-way target & source handles for radial edges */}
      <Handle id="t-top" type="target" position={Position.Top} isConnectable={false} />
      <Handle id="t-right" type="target" position={Position.Right} isConnectable={false} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} isConnectable={false} />
      <Handle id="t-left" type="target" position={Position.Left} isConnectable={false} />

      <Handle id="s-top" type="source" position={Position.Top} isConnectable={false} />
      <Handle id="s-right" type="source" position={Position.Right} isConnectable={false} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} isConnectable={false} />
      <Handle id="s-left" type="source" position={Position.Left} isConnectable={false} />

      {/* Top metadata: Year · Author & Similarity */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-medium text-[#5B6B82]">
          {paper.year} · {paper.author}
        </span>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${simMeta.badgeClass}`}
        >
          {paper.similarity.toFixed(0)}%
        </span>
      </div>

      {/* Short Title */}
      <h3 className="mt-1.5 text-[12px] font-bold leading-[1.35] text-[#0F172A] line-clamp-2">
        {paper.title}
      </h3>

      {/* Provenance & Verification & Gap Status Badges */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {paper.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#BCE6CA] bg-[#E6F6EC] px-2 py-0.5 text-[10px] font-medium text-[#15803D]">
            <Check className="h-3 w-3 stroke-[2.5]" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-[#DCE4F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#64748B]">
            Unverified
          </span>
        )}

        <span
          className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium ${summaryClass}`}
        >
          {summaryLabel}
        </span>

        {(paper.sourceType === 'personal' ||
          paper.sourceType === 'open_access' ||
          paper.sourceType === 'journal') && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sourceBadge.className}`}
          >
            {paper.sourceType === 'open_access' && <Sparkles className="h-2.5 w-2.5" />}
            {sourceBadge.label}
          </span>
        )}
      </div>
      </div>
    </div>
  );
});
