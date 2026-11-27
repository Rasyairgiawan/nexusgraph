import { NextRequest, NextResponse } from 'next/server';
import { getAnonSupabase } from '@/lib/serverSupabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const anon = getAnonSupabase();
    const origin = req.nextUrl.origin;
    const { error } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message:
        'If an account exists for that email, a password reset link has been sent.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Unable to process password reset request.' },
      { status: 500 }
    );
  }
}

