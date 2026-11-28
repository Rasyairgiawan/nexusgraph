'use client';

import React, { useState } from 'react';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import type { Paper, PaperUpdatePayload, UserProfile } from '@/types';
import { useLanguage } from '@/lib/i18n';

interface EditVerifyModalProps {
  paper: Paper;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSave: (paperId: string, payload: PaperUpdatePayload) => Promise<void>;
}

export function EditVerifyModal({
  paper,
  currentUser,
  onClose,
  onSave,
}: EditVerifyModalProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(paper.title);
  const [author, setAuthor] = useState(paper.author);
  const [year, setYear] = useState(paper.year);
  const [sourceUrl, setSourceUrl] = useState(paper.sourceUrl || '');
  const [problem, setProblem] = useState(paper.problem);
  const [method, setMethod] = useState(paper.method);
  const [dataset, setDataset] = useState(paper.dataset);
  const [keyFindings, setKeyFindings] = useState(
    paper.keyFindings || paper.limitation
  );
  const [futureWork, setFutureWork] = useState(paper.futureWork);
  const [verified, setVerified] = useState(paper.verified);
  const [verifiedBy, setVerifiedBy] = useState(
    paper.verifiedBy || currentUser?.fullName || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      await onSave(paper.id, {
        title: title.trim() || paper.title,
        author: author.trim() || paper.author,
        year: Number(year) || paper.year,
        sourceUrl: sourceUrl.trim() || null,
        problem: problem.trim(),
        method: method.trim(),
        dataset: dataset.trim(),
        keyFindings: keyFindings.trim(),
        limitation: keyFindings.trim(),
        futureWork: futureWork.trim(),
        verified,
        verifiedBy: verified ? verifiedBy.trim() || currentUser?.fullName || 'Peer Reviewer' : null,
      });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('editVerifyDialog')}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#DCE4F0] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#1E2A5A]" />
              <h2 className="text-[15.5px] font-bold text-[#0F172A]">
                {t('editEntitiesTitle')}
              </h2>
            </div>
            <p className="mt-0.5 text-[12px] text-[#5B6B82]">
              {t('editEntitiesDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeModal')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
          <div>
            <label className="block text-[11.5px] font-semibold text-[#0F172A]">
              {t('thesisTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-[11.5px] font-semibold text-[#0F172A]">
                {t('author').replace(/:$/, '')}
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[#0F172A]">
                {t('year')}
              </label>
              <input
                type="number"
                min={1990}
                max={2035}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                required
                className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0F172A]">
              {t('originalSourceUrl')}
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={t('originalSourceUrlPlaceholder')}
              className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#1E2A5A]">
              {t('entProblem')}
            </label>
            <textarea
              rows={2}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#7C3AED]">
              {t('methodology')}
            </label>
            <textarea
              rows={2}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0D9488]">
              {t('datasetObject')}
            </label>
            <textarea
              rows={2}
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#EA580C]">
              {t('keyFindings')}
            </label>
            <textarea
              rows={2}
              value={keyFindings}
              onChange={(e) => setKeyFindings(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#4F46E5]">
              {t('researchGapFuture')}
            </label>
            <textarea
              rows={2}
              value={futureWork}
              onChange={(e) => setFutureWork(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          {/* Reviewer Verification Box */}
          <div className="rounded-xl border border-[#BCE6CA] bg-[#E6F6EC]/60 p-3.5">
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#15803D] cursor-pointer">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="h-4 w-4 rounded border-[#15803D] accent-[#16A34A] cursor-pointer"
              />
              <span>{t('markHumanVerified')}</span>
            </label>

            {verified && (
              <div className="mt-2.5">
                <label className="block text-[11px] font-medium text-[#15803D]">
                  {t('verifiedBy')}
                </label>
                <input
                  type="text"
                  value={verifiedBy}
                  onChange={(e) => setVerifiedBy(e.target.value)}
                  placeholder={t('reviewerNamePlaceholder')}
                  className="mt-1 h-8 w-full rounded-lg border border-[#BCE6CA] bg-white px-2.5 text-[12px] text-[#0F172A] focus:border-[#16A34A] focus:outline-none"
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-lg border border-[#DCE4F0] px-4 text-[12.5px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('saving')}</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{t('saveUpdateGraph')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
