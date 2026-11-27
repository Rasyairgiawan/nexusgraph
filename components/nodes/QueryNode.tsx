'use client';

import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { QueryNodeData } from '@/types';

export type QueryFlowNode = Node<QueryNodeData, 'queryNode'>;

export const QueryNode = memo(function QueryNode({ data }: NodeProps<QueryFlowNode>) {
  const displayQuery = data.query.trim()
    ? `“${data.query.trim()}”`
    : 'All Theses';

  return (
    <div className="flex w-[200px] flex-col items-center">
      <span className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-[#1E2A5A] uppercase">
        {data.query.trim() ? 'SEMANTIC QUERY' : 'ACTIVE CORPUS'}
      </span>
      <div className="relative w-full rounded-full bg-[#1E2A5A] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(30,42,90,0.22)] text-center cursor-pointer hover:bg-[#172148] transition-colors">
        <div className="truncate">{displayQuery}</div>
        <div className="mt-0.5 text-[10px] font-normal text-[#BFDBFE]">
          {data.resultCount} mapped {data.resultCount === 1 ? 'thesis' : 'theses'}
        </div>

        {/* 4-way radial source handles */}
        <Handle id="s-top" type="source" position={Position.Top} isConnectable={false} />
        <Handle id="s-right" type="source" position={Position.Right} isConnectable={false} />
        <Handle id="s-bottom" type="source" position={Position.Bottom} isConnectable={false} />
        <Handle id="s-left" type="source" position={Position.Left} isConnectable={false} />
      </div>
    </div>
  );
});
