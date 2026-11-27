import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  attachRefreshedCookies,
  getAdminSupabase,
  getAuthenticatedSession,
  isSchemaMissingError,
  listUserConversations,
  saveUserConversationsFallback,
} from '@/lib/serverSupabase';
import type { AiConversationRecord } from '@/types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ conversations: [] });
    }
    const conversations = await listUserConversations(user);
    const res = NextResponse.json({ conversations });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to load conversations.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = (await req.json()) as { conversation?: AiConversationRecord };
    const conv = body?.conversation;
    if (!conv || !conv.title) {
      return NextResponse.json({ error: 'Conversation payload is required.' }, { status: 400 });
    }

    const validId = UUID_REGEX.test(conv.id) ? conv.id : randomUUID();
    const normalized: AiConversationRecord = {
      ...conv,
      id: validId,
      updatedAt: new Date().toISOString(),
      createdAt: conv.createdAt || new Date().toISOString(),
    };

    const admin = getAdminSupabase();
    const { error: upsertErr } = await admin.from('ai_conversations').upsert(
      {
        id: normalized.id,
        user_id: user.id,
        title: normalized.title,
        query_context: normalized.queryContext || '',
        year_filter: normalized.yearFilter || 'all',
        updated_at: normalized.updatedAt,
      },
      { onConflict: 'id' }
    );

    if (!upsertErr) {
      // Replace messages for this conversation atomically
      await admin.from('ai_messages').delete().eq('conversation_id', normalized.id);
      if (normalized.messages.length > 0) {
        const msgRows = normalized.messages.map((m) => ({
          id: UUID_REGEX.test(m.id) ? m.id : randomUUID(),
          conversation_id: normalized.id,
          role: m.role,
          content: m.content,
          citations: m.citations || [],
          related_thesis_ids: m.relatedThesisIds || [],
          next_actions: m.nextActions || [],
          created_at: m.createdAt || new Date().toISOString(),
        }));
        const { error: msgErr } = await admin.from('ai_messages').insert(msgRows);
        if (msgErr && !isSchemaMissingError(msgErr)) throw msgErr;
      }

      const conversations = await listUserConversations(user);
      const res = NextResponse.json({ conversations, savedId: normalized.id });
      return attachRefreshedCookies(res, refreshedSession);
    }

    if (!isSchemaMissingError(upsertErr)) {
      throw upsertErr;
    }

    const existing = await listUserConversations(user);
    const filtered = existing.filter((c) => c.id !== normalized.id);
    const next = [normalized, ...filtered];
    await saveUserConversationsFallback(user, next);

    const res = NextResponse.json({ conversations: next, savedId: normalized.id });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to save conversation.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id') || '';
    if (!id) {
      return NextResponse.json({ error: 'Conversation id is required.' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      const conversations = await listUserConversations(user);
      const res = NextResponse.json({ conversations });
      return attachRefreshedCookies(res, refreshedSession);
    }

    if (!isSchemaMissingError(error)) {
      throw error;
    }

    const existing = await listUserConversations(user);
    const next = existing.filter((c) => c.id !== id);
    await saveUserConversationsFallback(user, next);

    const res = NextResponse.json({ conversations: next });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete conversation.' },
      { status: 500 }
    );
  }
}

