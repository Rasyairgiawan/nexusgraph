import { NextRequest, NextResponse } from 'next/server';
import {
  attachRefreshedCookies,
  getAuthenticatedSession,
  getUserProfileRecord,
  updateUserProfileRecord,
} from '@/lib/serverSupabase';

export async function GET(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const profile = await getUserProfileRecord(user);
    const res = NextResponse.json({ user: profile });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to load profile.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const profile = await updateUserProfileRecord(user, {
      fullName: typeof body?.fullName === 'string' ? body.fullName : undefined,
      institution: typeof body?.institution === 'string' ? body.institution : undefined,
      major: typeof body?.major === 'string' ? body.major : undefined,
      nim: typeof body?.nim === 'string' ? body.nim : undefined,
      researchInterests:
        typeof body?.researchInterests === 'string' ? body.researchInterests : undefined,
    });

    const res = NextResponse.json({ user: profile });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update profile.' },
      { status: 500 }
    );
  }
}

