import { NextRequest, NextResponse } from 'next/server';
import {
  attachRefreshedCookies,
  BASE_THESIS_SELECT,
  EXTENDED_THESIS_SELECT,
  getAdminSupabase,
  getAuthenticatedSession,
  getUserProfileRecord,
  isSchemaMissingError,
  updateUserProfileRecord,
} from '@/lib/serverSupabase';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    const admin = getAdminSupabase();

    const coreUpdates: Record<string, unknown> = {};
    const extendedUpdates: Record<string, unknown> = {};

    const stringOrNull = (val: unknown) =>
      typeof val === 'string' ? val.trim() : val === null ? null : undefined;

    if (typeof body.title === 'string') coreUpdates.title = body.title.trim();
    if (typeof body.author === 'string') coreUpdates.author = body.author.trim();
    if (typeof body.year === 'number') coreUpdates.year = body.year;
    if (typeof body.problem === 'string') coreUpdates.problem = body.problem.trim();
    if (typeof body.method === 'string') coreUpdates.method = body.method.trim();
    if (typeof body.dataset === 'string') coreUpdates.dataset = body.dataset.trim();

    if (typeof body.key_findings === 'string') {
      const kf = body.key_findings.trim();
      extendedUpdates.key_findings = kf;
      if (typeof body.limitation !== 'string') {
        coreUpdates.limitation = kf;
      }
    }
    if (typeof body.limitation === 'string') {
      coreUpdates.limitation = body.limitation.trim();
      if (typeof body.key_findings !== 'string') {
        extendedUpdates.key_findings = body.limitation.trim();
      }
    }

    if (typeof body.future_work === 'string') {
      coreUpdates.future_work = body.future_work.trim();
    }

    const sourceUrl = stringOrNull(body.source_url);
    if (sourceUrl !== undefined) {
      extendedUpdates.source_url = sourceUrl || null;
    }

    let reviewerName: string | null = null;
    if (user) {
      const profile = await getUserProfileRecord(user);
      reviewerName = profile.fullName;
    }

    if (typeof body.is_verified === 'boolean') {
      coreUpdates.is_verified = body.is_verified;
      if (body.is_verified) {
        const explicitVerifier =
          typeof body.verified_by === 'string' && body.verified_by.trim()
            ? body.verified_by.trim()
            : reviewerName || 'Peer Reviewer';
        extendedUpdates.verified_by = explicitVerifier;
        extendedUpdates.verified_at = new Date().toISOString();
        if (user) extendedUpdates.verified_by_user_id = user.id;
      } else {
        extendedUpdates.verified_by = null;
        extendedUpdates.verified_at = null;
        extendedUpdates.verified_by_user_id = null;
      }
    }

    if (
      Object.keys(coreUpdates).length === 0 &&
      Object.keys(extendedUpdates).length === 0
    ) {
      return NextResponse.json({ error: 'No valid update fields supplied.' }, { status: 400 });
    }

    let updatedRow: Record<string, unknown> | null = null;

    const fullAttempt = await admin
      .from('theses')
      .update({ ...coreUpdates, ...extendedUpdates })
      .eq('id', id)
      .select(EXTENDED_THESIS_SELECT)
      .single();

    if (!fullAttempt.error) {
      updatedRow = fullAttempt.data as Record<string, unknown>;
    } else if (isSchemaMissingError(fullAttempt.error)) {
      if (Object.keys(coreUpdates).length === 0) {
        const existing = await admin
          .from('theses')
          .select(BASE_THESIS_SELECT)
          .eq('id', id)
          .single();
        if (existing.error) throw existing.error;
        updatedRow = { ...(existing.data as Record<string, unknown>), ...extendedUpdates };
      } else {
        const coreAttempt = await admin
          .from('theses')
          .update(coreUpdates)
          .eq('id', id)
          .select(BASE_THESIS_SELECT)
          .single();
        if (coreAttempt.error) throw coreAttempt.error;
        updatedRow = { ...(coreAttempt.data as Record<string, unknown>), ...extendedUpdates };
      }
    } else {
      throw fullAttempt.error;
    }

    if (user && coreUpdates.is_verified === true) {
      await updateUserProfileRecord(user, {
        addVerifiedThesisId: id,
      });
    }

    const res = NextResponse.json({
      status: 'success',
      result: updatedRow,
    });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update thesis record.' },
      { status: 500 }
    );
  }
}
