import { NextRequest, NextResponse } from 'next/server';
import {
  attachRefreshedCookies,
  clearAuthCookies,
  getAuthenticatedSession,
  getUserProfileRecord,
  listUserConversations,
  listUserProjects,
} from '@/lib/serverSupabase';

export async function GET(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      const res = NextResponse.json({ user: null, projects: [], conversations: [] });
      clearAuthCookies(res);
      return res;
    }

    const [profile, projects, conversations] = await Promise.all([
      getUserProfileRecord(user),
      listUserProjects(user),
      listUserConversations(user),
    ]);

    const res = NextResponse.json({
      user: profile,
      projects,
      conversations,
    });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to resolve session.' },
      { status: 500 }
    );
  }
}

