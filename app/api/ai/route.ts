import { NextRequest, NextResponse } from 'next/server';
import { getActiveClaimsForThesis, getThesisGapSummary, isActiveClaim } from '@/lib/claims';
import { embedTextWithGemini, generateJsonWithGemini } from '@/lib/gemini';
import {
  fetchAllThesesSafe,
  getAdminSupabase,
  listGapClaimsSafe,
  type RawThesisRow,
} from '@/lib/serverSupabase';
import type { AiNextAction } from '@/types';

interface RagJsonResponse {
  answer: string;
  citedIds?: string[];
  relatedThesisIds?: string[];
  nextActions?: Array<{
    label: string;
    type: 'open_graph' | 'open_table' | 'save_project' | 'view_gap' | 'claim_gap' | 'clear_filters';
    thesisId?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const selectedThesisId =
      typeof body?.selectedThesisId === 'string' ? body.selectedThesisId : null;
    const queryContext =
      typeof body?.queryContext === 'string' ? body.queryContext.trim() : '';
    const yearFilter =
      typeof body?.yearFilter === 'number' || body?.yearFilter === 'all'
        ? body.yearFilter
        : 'all';
    const verifiedOnly = Boolean(body?.verifiedOnly);
    const availableGapsOnly = Boolean(body?.availableGapsOnly);
    const projectThesisIds = Array.isArray(body?.projectThesisIds)
      ? (body.projectThesisIds as string[])
      : null;
    const history = Array.isArray(body?.history)
      ? (body.history as Array<{ role: string; content: string }>).slice(-6)
      : [];

    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    const [allTheses, allClaims] = await Promise.all([
      fetchAllThesesSafe(),
      listGapClaimsSafe(),
    ]);
    const now = Date.now();
    const activeClaims = allClaims.filter((c) => isActiveClaim(c, now));

    const scoped = allTheses.filter((row) => {
      if (projectThesisIds && !projectThesisIds.includes(row.id)) return false;
      if (yearFilter !== 'all' && row.year !== yearFilter) return false;
      if (verifiedOnly && !row.is_verified) return false;
      if (availableGapsOnly && getActiveClaimsForThesis(activeClaims, row.id, now).length > 0) {
        return false;
      }
      return true;
    });

    if (scoped.length === 0) {
      return NextResponse.json({
        answer:
          'No theses currently match your active filters in Supabase, so I cannot answer from grounded thesis records yet. Try resetting your filters or adding new theses to analyze.',
        citations: [],
        relatedThesisIds: [],
        nextActions: [
          { label: 'Clear active filters', type: 'clear_filters' },
          { label: 'Switch to Graph view', type: 'open_graph' },
        ] satisfies AiNextAction[],
      });
    }

    // Score relevance via semantic vector search + keyword overlap
    let rankedRows: RawThesisRow[] = scoped;
    try {
      const queryText = `${message} ${queryContext}`.trim();
      const vec = await embedTextWithGemini(queryText);
      const admin = getAdminSupabase();
      const { data: vecMatches } = await admin.rpc('match_theses', {
        query_embedding: vec,
        match_threshold: 0.3,
        match_count: 15,
      });

      if (Array.isArray(vecMatches) && vecMatches.length > 0) {
        const simById = new Map<string, number>();
        for (const m of vecMatches as Array<{ id: string; similarity?: number }>) {
          simById.set(m.id, m.similarity ?? 0.5);
        }
        rankedRows = [...scoped].sort((a, b) => {
          if (a.id === selectedThesisId) return -1;
          if (b.id === selectedThesisId) return 1;
          return (simById.get(b.id) ?? 0) - (simById.get(a.id) ?? 0);
        });
      }
    } catch {
      // Fall back silently to year/selection ordering
    }

    const contextRows = rankedRows.slice(0, 14);
    const validIds = new Set(contextRows.map((t) => t.id));
    const thesisMap = new Map(allTheses.map((t) => [t.id, t]));

    const serializedContext = contextRows
      .map((t) => {
        const thesisClaims = getActiveClaimsForThesis(activeClaims, t.id, now);
        const gapSummary = getThesisGapSummary(thesisClaims, now);
        const claimDetails =
          thesisClaims.length > 0
            ? ` (${thesisClaims.map((c) => `${c.user_name}: ${c.status} — "${c.planned_angle}"`).join('; ')})`
            : '';
        return `- ID: ${t.id} | Year: ${t.year} | File: ${t.file_name} | Title: ${t.title} | Author: ${t.author} | Verified: ${Boolean(t.is_verified)} | GapStatus: ${gapSummary}${claimDetails}\n  Problem: ${t.problem}\n  Method: ${t.method}\n  Dataset: ${t.dataset}\n  Key Findings: ${t.key_findings || t.limitation}\n  Research Gap / Future Work: ${t.future_work}`;
      })
      .join('\n\n');

    const historyText =
      history.length > 0
        ? history
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
            .join('\n')
        : 'None';

    const prompt = `You are the NexusGraph Research Assistant (grounded academic RAG advisor).
Respond strictly in natural, clear, polite ENGLISH.
CRITICAL GROUNDING RULES:
1. Base EVERY factual claim ONLY on the theses provided in THESIS CONTEXT below. Never invent theses, authors, metrics, or citations.
2. Answer directly in the first sentence without fluff. Keep simple answers to 2-3 sentences; comparisons or gap summaries to 3-4 concise bullet points.
3. Whenever you reference a thesis, embed inline citation tokens verbatim like [[cite:EXACT_UUID]] right next to the claim.
4. If the user asks about a topic not present in the context, state clearly that no thesis in the active collection covers it and offer concrete next steps inside NexusGraph.
5. Do not output raw markdown JSON fences; return valid JSON matching the schema below.

ACTIVE FILTERS:
- Search Query Context: ${queryContext || 'None'}
- Year Filter: ${yearFilter}
- Selected Thesis ID: ${selectedThesisId || 'None'}

RECENT CONVERSATION:
${historyText}

THESIS CONTEXT (from Supabase):
${serializedContext}

USER QUESTION:
"${message}"

Return JSON strictly matching:
{
  "answer": "Your grounded English answer with [[cite:UUID]] tokens",
  "citedIds": ["uuid-from-context"],
  "relatedThesisIds": ["primary-relevant-uuid"],
  "nextActions": [
    { "label": "Short action label", "type": "open_graph" | "open_table" | "save_project" | "view_gap" | "claim_gap", "thesisId": "optional-uuid-from-context" }
  ]
}`;

    const ai = await generateJsonWithGemini<RagJsonResponse>(prompt, {
      temperature: 0.2,
      maxOutputTokens: 1600,
    });

    // Extract cited IDs from inline markers too and validate every ID against real DB rows
    const inlineMatches = Array.from(
      (ai.answer || '').matchAll(/\[\[cite:([^\]]+)\]\]/g)
    ).map((m) => m[1].trim());

