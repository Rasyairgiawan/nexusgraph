'use client';

import React, { useState } from 'react';
import { FolderPlus, Loader2, X } from 'lucide-react';
import type { Paper, ProjectRecord, UserProfile } from '@/types';

interface ProjectModalProps {
  paper: Paper | null;
  projects: ProjectRecord[];
  currentUser: UserProfile | null;
  initialMode?: 'select' | 'create';
  onClose: () => void;
  onCreateProject: (name: string, description: string, note: string) => Promise<void>;
  onSaveToExisting: (projectId: string, note: string) => Promise<void>;
  onRequireAuth: () => void;
}

export function ProjectModal({
  paper,
  projects,
  currentUser,
  initialMode = 'select',
  onClose,
  onCreateProject,
  onSaveToExisting,
  onRequireAuth,
}: ProjectModalProps) {
  const [mode, setMode] = useState<'select' | 'create'>(
    projects.length === 0 ? 'create' : initialMode
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || ''
  );
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-[420px] rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between">
            <h2 className="text-[15px] font-bold text-[#0F172A]">
              Sign In to Save Research Projects
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#5B6B82]">
            Projects and personal thesis notes are stored per account in Supabase. Sign
            in or create a free researcher account to organize saved theses.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[#DCE4F0] px-4 text-[12.5px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              className="h-9 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        if (!projectName.trim()) {
          throw new Error('Project name cannot be empty.');
        }
        await onCreateProject(projectName.trim(), projectDescription.trim(), note.trim());
      } else {
        if (!selectedProjectId) {
          throw new Error('Please choose a project.');
        }
        await onSaveToExisting(selectedProjectId, note.trim());
      }
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save to Research Project"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[460px] rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF1FE] text-[#1E2A5A]">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F172A]">
                {paper ? 'Save Thesis to Project' : 'Create New Research Project'}
              </h2>
              <p className="text-[11.5px] text-[#5B6B82]">
                Persisted in your Supabase research workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {paper && (
          <div className="mt-3 rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-3">
            <div className="text-[11px] font-medium text-[#5B6B82]">
              {paper.year} · {paper.author}
            </div>
            <div className="mt-0.5 text-[12.5px] font-bold text-[#0F172A] line-clamp-2">
              {paper.title}
            </div>
          </div>
        )}

        {projects.length > 0 && paper && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('select')}
              className={`h-8 rounded-lg border text-[12px] font-semibold cursor-pointer ${
                mode === 'select'
                  ? 'border-[#1E2A5A] bg-[#EAF1FE] text-[#1E2A5A]'
                  : 'border-[#DCE4F0] bg-white text-[#5B6B82]'
              }`}
            >
              Existing Project
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`h-8 rounded-lg border text-[12px] font-semibold cursor-pointer ${
                mode === 'create'
                  ? 'border-[#1E2A5A] bg-[#EAF1FE] text-[#1E2A5A]'
                  : 'border-[#DCE4F0] bg-white text-[#5B6B82]'
              }`}
            >
              + New Project
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'select' && projects.length > 0 ? (
            <div>
              <label className="block text-[12px] font-medium text-[#0F172A]">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] bg-white px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.items.length} saved)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[12px] font-medium text-[#0F172A]">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Clinical NLP Literature Review"
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#0F172A]">
                  Goal / Description <span className="font-normal text-[#8A97AB]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Scope or hypothesis of this research workspace..."
                  className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                />
              </div>
            </>
          )}

          {paper && (
            <div>
              <label className="block text-[12px] font-medium text-[#0F172A]">
                Personal Research Note <span className="font-normal text-[#8A97AB]">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Key methodology notes, baseline comparison, or follow-up idea..."
                className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 rounded-lg border border-[#DCE4F0] px-4 text-[12.5px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{mode === 'create' ? 'Create & Save' : 'Save to Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
