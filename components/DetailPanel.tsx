'use client';

import React from 'react';
import {
  ArrowRight,
  BookmarkPlus,
  BookOpen,
  Check,
  Database,
  ExternalLink,
  Hand,
  Lightbulb,
  Pencil,
  Settings,
  X,
} from 'lucide-react';
import {
  getActiveClaimsForThesis,
  getDaysLeft,
  getThesisGapSummary,
  hasActiveClaimByUser,
  type GapClaim,
} from '@/lib/claims';
import {
  getSimilarityMeta,
  getSourceBadgeMeta,
  type Paper,
  type UserProfile,
} from '@/types';

interface DetailPanelProps {
  paper: Paper;
  claims: GapClaim[];
  claimsNow: number;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenEditModal: () => void;
  onOpenClaimDialog: () => void;
  onSaveToProject: () => void;
}

export function DetailPanel({
  paper,
  claims,
  claimsNow,
  currentUser,
  onClose,
  onOpenEditModal,
  onOpenClaimDialog,
  onSaveToProject,
}: DetailPanelProps) {
  const simMeta = getSimilarityMeta(paper.similarity);
  const sourceBadge = getSourceBadgeMeta(paper.sourceType);
  const now = claimsNow;
  const activeClaims = getActiveClaimsForThesis(claims, paper.id, now);
  const gapSummary = getThesisGapSummary(activeClaims, now);
  const userAlreadyClaimed = currentUser
    ? hasActiveClaimByUser(activeClaims, currentUser.id, paper.id, now)
    : false;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-30 bg-[#0F172A]/25 xl:hidden"
      />

      <aside
        aria-label="Thesis detail inspector"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[82vh] w-full flex-col rounded-t-2xl border-t border-[#DCE4F0] bg-white shadow-2xl xl:static xl:inset-auto xl:z-auto xl:h-full xl:max-h-none xl:w-[400px] xl:shrink-0 xl:rounded-none xl:border-t-0 xl:border-l xl:shadow-none"
      >
        {/* Mobile grab handle */}
        <div className="flex justify-center pt-2 xl:hidden">
          <span className="h-1 w-10 rounded-full bg-[#C5D0E0]" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          {/* Header Badges + Close */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-md border border-[#DCE4F0] bg-[#EEF2F7] px-2 py-0.5 font-mono text-[11px] font-medium text-[#475569]">
                {paper.year} · {paper.fileName}
              </span>

              {paper.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#BCE6CA] bg-[#E6F6EC] px-2 py-0.5 text-[10.5px] font-medium text-[#15803D]">
                  <Check className="h-3 w-3 stroke-[2.5]" />
                  Verified{paper.verifiedBy ? ` by ${paper.verifiedBy}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-[#DCE4F0] bg-[#F8FAFC] px-2 py-0.5 text-[10.5px] font-medium text-[#64748B]">
                  Unverified
                </span>
              )}

              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${sourceBadge.className}`}
              >
                {sourceBadge.label}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail drawer"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] transition-colors hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Title & Author */}
          <h2 className="mt-3 text-[16px] font-bold leading-snug text-[#0F172A]">
            {paper.title}
          </h2>
          <p className="mt-1 text-[12px] text-[#5B6B82]">
            Author: <span className="font-medium text-[#0F172A]">{paper.author}</span>
            {paper.university ? ` · ${paper.university}` : ''}
          </p>

          {/* Similarity + Derived Gap Summary */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${simMeta.badgeClass}`}
            >
              Similarity: {paper.similarity.toFixed(1)}% ({simMeta.label})
            </span>

            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                gapSummary.startsWith('In Progress')
                  ? 'border-[#F5D77A] bg-[#FEF3C7] text-[#B45309]'
                  : gapSummary.startsWith('Exploring')
                    ? 'border-[#BFDBFE] bg-[#EAF1FE] text-[#1D4ED8]'
                    : 'border-[#BCE6CA] bg-[#E6F6EC] text-[#15803D]'
              }`}
            >
              {gapSummary}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {paper.sourceUrl && (
              <a
                href={paper.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-[#F8FAFC] px-3 text-[12px] font-medium text-[#1E2A5A] transition-colors hover:border-[#1E2A5A] hover:bg-[#EAF1FE]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View Original Source</span>
              </a>
            )}
            <button
              type="button"
              onClick={onSaveToProject}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white px-3 text-[12px] font-medium text-[#0F172A] transition-colors hover:bg-[#F4F7FB] cursor-pointer"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-[#1E2A5A]" />
              <span>Save to Project</span>
            </button>
          </div>

          {/* 5 Entity Cards */}
          <div className="mt-4 space-y-2.5">
            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1E2A5A]">
                <BookOpen className="h-3.5 w-3.5" />
                <span>1. Research Problem</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {paper.problem}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">
                <Settings className="h-3.5 w-3.5" />
                <span>2. Methodology</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {paper.method}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0D9488]">
                <Database className="h-3.5 w-3.5" />
                <span>3. Dataset / Object</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {paper.dataset}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#EA580C]">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>4. Key Findings</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {paper.keyFindings || paper.limitation}
              </p>
            </div>

            {/* Highlighted Research Gap / Future Work + Active Soft-Lock Claims */}
            <div className="rounded-xl border-2 border-[#F5D77A] bg-[#FFF9E6] p-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#B45309]">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>5. Research Gap / Future Work</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    gapSummary.startsWith('In Progress')
                      ? 'bg-[#FEF3C7] text-[#B45309]'
                      : gapSummary.startsWith('Exploring')
                        ? 'bg-[#EAF1FE] text-[#1D4ED8]'
                        : 'bg-[#E6F6EC] text-[#15803D]'
                  }`}
                >
                  {gapSummary}
                </span>
              </div>

              <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#0F172A]">
                {paper.futureWork}
              </p>

              {/* Inline List of Active Claims */}
              {activeClaims.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-[#F5D77A]/70 pt-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#92400E]">
                    Active Researcher Claims ({activeClaims.length})
                  </div>
                  {activeClaims.map((claim) => {
                    const daysLeft = getDaysLeft(claim, now);
                    const isInProgress = claim.status === 'in_progress';
                    return (
                      <div
                        key={claim.id}
                        className="rounded-lg border border-[#F5D77A] bg-white/85 p-2.5 text-[11.5px]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-semibold text-[#0F172A]">
                            {claim.user_name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isInProgress
                                ? 'bg-[#FEF3C7] text-[#B45309]'
                                : 'bg-[#EAF1FE] text-[#1D4ED8]'
                            }`}
                          >
                            {isInProgress
                              ? 'In Progress'
                              : `Exploring · ${daysLeft ?? 1}d left`}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-snug text-[#5B6B82]">
                          {claim.planned_angle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer (preserved exact 2-column grid layout) */}
        <div className="border-t border-[#DCE4F0] bg-white p-3.5 lg:px-5">
          {userAlreadyClaimed && (
            <p className="mb-1.5 text-center text-[11px] font-medium text-[#1D4ED8]">
              You have an active claim
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenEditModal}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#1E2A5A] bg-white px-3 text-[12px] font-semibold text-[#1E2A5A] transition-colors hover:bg-[#EAF1FE] cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit &amp; Verify</span>
            </button>

            <button
              type="button"
              onClick={onOpenClaimDialog}
              disabled={userAlreadyClaimed}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1E2A5A] px-3 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Hand className="h-3.5 w-3.5" />
              <span>Claim Research Gap</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
