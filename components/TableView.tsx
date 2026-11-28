'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitFork,
} from 'lucide-react';
import {
  getActiveClaimsForThesis,
  getThesisGapSummary,
  type GapClaim,
} from '@/lib/claims';
import {
  getSimilarityMeta,
  getSourceBadgeMeta,
  type Paper,
  type SortDirection,
  type TableSortField,
} from '@/types';
import { useLanguage } from '@/lib/i18n';

interface TableViewProps {
  papers: Paper[];
  claims: GapClaim[];
  claimsNow: number;
  totalCorpusCount: number;
  selectedPaperId: string | null;
  onSelectPaper: (paperId: string) => void;
  onOpenInGraph: (paperId: string) => void;
  onResetFilters: () => void;
}

const PAGE_SIZE = 10;

function SortIcon({
  field,
  activeField,
  direction,
}: {
  field: TableSortField;
  activeField: TableSortField;
  direction: SortDirection;
}) {
  if (field !== activeField) {
    return <ArrowUpDown className="h-3 w-3 text-[#8A97AB]" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#1E2A5A]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#1E2A5A]" />
  );
}

export function TableView({
  papers,
  claims,
  claimsNow,
  totalCorpusCount,
  selectedPaperId,
  onSelectPaper,
  onOpenInGraph,
  onResetFilters,
}: TableViewProps) {
  const { t, translateStatus } = useLanguage();
  const [sortField, setSortField] = useState<TableSortField>('similarity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const now = claimsNow;

  const handleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const sortedPapers = useMemo(() => {
    const copy = [...papers];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title, 'en');
      } else if (sortField === 'year') {
        cmp = a.year - b.year;
      } else if (sortField === 'similarity') {
        cmp = a.similarity - b.similarity;
      } else if (sortField === 'status') {
        const rank = (p: Paper) => {
          const hasClaims = getActiveClaimsForThesis(claims, p.id, claimsNow).length > 0;
          return p.verified ? 3 : hasClaims ? 2 : 1;
        };
        cmp = rank(a) - rank(b);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [papers, claims, claimsNow, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedPapers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedPapers = sortedPapers.slice(startIdx, startIdx + PAGE_SIZE);

  const stats = useMemo(() => {
    const count = papers.length;
    const verifiedCount = papers.filter((p) => p.verified).length;
    const availableGapsCount = papers.filter(
      (p) => getActiveClaimsForThesis(claims, p.id, claimsNow).length === 0
    ).length;
    const claimedGapsCount = count - availableGapsCount;
    return { count, verifiedCount, availableGapsCount, claimedGapsCount };
  }, [papers, claims, claimsNow]);

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 lg:p-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DCE4F0] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
          <div className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
            {t('totalTheses')}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none text-[#0F172A] tabular-nums">
              {stats.count}
            </span>
            <span className="text-[12px] text-[#5B6B82]">
              {t('of')} {totalCorpusCount} {t('inSupabase')}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4F0] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
          <div className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
            {t('verified')}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none text-[#15803D] tabular-nums">
              {stats.verifiedCount}
            </span>
            <span className="text-[12px] text-[#5B6B82]">{t('peerVerified')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4F0] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
          <div className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
            {t('availableGaps')}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none text-[#1E2A5A] tabular-nums">
              {stats.availableGapsCount}
            </span>
            <span className="text-[12px] text-[#5B6B82]">{t('readyToClaim')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4F0] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
          <div className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
            {t('claimedGaps')}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none text-[#B45309] tabular-nums">
              {stats.claimedGapsCount}
            </span>
            <span className="text-[12px] text-[#5B6B82]">{t('activeFollowUps')}</span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#DCE4F0] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE4F0] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-[#0F172A]">{t('matrixTitle')}</span>
            <span className="text-[#8A97AB]">•</span>
            <span className="text-[12px] text-[#5B6B82]">
              {t('matrixSub')}
            </span>
          </div>
        </div>

        {papers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] text-[#5B6B82]">
              {t('noThesesMatch')}
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 rounded-lg border border-[#DCE4F0] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#1E2A5A] hover:bg-[#EAF1FE] cursor-pointer"
            >
              {t('clearFilters')}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#DCE4F0] bg-[#F8FAFC] text-[10.5px] font-semibold tracking-wider text-[#5B6B82] uppercase">
                    <th className="py-3 pl-4 pr-3">
                      <button
                        type="button"
                        onClick={() => handleSort('title')}
                        className="inline-flex items-center gap-1 hover:text-[#0F172A] cursor-pointer"
                      >
                        <span>{t('colTitleAuthor')}</span>
                        <SortIcon
                          field="title"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('year')}
                        className="inline-flex items-center gap-1 hover:text-[#0F172A] cursor-pointer"
                      >
                        <span>{t('colYear')}</span>
                        <SortIcon
                          field="year"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('similarity')}
                        className="inline-flex items-center gap-1 hover:text-[#0F172A] cursor-pointer"
                      >
                        <span>{t('colSimilarity')}</span>
                        <SortIcon
                          field="similarity"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="px-3 py-3">{t('colProblem')}</th>
                    <th className="px-3 py-3">{t('colMethod')}</th>
                    <th className="px-3 py-3">{t('colDataset')}</th>
                    <th className="px-3 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-[#0F172A] cursor-pointer"
                      >
                        <span>{t('colStatus')}</span>
                        <SortIcon
                          field="status"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </th>
                    <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                      {t('colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4F0]">
                  {paginatedPapers.map((paper) => {
                    const isSelected = paper.id === selectedPaperId;
                    const simMeta = getSimilarityMeta(paper.similarity);
                    const sourceBadge = getSourceBadgeMeta(paper.sourceType);
                    const activePaperClaims = getActiveClaimsForThesis(
                      claims,
                      paper.id,
                      now
                    );
                    const gapSummary = getThesisGapSummary(activePaperClaims, now);
                    const gapBadgeClass = gapSummary.startsWith('In Progress')
                      ? 'border-[#F5D77A] bg-[#FEF3C7] text-[#B45309]'
                      : gapSummary.startsWith('Exploring')
                        ? 'border-[#BFDBFE] bg-[#EAF1FE] text-[#1D4ED8]'
                        : 'border-[#BCE6CA] bg-[#E6F6EC] text-[#15803D]';

                    return (
                      <tr
                        key={paper.id}
                        onClick={() => onSelectPaper(paper.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EAF1FE]/75'
                            : 'bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="py-3 pl-4 pr-3 align-top max-w-[260px]">
                          <div className="text-[12.5px] font-bold leading-snug text-[#0F172A] line-clamp-2">
                            {paper.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#5B6B82]">
                            <span>{paper.author}</span>
                            <span
                              className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[9.5px] font-medium ${sourceBadge.className}`}
                            >
                              {translateStatus(sourceBadge.label)}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top text-[12px] font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                          {paper.year}
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${simMeta.badgeClass}`}
                          >
                            {paper.similarity.toFixed(1)}%
                          </span>
                        </td>

                        <td className="px-3 py-3 align-top text-[11.5px] leading-relaxed text-[#5B6B82] max-w-[190px]">
                          <div className="line-clamp-2">{paper.problem}</div>
                        </td>

                        <td className="px-3 py-3 align-top text-[11.5px] leading-relaxed text-[#5B6B82] max-w-[175px]">
                          <div className="line-clamp-2">{paper.method}</div>
                        </td>

                        <td className="px-3 py-3 align-top text-[11.5px] leading-relaxed text-[#5B6B82] max-w-[155px]">
                          <div className="line-clamp-2">{paper.dataset}</div>
                        </td>

                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            {paper.verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#BCE6CA] bg-[#E6F6EC] px-2 py-0.5 text-[10.5px] font-medium text-[#15803D]">
                                <Check className="h-3 w-3 stroke-[2.5]" />
                                {t('verified')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-[#DCE4F0] bg-[#EEF2F7] px-2 py-0.5 text-[10.5px] font-medium text-[#475569]">
                                {t('unverified')}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${gapBadgeClass}`}
                            >
                              {translateStatus(gapSummary)}
                            </span>
                          </div>
                        </td>

                        <td
                          className="py-3 pl-3 pr-4 align-top text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectPaper(paper.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DCE4F0] bg-white px-2.5 text-[11px] font-medium text-[#0F172A] hover:border-[#1E2A5A] hover:text-[#1E2A5A] cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{t('inspect')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenInGraph(paper.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#EAF1FE] px-2.5 text-[11px] font-semibold text-[#1E2A5A] hover:bg-[#DBEAFE] cursor-pointer"
                            >
                              <GitFork className="h-3 w-3" />
                              <span>{t('openInGraph')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE4F0] bg-white px-4 py-3 text-[12px]">
              <span className="text-[#5B6B82]">
                {t('showing')}{' '}
                <strong className="font-semibold text-[#0F172A]">
                  {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, sortedPapers.length)}
                </strong>{' '}
                {t('of')}{' '}
                <strong className="font-semibold text-[#0F172A]">
                  {sortedPapers.length}
                </strong>{' '}
                {t('theses')}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE4F0] bg-white px-3 text-[12px] font-medium text-[#0F172A] hover:bg-[#F4F7FB] disabled:opacity-45 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>{t('previous')}</span>
                </button>
                <span className="text-[11.5px] font-medium text-[#5B6B82]">
                  {t('page')} {safePage} {t('of')} {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DCE4F0] bg-white px-3 text-[12px] font-medium text-[#0F172A] hover:bg-[#F4F7FB] disabled:opacity-45 cursor-pointer"
                >
                  <span>{t('next')}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
