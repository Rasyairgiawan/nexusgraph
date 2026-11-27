import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import type { GapClaim, GapClaimStatus } from '@/lib/claims';
import type {
  AiConversationRecord,
  ProjectRecord,
  ThesisSourceType,
  UserProfile,
} from '@/types';

export const ACCESS_COOKIE = 'ng_sb_access';
export const REFRESH_COOKIE = 'ng_sb_refresh';

export const BASE_THESIS_SELECT =
  'id, file_name, title, author, year, problem, method, dataset, limitation, future_work, is_verified, gap_claimed_by, gap_claimed_at';

export const EXTENDED_THESIS_SELECT =
  'id, file_name, title, author, year, problem, method, dataset, limitation, key_findings, future_work, is_verified, verified_by, verified_by_user_id, verified_at, source_url, source_type, uploaded_by, university, created_at';

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }
  return { url, anonKey: anonKey || serviceKey || '', serviceKey: serviceKey || anonKey || '' };
}

export function getAdminSupabase(): SupabaseClient {
  const { url, serviceKey } = getSupabaseEnv();
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonSupabase(): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variable.');
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: string; message?: string; details?: string };
  const code = record.code || '';
  const msg = `${record.message || ''} ${record.details || ''}`.toLowerCase();
  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42883' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the')
  );
}

export function setAuthCookies(
  res: NextResponse,
  session: { access_token: string; refresh_token?: string | null; expires_in?: number }
) {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = Math.max(session.expires_in ?? 3600, 3600);
  res.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge,
  });
  if (session.refresh_token) {
    res.cookies.set(REFRESH_COOKIE, session.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

export interface AuthSessionResult {
  user: User | null;
  refreshedSession: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  } | null;
}

export async function getAuthenticatedSession(req: NextRequest): Promise<AuthSessionResult> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return { user: null, refreshedSession: null };
  }

  const admin = getAdminSupabase();
  if (accessToken) {
    const { data, error } = await admin.auth.getUser(accessToken);
    if (!error && data.user) {
      return { user: data.user, refreshedSession: null };
    }
  }

  if (refreshToken) {
    const anon = getAnonSupabase();
    const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.user && data.session) {
      return {
        user: data.user,
        refreshedSession: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        },
      };
    }
  }

  return { user: null, refreshedSession: null };
}

export function attachRefreshedCookies(
  res: NextResponse,
  refreshedSession: AuthSessionResult['refreshedSession']
) {
  if (refreshedSession) {
    setAuthCookies(res, refreshedSession);
  }
  return res;
}

export interface RawThesisRow {
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
  verified_by_user_id?: string | null;
  verified_at?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  uploaded_by?: string | null;
  university?: string | null;
  gap_status?: string | null;
  gap_claimed_by: string | null;
  gap_claimed_at: string | null;
  gap_claimed_topic?: string | null;
  gap_claimed_nim?: string | null;
  created_at?: string | null;
  similarity?: number;
}

export async function fetchAllThesesSafe(): Promise<RawThesisRow[]> {
  const admin = getAdminSupabase();
  const extended = await admin
    .from('theses')
    .select(EXTENDED_THESIS_SELECT)
    .order('year', { ascending: false });

  if (!extended.error) {
    return (extended.data || []) as RawThesisRow[];
  }

  if (!isSchemaMissingError(extended.error)) {
    throw extended.error;
  }

  const base = await admin
    .from('theses')
    .select(BASE_THESIS_SELECT)
    .order('year', { ascending: false });

  if (base.error) {
    throw base.error;
  }
  return (base.data || []) as RawThesisRow[];
}

