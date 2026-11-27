export type AppMode = 'graph' | 'table' | 'ai';

export type CategoryType =
  | 'problem'
  | 'method'
  | 'dataset'
  | 'key_findings'
  | 'future_work';

export type SimilarityTier = 'high' | 'medium' | 'low';

export type ThesisSourceType =
  | 'campus_repo'
  | 'open_access'
  | 'personal'
  | 'journal';

export type TableSortField = 'title' | 'year' | 'similarity' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface Paper {
  id: string;
  fileName: string;
  title: string;
  author: string;
  year: number;
  similarity: number; // 0 - 100
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  problem: string;
  method: string;
  dataset: string;
  limitation: string;
  keyFindings: string;
  futureWork: string;
  sourceUrl: string | null;
  sourceType: ThesisSourceType;
  university: string | null;
  uploadedBy: string | null;
}

export type PaperUpdatePayload = Partial<{
  title: string;
  author: string;
  year: number;
  problem: string;
  method: string;
  dataset: string;
  limitation: string;
  keyFindings: string;
  futureWork: string;
  verified: boolean;
  verifiedBy: string | null;
  sourceUrl: string | null;
}>;

export interface FilterState {
  year: number | 'all';
  verifiedOnly: boolean;
  availableGapsOnly: boolean;
}

export interface QueryNodeData extends Record<string, unknown> {
  query: string;
  resultCount: number;
}

export interface PaperNodeData extends Record<string, unknown> {
  paper: Paper;
  gapSummary: string;
  isSelected: boolean;
  isDimmed: boolean;
}

export interface CategoryNodeData extends Record<string, unknown> {
  paperId: string;
  category: CategoryType;
  text: string;
  sharedCount: number;
  isSelected: boolean;
  isDimmed: boolean;
}

export interface CurvedEdgeData extends Record<string, unknown> {
  label?: string;
  showLabel?: boolean;
  kind?: 'query' | 'similarity' | 'method' | 'entity';
  strength?: 'strong' | 'weak';
  isHighlighted: boolean;
  isDimmed: boolean;
  isHovered?: boolean;
}

export type AiFollowUpActionType =
  | 'open_graph'
  | 'open_table'
  | 'save_project'
  | 'view_gap'
  | 'claim_gap'
  | 'clear_filters';

export interface AiNextAction {
  label: string;
  type: AiFollowUpActionType;
  thesisId?: string;
}

export interface AiCitation {
  paperId: string;
  label: string;
  title: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  relatedThesisIds?: string[];
  nextActions?: AiNextAction[];
  createdAt: string;
}

export interface AiConversationRecord {
  id: string;
  title: string;
  queryContext: string;
  yearFilter: string;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectThesisEntry {
  thesisId: string;
  note: string;
  addedAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  items: ProjectThesisEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  institution: string;
  major: string;
  nim: string;
  researchInterests: string;
  uploadedThesisIds: string[];
  verifiedThesisIds: string[];
  claimedThesisIds: string[];
  createdAt: string;
}

export interface ProfileStats {
  savedThesesCount: number;
  projectsCount: number;
  claimedGapsCount: number;
}

export interface HarvestCandidate {
  externalId: string;
  title: string;
  author: string;
  year: number;
  university: string;
  abstract: string;
  sourceUrl: string;
  sourceType: ThesisSourceType;
}

export function getSimilarityMeta(similarity: number): {
  tier: SimilarityTier;
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  if (similarity >= 70) {
    return {
      tier: 'high',
      label: 'High',
      badgeClass: 'bg-[#E7F7EE] text-[#15803D] border-[#BEE8CF]',
      dotClass: 'bg-[#16A34A]',
    };
  }
  if (similarity >= 55) {
    return {
      tier: 'medium',
      label: 'Moderate',
      badgeClass: 'bg-[#FFF1E3] text-[#B45309] border-[#F8D3AA]',
      dotClass: 'bg-[#EA7A1A]',
    };
  }
  return {
    tier: 'low',
    label: 'Low',
    badgeClass: 'bg-[#EEF2F7] text-[#475569] border-[#DCE4F0]',
    dotClass: 'bg-[#64748B]',
  };
}

export function getSourceBadgeMeta(sourceType: ThesisSourceType): {
  label: string;
  className: string;
} {
  switch (sourceType) {
    case 'personal':
      return {
        label: 'Personal',
        className: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]',
      };
    case 'open_access':
      return {
        label: 'Open-Access API',
        className: 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]',
      };
    case 'journal':
      return {
        label: 'Journal',
        className: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]',
      };
    default:
      return {
        label: 'Campus Repo',
        className: 'border-[#DCE4F0] bg-[#F4F7FB] text-[#475569]',
      };
  }
}

export const CATEGORY_META: Record<
  CategoryType,
  {
    label: string;
    shortLabel: string;
    colorHex: string;
    textClass: string;
    borderHoverClass: string;
  }
> = {
  problem: {
    label: 'RESEARCH PROBLEM',
    shortLabel: 'Research Problem',
    colorHex: '#1E2A5A',
    textClass: 'text-[#1E2A5A]',
    borderHoverClass: 'hover:border-[#1E2A5A]/45',
  },
  method: {
    label: 'METHODOLOGY',
    shortLabel: 'Methodology',
    colorHex: '#7C3AED',
    textClass: 'text-[#7C3AED]',
    borderHoverClass: 'hover:border-[#7C3AED]/45',
  },
  dataset: {
    label: 'DATASET / OBJECT',
    shortLabel: 'Dataset / Object',
    colorHex: '#0D9488',
    textClass: 'text-[#0F766E]',
    borderHoverClass: 'hover:border-[#0D9488]/45',
  },
  key_findings: {
    label: 'KEY FINDINGS',
    shortLabel: 'Key Findings',
    colorHex: '#EA580C',
    textClass: 'text-[#C2410C]',
    borderHoverClass: 'hover:border-[#EA580C]/45',
  },
  future_work: {
    label: 'RESEARCH GAP / FUTURE WORK',
    shortLabel: 'Research Gap',
    colorHex: '#4F46E5',
    textClass: 'text-[#4F46E5]',
    borderHoverClass: 'hover:border-[#4F46E5]/45',
  },
};
