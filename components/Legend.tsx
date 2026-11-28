'use client';

import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Database,
  Lightbulb,
  Settings,
} from 'lucide-react';
import { useLanguage, type TranslationKey } from '@/lib/i18n';

const LEGEND_CATEGORIES: Array<{
  key: TranslationKey;
  Icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}> = [
  { key: 'legProblem', Icon: BookOpen, colorClass: 'text-[#1E2A5A]' },
  { key: 'legMethod', Icon: Settings, colorClass: 'text-[#7C3AED]' },
  { key: 'legDataset', Icon: Database, colorClass: 'text-[#0D9488]' },
  { key: 'legFindings', Icon: Lightbulb, colorClass: 'text-[#EA580C]' },
  { key: 'legGap', Icon: ArrowRight, colorClass: 'text-[#4F46E5]' },
] as const;

export function Legend() {
  const { t } = useLanguage();

  return (
    <div className="w-[186px] rounded-[11px] border border-[#DCE4F0] bg-white/95 p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur-[2px]">
      <div className="text-[11.5px] font-semibold text-[#0F172A]">{t('entityLegend')}</div>

      <ul className="mt-2 space-y-1.5">
        {LEGEND_CATEGORIES.map(({ key, Icon, colorClass }) => (
          <li key={key} className="flex items-center gap-2 text-[11px] text-[#5B6B82]">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>

      <div className="my-2.5 border-t border-[#DCE4F0]" />

      <div className="text-[11px] font-semibold text-[#0F172A]">{t('similarity')}</div>
      <ul className="mt-1.5 space-y-1 text-[11px] text-[#5B6B82]">
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#16A34A] shrink-0" />
          <span>{t('simHigh')}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#EA7A1A] shrink-0" />
          <span>{t('simMod')}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#64748B] shrink-0" />
          <span>{t('simLow')}</span>
        </li>
      </ul>

      <div className="my-2.5 border-t border-[#DCE4F0]" />

      <div className="text-[11px] font-semibold text-[#0F172A]">{t('linksStatus')}</div>
      <ul className="mt-1.5 space-y-1 text-[11px] text-[#5B6B82]">
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#1E2A5A] shrink-0" />
          <span>{t('strongMatch')}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0 w-4 border-t border-dashed border-[#94A3B8] shrink-0" />
          <span>{t('sharedMethod')}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-[#4338CA] bg-[#EEF2FF] shrink-0" />
          <span>{t('personalUnverified')}</span>
        </li>
      </ul>
    </div>
  );
}
