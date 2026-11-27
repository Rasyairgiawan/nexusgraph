import { NextRequest, NextResponse } from 'next/server';
import {
  hasActiveClaimByUser,
  isActiveClaim,
  withClaimMeta,
} from '@/lib/claims';
import {
  attachRefreshedCookies,
  fetchThesisByIdSafe,
  getAuthenticatedSession,
  insertGapClaimSafe,
  listGapClaimsSafe,
} from '@/lib/serverSupabase';

export async function GET(req: NextRequest) {
  try {
    const thesisId = req.nextUrl.searchParams.get('thesis_id')?.trim() || undefined;
    const userId = req.nextUrl.searchParams.get('user_id')?.trim() || undefined;
    const now = Date.now();

    const claims = await listGapClaimsSafe({ thesisId, userId });
    const activeClaims = claims
      .filter((claim) => isActiveClaim(claim, now))
      .map((claim) => withClaimMeta(claim, now));

    return NextResponse.json(activeClaims);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to load claims.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to claim a research gap.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const thesisId =
      typeof body?.thesis_id === 'string' ? body.thesis_id.trim() : '';
    const bodyUserId =
      typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    const userName =
      typeof body?.user_name === 'string' ? body.user_name.trim() : '';
    const plannedAngle =
      typeof body?.planned_angle === 'string' ? body.planned_angle.trim() : '';

    if (!thesisId || !bodyUserId || !userName || !plannedAngle) {
      return NextResponse.json(
        {
          error:
            'thesis_id, user_id, user_name, and planned_angle are all required and cannot be empty.',
        },
        { status: 400 }
      );
    }

    // Verify submitted user_id against server-authenticated user to prevent spoofing
    if (bodyUserId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: user_id does not match authenticated session.' },
        { status: 403 }
      );
    }

    const thesis = await fetchThesisByIdSafe(thesisId);
    if (!thesis) {
      return NextResponse.json(
        { error: 'Thesis not found.' },
        { status: 404 }
      );
    }

    const existingClaims = await listGapClaimsSafe({ thesisId });
    const now = Date.now();
    if (hasActiveClaimByUser(existingClaims, user.id, thesisId, now)) {
      return NextResponse.json(
        { error: 'You already have an active claim on this research gap.' },
        { status: 409 }
      );
    }

    const created = await insertGapClaimSafe({
      thesis_id: thesisId,
      user,
      user_name: userName,
      planned_angle: plannedAngle,
    });

    const res = NextResponse.json(withClaimMeta(created, Date.now()), {
      status: 201,
    });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create research gap claim.' },
      { status: 500 }
    );
  }
}