export async function fetchThesisByIdSafe(id: string): Promise<RawThesisRow | null> {
  const admin = getAdminSupabase();
  const extended = await admin
    .from('theses')
    .select(EXTENDED_THESIS_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (!extended.error) {
    return (extended.data as RawThesisRow) || null;
  }

  if (!isSchemaMissingError(extended.error)) {
    throw extended.error;
  }

  const base = await admin
    .from('theses')
    .select(BASE_THESIS_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (base.error) {
    throw base.error;
  }
  return (base.data as RawThesisRow) || null;
}

export interface ExtendedMetaEntry {
  sourceUrl?: string | null;
  sourceType?: ThesisSourceType;
  verifiedBy?: string | null;
  university?: string | null;
  gapClaimedTopic?: string | null;
  gapClaimedNim?: string | null;
}

function getMetadataRecord(user: User) {
  return (user.user_metadata || {}) as Record<string, unknown>;
}

function stringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((item): item is string => typeof item === 'string') : [];
}

export async function getUserProfileRecord(user: User): Promise<UserProfile> {
  const meta = getMetadataRecord(user);
  let fullName = typeof meta.full_name === 'string' ? meta.full_name : '';
  let institution = typeof meta.institution === 'string' ? meta.institution : '';
  let major = typeof meta.major === 'string' ? meta.major : '';
  let nim = typeof meta.nim === 'string' ? meta.nim : '';
  let researchInterests =
    typeof meta.research_interests === 'string' ? meta.research_interests : '';

  const admin = getAdminSupabase();
  const { data: profileRow, error } = await admin
    .from('profiles')
    .select('id, full_name, email, institution, major, nim, research_interests, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!error && profileRow) {
    fullName = profileRow.full_name || fullName;
    institution = profileRow.institution || institution;
    major = profileRow.major || major;
    nim = profileRow.nim || nim;
    researchInterests = profileRow.research_interests || researchInterests;
  } else if (error && !isSchemaMissingError(error)) {
    throw error;
  }

  return {
    id: user.id,
    email: user.email || '',
    fullName: fullName || user.email?.split('@')[0] || 'Researcher',
    institution,
    major,
    nim,
    researchInterests,
    uploadedThesisIds: stringArray(meta.uploaded_thesis_ids),
    verifiedThesisIds: stringArray(meta.verified_thesis_ids),
    claimedThesisIds: stringArray(meta.claimed_thesis_ids),
    createdAt: user.created_at || new Date().toISOString(),
  };
}

export async function updateUserProfileRecord(
  user: User,
  updates: {
    fullName?: string;
    institution?: string;
    major?: string;
    nim?: string;
    researchInterests?: string;
    addUploadedThesisId?: string;
    addVerifiedThesisId?: string;
    addClaimedThesisId?: string;
  }
): Promise<UserProfile> {
  const admin = getAdminSupabase();
  const meta = getMetadataRecord(user);

  const nextUploaded = new Set(stringArray(meta.uploaded_thesis_ids));
  if (updates.addUploadedThesisId) nextUploaded.add(updates.addUploadedThesisId);

  const nextVerified = new Set(stringArray(meta.verified_thesis_ids));
  if (updates.addVerifiedThesisId) nextVerified.add(updates.addVerifiedThesisId);

  const nextClaimed = new Set(stringArray(meta.claimed_thesis_ids));
  if (updates.addClaimedThesisId) nextClaimed.add(updates.addClaimedThesisId);

  const fullName =
    updates.fullName !== undefined
      ? updates.fullName.trim()
      : typeof meta.full_name === 'string'
        ? meta.full_name
        : '';
  const institution =
    updates.institution !== undefined
      ? updates.institution.trim()
      : typeof meta.institution === 'string'
        ? meta.institution
        : '';
  const major =
    updates.major !== undefined
      ? updates.major.trim()
      : typeof meta.major === 'string'
        ? meta.major
        : '';
  const nim =
    updates.nim !== undefined
      ? updates.nim.trim()
      : typeof meta.nim === 'string'
        ? meta.nim
        : '';
  const researchInterests =
    updates.researchInterests !== undefined
      ? updates.researchInterests.trim()
      : typeof meta.research_interests === 'string'
        ? meta.research_interests
        : '';

  const nextMetadata = {
    ...meta,
    full_name: fullName,
    institution,
    major,
    nim,
    research_interests: researchInterests,
    uploaded_thesis_ids: Array.from(nextUploaded),
    verified_thesis_ids: Array.from(nextVerified),
    claimed_thesis_ids: Array.from(nextClaimed),
  };

  const { data: updatedAuth, error: authError } = await admin.auth.admin.updateUserById(
    user.id,
    { user_metadata: nextMetadata }
  );
  if (authError) {
    throw authError;
  }

  const profileUpsert = await admin.from('profiles').upsert(
    {
      id: user.id,
      email: user.email || '',
      full_name: fullName,
      institution,
      major,
      nim,
      research_interests: researchInterests,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (profileUpsert.error && !isSchemaMissingError(profileUpsert.error)) {
    throw profileUpsert.error;
  }

  return getUserProfileRecord(updatedAuth.user || user);
}

export async function listUserProjects(user: User): Promise<ProjectRecord[]> {
  const admin = getAdminSupabase();
  const { data: projectRows, error } = await admin
    .from('projects')
    .select('id, name, description, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (!error) {
    const projectIds = (projectRows || []).map((p) => p.id as string);
    const itemsByProject = new Map<
      string,
      Array<{ thesisId: string; note: string; addedAt: string }>
    >();

    if (projectIds.length > 0) {
      const { data: linkRows, error: linkErr } = await admin
        .from('project_theses')
        .select('project_id, thesis_id, note, added_at')
        .in('project_id', projectIds)
        .order('added_at', { ascending: false });

      if (linkErr && !isSchemaMissingError(linkErr)) {
        throw linkErr;
      }

      for (const row of linkRows || []) {
        const list = itemsByProject.get(row.project_id) || [];
        list.push({
          thesisId: row.thesis_id,
          note: row.note || '',
          addedAt: row.added_at || new Date().toISOString(),
        });
        itemsByProject.set(row.project_id, list);
      }
    }

    return (projectRows || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      items: itemsByProject.get(row.id) || [],
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));
  }

  if (!isSchemaMissingError(error)) {
    throw error;
  }

  const meta = getMetadataRecord(user);
  return Array.isArray(meta.nexus_projects) ? (meta.nexus_projects as ProjectRecord[]) : [];
}

export async function saveUserProjectsFallback(user: User, projects: ProjectRecord[]) {
  const admin = getAdminSupabase();
  const meta = getMetadataRecord(user);
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      nexus_projects: projects,
    },
  });
  if (error) throw error;
}

