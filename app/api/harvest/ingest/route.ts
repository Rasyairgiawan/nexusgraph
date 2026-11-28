import { NextRequest } from 'next/server';
import { embedTextWithGemini, generateJsonWithGemini } from '@/lib/gemini';
import {
  BASE_THESIS_SELECT,
  EXTENDED_THESIS_SELECT,
  fetchAllThesesSafe,
  getAdminSupabase,
  getAuthenticatedSession,
  isSchemaMissingError,
  updateUserProfileRecord,
} from '@/lib/serverSupabase';
import type { HarvestCandidate } from '@/types';

export const maxDuration = 60;

interface ExtractedEntities {
  problem: string;
  method: string;
  dataset: string;
  key_findings: string;
  future_work: string;
}

function ndjsonLine(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthenticatedSession(req);
  const body = (await req.json()) as { items?: HarvestCandidate[] };
  const items = Array.isArray(body?.items) ? body.items : [];

  if (items.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Select at least one thesis record to import.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(ndjsonLine(payload));
      };

      try {
        const existingRows = await fetchAllThesesSafe();
        const existingTitleSet = new Set(
          existingRows.map((r) => r.title.trim().toLowerCase())
        );

        const admin = getAdminSupabase();
        const imported: Array<Record<string, unknown>> = [];
        const skipped: string[] = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const normalizedTitle = item.title.trim().toLowerCase();
          if (existingTitleSet.has(normalizedTitle)) {
            skipped.push(item.title);
            continue;
          }

          emit({
            type: 'progress',
            stage: 'extracting',
            label: 'Extracting 5 Entities via Gemini',
            current: i + 1,
            total: items.length,
            title: item.title,
          });

          const prompt = `You are a research knowledge extractor for NexusGraph.
Given the thesis/paper metadata and abstract below (may be in Indonesian or English), extract 5 concise, grounded research entities in English. Do not fabricate empirical metrics that are not implied by the text.

Title: ${item.title}
Author: ${item.author}
Year: ${item.year}
Institution / Source: ${item.university}
Abstract / Description:
"""
${item.abstract.slice(0, 6000)}
"""

Return ONLY valid JSON:
{
  "problem": "Core research problem studied (1-2 sentences)",
  "method": "Methodology, model, or research design (1-2 sentences)",
  "dataset": "Dataset, corpus, participants, or study object (1 sentence)",
  "key_findings": "Primary findings or scope limitations stated (1-2 sentences)",
  "future_work": "Next-step research gap or open opportunity (1-2 sentences)"
}`;

          const entities = await generateJsonWithGemini<ExtractedEntities>(prompt, {
            temperature: 0.15,
          });

          emit({
            type: 'progress',
            stage: 'embedding',
            label: 'Generating Embeddings',
            current: i + 1,
            total: items.length,
            title: item.title,
          });

          const embeddingText = [
            item.title,
            entities.problem,
            entities.method,
            entities.dataset,
            entities.key_findings,
            entities.future_work,
          ]
            .filter(Boolean)
            .join(' | ');

          const embedding = await embedTextWithGemini(embeddingText);

          emit({
            type: 'progress',
            stage: 'saving',
            label: 'Saving to Supabase',
            current: i + 1,
            total: items.length,
            title: item.title,
          });

          const slug = item.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48);

          const corePayload = {
            file_name: `${slug || 'open-access'}-${item.year}.pdf`,
            title: item.title.trim(),
            author: (item.author || 'Open-Access Researcher').trim(),
            year: item.year || new Date().getFullYear(),
            problem: (entities.problem || item.abstract.slice(0, 200)).trim(),
            method: (entities.method || 'Empirical research methodology').trim(),
            dataset: (entities.dataset || item.university || 'Academic corpus').trim(),
            limitation: (entities.key_findings || 'Scope limited to harvested abstract metadata.').trim(),
            future_work: (entities.future_work || 'Expand experimental validation and comparative benchmarking.').trim(),
            is_verified: false,
            gap_claimed_by: null,
            gap_claimed_at: null,
            embedding,
          };

          const extendedPayload = {
            ...corePayload,
            key_findings: corePayload.limitation,
            source_url: item.sourceUrl || null,
            source_type: item.sourceType === 'campus_repo' ? 'campus_repo' : 'open_access',
            uploaded_by: user?.id || null,
            university: item.university || null,
          };

          let insertedRow: Record<string, unknown> | null = null;
          const extAttempt = await admin
            .from('theses')
            .insert(extendedPayload)
            .select(EXTENDED_THESIS_SELECT)
            .single();

          if (!extAttempt.error && extAttempt.data) {
            insertedRow = extAttempt.data as Record<string, unknown>;
          } else if (isSchemaMissingError(extAttempt.error)) {
            const baseAttempt = await admin
              .from('theses')
              .insert(corePayload)
              .select(BASE_THESIS_SELECT)
              .single();
            if (baseAttempt.error) throw baseAttempt.error;
            insertedRow = {
              ...(baseAttempt.data as Record<string, unknown>),
              key_findings: corePayload.limitation,
              source_url: item.sourceUrl || null,
              source_type: item.sourceType === 'campus_repo' ? 'campus_repo' : 'open_access',
              uploaded_by: user?.id || null,
              university: item.university || null,
            };
          } else {
            throw extAttempt.error;
          }

          existingTitleSet.add(normalizedTitle);
          imported.push(insertedRow);

          if (user && insertedRow?.id) {
            await updateUserProfileRecord(user, {
              addUploadedThesisId: String(insertedRow.id),
            }).catch(() => {});
          }
        }

        emit({
          type: 'complete',
          theses: imported,
          skipped,
        });
      } catch (err) {
        emit({
          type: 'error',
          error: (err as Error).message || 'Failed to import harvested records.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

