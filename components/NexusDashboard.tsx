'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  createProjectApi,
  deleteConversationApi,
  deleteProjectApi,
  fetchAllPapersFromApi,
  fetchAuthSessionApi,
  fetchGapClaimsApi,
  mutateProjectApi,
  saveConversationApi,
  searchPapersFromApi,
  signOutApi,
  updateGapClaimApi,
  updatePaperViaApi,
} from '@/lib/api';
import {
  getActiveClaimsForThesis,
  getActiveClaimsForUser,
  type GapClaimWithMeta,
} from '@/lib/claims';
import type {
  AiConversationRecord,
  AppMode,
  FilterState,
  Paper,
  PaperUpdatePayload,
  ProfileStats,
  ProjectRecord,
  UserProfile,
} from '@/types';
import { AddThesisModal } from './AddThesisModal';
import { AiView } from './AiView';
import { AuthModal, type AuthModalMode } from './AuthModal';
import { ClaimGapDialog } from './ClaimGapDialog';
import { DetailPanel } from './DetailPanel';
import { EditVerifyModal } from './EditVerifyModal';
import { GraphCanvas } from './GraphCanvas';
import { Header } from './Header';
import { ProfileDrawer } from './ProfileDrawer';
import type { ProfileMenuAction } from './ProfileMenu';
import { ProjectModal } from './ProjectModal';
import { TableView } from './TableView';

const DEFAULT_FILTERS: FilterState = {
  year: 'all',
  verifiedOnly: false,
  availableGapsOnly: false,
};

