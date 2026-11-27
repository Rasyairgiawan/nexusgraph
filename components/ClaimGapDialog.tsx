'use client';

import React, { useState } from 'react';
import { Hand, Loader2, X } from 'lucide-react';
import { createGapClaimApi } from '@/lib/api';
import type { Paper, UserProfile } from '@/types';

interface ClaimGapDialogProps {
  paper: Paper;
  currentUser: UserProfile | null;
  onClose: () => void;
  onClaimed: () => Promise<void>;
  onRequireAuth: () => void;
}

export function ClaimGapDialog({
  paper,
  currentUser,
  onClose,
  onClaimed,
  onRequireAuth,
}: ClaimGapDialogProps) {
  const [userName, setUserName] = useState(currentUser?.fullName || '');
  const [plannedAngle, setPlannedAngle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign In to Claim Research Gap"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-[440px] rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF1FE] text-[#1E2A5A]">
                <Hand className="h-4 w-4" />
              </div>
              <h2 className="text-[15px] font-bold text-[#0F172A]">
                Sign In to Claim Research Gap
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close claim dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#5B6B82]">
            Sign in with your researcher account so your claim is linked to your Profile
            and protected against unauthorized edits.
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
    if (!userName.trim()) {
      setErrorMsg('Researcher name is required.');
      return;
    }
    if (!plannedAngle.trim()) {
      setErrorMsg('Planned follow-up angle is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await createGapClaimApi({
        thesis_id: paper.id,
        user_id: currentUser.id,
        user_name: userName.trim(),
        planned_angle: plannedAngle.trim(),
      });
      await onClaimed();
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to claim research gap.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Claim Research Gap"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[460px] rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF1FE] text-[#1E2A5A]">
              <Hand className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F172A]">
                Claim Research Gap
              </h2>
              <p className="text-[11.5px] text-[#5B6B82]">
                Register your unique follow-up angle in Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close claim dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3.5 rounded-xl border border-[#F5D77A] bg-[#FFF9E6] p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#B45309]">
            Target Research Gap ({paper.year})
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#0F172A]">
            {paper.futureWork}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="claim-name"
              className="block text-[12px] font-medium text-[#0F172A]"
            >
              Researcher Name
            </label>
            <input
              id="claim-name"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g., Rina Kusuma"
              required
              className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="claim-angle"
              className="block text-[12px] font-medium text-[#0F172A]"
            >
              Planned Research Angle
            </label>
            <textarea
              id="claim-angle"
              rows={3}
              value={plannedAngle}
              onChange={(e) => setPlannedAngle(e.target.value)}
              placeholder="Specify how your planned approach extends or differs from existing work..."
              required
              className="mt-1 w-full rounded-lg border border-[#DCE4F0] px-3 py-2 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          <p className="text-[11px] leading-snug text-[#5B6B82]">
            Claims start as &apos;Exploring&apos; and auto-expire in 30 days unless marked &apos;In Progress&apos; in your Profile.
          </p>

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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E2A5A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <Hand className="h-4 w-4" />
                  <span>Confirm Claim</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
