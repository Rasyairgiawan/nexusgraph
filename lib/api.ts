import type { GapClaimWithMeta } from '@/lib/claims';
import type {
  AiCitation,
  AiConversationRecord,
  AiNextAction,
  HarvestCandidate,
  Paper,
  PaperUpdatePayload,
  ProjectRecord,
  ThesisSourceType,
  UserProfile,
} from '@/types';

export interface ApiThesisRecord {
  id: string;
  file_name: string;
  title: string;
  author: string;
  year: number;
  problem: string;
  method: string;
  dataset: string;
  limitation: string;
  key_findings?: string | null;
  future_work: string;
  is_verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  uploaded_by?: string | null;
  university?: string | null;
  similarity?: number;
}

function normalizeSourceType(val: string | null | undefined): ThesisSourceType {
  if (val === 'personal' || val === 'open_access' || val === 'journal' || val === 'campus_repo') {
    return val;
  }
  return 'campus_repo';
}

export function mapApiRecordToPaper(
  record: ApiThesisRecord,
  fallbackSimilarity = 68
): Paper {
  const rawSim = record.similarity;
  const normalizedSim =
    typeof rawSim === 'number'
      ? Number((rawSim <= 1 ? rawSim * 100 : rawSim).toFixed(1))
      : fallbackSimilarity;

  const keyFindings = record.key_findings || record.limitation || '';

  return {
    id: record.id,
    fileName: record.file_name,
    title: record.title,
    author: record.author || 'Anonymous Researcher',
    year: record.year || new Date().getFullYear(),
    similarity: normalizedSim,
    verified: Boolean(record.is_verified),
    verifiedBy: record.verified_by ?? null,
    verifiedAt: record.verified_at ?? null,
    problem: record.problem || '',
    method: record.method || '',
    dataset: record.dataset || '',
    limitation: record.limitation || keyFindings,
    keyFindings,
    futureWork: record.future_work || '',
    sourceUrl: record.source_url ?? null,
    sourceType: normalizeSourceType(record.source_type),
    university: record.university ?? null,
    uploadedBy: record.uploaded_by ?? null,
  };
}

export function mapPaperPayloadToApi(
  payload: PaperUpdatePayload
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if ('title' in payload) mapped.title = payload.title;
  if ('author' in payload) mapped.author = payload.author;
  if ('year' in payload) mapped.year = payload.year;
  if ('problem' in payload) mapped.problem = payload.problem;
  if ('method' in payload) mapped.method = payload.method;
  if ('dataset' in payload) mapped.dataset = payload.dataset;
  if ('limitation' in payload) mapped.limitation = payload.limitation;
  if ('keyFindings' in payload) mapped.key_findings = payload.keyFindings;
  if ('futureWork' in payload) mapped.future_work = payload.futureWork;
  if ('verified' in payload) mapped.is_verified = payload.verified;
  if ('verifiedBy' in payload) mapped.verified_by = payload.verifiedBy;
  if ('sourceUrl' in payload) mapped.source_url = payload.sourceUrl;
  return mapped;
}

export async function fetchAllPapersFromApi(): Promise<Paper[]> {
  const res = await fetch('/api/search', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load theses from /api/search.');
  }
  const results: ApiThesisRecord[] = Array.isArray(data.results) ? data.results : [];
  return results.map((item) => mapApiRecordToPaper(item, 68));
}

export async function searchPapersFromApi(
  query: string,
  threshold = 0.45,
  count = 20
): Promise<Paper[]> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, threshold, count }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Semantic search failed.');
  }
  const results: ApiThesisRecord[] = Array.isArray(data.results) ? data.results : [];
  return results.map((item) => mapApiRecordToPaper(item));
}