export function NexusDashboard() {
  const [mode, setMode] = useState<AppMode>('graph');
  const [queryInput, setQueryInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  // Live theses & active gap claims fetched from Supabase
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [claims, setClaims] = useState<GapClaimWithMeta[]>([]);
  const [claimsNow, setClaimsNow] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  // Scoped Project Filter for Graph / Table
  const [scopedProjectId, setScopedProjectId] = useState<string | null>(null);

  // Modals & Drawers
  const [isAddThesisOpen, setIsAddThesisOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [claimDialogPaper, setClaimDialogPaper] = useState<Paper | null>(null);

  // Auth & Per-User Persisted State (Supabase)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  // Projects & Conversations
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectModalState, setProjectModalState] = useState<{
    paper: Paper | null;
    initialMode: 'select' | 'create';
  } | null>(null);

  const [conversations, setConversations] = useState<AiConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [aiHighlightSection, setAiHighlightSection] = useState<'projects' | 'history' | null>(null);

  const refreshClaims = async () => {
    const activeClaims = await fetchGapClaimsApi();
    setClaims(activeClaims);
    setClaimsNow(Date.now());
  };

  // Initial Hydration from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [thesesList, sessionData, activeClaims] = await Promise.all([
          fetchAllPapersFromApi(),
          fetchAuthSessionApi(),
          fetchGapClaimsApi(),
        ]);
        if (cancelled) return;
        setAllPapers(thesesList);
        setSearchResults(thesesList);
        setClaims(activeClaims);
        setClaimsNow(Date.now());
        setCurrentUser(sessionData.user);
        setProjects(sessionData.projects);
        setConversations(sessionData.conversations);
        if (sessionData.projects.length > 0) {
          setActiveProjectId(sessionData.projects[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setApiError((err as Error).message || 'Failed to load theses from Supabase.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const scopedProject = useMemo(
    () => projects.find((p) => p.id === scopedProjectId) || null,
    [projects, scopedProjectId]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(allPapers.map((p) => p.year))).sort((a, b) => b - a);
    return years;
  }, [allPapers]);

  const visiblePapers = useMemo(() => {
    const scopedIdSet = scopedProject
      ? new Set(scopedProject.items.map((item) => item.thesisId))
      : null;

    return searchResults.filter((paper) => {
      if (scopedIdSet && !scopedIdSet.has(paper.id)) return false;
      if (filters.year !== 'all' && paper.year !== filters.year) return false;
      if (filters.verifiedOnly && !paper.verified) return false;
      if (
        filters.availableGapsOnly &&
        getActiveClaimsForThesis(claims, paper.id, claimsNow).length > 0
      ) {
        return false;
      }
      return true;
    });
  }, [searchResults, filters, scopedProject, claims, claimsNow]);

  const selectedPaper = useMemo(
    () =>
      allPapers.find((p) => p.id === selectedPaperId) ||
      visiblePapers.find((p) => p.id === selectedPaperId) ||
      null,
    [allPapers, visiblePapers, selectedPaperId]
  );

  const profileStats: ProfileStats = useMemo(() => {
    const uniqueSavedIds = new Set<string>();
    projects.forEach((proj) => proj.items.forEach((it) => uniqueSavedIds.add(it.thesisId)));

    const activeUserClaims = currentUser
      ? getActiveClaimsForUser(claims, currentUser.id, claimsNow).length
      : 0;

    return {
      savedThesesCount: uniqueSavedIds.size,
      projectsCount: projects.length,
      claimedGapsCount: activeUserClaims,
    };
  }, [projects, currentUser, claims, claimsNow]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setApiError(null);
    setQueryInput('');
    setSubmittedQuery('');
    try {
      const [refreshed, activeClaims] = await Promise.all([
        fetchAllPapersFromApi(),
        fetchGapClaimsApi(),
      ]);
      setAllPapers(refreshed);
      setSearchResults(refreshed);
      setClaims(activeClaims);
      setClaimsNow(Date.now());
    } catch (err) {
      setApiError((err as Error).message || 'Failed to reload data from Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = queryInput.trim();
    setSubmittedQuery(q);
    setApiError(null);
    setIsLoading(true);

    try {
      if (!q) {
        const fresh = await fetchAllPapersFromApi();
        setAllPapers(fresh);
        setSearchResults(fresh);
      } else {
        const matches = await searchPapersFromApi(q, 0.42, 20);
        setSearchResults(matches);
        if (matches.length > 0) {
          setSelectedPaperId(matches[0].id);
        }
      }
    } catch (err) {
      setApiError((err as Error).message || 'Semantic search failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const mergePaperUpdate = (updated: Paper) => {
    setAllPapers((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });
    setSearchResults((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });
  };

  const handleUpdatePaper = async (paperId: string, payload: PaperUpdatePayload) => {
    const updated = await updatePaperViaApi(paperId, payload);
    mergePaperUpdate(updated);

    if (currentUser && payload.verified) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const verifiedIds = new Set(prev.verifiedThesisIds);
        verifiedIds.add(paperId);
        return {
          ...prev,
          verifiedThesisIds: Array.from(verifiedIds),
        };
      });
    }
  };

  const handleAddedPapers = (newPapers: Paper[]) => {
    if (newPapers.length === 0) return;
    setAllPapers((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNew = newPapers.filter((p) => !existingIds.has(p.id));
      return [...uniqueNew, ...prev];
    });
    setSearchResults((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNew = newPapers.filter((p) => !existingIds.has(p.id));
      return [...uniqueNew, ...prev];
    });
    setSelectedPaperId(newPapers[0].id);

    if (currentUser) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const nextUploaded = new Set(prev.uploadedThesisIds);
        newPapers.forEach((p) => nextUploaded.add(p.id));
        return { ...prev, uploadedThesisIds: Array.from(nextUploaded) };
      });
    }
  };

  const handleUpsertConversation = async (conv: AiConversationRecord) => {
    setConversations((prev) => {
      const without = prev.filter((c) => c.id !== conv.id);
      return [conv, ...without];
    });
    setActiveConversationId(conv.id);

    if (currentUser) {
      try {
        const res = await saveConversationApi(conv);
        setConversations(res.conversations);
        setActiveConversationId(res.savedId);
      } catch {
        // Keep local state usable cleanly
      }
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConversationId === convId) {
      setActiveConversationId(null);
    }
    if (currentUser) {
      try {
        const remaining = await deleteConversationApi(convId);
        setConversations(remaining);
      } catch {
        // Ignore network error after optimistic removal
      }
    }
  };

  const handleCreateProject = async (
    name: string,
    description: string,
    note: string
  ) => {
    const paper = projectModalState?.paper || null;
    const { projectId, projects: updatedProjects } = await createProjectApi({
      name,
      description,
      thesisId: paper?.id,
      note,
    });
    setProjects(updatedProjects);
    setActiveProjectId(projectId);
  };

  const handleSaveToExistingProject = async (projectId: string, note: string) => {
    const paper = projectModalState?.paper || null;
    if (!paper) return;
    const updatedProjects = await mutateProjectApi({
      action: 'upsert_thesis',
      projectId,
      thesisId: paper.id,
      note,
    });
    setProjects(updatedProjects);
    setActiveProjectId(projectId);
  };

  const handleProfileAction = (action: ProfileMenuAction) => {
    switch (action) {
      case 'open_profile':
      case 'open_claimed_gaps':
        setIsProfileDrawerOpen(true);
        break;
      case 'open_projects':
        setMode('ai');
        setAiHighlightSection('projects');
        break;
      case 'open_history':
        setMode('ai');
        setAiHighlightSection('history');
        break;
    }
  };

  const handleSignOut = async () => {
    await signOutApi();
    setCurrentUser(null);
    setProjects([]);
    setConversations([]);
    setActiveProjectId(null);
    setScopedProjectId(null);
    setActiveConversationId(null);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F4F7FB]">
      <Header
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setAiHighlightSection(null);
        }}
        queryInput={queryInput}
        onQueryInputChange={setQueryInput}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={handleRefresh}
        shownCount={visiblePapers.length}
        totalCount={allPapers.length}
        isLoading={isLoading}
        user={currentUser}
        profileStats={profileStats}
        onOpenAuth={(m) => setAuthModalMode(m)}
        onOpenAddThesis={() => setIsAddThesisOpen(true)}
        onProfileAction={handleProfileAction}
        onSignOutClick={() => setIsProfileDrawerOpen(true)}
        filters={filters}
        availableYears={availableYears}
        onFilterChange={setFilters}
        onResetFilters={() => {
          setFilters(DEFAULT_FILTERS);
          setScopedProjectId(null);
        }}
        activeProjectName={scopedProject?.name || null}
        onExitProjectScope={() => setScopedProjectId(null)}
      />

      <div
        style={{
          background: 'radial-gradient(circle at center, #fdf0ec 0%, #aee1f9 100%)',
        }}
        className="flex flex-1 flex-col min-h-0 overflow-hidden"
      >

      {apiError && (
        <div className="border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-[12px] text-[#B91C1C] lg:px-6">
          {apiError}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {mode === 'graph' && (
          <>
            <GraphCanvas
              query={submittedQuery}
              papers={visiblePapers}
              allPapers={allPapers}
              claims={claims}
              claimsNow={claimsNow}
              selectedPaperId={selectedPaper?.id || null}
              onSelectPaper={setSelectedPaperId}
              isLoading={isLoading}
            />
            {selectedPaper && (
              <DetailPanel
                paper={selectedPaper}
                claims={claims}
                claimsNow={claimsNow}
                currentUser={currentUser}
                onClose={() => setSelectedPaperId(null)}
                onOpenEditModal={() => setIsEditModalOpen(true)}
                onOpenClaimDialog={() => setClaimDialogPaper(selectedPaper)}
                onSaveToProject={() =>
                  setProjectModalState({
                    paper: selectedPaper,
                    initialMode: 'select',
                  })
                }
              />
            )}
          </>
        )}

        {mode === 'table' && (
          <>
            <TableView
              papers={visiblePapers}
              claims={claims}
              claimsNow={claimsNow}
              totalCorpusCount={allPapers.length}
              selectedPaperId={selectedPaper?.id || null}
              onSelectPaper={(id) => setSelectedPaperId(id)}
              onOpenInGraph={(id) => {
                setSelectedPaperId(id);
                setMode('graph');
              }}
              onResetFilters={() => {
                setFilters(DEFAULT_FILTERS);
                setScopedProjectId(null);
              }}
            />
            {selectedPaper && (
              <DetailPanel
                paper={selectedPaper}
                claims={claims}
                claimsNow={claimsNow}
                currentUser={currentUser}
                onClose={() => setSelectedPaperId(null)}
                onOpenEditModal={() => setIsEditModalOpen(true)}
                onOpenClaimDialog={() => setClaimDialogPaper(selectedPaper)}
                onSaveToProject={() =>
                  setProjectModalState({
                    paper: selectedPaper,
                    initialMode: 'select',
                  })
                }
              />
            )}
          </>
        )}

        {mode === 'ai' && (
          <AiView
            query={submittedQuery}
            filters={filters}
            papers={visiblePapers}
            allPapers={allPapers}
            claims={claims}
            claimsNow={claimsNow}
            selectedPaper={selectedPaper}
            currentUser={currentUser}
            conversations={conversations}
            activeConversationId={activeConversationId}
            projects={projects}
            activeProjectId={activeProjectId}
            highlightSection={aiHighlightSection}
            onSelectConversation={setActiveConversationId}
            onUpsertConversation={handleUpsertConversation}
            onDeleteConversation={handleDeleteConversation}
            onSelectPaper={(id) => setSelectedPaperId(id)}
            onOpenInGraph={(id) => {
              setSelectedPaperId(id);
              setMode('graph');
            }}
            onOpenInTable={(id) => {
              setSelectedPaperId(id);
              setMode('table');
            }}
            onOpenProjectModal={(paper, initialMode = 'select') =>
              setProjectModalState({ paper, initialMode })
            }
            onOpenClaimDialog={(paper) => setClaimDialogPaper(paper)}
            onClearFilters={() => {
              setFilters(DEFAULT_FILTERS);
              setScopedProjectId(null);
            }}
            onSelectProject={setActiveProjectId}
            onUpdateProjectNote={async (projectId, thesisId, note) => {
              const updated = await mutateProjectApi({
                action: 'upsert_thesis',
                projectId,
                thesisId,
                note,
              });
              setProjects(updated);
            }}
            onRemoveFromProject={async (projectId, thesisId) => {
              const updated = await mutateProjectApi({
                action: 'remove_thesis',
                projectId,
                thesisId,
              });
              setProjects(updated);
            }}
            onDeleteProject={async (projectId) => {
              const updated = await deleteProjectApi(projectId);
              setProjects(updated);
              if (activeProjectId === projectId) setActiveProjectId(null);
              if (scopedProjectId === projectId) setScopedProjectId(null);
            }}
            onOpenProjectInMode={(projectId, targetMode) => {
              setScopedProjectId(projectId);
              setMode(targetMode);
            }}
          />
        )}
      </main>
      </div>

      {/* Modals & Profile Drawer */}
      <AddThesisModal
        isOpen={isAddThesisOpen}
        onClose={() => setIsAddThesisOpen(false)}
        onAddedPapers={handleAddedPapers}
      />

      {isEditModalOpen && selectedPaper && (
        <EditVerifyModal
          paper={selectedPaper}
          currentUser={currentUser}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdatePaper}
        />
      )}

      {claimDialogPaper && (
        <ClaimGapDialog
          paper={claimDialogPaper}
          currentUser={currentUser}
          onClose={() => setClaimDialogPaper(null)}
          onClaimed={refreshClaims}
          onRequireAuth={() => setAuthModalMode('signin')}
        />
      )}

      {projectModalState && (
        <ProjectModal
          paper={projectModalState.paper}
          projects={projects}
          currentUser={currentUser}
          initialMode={projectModalState.initialMode}
          onClose={() => setProjectModalState(null)}
          onCreateProject={handleCreateProject}
          onSaveToExisting={handleSaveToExistingProject}
          onRequireAuth={() => setAuthModalMode('signin')}
        />
      )}

      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          onModeChange={setAuthModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={(payload) => {
            setCurrentUser(payload.user);
            setProjects(payload.projects);
            setConversations(payload.conversations);
            if (payload.projects.length > 0) {
              setActiveProjectId(payload.projects[0].id);
            }
          }}
        />
      )}

      {isProfileDrawerOpen && currentUser && (
        <ProfileDrawer
          user={currentUser}
          allPapers={allPapers}
          claims={claims}
          claimsNow={claimsNow}
          onClose={() => setIsProfileDrawerOpen(false)}
          onUserUpdated={setCurrentUser}
          onUpgradeClaim={async (claimId) => {
            await updateGapClaimApi(claimId, {
              action: 'upgrade',
              user_id: currentUser.id,
            });
            await refreshClaims();
          }}
          onReleaseClaim={async (claimId) => {
            await updateGapClaimApi(claimId, {
              action: 'release',
              user_id: currentUser.id,
            });
            await refreshClaims();
          }}
          onOpenThesisInGraph={(paperId) => {
            setSelectedPaperId(paperId);
            setMode('graph');
          }}
          onSignOutConfirmed={handleSignOut}
        />
      )}
    </div>
  );
}