export async function listUserConversations(user: User): Promise<AiConversationRecord[]> {
  const admin = getAdminSupabase();
  const { data: convRows, error } = await admin
    .from('ai_conversations')
    .select('id, title, query_context, year_filter, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (!error) {
    const convIds = (convRows || []).map((c) => c.id as string);
    const messagesByConv = new Map<string, AiConversationRecord['messages']>();

    if (convIds.length > 0) {
      const { data: msgRows, error: msgErr } = await admin
        .from('ai_messages')
        .select('id, conversation_id, role, content, citations, related_thesis_ids, next_actions, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (msgErr && !isSchemaMissingError(msgErr)) {
        throw msgErr;
      }

      for (const m of msgRows || []) {
        const list = messagesByConv.get(m.conversation_id) || [];
        list.push({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          citations: Array.isArray(m.citations) ? m.citations : [],
          relatedThesisIds: Array.isArray(m.related_thesis_ids) ? m.related_thesis_ids : [],
          nextActions: Array.isArray(m.next_actions) ? m.next_actions : [],
          createdAt: m.created_at || new Date().toISOString(),
        });
        messagesByConv.set(m.conversation_id, list);
      }
    }

    return (convRows || []).map((c) => ({
      id: c.id,
      title: c.title,
      queryContext: c.query_context || '',
      yearFilter: c.year_filter || 'all',
      messages: messagesByConv.get(c.id) || [],
      createdAt: c.created_at || new Date().toISOString(),
      updatedAt: c.updated_at || new Date().toISOString(),
    }));
  }

  if (!isSchemaMissingError(error)) {
    throw error;
  }

  const meta = getMetadataRecord(user);
  return Array.isArray(meta.nexus_conversations)
    ? (meta.nexus_conversations as AiConversationRecord[])
    : [];
}

export async function saveUserConversationsFallback(
  user: User,
  conversations: AiConversationRecord[]
) {
  const admin = getAdminSupabase();
  const meta = getMetadataRecord(user);
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      nexus_conversations: conversations.slice(0, 30),
    },
  });
  if (error) throw error;
}

function parseUserGapClaims(user: User): GapClaim[] {
  const meta = getMetadataRecord(user);
  return Array.isArray(meta.nexus_gap_claims)
    ? (meta.nexus_gap_claims as GapClaim[])
    : [];
}

