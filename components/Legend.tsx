'use client';

import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Database,
  Lightbulb,
  Settings,
} from 'lucide-react';

const LEGEND_CATEGORIES = [
  { label: 'Research Problem', Icon: BookOpen, colorClass: 'text-[#1E2A5A]' },
  { label: 'Methodology', Icon: Settings, colorClass: 'text-[#7C3AED]' },
  { label: 'Dataset / Object', Icon: Database, colorClass: 'text-[#0D9488]' },
  { label: 'Key Findings', Icon: Lightbulb, colorClass: 'text-[#EA580C]' },
  { label: 'Research Gap', Icon: ArrowRight, colorClass: 'text-[#4F46E5]' },
] as const;

export function Legend() {
  return (
    <div className="w-[186px] rounded-[11px] border border-[#DCE4F0] bg-white/95 p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur-[2px]">
      <div className="text-[11.5px] font-semibold text-[#0F172A]">Entity Legend</div>

      <ul className="mt-2 space-y-1.5">
        {LEGEND_CATEGORIES.map(({ label, Icon, colorClass }) => (
          <li key={label} className="flex items-center gap-2 text-[11px] text-[#5B6B82]">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="my-2.5 border-t border-[#DCE4F0]" />

      <div className="text-[11px] font-semibold text-[#0F172A]">Similarity</div>
      <ul className="mt-1.5 space-y-1 text-[11px] text-[#5B6B82]">
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#16A34A] shrink-0" />
          <span>High (&ge;70%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#EA7A1A] shrink-0" />
          <span>Moderate (55–69%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#64748B] shrink-0" />
          <span>Low (&lt;55%)</span>
        </li>
      </ul>

      <div className="my-2.5 border-t border-[#DCE4F0]" />

      <div className="text-[11px] font-semibold text-[#0F172A]">Links &amp; Status</div>
      <ul className="mt-1.5 space-y-1 text-[11px] text-[#5B6B82]">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#1E2A5A] shrink-0" />
          <span>Strong Match (&ge;70%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0 w-4 border-t border-dashed border-[#94A3B8] shrink-0" />
          <span>Shared Method / Weak</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-[#4338CA] bg-[#EEF2FF] shrink-0" />
          <span>Personal Unverified</span>
        </li>
      </ul>
    </div>
  );
}
