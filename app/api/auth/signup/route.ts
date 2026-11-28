import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminSupabase,
  getAnonSupabase,
  getUserProfileRecord,
  isSchemaMissingError,
  setAuthCookies,
} from '@/lib/serverSupabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword =
      typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';
    const institution = typeof body?.institution === 'string' ? body.institution.trim() : '';
    const major = typeof body?.major === 'string' ? body.major.trim() : '';
    const nim = typeof body?.nim === 'string' ? body.nim.trim() : '';
    const researchInterests =
      typeof body?.researchInterests === 'string' ? body.researchInterests.trim() : '';
    const acceptedTerms = Boolean(body?.acceptedTerms);

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: 'Full Name must be at least 2 characters.' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid academic or personal email.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Password confirmation does not match.' }, { status: 400 });
    }
    if (!institution || !major || !researchInterests) {
      return NextResponse.json(
        { error: 'Institution, Major / Study Program, and Research Interests are required.' },
        { status: 400 }
      );
    }
    if (!acceptedTerms) {
      return NextResponse.json(
        { error: 'You must agree to the Terms of Service and Privacy Policy.' },
        { status: 400 }
      );
    }

    const admin = getAdminSupabase();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        institution,
        major,
        nim,
        research_interests: researchInterests,
        uploaded_thesis_ids: [],
        verified_thesis_ids: [],
        claimed_thesis_ids: [],
      },
    });

    if (createError || !created.user) {
      const msg = createError?.message || 'Unable to create account.';
      const status = msg.toLowerCase().includes('already') ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    const profileUpsert = await admin.from('profiles').upsert(
      {
        id: created.user.id,
        full_name: fullName,
        email,
        institution,
        major,
        nim,
        research_interests: researchInterests,
      },
      { onConflict: 'id' }
    );
    if (profileUpsert.error && !isSchemaMissingError(profileUpsert.error)) {
      throw profileUpsert.error;
    }

    const anon = getAnonSupabase();
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signInData.session) {
      return NextResponse.json(
        { error: signInErr?.message || 'Account created, but auto sign-in failed.' },
        { status: 500 }
      );
    }

    const profile = await getUserProfileRecord(created.user);
    const res = NextResponse.json({ user: profile });
    setAuthCookies(res, {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Sign Up failed.' },
      { status: 500 }
    );
  }
}

