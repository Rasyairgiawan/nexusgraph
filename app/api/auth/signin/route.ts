import { NextRequest, NextResponse } from 'next/server';
import {
  getAnonSupabase,
  getUserProfileRecord,
  listUserConversations,
  listUserProjects,
  setAuthCookies,
} from '@/lib/serverSupabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const anon = getAnonSupabase();
    const { data, error } = await anon.auth.signInWithPassword({ email, password });

    if (error || !data.user || !data.session) {
      return NextResponse.json(
        { error: 'Invalid email or password. Please check your credentials and try again.' },
        { status: 401 }
      );
    }

    const [profile, projects, conversations] = await Promise.all([
      getUserProfileRecord(data.user),
      listUserProjects(data.user),
      listUserConversations(data.user),
    ]);

    const res = NextResponse.json({ user: profile, projects, conversations });
    setAuthCookies(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Sign In failed.' },
      { status: 500 }
    );
  }
}