    const mergedCitedIds = Array.from(
      new Set([...(ai.citedIds || []), ...inlineMatches])
    ).filter((id) => validIds.has(id));

    const citations = mergedCitedIds
      .map((id) => thesisMap.get(id))
      .filter((t): t is RawThesisRow => Boolean(t))
      .map((t) => ({
        paperId: t.id,
        label: `${t.year} · ${t.file_name}`,
        title: t.title,
      }));

    const relatedThesisIds = Array.from(
      new Set([
        ...(ai.relatedThesisIds || []),
        ...mergedCitedIds,
        ...(selectedThesisId && validIds.has(selectedThesisId) ? [selectedThesisId] : []),
      ])
    )
      .filter((id) => validIds.has(id))
      .slice(0, 3);

    const nextActions: AiNextAction[] = (ai.nextActions || [])
      .filter((a) => a && a.label && a.type)
      .slice(0, 3)
      .map((a) => ({
        label: a.label,
        type: a.type,
        thesisId: a.thesisId && validIds.has(a.thesisId) ? a.thesisId : relatedThesisIds[0],
      }));

    if (nextActions.length === 0 && relatedThesisIds[0]) {
      nextActions.push(
        { label: 'Inspect Gap in Graph', type: 'open_graph', thesisId: relatedThesisIds[0] },
        { label: 'Compare in Table', type: 'open_table', thesisId: relatedThesisIds[0] },
        { label: 'Save to Project', type: 'save_project', thesisId: relatedThesisIds[0] }
      );
    }

    return NextResponse.json({
      answer:
        ai.answer ||
        'I reviewed the active theses in Supabase, but could not generate a summary for that query.',
      citations,
      relatedThesisIds,
      nextActions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'AI Assistant request failed.' },
      { status: 500 }
    );
  }
}