export async function listGapClaimsSafe(filters?: {
  thesisId?: string;
  userId?: string;
}): Promise<GapClaim[]> {
  const admin = getAdminSupabase();
  let query = admin
    .from('gap_claims')
    .select('id, thesis_id, user_id, user_name, planned_angle, status, claimed_at, expires_at')
    .order('claimed_at', { ascending: false });

  if (filters?.thesisId) {
    query = query.eq('thesis_id', filters.thesisId);
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }

  const { data, error } = await query;
  if (!error) {
    return (data || []) as GapClaim[];
  }
  if (!isSchemaMissingError(error)) {
    throw error;
  }

  // Schema-cache fallback: aggregate claims persisted per user in auth.users user_metadata
  let allClaims: GapClaim[] = [];
  if (filters?.userId) {
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(
      filters.userId
    );
    if (!userErr && userRes?.user) {
      allClaims = parseUserGapClaims(userRes.user);
    }
  } else {
    const { data: usersRes, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw listErr;
    for (const u of usersRes?.users || []) {
      allClaims.push(...parseUserGapClaims(u));
    }
  }

  return allClaims
    .filter((c) => {
      if (filters?.thesisId && c.thesis_id !== filters.thesisId) return false;
      if (filters?.userId && c.user_id !== filters.userId) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime()
    );
}

export async function findGapClaimByIdSafe(claimId: string): Promise<GapClaim | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('gap_claims')
    .select('id, thesis_id, user_id, user_name, planned_angle, status, claimed_at, expires_at')
    .eq('id', claimId)
    .maybeSingle();

  if (!error) {
    return (data as GapClaim) || null;
  }
  if (!isSchemaMissingError(error)) {
    throw error;
  }

  const all = await listGapClaimsSafe();
  return all.find((c) => c.id === claimId) || null;
}

export async function insertGapClaimSafe(input: {
  thesis_id: string;
  user: User;
  user_name: string;
  planned_angle: string;
}): Promise<GapClaim> {
  const admin = getAdminSupabase();
  const nowMs = Date.now();
  const claimedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 30 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from('gap_claims')
    .insert({
      thesis_id: input.thesis_id,
      user_id: input.user.id,
      user_name: input.user_name,
      planned_angle: input.planned_angle,
      status: 'exploring',
      claimed_at: claimedAt,
      expires_at: expiresAt,
    })
    .select('id, thesis_id, user_id, user_name, planned_angle, status, claimed_at, expires_at')
    .single();

  if (!error && data) {
    return data as GapClaim;
  }
  if (!isSchemaMissingError(error)) {
    throw error;
  }

  // Metadata fallback when public.gap_claims table is not yet created
  const { data: freshUser } = await admin.auth.admin.getUserById(input.user.id);
  const targetUser = freshUser?.user || input.user;
  const meta = getMetadataRecord(targetUser);
  const existing = parseUserGapClaims(targetUser);

  const created: GapClaim = {
    id: randomUUID(),
    thesis_id: input.thesis_id,
    user_id: input.user.id,
    user_name: input.user_name,
    planned_angle: input.planned_angle,
    status: 'exploring',
    claimed_at: claimedAt,
    expires_at: expiresAt,
  };

  const { error: updErr } = await admin.auth.admin.updateUserById(input.user.id, {
    user_metadata: {
      ...meta,
      nexus_gap_claims: [created, ...existing],
    },
  });
  if (updErr) throw updErr;
  return created;
}

export async function updateGapClaimStatusSafe(input: {
  claimId: string;
  ownerUser: User;
  status: GapClaimStatus;
  expires_at?: string | null;
}): Promise<GapClaim | null> {
  const admin = getAdminSupabase();
  const patchPayload: { status: GapClaimStatus; expires_at?: string | null } = {
    status: input.status,
  };
  if (input.expires_at !== undefined) {
    patchPayload.expires_at = input.expires_at;
  }

  const { data, error } = await admin
    .from('gap_claims')
    .update(patchPayload)
    .eq('id', input.claimId)
    .eq('user_id', input.ownerUser.id)
    .select('id, thesis_id, user_id, user_name, planned_angle, status, claimed_at, expires_at')
    .maybeSingle();

  if (!error) {
    return (data as GapClaim) || null;
  }
  if (!isSchemaMissingError(error)) {
    throw error;
  }

  const { data: freshUser } = await admin.auth.admin.getUserById(input.ownerUser.id);
  const targetUser = freshUser?.user || input.ownerUser;
  const meta = getMetadataRecord(targetUser);
  const existing = parseUserGapClaims(targetUser);
  let updatedClaim: GapClaim | null = null;

  const next = existing.map((claim) => {
    if (claim.id !== input.claimId) return claim;
    updatedClaim = {
      ...claim,
      status: input.status,
      expires_at:
        input.expires_at !== undefined ? input.expires_at : claim.expires_at,
    };
    return updatedClaim;
  });

  if (!updatedClaim) return null;

  const { error: updErr } = await admin.auth.admin.updateUserById(input.ownerUser.id, {
    user_metadata: {
      ...meta,
      nexus_gap_claims: next,
    },
  });
  if (updErr) throw updErr;
  return updatedClaim;
}


