const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GENERATION_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }
  return key;
}

export async function embedTextWithGemini(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) {
    throw new Error('Cannot generate embedding for empty text.');
  }

  const res = await fetch(
    `${GEMINI_BASE_URL}/gemini-embedding-001:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: trimmed }] },
        outputDimensionality: 768,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok || !Array.isArray(data?.embedding?.values)) {
    throw new Error(
      data?.error?.message || `Gemini embedding request failed (${res.status}).`
    );
  }

  return data.embedding.values as number[];
}

export async function generateWithGemini(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number } = {}
): Promise<string> {
  const apiKey = getGeminiApiKey();
  let lastError = 'Gemini generation failed.';

  for (const model of GENERATION_MODELS) {
    const res = await fetch(
      `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxOutputTokens ?? 1800,
          },
        }),
      }
    );

    const data = await res.json();
    if (res.ok && data?.candidates?.[0]?.content?.parts) {
      const text = data.candidates[0].content.parts
        .map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();
      if (text) return text;
    }

    lastError = data?.error?.message || `Gemini HTTP ${res.status} on ${model}`;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      break;
    }
  }

  throw new Error(lastError);
}

export async function generateJsonWithGemini<T>(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number } = {}
): Promise<T> {
  const raw = await generateWithGemini(prompt, options);
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(candidate) as T;
}

