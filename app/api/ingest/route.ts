import { createRequire } from 'module';
import { NextRequest } from 'next/server';
import { embedTextWithGemini, generateJsonWithGemini } from '@/lib/gemini';
import {
  BASE_THESIS_SELECT,
  EXTENDED_THESIS_SELECT,
  getAdminSupabase,
  getAuthenticatedSession,
  isSchemaMissingError,
  updateUserProfileRecord,
} from '@/lib/serverSupabase';

const require = createRequire(import.meta.url);

interface GatekeeperResponse {
  is_academic: boolean;
  confidence?: number;
  rejection_reason?: string;
}

interface ExtractedThesisMetadata {
  title: string;
  author: string;
  year: number;
  university?: string;
  problem: string;
  method: string;
  dataset: string;
  key_findings: string;
  future_work: string;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2 compatibility matching scripts/ingest.js
  const pdfParseModule = require('pdf-parse') as
    | ((buf: Buffer) => Promise<{ text?: string }>)
    | {
        default?: (buf: Buffer) => Promise<{ text?: string }>;
        PDFParse?: new (opts: { data: Buffer }) => {
          getText?: () => Promise<string | { text?: string }>;
          parse?: () => Promise<{ text?: string }>;
          destroy?: () => Promise<void>;
        };
      };

