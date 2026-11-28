'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileUp,
  Globe2,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  harvestExternalApi,
  streamHarvestIngestApi,
  streamIngestPdfApi,
} from '@/lib/api';
import type { HarvestCandidate, Paper } from '@/types';
import { useLanguage, type TranslationKey } from '@/lib/i18n';

interface AddThesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddedPapers: (papers: Paper[]) => void;
}

type ModalTab = 'upload' | 'harvest';

const PDF_STEP_KEYS: TranslationKey[] = [
  'uploadingPdf',
  'validatingAcademicStructure',
  'extractingEntities',
  'addedToGraph',
];

const CAMPUS_PRESETS = [
  {
    label: 'UIN Malang E-Theses',
    url: 'http://etheses.uin-malang.ac.id/cgi/oai2',
  },
  {
    label: 'UIN Sunan Ampel Repo',
    url: 'http://digilib.uinsa.ac.id/cgi/oai2',
  },
  {
    label: 'UM Surabaya Repo',
    url: 'http://repository.um-surabaya.ac.id/cgi/oai2',
  },
];

export function AddThesisModal({
  isOpen,
  onClose,
  onAddedPapers,
}: AddThesisModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ModalTab>('upload');

  // Tab 1: Self-Upload PDF
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedPaper, setUploadedPaper] = useState<Paper | null>(null);

  // Tab 2: Harvest External
  const [sourceType, setSourceType] = useState<'oai_pmh' | 'openalex'>('oai_pmh');
  const [harvestQuery, setHarvestQuery] = useState('');
  const [oaiUrl, setOaiUrl] = useState(CAMPUS_PRESETS[0].url);
  const [limit, setLimit] = useState<number>(30);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [harvestError, setHarvestError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<HarvestCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importResultMsg, setImportResultMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploading || isImporting) return;
    onClose();
  };

  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    setUploadedPaper(null);
    setUploadStep(0);
    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError(t('choosePdfError'));
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadedPaper(null);
    setUploadStep(1);

    try {
      const created = await streamIngestPdfApi(selectedFile, sourceUrl, (evt) => {
        if (evt.type === 'progress' && typeof evt.step === 'number') {
          setUploadStep(evt.step);
        }
      });
      setUploadStep(4);
      setUploadedPaper(created);
      onAddedPapers([created]);
    } catch (err) {
      setUploadError((err as Error).message || 'PDF ingest failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFetchPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setHarvestError(null);
    setImportResultMsg(null);
    setIsFetchingPreview(true);

    try {
      const items = await harvestExternalApi({
        sourceType,
        query: harvestQuery,
        oaiUrl,
        limit,
      });
      setCandidates(items);
      setSelectedIds(new Set(items.map((item) => item.externalId)));
      if (items.length === 0) {
        setHarvestError(t('noMatchingRecords'));
      }
    } catch (err) {
      setHarvestError((err as Error).message || 'Failed to fetch preview.');
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.externalId)));
    }
  };

  const handleImportSelected = async () => {
    const picked = candidates.filter((c) => selectedIds.has(c.externalId));
    if (picked.length === 0) {
      setHarvestError(t('selectRecordError'));
      return;
    }

    setIsImporting(true);
    setHarvestError(null);
    setImportResultMsg(null);
    setImportProgress(t('preparingPipeline'));

    try {
      const { imported, skipped } = await streamHarvestIngestApi(picked, (evt) => {
        if (evt.type === 'progress') {
          const counter =
            evt.current && evt.total ? ` (${evt.current}/${evt.total})` : '';
          setImportProgress(
            `${evt.label || 'Processing'}${counter}: ${evt.title || ''}`
          );
        }
      });

      if (imported.length > 0) {
        onAddedPapers(imported);
      }

      const skipNote =
        skipped.length > 0
          ? ` (${skipped.length} ${
              skipped.length === 1 ? t('duplicateSkipped') : t('duplicatesSkipped')
            })`
          : '';
      setImportResultMsg(
        `${t('mapped')} ${imported.length} ${
          imported.length === 1 ? t('newThesisNode') : t('newThesisNodes')
        } ${t('intoNexusGraph')}${skipNote}.`
      );
      setImportProgress(null);
    } catch (err) {
      setHarvestError((err as Error).message || 'Import failed.');
      setImportProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('addThesis')}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE4F0] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">{t('addThesisTitle')}</h2>
            <p className="mt-0.5 text-[12px] text-[#5B6B82]">
              {t('addThesisSub')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('close')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Two Tabs */}
        <div className="border-b border-[#DCE4F0] bg-[#F8FAFC] px-5 pt-2.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-[#1E2A5A] text-[#1E2A5A]'
                  : 'border-transparent text-[#5B6B82] hover:text-[#0F172A]'
              }`}
            >
              <FileUp className="h-4 w-4" />
              <span>{t('selfUploadTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('harvest')}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'harvest'
                  ? 'border-[#1E2A5A] text-[#1E2A5A]'
                  : 'border-transparent text-[#5B6B82] hover:text-[#0F172A]'
              }`}
            >
              <Globe2 className="h-4 w-4" />
              <span>{t('importRepoTab')}</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'upload' ? (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag-and-drop dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0] || null;
                  handleFileChange(dropped);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
                  isDragging
                    ? 'border-[#1E2A5A] bg-[#EAF1FE]'
                    : 'border-[#C5D0E0] bg-[#F8FAFC] hover:border-[#1E2A5A]/60'
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1FE] text-[#1E2A5A]">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-[#0F172A]">
                  {selectedFile ? selectedFile.name : t('dragDropPdf')}
                </p>
                <p className="mt-1 text-[11.5px] text-[#5B6B82]">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB · ${t('pdfReadyForValidation')}`
                    : t('readablePdfTypes')}
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0F172A] shadow-2xs hover:bg-[#F4F7FB]">
                  <span>{selectedFile ? t('changePdf') : t('browsePdf')}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {/* Optional Repository Source URL */}
              <div>
                <label
                  htmlFor="ingest-source-url"
                  className="block text-[12px] font-medium text-[#0F172A]"
                >
                  {t('originalRepoUrl')}{' '}
                  <span className="font-normal text-[#8A97AB]">{t('optional')}</span>
                </label>
                <input
                  id="ingest-source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://repository.university.ac.id/handle/12345"
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] placeholder:text-[#8A97AB] focus:border-[#1E2A5A] focus:outline-none"
                />
              </div>

              {/* Real Streaming Stepper */}
              {(isUploading || uploadStep > 0) && (
                <div className="rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B82]">
                    {t('ingestProgress')}
                  </div>
                  <ol className="mt-2.5 space-y-2">
                    {PDF_STEP_KEYS.map((stepKey, idx) => {
                      const stepNum = idx + 1;
                      const isDone = uploadStep > stepNum || (uploadStep === 4 && stepNum === 4);
                      const isCurrent = isUploading && uploadStep === stepNum;
                      const isFailedHere = Boolean(uploadError && uploadStep === stepNum);

                      return (
                        <li
                          key={stepKey}
                          className="flex items-center gap-2.5 text-[12px]"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${
                              isFailedHere
                                ? 'bg-[#FEE2E2] text-[#DC2626]'
                                : isDone
                                  ? 'bg-[#E6F6EC] text-[#15803D]'
                                  : isCurrent
                                    ? 'bg-[#EAF1FE] text-[#1E2A5A]'
                                    : 'bg-[#EEF2F7] text-[#8A97AB]'
                            }`}
                          >
                            {isFailedHere ? (
                              <X className="h-3 w-3" />
                            ) : isDone ? (
                              <Check className="h-3 w-3" />
                            ) : isCurrent ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              stepNum
                            )}
                          </span>
                          <span
                            className={
                              isFailedHere
                                ? 'font-medium text-[#DC2626]'
                                : isDone || isCurrent
                                  ? 'font-medium text-[#0F172A]'
                                  : 'text-[#8A97AB]'
                            }
                          >
                            {t(stepKey)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12px] text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadedPaper && (
                <div className="rounded-xl border border-[#BCE6CA] bg-[#E6F6EC] p-3 text-[12px] text-[#15803D]">
                  <div className="font-semibold">
                  {t('added')} &ldquo;{uploadedPaper.title}&rdquo; {t('toPersonalWorkspace')}
                  </div>
                  <p className="mt-0.5 text-[11.5px]">
                  {t('colStatus')}: {t('unverified')} ({t('personalLabel')} {t('node')}).
                  {' '}{t('clickEditVerify')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isUploading}
                  className="h-9 rounded-lg border border-[#DCE4F0] px-4 text-[12.5px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
                >
                  {t('close')}
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('processingPdf')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>{t('validateExtract')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Source Switcher */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSourceType('oai_pmh')}
                  className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    sourceType === 'oai_pmh'
                      ? 'border-[#1E2A5A] bg-[#EAF1FE]/60'
                      : 'border-[#DCE4F0] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="text-[12.5px] font-bold text-[#0F172A]">
                    {t('campusRepository')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#5B6B82]">
                    {t('campusHarvestDescription')}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('openalex')}
                  className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    sourceType === 'openalex'
                      ? 'border-[#1E2A5A] bg-[#EAF1FE]/60'
                      : 'border-[#DCE4F0] bg-white hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="text-[12.5px] font-bold text-[#0F172A]">
                    {t('openAlexApi')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#5B6B82]">
                    {t('openAlexDescription')}
                  </div>
                </button>
              </div>

              {/* Harvest Search Form */}
              <form onSubmit={handleFetchPreview} className="space-y-3">
                {sourceType === 'oai_pmh' && (
                  <div>
                    <label
                      htmlFor="harvest-oai-url"
                      className="block text-[12px] font-medium text-[#0F172A]"
                    >
                      {t('campusEndpoint')}
                    </label>
                    <input
                      id="harvest-oai-url"
                      type="url"
                      value={oaiUrl}
                      onChange={(e) => setOaiUrl(e.target.value)}
                      placeholder="http://etheses.uin-malang.ac.id/cgi/oai2"
                      className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {CAMPUS_PRESETS.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setOaiUrl(preset.url)}
                          className="rounded-md border border-[#DCE4F0] bg-[#F4F7FB] px-2 py-0.5 text-[10.5px] font-medium text-[#5B6B82] hover:border-[#1E2A5A] hover:text-[#1E2A5A] cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex-1 min-w-[200px]">
                    <label
                      htmlFor="harvest-keyword"
                      className="block text-[12px] font-medium text-[#0F172A]"
                    >
                      {t('searchKeyword')}{' '}
                      {sourceType === 'oai_pmh' ? t('optionalFilter') : ''}
                    </label>
                    <input
                      id="harvest-keyword"
                      type="text"
                      value={harvestQuery}
                      onChange={(e) => setHarvestQuery(e.target.value)}
                      placeholder={t('keywordExamplePlaceholder')}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                    />
                  </div>

                  <div className="w-[110px]">
                    <label
                      htmlFor="harvest-limit"
                      className="block text-[12px] font-medium text-[#0F172A]"
                    >
                      {t('resultLimit')}
                    </label>
                    <select
                      id="harvest-limit"
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none cursor-pointer"
                    >
                      <option value={20}>20 {t('results')}</option>
                      <option value={30}>30 {t('results')}</option>
                      <option value={40}>40 {t('results')}</option>
                      <option value={50}>50 {t('results')}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isFetchingPreview || isImporting}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#172148] disabled:opacity-60 cursor-pointer"
                  >
                    {isFetchingPreview ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t('fetching')}</span>
                      </>
                    ) : (
                      <span>{t('fetchingPreview')}</span>
                    )}
                  </button>
                </div>
              </form>

              {harvestError && (
                <div className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12px] text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{harvestError}</span>
                </div>
              )}

              {importProgress && (
                <div className="flex items-center gap-2.5 rounded-xl border border-[#BFDBFE] bg-[#EAF1FE] p-3 text-[12px] font-medium text-[#1D4ED8]">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span className="truncate">{importProgress}</span>
                </div>
              )}

              {importResultMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-[#BCE6CA] bg-[#E6F6EC] p-3 text-[12px] font-medium text-[#15803D]">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{importResultMsg}</span>
                </div>
              )}

              {/* Candidate List */}
              {candidates.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11.5px] text-[#5B6B82]">
                    <span>
                      {t('foundRecords')}{' '}
                      <strong className="text-[#0F172A]">{candidates.length}</strong>{' '}
                      {t('records')} ·{' '}
                      <strong className="text-[#1E2A5A]">{selectedIds.size}</strong>{' '}
                      {t('selected')}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="font-medium text-[#1E2A5A] hover:underline cursor-pointer"
                    >
                      {selectedIds.size === candidates.length
                        ? t('deselectAll')
                        : t('selectAll')}
                    </button>
                  </div>

                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {candidates.map((item) => {
                      const checked = selectedIds.has(item.externalId);
                      return (
                        <div
                          key={item.externalId}
                          onClick={() => toggleCandidate(item.externalId)}
                          className={`rounded-xl border p-3 transition-colors cursor-pointer ${
                            checked
                              ? 'border-[#1E2A5A] bg-[#EAF1FE]/40'
                              : 'border-[#DCE4F0] bg-white hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCandidate(item.externalId)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 h-4 w-4 rounded border-[#DCE4F0] accent-[#1E2A5A] cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-medium text-[#5B6B82]">
                                  {item.year} · {item.author} · {item.university}
                                </span>
                                {item.sourceUrl && (
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E2A5A] hover:underline"
                                  >
                                    <span>{t('source')}</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <div className="mt-0.5 text-[13px] font-bold text-[#0F172A]">
                                {item.title}
                              </div>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-[#5B6B82] line-clamp-2">
                                {item.abstract}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isImporting}
                      className="h-9 rounded-lg border border-[#DCE4F0] px-4 text-[12.5px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
                    >
                      {t('close')}
                    </button>
                    <button
                      type="button"
                      onClick={handleImportSelected}
                      disabled={isImporting || selectedIds.size === 0}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('importing')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>{t('importMapGraph')} ({selectedIds.size})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

