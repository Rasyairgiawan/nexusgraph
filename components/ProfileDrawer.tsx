'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  FileText,
  GitFork,
  GraduationCap,
  Lightbulb,
  Loader2,
  LogOut,
  Pencil,
  ShieldCheck,
  X,
} from 'lucide-react';
import { updateProfileApi } from '@/lib/api';
import {
  formatExpiryLabel,
  getActiveClaimsForUser,
  getDaysLeft,
  type GapClaim,
} from '@/lib/claims';
import type { Paper, UserProfile } from '@/types';

interface ProfileDrawerProps {
  user: UserProfile;
  allPapers: Paper[];
  claims: GapClaim[];
  claimsNow: number;
  onClose: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onUpgradeClaim: (claimId: string) => Promise<void>;
  onReleaseClaim: (claimId: string) => Promise<void>;
  onOpenThesisInGraph: (paperId: string) => void;
  onSignOutConfirmed: () => Promise<void>;
}

export function ProfileDrawer({
  user,
  allPapers,
  claims,
  claimsNow,
  onClose,
  onUserUpdated,
  onUpgradeClaim,
  onReleaseClaim,
  onOpenThesisInGraph,
  onSignOutConfirmed,
}: ProfileDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [institution, setInstitution] = useState(user.institution);
  const [major, setMajor] = useState(user.major);
  const [nim, setNim] = useState(user.nim);
  const [researchInterests, setResearchInterests] = useState(user.researchInterests);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [claimBusyId, setClaimBusyId] = useState<string | null>(null);
  const [claimActionError, setClaimActionError] = useState<string | null>(null);
  const [releaseCandidate, setReleaseCandidate] = useState<{
    claim: GapClaim;
    thesisTitle: string;
  } | null>(null);

  const paperById = useMemo(
    () => new Map(allPapers.map((p) => [p.id, p])),
    [allPapers]
  );

  // Only active claims (released and expired exploring claims are automatically hidden)
  const myActiveClaims = useMemo(
    () => getActiveClaimsForUser(claims, user.id, claimsNow),
    [claims, user.id, claimsNow]
  );

  const verifiedTheses = useMemo(() => {
    const idSet = new Set(user.verifiedThesisIds);
    const normalizedName = user.fullName.trim().toLowerCase();
    return allPapers.filter(
      (p) =>
        p.verified &&
        (idSet.has(p.id) ||
          (p.verifiedBy && p.verifiedBy.trim().toLowerCase() === normalizedName))
    );
  }, [allPapers, user.verifiedThesisIds, user.fullName]);

  const uploadedTheses = useMemo(() => {
    const idSet = new Set(user.uploadedThesisIds);
    return allPapers.filter(
      (p) => idSet.has(p.id) || p.uploadedBy === user.id
    );
  }, [allPapers, user.uploadedThesisIds, user.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const updated = await updateProfileApi({
        fullName: fullName.trim(),
        institution: institution.trim(),
        major: major.trim(),
        nim: nim.trim(),
        researchInterests: researchInterests.trim(),
      });
      onUserUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgrade = async (claimId: string) => {
    setClaimBusyId(claimId);
    setClaimActionError(null);
    try {
      await onUpgradeClaim(claimId);
    } catch (err) {
      setClaimActionError((err as Error).message || 'Could not upgrade claim.');
    } finally {
      setClaimBusyId(null);
    }
  };

  const handleConfirmRelease = async () => {
    if (!releaseCandidate) return;
    const id = releaseCandidate.claim.id;
    setClaimBusyId(id);
    setClaimActionError(null);
    try {
      await onReleaseClaim(id);
      setReleaseCandidate(null);
    } catch (err) {
      setClaimActionError((err as Error).message || 'Could not release claim.');
    } finally {
      setClaimBusyId(null);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOutConfirmed();
      onClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[#0F172A]/35 backdrop-blur-[1px]"
      />

      <aside
        aria-label="Researcher Profile Drawer"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col border-l border-[#DCE4F0] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE4F0] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">
              Researcher Profile
            </h2>
            <p className="text-[11.5px] text-[#5B6B82]">
              Unified academic identity &amp; research contributions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile drawer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity & Academic Background */}
          <section className="rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E2A5A] text-[13px] font-bold text-white">
                  {user.fullName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join('')
                    .toUpperCase() || 'NG'}
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#0F172A]">
                    {user.fullName}
                  </div>
                  <div className="text-[11.5px] text-[#5B6B82]">{user.email}</div>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DCE4F0] bg-white px-2.5 text-[11px] font-medium text-[#0F172A] hover:border-[#1E2A5A] hover:text-[#1E2A5A] cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5B6B82]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6B82]">
                      Institution
                    </label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6B82]">
                      Major / Program
                    </label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6B82]">
                      Student ID (NIM)
                    </label>
                    <input
                      type="text"
                      value={nim}
                      onChange={(e) => setNim(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5B6B82]">
                      Research Interests
                    </label>
                    <input
                      type="text"
                      value={researchInterests}
                      onChange={(e) => setResearchInterests(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A]"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-[11.5px] text-[#DC2626]">{errorMsg}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="h-8 rounded-lg border border-[#DCE4F0] bg-white px-3 text-[11.5px] font-medium text-[#5B6B82] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E2A5A] px-3 text-[11.5px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    <span>Save</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3.5 grid grid-cols-2 gap-2.5 border-t border-[#DCE4F0] pt-3 text-[12px]">
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8A97AB]">
                    Institution
                  </div>
                  <div className="mt-0.5 font-medium text-[#0F172A]">
                    {user.institution || 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8A97AB]">
                    Major
                  </div>
                  <div className="mt-0.5 font-medium text-[#0F172A]">
                    {user.major || 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8A97AB]">
                    NIM / ID
                  </div>
                  <div className="mt-0.5 font-medium text-[#0F172A]">
                    {user.nim || 'Not set'}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8A97AB]">
                    Interests
                  </div>
                  <div className="mt-0.5 font-medium text-[#0F172A]">
                    {user.researchInterests || 'Not set'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* My Claimed Research Gaps (Active Claims Only) */}
          <section>
            <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F172A]">
              <Lightbulb className="h-4 w-4 text-[#B45309]" />
              <span>My Claimed Research Gaps ({myActiveClaims.length})</span>
            </div>

            {claimActionError && (
              <div className="mt-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11.5px] text-[#B91C1C]">
                {claimActionError}
              </div>
            )}

            {myActiveClaims.length === 0 ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-[#DCE4F0] p-3 text-[12px] text-[#8A97AB]">
                No active research gap claims right now.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {myActiveClaims.map((claim) => {
                  const paper = paperById.get(claim.thesis_id);
                  const thesisTitle = paper?.title || 'Thesis Record';
                  const daysLeft = getDaysLeft(claim, claimsNow);
                  const expiryText = formatExpiryLabel(daysLeft);
                  const isExploring = claim.status === 'exploring';
                  const isBusy = claimBusyId === claim.id;

                  return (
                    <div
                      key={claim.id}
                      className="rounded-xl border border-[#F5D77A] bg-[#FFF9E6]/70 p-3 text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isExploring
                              ? 'bg-[#EAF1FE] text-[#1D4ED8]'
                              : 'bg-[#FEF3C7] text-[#B45309]'
                          }`}
                        >
                          {isExploring
                            ? `Exploring${expiryText ? ` · ${expiryText}` : ''}`
                            : 'In Progress'}
                        </span>

                        {paper && (
                          <button
                            type="button"
                            onClick={() => {
                              onOpenThesisInGraph(paper.id);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E2A5A] hover:underline cursor-pointer"
                          >
                            <GitFork className="h-3 w-3" />
                            <span>Open in Graph</span>
                          </button>
                        )}
                      </div>

                      <div className="mt-1 text-[12.5px] font-bold text-[#0F172A] line-clamp-1">
                        {paper ? `${paper.year} · ` : ''}
                        {thesisTitle}
                      </div>

                      <p className="mt-1 text-[11.5px] leading-snug text-[#5B6B82]">
                        {claim.planned_angle}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#F5D77A]/60 pt-2">
                        {isExploring && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpgrade(claim.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-[#1E2A5A] px-2.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-55 cursor-pointer"
                          >
                            {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                            <span>Mark as In Progress</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            setReleaseCandidate({ claim, thesisTitle })
                          }
                          className="inline-flex h-7 items-center rounded-md border border-[#FECACA] bg-white px-2.5 text-[11px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-55 cursor-pointer"
                        >
                          Release Claim
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Verified Theses */}
          <section>
            <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F172A]">
              <ShieldCheck className="h-4 w-4 text-[#15803D]" />
              <span>My Verified Theses ({verifiedTheses.length})</span>
            </div>
            {verifiedTheses.length === 0 ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-[#DCE4F0] p-3 text-[12px] text-[#8A97AB]">
                Verify AI-extracted thesis entities via &ldquo;Edit &amp; Verify&rdquo; to build
                campus trust.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {verifiedTheses.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => {
                      onOpenThesisInGraph(paper.id);
                      onClose();
                    }}
                    className="w-full rounded-xl border border-[#DCE4F0] bg-white p-3 text-left hover:border-[#1E2A5A] cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#15803D]">
                      <span>{paper.year} · Verified</span>
                      <span className="text-[#1E2A5A]">Open in Graph</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] font-bold text-[#0F172A] line-clamp-1">
                      {paper.title}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* My Uploaded Theses */}
          <section>
            <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F172A]">
              <FileText className="h-4 w-4 text-[#4338CA]" />
              <span>My Uploaded / Imported Theses ({uploadedTheses.length})</span>
            </div>
            {uploadedTheses.length === 0 ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-[#DCE4F0] p-3 text-[12px] text-[#8A97AB]">
                No personal uploads or imports linked to this account yet.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {uploadedTheses.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => {
                      onOpenThesisInGraph(paper.id);
                      onClose();
                    }}
                    className="w-full rounded-xl border border-[#DCE4F0] bg-white p-3 text-left hover:border-[#1E2A5A] cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#5B6B82]">
                      <span>{paper.year} · {paper.fileName}</span>
                      <span className="text-[#1E2A5A]">Open in Graph</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] font-bold text-[#0F172A] line-clamp-1">
                      {paper.title}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-3 text-[11.5px] text-[#5B6B82]">
            <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
              <GraduationCap className="h-3.5 w-3.5 text-[#1E2A5A]" />
              <span>Unified Researcher Workspace</span>
            </div>
            <p className="mt-1 leading-relaxed">
              Every NexusGraph account can upload theses, verify extracted entities, claim
              open research gaps, and curate project workspaces.
            </p>
          </div>
        </div>

        {/* Footer Sign Out */}
        <div className="border-t border-[#DCE4F0] bg-white p-4">
          {confirmSignOut ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
              <span className="text-[12px] font-medium text-[#B91C1C]">
                Sign out from NexusGraph?
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  className="h-7 rounded-md border border-[#DCE4F0] bg-white px-2.5 text-[11.5px] font-medium text-[#5B6B82] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-[#DC2626] px-2.5 text-[11.5px] font-semibold text-white hover:bg-[#B91C1C] cursor-pointer"
                >
                  {isSigningOut && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#FECACA] bg-white text-[12.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Release Claim Confirmation Dialog */}
      {releaseCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Release Claim"
          onClick={(e) => {
            if (e.target === e.currentTarget && !claimBusyId) {
              setReleaseCandidate(null);
            }
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0F172A]/50 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-[400px] rounded-2xl border border-[#DCE4F0] bg-white p-5 shadow-2xl">
            <h3 className="text-[15px] font-bold text-[#0F172A]">
              Release Research Gap Claim?
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B6B82]">
              Releasing your claim on{' '}
              <strong className="text-[#0F172A]">{releaseCandidate.thesisTitle}</strong>{' '}
              removes it from your active claims and lets you re-claim it later if needed.
            </p>
            <div className="mt-3 rounded-lg border border-[#DCE4F0] bg-[#F8FAFC] p-2.5 text-[11.5px] text-[#5B6B82]">
              Angle: {releaseCandidate.claim.planned_angle}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(claimBusyId)}
                onClick={() => setReleaseCandidate(null)}
                className="h-8 rounded-lg border border-[#DCE4F0] px-3.5 text-[12px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(claimBusyId)}
                onClick={handleConfirmRelease}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#DC2626] px-3.5 text-[12px] font-semibold text-white hover:bg-[#B91C1C] cursor-pointer"
              >
                {claimBusyId === releaseCandidate.claim.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Confirm Release</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