  if (typeof pdfParseModule === 'function') {
    const res = await pdfParseModule(buffer);
    return res?.text || '';
  }
  if (typeof pdfParseModule?.default === 'function') {
    const res = await pdfParseModule.default(buffer);
    return res?.text || '';
  }
  if (typeof pdfParseModule?.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    try {
      if (typeof parser.getText === 'function') {
        const res = await parser.getText();
        return typeof res === 'string' ? res : res?.text || '';
      }
      if (typeof parser.parse === 'function') {
        const res = await parser.parse();
        return res?.text || '';
      }
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  }
  throw new Error('PDF parser engine could not be initialized.');
}

function ndjsonLine(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthenticatedSession(req);
  const formData = await req.formData();
  const file = formData.get('file');
  const rawSourceUrl = formData.get('sourceUrl');
  const sourceUrl =
    typeof rawSourceUrl === 'string' && rawSourceUrl.trim()
      ? rawSourceUrl.trim()
      : null;

  if (
    sourceUrl &&
    !/^https?:\/\/.+/i.test(sourceUrl)
  ) {
    return new Response(
      JSON.stringify({
        error: 'Original Repository URL must start with http:// or https://.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'Please select a PDF file to upload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const fileName = file.name || 'uploaded-thesis.pdf';
  if (!fileName.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return new Response(
      JSON.stringify({ error: 'Only valid PDF documents (.pdf) are supported.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (payload: Record<string, unknown>) => {
        if (!closed) {
          controller.enqueue(ndjsonLine(payload));
        }
      };

      try {
        emit({ type: 'progress', step: 1, label: 'Uploading PDF' });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.byteLength < 100) {
          emit({
            type: 'error',
            stage: 'upload',
            error: 'The uploaded PDF file appears empty or corrupted.',
          });
          return;
        }

        let rawText = '';
        try {
          rawText = await extractPdfText(buffer);
        } catch (pdfErr) {
          emit({
            type: 'error',
            stage: 'upload',
            error: `Could not read PDF content: ${(pdfErr as Error).message}`,
          });
          return;
        }

        const normalizedText = rawText.replace(/\s+/g, ' ').trim();
        const wordCount = normalizedText ? normalizedText.split(/\s+/).length : 0;

        emit({
          type: 'progress',
          step: 2,
          label: 'Validating Academic Structure (AI Gatekeeper)',
        });

        if (wordCount < 35 || normalizedText.length < 220) {
          emit({
            type: 'error',
            stage: 'gatekeeper',
            error:
              'Rejected by AI Gatekeeper: The PDF has too little readable academic text (scanned image without OCR or empty placeholder). Please upload a text-readable thesis or research paper.',
          });
          return;
        }

        const excerpt = normalizedText.slice(0, 9500);
        const gatekeeperPrompt = `You are NexusGraph's strict Academic Structure Gatekeeper.
Evaluate whether the following document excerpt represents a genuine academic thesis, skripsi, dissertation, or scientific research paper (not an invoice, receipt, dummy lorem ipsum, random test notes, restaurant menu, form, or non-academic brochure).

Document filename: "${fileName}"
Excerpt:
"""
${excerpt}
"""

Return ONLY valid JSON:
{
  "is_academic": true or false,
  "confidence": 0.0 to 1.0,
  "rejection_reason": "Short, specific reason in English if is_academic is false; otherwise empty string"
}`;

        const gatekeeper = await generateJsonWithGemini<GatekeeperResponse>(
          gatekeeperPrompt,
          { temperature: 0.1 }
        );

        if (!gatekeeper.is_academic) {
          emit({
            type: 'error',
            stage: 'gatekeeper',
            error: `Rejected by AI Gatekeeper: ${
              gatekeeper.rejection_reason ||
              'This document does not exhibit valid academic thesis or research paper structure.'
            }`,
          });
          return;
        }

        emit({
          type: 'progress',
          step: 3,
          label: 'Extracting 5 Entities & Embeddings',
        });

        const extractPrompt = `You are an academic research extraction agent.
Analyze this research thesis/paper excerpt (which may be in Indonesian or English) and extract metadata plus 5 structured research entities in clear, concise ENGLISH (translate Indonesian abstracts accurately into academic English while preserving proper method/dataset names).

Filename: "${fileName}"
Text Excerpt:
"""
${normalizedText.slice(0, 14000)}
"""

Return ONLY valid JSON with these exact keys:
{
  "title": "Exact full thesis/paper title",
  "author": "Author full name(s) or 'Unknown Author' if absent",
  "year": 2024,
  "university": "University or institution name if mentioned, else ''",
  "problem": "Concise summary of the Research Problem addressed (1-2 sentences)",
  "method": "Concise summary of the Methodology / algorithms / framework (1-2 sentences)",
  "dataset": "Dataset, sample size, or study object evaluated (1-2 sentences)",
  "key_findings": "Concise Key Findings & current limitations identified (1-2 sentences)",
  "future_work": "Recommended Research Gap / Future Work proposed (1-2 sentences)"
}`;

        const extracted = await generateJsonWithGemini<ExtractedThesisMetadata>(
          extractPrompt,
          { temperature: 0.15 }
        );

        const safeTitle =
          (extracted.title || fileName.replace(/\.pdf$/i, '')).trim();
        const safeYear =
          typeof extracted.year === 'number' &&
          extracted.year >= 1990 &&
          extracted.year <= 2030
            ? Math.round(extracted.year)
            : new Date().getFullYear();

        const semanticDocument = [
          safeTitle,
          extracted.problem,
          extracted.method,
          extracted.dataset,
          extracted.key_findings,
          extracted.future_work,
        ]
          .filter(Boolean)
          .join(' | ');

        const embedding = await embedTextWithGemini(semanticDocument);
        const admin = getAdminSupabase();

        const corePayload = {
          file_name: fileName,
          title: safeTitle,
          author: (extracted.author || 'Personal Upload').trim(),
          year: safeYear,
          problem: (extracted.problem || 'Problem formulation extracted from uploaded PDF.').trim(),
          method: (extracted.method || 'Methodology extracted from uploaded PDF.').trim(),
          dataset: (extracted.dataset || 'Dataset/study object described in manuscript.').trim(),
          limitation: (extracted.key_findings || 'Key findings & scope constraints documented in study.').trim(),
          future_work: (extracted.future_work || 'Open research directions identified from uploaded manuscript.').trim(),
          is_verified: false,
          gap_claimed_by: null,
          gap_claimed_at: null,
          embedding,
        };

        const extendedPayload = {
          ...corePayload,
          key_findings: corePayload.limitation,
          source_url: sourceUrl,
          source_type: 'personal',
          uploaded_by: user?.id || null,
          university: (extracted.university || '').trim() || null,
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
            source_url: sourceUrl,
            source_type: 'personal',
            uploaded_by: user?.id || null,
            university: (extracted.university || '').trim() || null,
          };
        } else {
          throw extAttempt.error;
        }

        if (user && insertedRow?.id) {
          await updateUserProfileRecord(user, {
            addUploadedThesisId: String(insertedRow.id),
          }).catch(() => {});
        }

        emit({ type: 'progress', step: 4, label: 'Added to Graph' });
        emit({ type: 'complete', thesis: insertedRow });
      } catch (err) {
        emit({
          type: 'error',
          stage: 'extract',
          error: (err as Error).message || 'Failed to ingest uploaded PDF.',
        });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed by client abort
          }
        }
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

