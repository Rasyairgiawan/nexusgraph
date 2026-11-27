import { NextRequest, NextResponse } from 'next/server';
import { embedTextWithGemini } from '@/lib/gemini';
import {
  fetchAllThesesSafe,
  getAdminSupabase,
  isSchemaMissingError,
  type RawThesisRow,
} from '@/lib/serverSupabase';

function normalizeThesisRow(row: RawThesisRow) {
  return {
    id: row.id,
    file_name: row.file_name,
    title: row.title,
    author: row.author || 'Anonymous Researcher',
    year: row.year || new Date().getFullYear(),
    problem: row.problem || '',
    method: row.method || '',
    dataset: row.dataset || '',
    limitation: row.limitation || '',
    key_findings: row.key_findings || row.limitation || '',
    future_work: row.future_work || '',
    is_verified: Boolean(row.is_verified),
    verified_by: row.verified_by || null,
    verified_at: row.verified_at || null,
    source_url: row.source_url || null,
    source_type: row.source_type || 'campus_repo',
    uploaded_by: row.uploaded_by || null,
    university: row.university || null,
    similarity: row.similarity,
  };
}

export async function GET(req: NextRequest) {
  try {
    void req.nextUrl;
    const rows = await fetchAllThesesSafe();
    const results = rows.map(normalizeThesisRow);
    return NextResponse.json({ count: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to load theses from Supabase.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const threshold = typeof body?.threshold === 'number' ? body.threshold : 0.45;
    const count = typeof body?.count === 'number' ? body.count : 20;

    if (!query) {
      return NextResponse.json({ error: 'Search query cannot be empty.' }, { status: 400 });
    }

    const queryEmbedding = await embedTextWithGemini(query);
    const admin = getAdminSupabase();

    const { data, error } = await admin.rpc('match_theses', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: count,
    });

    if (error) {
      throw new Error(`Supabase vector search failed: ${error.message}`);
    }

    const matchedRows = (data || []) as RawThesisRow[];
    // Enrich matched rows with any extended columns if RPC returned base shape
    const allRows = await fetchAllThesesSafe();
    const byId = new Map(allRows.map((row) => [row.id, row]));

    const enriched = matchedRows.map((row) => {
      const full = byId.get(row.id);
      return normalizeThesisRow({
        ...(full || row),
        similarity: row.similarity,
      });
    });

    return NextResponse.json({
      query,
      count: enriched.length,
      results: enriched,
    });
  } catch (err) {
    if (isSchemaMissingError(err)) {
      return NextResponse.json(
        { error: 'Vector search RPC is out of sync with schema.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Semantic search failed.' },
      { status: 500 }
    );
  }
}
