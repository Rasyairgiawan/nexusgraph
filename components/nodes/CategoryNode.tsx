'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  ArrowRight,
  BookOpen,
  Database,
  Lightbulb,
  Settings,
} from 'lucide-react';
import { CATEGORY_META, type CategoryNodeData, type CategoryType } from '@/types';

export type CategoryFlowNode = Node<CategoryNodeData, 'categoryNode'>;

const CATEGORY_ICONS: Record<
  CategoryType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  problem: BookOpen,
  method: Settings,
  dataset: Database,
  key_findings: Lightbulb,
  future_work: ArrowRight,
};

export const CategoryNode = memo(function CategoryNode({
  data,
}: NodeProps<CategoryFlowNode>) {
  const meta = CATEGORY_META[data.category];
  const Icon = CATEGORY_ICONS[data.category];

  return (
    <div
      className={`relative w-[190px] rounded-[11px] border bg-white px-3 py-2.5 text-left transition-all duration-150 cursor-pointer ${
        data.category === 'future_work'
          ? 'border-[#C7D2FE] bg-[#FAFBFF]'
          : 'border-[#DCE4F0]'
      } ${
        data.isSelected
          ? 'shadow-[0_2px_10px_rgba(15,23,42,0.06)]'
          : 'shadow-[0_1px_3px_rgba(15,23,42,0.04)]'
      } ${meta.borderHoverClass} ${data.isDimmed ? 'opacity-45 hover:opacity-85' : 'opacity-100'}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />

      <div className="flex items-center justify-between gap-1.5">
        <div
          className={`flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase ${meta.textClass}`}
        >
          <Icon className="h-3 w-3 shrink-0" style={{ color: meta.colorHex }} />
          <span>{meta.shortLabel}</span>
        </div>
        {data.sharedCount > 1 && (
          <span className="shrink-0 text-[10px] font-medium text-[#5B6B82]">
            · {data.sharedCount} theses
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-[1.4] text-[#5B6B82] line-clamp-2">
        {data.text}
      </p>

      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});