export async function updatePaperViaApi(
  id: string,
  payload: PaperUpdatePayload
): Promise<Paper> {
  const apiBody = mapPaperPayloadToApi(payload);
  const res = await fetch(`/api/theses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiBody),
  });
  const data = await res.json();
  if (!res.ok || !data.result) {
    throw new Error(data.error || 'Failed to update thesis record.');
  }
  return mapApiRecordToPaper(data.result);
}

export async function fetchAuthSessionApi(): Promise<{
  user: UserProfile | null;
  projects: ProjectRecord[];
  conversations: AiConversationRecord[];
}> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to read session.');
  }
  return {
    user: data.user || null,
    projects: Array.isArray(data.projects) ? data.projects : [],
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
  };
}

export async function signInApi(payload: {
  email: string;
  password: string;
}): Promise<{
  user: UserProfile;
  projects: ProjectRecord[];
  conversations: AiConversationRecord[];
}> {
  const res = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.user) {
    throw new Error(data.error || 'Sign In failed.');
  }
  return {
    user: data.user,
    projects: Array.isArray(data.projects) ? data.projects : [],
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
  };
}

export async function signUpApi(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  institution: string;
  major: string;
  nim: string;
  researchInterests: string;
  acceptedTerms: boolean;
}): Promise<{ user: UserProfile }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.user) {
    throw new Error(data.error || 'Sign Up failed.');
  }
  return { user: data.user };
}

export async function signOutApi(): Promise<void> {
  await fetch('/api/auth/signout', { method: 'POST' });
}

export async function forgotPasswordApi(email: string): Promise<string> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Password reset request failed.');
  }
  return data.message || 'Password reset link sent.';
}

export async function updateProfileApi(payload: {
  fullName?: string;
  institution?: string;
  major?: string;
  nim?: string;
  researchInterests?: string;
}): Promise<UserProfile> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.user) {
    throw new Error(data.error || 'Failed to update profile.');
  }
  return data.user;
}

export async function createProjectApi(payload: {
  name: string;
  description?: string;
  thesisId?: string;
  note?: string;
}): Promise<{ projectId: string; projects: ProjectRecord[] }> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create project.');
  }
  return {
    projectId: data.projectId,
    projects: Array.isArray(data.projects) ? data.projects : [],
  };
}

export async function mutateProjectApi(payload: {
  action: 'upsert_thesis' | 'remove_thesis' | 'rename';
  projectId: string;
  thesisId?: string;
  note?: string;
  name?: string;
  description?: string;
}): Promise<ProjectRecord[]> {
  const res = await fetch('/api/projects', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update project.');
  }
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function deleteProjectApi(projectId: string): Promise<ProjectRecord[]> {
  const res = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete project.');
  }
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function saveConversationApi(
  conversation: AiConversationRecord
): Promise<{ conversations: AiConversationRecord[]; savedId: string }> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save conversation.');
  }
  return {
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    savedId: data.savedId || conversation.id,
  };
}

export async function deleteConversationApi(
  id: string
): Promise<AiConversationRecord[]> {
  const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete conversation.');
  }
  return Array.isArray(data.conversations) ? data.conversations : [];
}

export async function askAiAssistantApi(payload: {
  message: string;
  selectedThesisId?: string | null;
  queryContext?: string;
  yearFilter?: number | 'all';
  verifiedOnly?: boolean;
  availableGapsOnly?: boolean;
  projectThesisIds?: string[] | null;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{
  answer: string;
  citations: AiCitation[];
  relatedThesisIds: string[];
  nextActions: AiNextAction[];
}> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'AI Assistant error.');
  }
  return {
    answer: data.answer || '',
    citations: Array.isArray(data.citations) ? data.citations : [],
    relatedThesisIds: Array.isArray(data.relatedThesisIds) ? data.relatedThesisIds : [],
    nextActions: Array.isArray(data.nextActions) ? data.nextActions : [],
  };
}

export async function streamIngestPdfApi(
  file: File,
  sourceUrl: string,
  onEvent: (evt: {
    type: 'progress' | 'complete' | 'error';
    step?: number;
    label?: string;
    stage?: string;
    error?: string;
    thesis?: ApiThesisRecord;
  }) => void
): Promise<Paper> {
  const form = new FormData();
  form.append('file', file);
  if (sourceUrl.trim()) {
    form.append('sourceUrl', sourceUrl.trim());
  }

  const res = await fetch('/api/ingest', {
    method: 'POST',
    body: form,
  });

  if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const errData = await res.json();
    throw new Error(errData.error || 'PDF upload failed.');
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response unavailable.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let resultPaper: Paper | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const evt = JSON.parse(trimmed);
      onEvent(evt);
      if (evt.type === 'error') {
        throw new Error(evt.error || 'Ingest failed.');
      }
      if (evt.type === 'complete' && evt.thesis) {
        resultPaper = mapApiRecordToPaper(evt.thesis, 85);
      }
    }
  }

  if (!resultPaper) {
    throw new Error('PDF processing ended without returning a thesis record.');
  }
  return resultPaper;
}

export async function harvestExternalApi(payload: {
  sourceType: 'oai_pmh' | 'openalex';
  query: string;
  oaiUrl: string;
  limit: number;
}): Promise<HarvestCandidate[]> {
  const res = await fetch('/api/harvest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Harvest preview failed.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export async function streamHarvestIngestApi(
  items: HarvestCandidate[],
  onEvent: (evt: {
    type: 'progress' | 'complete' | 'error';
    stage?: string;
    label?: string;
    current?: number;
    total?: number;
    title?: string;
    error?: string;
  }) => void
): Promise<{ imported: Paper[]; skipped: string[] }> {
  const res = await fetch('/api/harvest/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const errData = await res.json();
    throw new Error(errData.error || 'Import failed.');
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response unavailable.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let imported: Paper[] = [];
  let skipped: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const evt = JSON.parse(trimmed);
      onEvent(evt);
      if (evt.type === 'error') {
        throw new Error(evt.error || 'Harvest import failed.');
      }
      if (evt.type === 'complete') {
        const rawList: ApiThesisRecord[] = Array.isArray(evt.theses) ? evt.theses : [];
        imported = rawList.map((r) => mapApiRecordToPaper(r, 82));
        skipped = Array.isArray(evt.skipped) ? evt.skipped : [];
      }
    }
  }

  return { imported, skipped };
}

export async function fetchGapClaimsApi(params?: {
  thesisId?: string;
  userId?: string;
}): Promise<GapClaimWithMeta[]> {
  const qs = new URLSearchParams();
  if (params?.thesisId) qs.set('thesis_id', params.thesisId);
  if (params?.userId) qs.set('user_id', params.userId);
  const query = qs.toString();
  const res = await fetch(`/api/claims${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load gap claims.');
  }
  return Array.isArray(data) ? data : [];
}

export async function createGapClaimApi(payload: {
  thesis_id: string;
  user_id: string;
  user_name: string;
  planned_angle: string;
}): Promise<GapClaimWithMeta> {
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create research gap claim.');
  }
  return data;
}

export async function updateGapClaimApi(
  claimId: string,
  payload: { action: 'upgrade' | 'release'; user_id: string }
): Promise<GapClaimWithMeta> {
  const res = await fetch(`/api/claims/${encodeURIComponent(claimId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update research gap claim.');
  }
  return data;
}

