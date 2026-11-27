'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  Copy,
  FolderKanban,
  GitFork,
  Hand,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { askAiAssistantApi } from '@/lib/api';
import {
  getActiveClaimsForThesis,
  getThesisGapSummary,
  type GapClaim,
} from '@/lib/claims';
import type {
  AiConversationRecord,
  AiMessage,
  AiNextAction,
  FilterState,
  Paper,
  ProjectRecord,
  UserProfile,
} from '@/types';

interface AiViewProps {
  query: string;
  filters: FilterState;
  papers: Paper[];
  allPapers: Paper[];
  claims: GapClaim[];
  claimsNow: number;
  selectedPaper: Paper | null;
  currentUser: UserProfile | null;
  conversations: AiConversationRecord[];
  activeConversationId: string | null;
  projects: ProjectRecord[];
  activeProjectId: string | null;
  highlightSection?: 'projects' | 'history' | null;
  onSelectConversation: (convId: string | null) => void;
  onUpsertConversation: (conv: AiConversationRecord) => Promise<void>;
  onDeleteConversation: (convId: string) => Promise<void>;
  onSelectPaper: (paperId: string | null) => void;
  onOpenInGraph: (paperId: string) => void;
  onOpenInTable: (paperId: string) => void;
  onOpenProjectModal: (paper: Paper | null, initialMode?: 'select' | 'create') => void;
  onOpenClaimDialog: (paper: Paper) => void;
  onClearFilters: () => void;
  onSelectProject: (projectId: string | null) => void;
  onUpdateProjectNote: (projectId: string, thesisId: string, note: string) => Promise<void>;
  onRemoveFromProject: (projectId: string, thesisId: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onOpenProjectInMode: (projectId: string, targetMode: 'graph' | 'table') => void;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDateBucket(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const ts = date.getTime();
  if (ts >= startOfToday) return 'Today';
  if (ts >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

const SUGGESTION_PROMPTS = [
  'Which research gaps remain open across these theses?',
  'Compare methodologies used across the top theses.',
  'Summarize key datasets and findings in this collection.',
];

export function AiView({
  query,
  filters,
  papers,
  allPapers,
  claims,
  claimsNow,
  selectedPaper,
  conversations,
  activeConversationId,
  projects,
  activeProjectId,
  highlightSection,
  onSelectConversation,
  onUpsertConversation,
  onDeleteConversation,
  onSelectPaper,
  onOpenInGraph,
  onOpenInTable,
  onOpenProjectModal,
  onOpenClaimDialog,
  onClearFilters,
  onSelectProject,
  onUpdateProjectNote,
  onRemoveFromProject,
  onDeleteProject,
  onOpenProjectInMode,
}: AiViewProps) {
  const [searchConv, setSearchConv] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Local ephemeral thread when user hasn't started or saved one yet
  const [draftMessages, setDraftMessages] = useState<AiMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const paperById = useMemo(
    () => new Map(allPapers.map((p) => [p.id, p])),
    [allPapers]
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const displayedMessages = activeConversation
    ? activeConversation.messages
    : draftMessages;

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages.length, isSending]);

  const filteredConversations = useMemo(() => {
    const q = searchConv.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [conversations, searchConv]);

  const groupedConversations = useMemo(() => {
    const groups: Record<'Today' | 'Yesterday' | 'Earlier', AiConversationRecord[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const conv of filteredConversations) {
      groups[getDateBucket(conv.updatedAt || conv.createdAt)].push(conv);
    }
    return groups;
  }, [filteredConversations]);

  const handleNewChat = () => {
    onSelectConversation(null);
    setDraftMessages([]);
    setErrorMsg(null);
  };

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? inputValue).trim();
    if (!text || isSending) return;

    setInputValue('');
    setErrorMsg(null);

    const userMsg: AiMessage = {
      id: makeUuid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...displayedMessages, userMsg];
    if (!activeConversation) {
      setDraftMessages(nextHistory);
    }

    setIsSending(true);
    try {
      const response = await askAiAssistantApi({
        message: text,
        selectedThesisId: selectedPaper?.id || null,
        queryContext: query,
        yearFilter: filters.year,
        verifiedOnly: filters.verifiedOnly,
        availableGapsOnly: filters.availableGapsOnly,
        projectThesisIds: activeProject
          ? activeProject.items.map((i) => i.thesisId)
          : null,
        history: displayedMessages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMsg: AiMessage = {
        id: makeUuid(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        relatedThesisIds: response.relatedThesisIds,
        nextActions: response.nextActions,
        createdAt: new Date().toISOString(),
      };

      const fullMessages = [...nextHistory, assistantMsg];
      const now = new Date().toISOString();
      const convPayload: AiConversationRecord = activeConversation
        ? {
            ...activeConversation,
            queryContext: query,
            yearFilter: String(filters.year),
            messages: fullMessages,
            updatedAt: now,
          }
        : {
            id: makeUuid(),
            title: text.length > 52 ? `${text.slice(0, 52)}...` : text,
            queryContext: query,
            yearFilter: String(filters.year),
            messages: fullMessages,
            createdAt: now,
            updatedAt: now,
          };

      setDraftMessages(fullMessages);
      await onUpsertConversation(convPayload);
    } catch (err) {
      setErrorMsg((err as Error).message || 'AI Assistant could not answer right now.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = async (msgId: string, content: string) => {
    const clean = content.replace(/\[\[cite:[^\]]+\]\]/g, '').trim();
    await navigator.clipboard?.writeText(clean).catch(() => {});
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const handleActionClick = (action: AiNextAction) => {
    const targetPaper = action.thesisId ? paperById.get(action.thesisId) : selectedPaper;
    switch (action.type) {
      case 'open_graph':
        if (targetPaper) onOpenInGraph(targetPaper.id);
        break;
      case 'open_table':
        if (targetPaper) onOpenInTable(targetPaper.id);
        break;
      case 'save_project':
        onOpenProjectModal(targetPaper || null, 'select');
        break;
      case 'view_gap':
        if (targetPaper) onOpenInGraph(targetPaper.id);
        break;
      case 'claim_gap':
        if (targetPaper) onOpenClaimDialog(targetPaper);
        break;
      case 'clear_filters':
        onClearFilters();
        break;
    }
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[\[cite:[^\]]+\]\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[\[cite:([^\]]+)\]\]$/);
      if (!match) {
        return (
          <span key={idx} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      }
      const thesis = paperById.get(match[1].trim());
      if (!thesis) return null;
      return (
        <button
          key={idx}
          type="button"
          onClick={() => onSelectPaper(thesis.id)}
          title={thesis.title}
          className="mx-1 inline-flex items-center rounded-md border border-[#BFDBFE] bg-[#EAF1FE] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer align-baseline"
        >
          {thesis.year} · {thesis.fileName}
        </button>
      );
    });
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-transparent">
      {/* Left Sidebar: Chat History & Projects */}
      <aside className="hidden w-[270px] shrink-0 flex-col border-r border-[#DCE4F0] bg-white md:flex">
        <div className="border-b border-[#DCE4F0] p-3">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1E2A5A] px-3 text-[12.5px] font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          <div className="relative mt-2.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8A97AB]" />
            <input
              type="text"
              value={searchConv}
              onChange={(e) => setSearchConv(e.target.value)}
              placeholder="Search conversations..."
              className="h-8 w-full rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] pl-8 pr-2.5 text-[12px] text-[#0F172A] placeholder:text-[#8A97AB] focus:border-[#1E2A5A] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div
          className={`flex-1 overflow-y-auto p-2.5 space-y-3 ${
            highlightSection === 'history' ? 'ring-2 ring-inset ring-[#1E2A5A]/30' : ''
          }`}
        >
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DCE4F0] px-3 py-6 text-center">
              <MessageSquare className="h-5 w-5 text-[#8A97AB]" />
              <div className="mt-2 text-[12px] font-medium text-[#5B6B82]">
                No conversations yet
              </div>
              <p className="mt-0.5 text-[11px] text-[#8A97AB]">
                Ask a research question to start a grounded thread.
              </p>
            </div>
          ) : (
            (['Today', 'Yesterday', 'Earlier'] as const).map((bucket) => {
              const items = groupedConversations[bucket];
              if (items.length === 0) return null;
              return (
                <div key={bucket}>
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8A97AB]">
                    {bucket}
                  </div>
                  <div className="space-y-1">
                    {items.map((conv) => {
                      const isActive = conv.id === activeConversation?.id;
                      return (
                        <div
                          key={conv.id}
                          onClick={() => onSelectConversation(conv.id)}
                          className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12px] transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#EAF1FE] font-semibold text-[#1D4ED8]'
                              : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{conv.title}</div>
                            <div className="text-[10.5px] font-normal text-[#8A97AB]">
                              {conv.messages.length} messages
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            aria-label="Delete conversation"
                            className="hidden rounded p-1 text-[#8A97AB] hover:bg-white hover:text-[#DC2626] group-hover:block cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Projects Section */}
        <div
          className={`border-t border-[#DCE4F0] p-3 ${
            highlightSection === 'projects' ? 'bg-[#EAF1FE]/40' : 'bg-[#F8FAFC]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6B82]">
              Projects
            </span>
            <button
              type="button"
              onClick={() => onOpenProjectModal(null, 'create')}
              className="text-[11px] font-semibold text-[#1E2A5A] hover:underline cursor-pointer"
            >
              + New Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-[#DCE4F0] bg-white px-3 py-2.5 text-center text-[11.5px] text-[#8A97AB]">
              No projects yet
            </div>
          ) : (
            <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto pr-0.5">
              {projects.map((proj) => {
                const isSelected = proj.id === activeProjectId;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() =>
                      onSelectProject(isSelected ? null : proj.id)
                    }
                    className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#1E2A5A] bg-[#EAF1FE] text-[#1D4ED8]'
                        : 'border-[#DCE4F0] bg-white text-[#0F172A] hover:border-[#1E2A5A]/40'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-[#1E2A5A]" />
                      <span className="truncate font-medium">{proj.name}</span>
                    </div>
                    <span className="ml-2 shrink-0 text-[10.5px] font-medium text-[#5B6B82]">
                      {proj.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Center Conversation Panel */}
      <section className="flex flex-1 flex-col min-w-0">
        {/* Active Context Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#DCE4F0]/60 bg-transparent px-4 py-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#5B6B82]">
            ACTIVE CONTEXT:
          </span>
          {query.trim() && (
            <span className="rounded-full bg-[#1E2A5A] px-2.5 py-0.5 text-[11px] font-medium text-white">
              Query: {query}
            </span>
          )}
          <span className="rounded-full border border-[#DCE4F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#0F172A]">
            Year: {filters.year === 'all' ? 'All Years' : filters.year}
          </span>
          <span className="rounded-full border border-[#BFDBFE] bg-[#EAF1FE] px-2.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
            {papers.length} active {papers.length === 1 ? 'thesis' : 'theses'}
          </span>
          {activeProject && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EAF1FE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
              <FolderKanban className="h-3 w-3" />
              <span>Project: {activeProject.name}</span>
            </span>
          )}
        </div>

        {/* Scrollable Chat Messages */}
        <div className="flex-1 overflow-y-auto bg-transparent px-4 py-5 lg:px-8">
          <div className="mx-auto max-w-[780px] space-y-5">
            {displayedMessages.length === 0 ? (
              <div className="rounded-2xl border border-[#DCE4F0] bg-white p-6 text-center shadow-2xs">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1FE] text-[#1E2A5A]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-[16px] font-bold text-[#0F172A]">
                  NexusGraph Research Assistant
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B6B82] max-w-lg mx-auto">
                  Ask questions grounded strictly in your active Supabase theses. I will
                  synthesize answers with inline citations, related thesis cards, and
                  concrete next steps.
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTION_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] px-3.5 py-2 text-[12px] font-medium text-[#0F172A] transition-colors hover:border-[#1E2A5A] hover:bg-[#EAF1FE] hover:text-[#1D4ED8] cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              displayedMessages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#1E2A5A] px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-xs">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const relatedList = (msg.relatedThesisIds || [])
                  .map((id) => paperById.get(id))
                  .filter((p): p is Paper => Boolean(p));
                const primaryRelated = relatedList[0] || null;

                return (
                  <div
                    key={msg.id}
                    className="rounded-2xl border border-[#DCE4F0] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] space-y-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-[#1E2A5A]">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>NexusGraph AI Assistant</span>
                        <span className="font-normal text-[#8A97AB]">
                          · Grounded in Supabase
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#DCE4F0] px-2 py-1 text-[11px] font-medium text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#16A34A]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Grounded Content with Interactive Citations */}
                    <div className="text-[13px] leading-[1.65] text-[#0F172A]">
                      {renderMessageContent(msg.content)}
                    </div>

                    {/* Related Thesis Card(s) */}
                    {relatedList.length > 0 && (
                      <div className="space-y-2">
                        {relatedList.slice(0, 2).map((rel) => (
                          <div
                            key={rel.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6B82]">
                                Related Thesis
                              </div>
                              <div className="mt-0.5 text-[12.5px] font-bold text-[#0F172A] truncate">
                                {rel.title}
                              </div>
                              <div className="mt-0.5 text-[11px] text-[#5B6B82]">
                                {rel.author} · {rel.year} ·{' '}
                                {getThesisGapSummary(
                                  getActiveClaimsForThesis(claims, rel.id, claimsNow),
                                  claimsNow
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenProjectModal(rel, 'select')}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DCE4F0] bg-white px-2.5 text-[11px] font-medium text-[#0F172A] hover:border-[#1E2A5A] cursor-pointer"
                              >
                                <BookmarkPlus className="h-3 w-3 text-[#1E2A5A]" />
                                <span>Save to Project</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInGraph(rel.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#EAF1FE] px-2.5 text-[11px] font-semibold text-[#1E2A5A] hover:bg-[#DBEAFE] cursor-pointer"
                              >
                                <GitFork className="h-3 w-3" />
                                <span>Open in Graph</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInTable(rel.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DCE4F0] bg-white px-2.5 text-[11px] font-medium text-[#5B6B82] hover:text-[#0F172A] cursor-pointer"
                              >
                                <Table2 className="h-3 w-3" />
                                <span>Open in Table</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Bar below AI Answer */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF2F7] pt-2.5">
                      {primaryRelated && (
                        <button
                          type="button"
                          onClick={() => onOpenClaimDialog(primaryRelated)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#F5D77A] bg-[#FFF9E6] px-2.5 text-[11px] font-semibold text-[#B45309] hover:bg-[#FEF3C7] cursor-pointer"
                        >
                          <Hand className="h-3 w-3" />
                          <span>Set as Research Gap</span>
                        </button>
                      )}
                      {primaryRelated && (
                        <button
                          type="button"
                          onClick={() => onOpenProjectModal(primaryRelated, 'select')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[11px] font-medium text-[#0F172A] hover:bg-[#F4F7FB] cursor-pointer"
                        >
                          <BookmarkPlus className="h-3 w-3 text-[#1E2A5A]" />
                          <span>Save to Project</span>
                        </button>
                      )}
                    </div>

                    {/* Where to go next? */}
                    {msg.nextActions && msg.nextActions.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-semibold text-[#5B6B82]">
                          Where to go next?
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {msg.nextActions.map((act, idx) => (
                            <button
                              key={`${act.label}-${idx}`}
                              type="button"
                              onClick={() => handleActionClick(act)}
                              className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EAF1FE]/70 px-3 py-1 text-[11.5px] font-medium text-[#1D4ED8] hover:bg-[#DBEAFE] cursor-pointer"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#DCE4F0] bg-white px-4 py-2.5 text-[12.5px] text-[#5B6B82] shadow-2xs">
                <Loader2 className="h-4 w-4 animate-spin text-[#1E2A5A]" />
                <span>Analyzing grounded Supabase theses...</span>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[12px] text-[#B91C1C]">
                {errorMsg}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom Chat Composer */}
        <div className="border-t border-[#DCE4F0]/60 bg-transparent px-4 py-3 lg:px-8">
          <div className="mx-auto max-w-[780px] space-y-2">
            {selectedPaper && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#BFDBFE] bg-[#EAF1FE]/60 px-3 py-1.5 text-[11.5px] text-[#1D4ED8]">
                <span className="truncate">
                  <strong>Focused Thesis:</strong> {selectedPaper.title}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectPaper(null)}
                  aria-label="Clear focused thesis"
                  className="shrink-0 rounded p-0.5 hover:bg-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about research gaps, methodologies, or thesis comparisons..."
                className="h-10 flex-1 rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] px-4 text-[13px] text-[#0F172A] placeholder:text-[#8A97AB] focus:border-[#1E2A5A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2A5A]/15"
              />
              <button
                type="submit"
                disabled={isSending || !inputValue.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E2A5A] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Right Project Workspace Panel */}
      {activeProject && (
        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-[#DCE4F0] bg-white lg:flex">
          <div className="flex items-start justify-between border-b border-[#DCE4F0] p-4">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#1E2A5A]">
                ACTIVE PROJECT
              </div>
              <h3 className="mt-0.5 truncate text-[15px] font-bold text-[#0F172A]">
                {activeProject.name}
              </h3>
              <p className="text-[11.5px] text-[#5B6B82]">
                {activeProject.items.length} saved{' '}
                {activeProject.items.length === 1 ? 'thesis' : 'theses'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDeleteProject(activeProject.id)}
                title="Delete project"
                aria-label="Delete project"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#8A97AB] hover:border-[#FECACA] hover:text-[#DC2626] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectProject(null)}
                aria-label="Close project panel"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Scoped Workspace Switcher */}
          <div className="grid grid-cols-2 gap-2 border-b border-[#DCE4F0] bg-[#F8FAFC] p-3">
            <button
              type="button"
              disabled={activeProject.items.length === 0}
              onClick={() => onOpenProjectInMode(activeProject.id, 'graph')}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white text-[12px] font-semibold text-[#1E2A5A] hover:border-[#1E2A5A] disabled:opacity-45 cursor-pointer"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>Graph Scope</span>
            </button>
            <button
              type="button"
              disabled={activeProject.items.length === 0}
              onClick={() => onOpenProjectInMode(activeProject.id, 'table')}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white text-[12px] font-semibold text-[#0F172A] hover:border-[#1E2A5A] disabled:opacity-45 cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Table Scope</span>
            </button>
          </div>

          {/* Project Theses & Notes */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {activeProject.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#DCE4F0] p-4 text-center text-[12px] text-[#8A97AB]">
                No theses saved to this project yet. Use &ldquo;Save to Project&rdquo; from
                Graph, Detail, or AI answers.
              </p>
            ) : (
              activeProject.items.map((item) => {
                const thesis = paperById.get(item.thesisId);
                if (!thesis) return null;
                const editKey = `${activeProject.id}:${item.thesisId}`;
                const isEditingNote = editingNoteKey === editKey;

                return (
                  <div
                    key={item.thesisId}
                    className="rounded-xl border border-[#DCE4F0] bg-white p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#5B6B82]">
                      <span>
                        {thesis.year} · {thesis.author}
                      </span>
                      <span className="font-semibold text-[#15803D]">
                        {thesis.similarity.toFixed(0)}%
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenInGraph(thesis.id)}
                      className="text-left text-[12.5px] font-bold text-[#0F172A] hover:text-[#1E2A5A] line-clamp-2 cursor-pointer"
                    >
                      {thesis.title}
                    </button>

                    {isEditingNote ? (
                      <div className="space-y-1.5">
                        <textarea
                          rows={2}
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Add personal research note..."
                          className="w-full rounded-lg border border-[#1E2A5A] px-2.5 py-1.5 text-[11.5px] text-[#0F172A] focus:outline-none"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingNoteKey(null)}
                            className="rounded px-2 py-1 text-[11px] text-[#5B6B82] hover:bg-[#F4F7FB] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await onUpdateProjectNote(
                                activeProject.id,
                                item.thesisId,
                                noteDraft.trim()
                              );
                              setEditingNoteKey(null);
                            }}
                            className="rounded bg-[#1E2A5A] px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingNoteKey(editKey);
                          setNoteDraft(item.note);
                        }}
                        className="rounded-lg border border-[#F5D77A] bg-[#FFF9E6]/70 px-2.5 py-2 text-[11.5px] text-[#5B6B82] cursor-pointer hover:bg-[#FEF3C7]/40"
                      >
                        {item.note ? (
                          <span>Note: {item.note}</span>
                        ) : (
                          <span className="italic text-[#8A97AB]">
                            Click to add a personal research note...
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveFromProject(activeProject.id, item.thesisId)}
                      className="text-[11px] font-medium text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Remove from project
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
