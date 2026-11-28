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

export const maxDuration = 60;

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

function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function replaceRawThesisIds(
  text: string,
  thesisMap: Map<string, RawThesisRow>,
  fallbackLabel: string
): string {
  return text
    .split(/(\[\[cite:[^\]]+\]\])/g)
    .map((part) => {
      if (/^\[\[cite:[^\]]+\]\]$/.test(part)) return part;
      return part.replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        (id) => thesisMap.get(id)?.title || fallbackLabel
      );
    })
    .join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const language = body?.language === 'id' ? 'id' : 'en';
    const responseLanguageInstruction =
      language === 'id'
        ? 'Respond strictly in clear, formal, scholarly BAHASA INDONESIA.'
        : 'Respond strictly in clear, formal, scholarly ENGLISH.';
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
          language === 'id'
            ? 'Tidak ada skripsi yang cocok dengan filter aktif di Supabase, sehingga saya belum dapat menjawab berdasarkan data skripsi. Coba reset filter atau tambahkan skripsi untuk dianalisis.'
            : 'No theses currently match your active filters in Supabase, so I cannot answer from grounded thesis records yet. Try resetting your filters or adding new theses to analyze.',
        citations: [],
        relatedThesisIds: [],
        nextActions: [
          {
            label: language === 'id' ? 'Reset filter aktif' : 'Clear active filters',
            type: 'clear_filters',
          },
          {
            label: language === 'id' ? 'Buka tampilan Graf' : 'Switch to Graph view',
            type: 'open_graph',
          },
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
        const queryTerms = queryText
          .toLowerCase()
          .split(/\s+/)
          .map((term) => term.trim())
          .filter((term) => term.length >= 3);
        rankedRows = [...scoped].sort((a, b) => {
          if (a.id === selectedThesisId) return -1;
          if (b.id === selectedThesisId) return 1;
          const keywordScore = (row: RawThesisRow) => {
            const haystack =
              `${row.title} ${row.problem} ${row.method} ${row.dataset} ${row.key_findings} ${row.future_work}`.toLowerCase();
            return queryTerms.reduce(
              (score, term) => score + (haystack.includes(term) ? 1 : 0),
              0
            );
          };
          const scoreA = (simById.get(a.id) ?? 0) + keywordScore(a) * 0.08;
          const scoreB = (simById.get(b.id) ?? 0) + keywordScore(b) * 0.08;
          return scoreB - scoreA;
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

    const prompt = `You are the NexusGraph Research Intelligence Assistant—an insightful, articulate, and thorough academic research collaborator.
${responseLanguageInstruction}

CRITICAL RULES:
1. Never use emojis, emoticons, or decorative symbols. Markdown bold formatting is allowed for section labels and emphasis.
2. Never mention raw database UUIDs in prose. Refer to a thesis by its title or author/year. Use inline citation tokens exactly as [[cite:EXACT_UUID]] next to claims about that thesis; UUIDs may appear only inside those tokens and the JSON ID fields.
3. Base every factual claim only on the theses provided in THESIS CONTEXT below. Never invent theses, authors, metrics, findings, or citations.
4. Answer the user's exact question directly with a clear executive overview. Unless the user asks a simple yes/no question, provide a genuinely useful, well-structured analysis rather than a brief 1–2 sentence response. Use appropriate bold section labels or concise bullet points, and explain why findings matter, relevant methodological trade-offs, and realistic ways to build on an open research gap.
5. Tailor the structure to the question. When explaining a thesis, consider labels such as **Research Problem**, **Methodology**, **Key Findings**, and **Research Gap / Research Opportunities**. For comparisons, consider **Method Comparison**, **Strengths and Limitations**, and **Recommended Research Directions**.
6. If the user asks about a topic not covered in the context, say what evidence is missing and suggest concrete next steps, such as importing theses via OAI-PMH/OpenAlex or adjusting the filters.
7. Return only valid JSON matching the schema below, without markdown fences. Write the answer and next-action labels in the requested language.

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
  "answer": "A thorough, well-structured, emoji-free answer in the requested language, with inline [[cite:EXACT_UUID]] tokens",
  "citedIds": ["uuid-from-context"],
  "relatedThesisIds": ["primary-relevant-uuid"],
  "nextActions": [
    { "label": "Short action label in the requested language (no emojis)", "type": "open_graph" | "open_table" | "save_project" | "view_gap" | "claim_gap" | "clear_filters", "thesisId": "optional-uuid-from-context" }
  ]
}`;

    const ai = await generateJsonWithGemini<RagJsonResponse>(prompt, {
      temperature: 0.35,
      maxOutputTokens: 3000,
    });

    const cleanAnswer = replaceRawThesisIds(
      stripEmojis(
        ai.answer ||
          'I reviewed the active theses in Supabase, but could not generate a summary for that query.'
      ),
      thesisMap,
      language === 'id' ? 'skripsi terkait' : 'related thesis'
    );

    const inlineMatches = Array.from(
      cleanAnswer.matchAll(/\[\[cite:([^\]]+)\]\]/g)
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
        label: stripEmojis(a.label),
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
      answer: cleanAnswer,
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
