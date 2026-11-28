'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { useLanguage } from '@/lib/i18n';

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

interface TranslatedEntities {
  problem: string;
  method: string;
  dataset: string;
  keyFindings: string;
  futureWork: string;
}

type TranslationState =
  | { key: string; status: 'ready'; value: TranslatedEntities }
  | { key: string; status: 'error' };

const idTranslationCache = new Map<string, TranslatedEntities>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getTranslatedEntities(
  value: unknown,
  fallback: TranslatedEntities
): TranslatedEntities {
  if (!isRecord(value)) {
    throw new Error('Translation response was not a JSON object.');
  }
  const translatedField = (field: keyof TranslatedEntities) =>
    typeof value[field] === 'string' && value[field].trim()
      ? value[field] as string
      : fallback[field];

  return {
    problem: translatedField('problem'),
    method: translatedField('method'),
    dataset: translatedField('dataset'),
    keyFindings: translatedField('keyFindings'),
    futureWork: translatedField('futureWork'),
  };
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
  const { lang, t, translateStatus } = useLanguage();
  const [translationState, setTranslationState] = useState<TranslationState | null>(null);
  const translationKey = JSON.stringify([
    paper.id,
    paper.problem,
    paper.method,
    paper.dataset,
    paper.keyFindings,
    paper.limitation,
    paper.futureWork,
  ]);
  const sourceEntities = useMemo<TranslatedEntities>(
    () => ({
      problem: paper.problem,
      method: paper.method,
      dataset: paper.dataset,
      keyFindings: paper.keyFindings || paper.limitation,
      futureWork: paper.futureWork,
    }),
    [
      paper.problem,
      paper.method,
      paper.dataset,
      paper.keyFindings,
      paper.limitation,
      paper.futureWork,
    ]
  );
  const cachedTranslation = idTranslationCache.get(translationKey) || null;
  const currentTranslationState =
    translationState?.key === translationKey ? translationState : null;
  const translated =
    cachedTranslation ||
    (currentTranslationState?.status === 'ready' ? currentTranslationState.value : null);
  const translationError = currentTranslationState?.status === 'error';
  const isTranslating = lang === 'id' && !translated && !translationError;

  useEffect(() => {
    if (lang !== 'id' || idTranslationCache.has(translationKey)) return;

    const controller = new AbortController();
    let cancelled = false;

    const translate = async () => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetLang: 'id', ...sourceEntities }),
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          const message =
            isRecord(data) && typeof data.error === 'string'
              ? data.error
              : 'Translation request failed.';
          throw new Error(message);
        }

        const result = getTranslatedEntities(data, sourceEntities);
        if (cancelled) return;
        idTranslationCache.set(translationKey, result);
        setTranslationState({ key: translationKey, status: 'ready', value: result });
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setTranslationState({ key: translationKey, status: 'error' });
        }
      }
    };

    void translate();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    lang,
    paper.id,
    paper.problem,
    paper.method,
    paper.dataset,
    paper.keyFindings,
    paper.limitation,
    paper.futureWork,
    sourceEntities,
    translationKey,
  ]);

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
        aria-label={t('thesisDetailInspector')}
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
                  {t('verified')}
                  {paper.verifiedBy ? ` ${t('by')} ${paper.verifiedBy}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-[#DCE4F0] bg-[#F8FAFC] px-2 py-0.5 text-[10.5px] font-medium text-[#64748B]">
                  {t('unverified')}
                </span>
              )}

              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${sourceBadge.className}`}
              >
                {translateStatus(sourceBadge.label)}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('closeDetailDrawer')}
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
            {t('author')} <span className="font-medium text-[#0F172A]">{paper.author}</span>
            {paper.university ? ` · ${paper.university}` : ''}
          </p>

          {/* Similarity + Derived Gap Summary */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${simMeta.badgeClass}`}
            >
              {t('similarity')}: {paper.similarity.toFixed(1)}% ({translateStatus(simMeta.label)})
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
              {translateStatus(gapSummary)}
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
                <span>{t('viewPdf')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={onSaveToProject}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white px-3 text-[12px] font-medium text-[#0F172A] transition-colors hover:bg-[#F4F7FB] cursor-pointer"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-[#1E2A5A]" />
              <span>{t('saveToProject')}</span>
            </button>
          </div>

          {isTranslating && lang === 'id' && (
            <p className="mt-3 text-[11px] text-[#5B6B82]">{t('translating')}</p>
          )}
          {translationError && lang === 'id' && (
            <p role="status" className="mt-3 text-[11px] text-[#B91C1C]">
              {t('translationError')}
            </p>
          )}

          {/* 5 Entity Cards */}
          <div className="mt-4 space-y-2.5">
            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1E2A5A]">
                <BookOpen className="h-3.5 w-3.5" />
                <span>{t('entProblem')}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {translated?.problem || paper.problem}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">
                <Settings className="h-3.5 w-3.5" />
                <span>{t('entMethod')}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {translated?.method || paper.method}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0D9488]">
                <Database className="h-3.5 w-3.5" />
                <span>{t('entDataset')}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {translated?.dataset || paper.dataset}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE4F0] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#EA580C]">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>{t('entFindings')}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#0F172A]">
                {translated?.keyFindings || paper.keyFindings || paper.limitation}
              </p>
            </div>

            {/* Highlighted Research Gap / Future Work + Active Soft-Lock Claims */}
            <div className="rounded-xl border-2 border-[#F5D77A] bg-[#FFF9E6] p-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#B45309]">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>{t('entGap')}</span>
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
                  {translateStatus(gapSummary)}
                </span>
              </div>

              <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-[#0F172A]">
                {translated?.futureWork || paper.futureWork}
              </p>

              {/* Inline List of Active Claims */}
              {activeClaims.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-[#F5D77A]/70 pt-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#92400E]">
                    {t('activeClaims')} ({activeClaims.length})
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
                            {translateStatus(
                              isInProgress
                                ? 'In Progress'
                                : `Exploring · ${daysLeft ?? 1}d left`
                            )}
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
              {t('alreadyClaimed')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenEditModal}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#1E2A5A] bg-white px-3 text-[12px] font-semibold text-[#1E2A5A] transition-colors hover:bg-[#EAF1FE] cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{t('editVerify')}</span>
            </button>

            <button
              type="button"
              onClick={onOpenClaimDialog}
              disabled={userAlreadyClaimed}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1E2A5A] px-3 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Hand className="h-3.5 w-3.5" />
              <span>{t('claimGap')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
