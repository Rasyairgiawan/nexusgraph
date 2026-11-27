import { NextRequest, NextResponse } from 'next/server';
import { withClaimMeta } from '@/lib/claims';
import {
  attachRefreshedCookies,
  findGapClaimByIdSafe,
  getAuthenticatedSession,
  updateGapClaimStatusSafe,
} from '@/lib/serverSupabase';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to manage claims.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = body?.action;
    const bodyUserId =
      typeof body?.user_id === 'string' ? body.user_id.trim() : '';

    if (action !== 'upgrade' && action !== 'release') {
      return NextResponse.json(
        { error: "Invalid action. Must be 'upgrade' or 'release'." },
        { status: 400 }
      );
    }

    if (bodyUserId && bodyUserId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: user_id does not match authenticated session.' },
        { status: 403 }
      );
    }

    const claim = await findGapClaimByIdSafe(id);
    if (!claim || claim.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: claim does not exist or belongs to another user.' },
        { status: 403 }
      );
    }

    if (claim.status === 'released') {
      return NextResponse.json(
        { error: 'This claim has already been released.' },
        { status: 409 }
      );
    }

    if (action === 'upgrade') {
      if (claim.status !== 'exploring') {
        return NextResponse.json(
          { error: 'Only exploring claims can be upgraded to In Progress.' },
          { status: 409 }
        );
      }

      const updated = await updateGapClaimStatusSafe({
        claimId: id,
        ownerUser: user,
        status: 'in_progress',
        expires_at: null,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Claim update failed.' }, { status: 403 });
      }

      const res = NextResponse.json(withClaimMeta(updated, Date.now()), {
        status: 200,
      });
      return attachRefreshedCookies(res, refreshedSession);
    }

    const updated = await updateGapClaimStatusSafe({
      claimId: id,
      ownerUser: user,
      status: 'released',
    });

    if (!updated) {
      return NextResponse.json({ error: 'Claim release failed.' }, { status: 403 });
    }

    const res = NextResponse.json(withClaimMeta(updated, Date.now()), {
      status: 200,
    });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update claim.' },
      { status: 500 }
    );
  }
}

