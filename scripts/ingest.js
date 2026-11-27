import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PDF_DIR = './pdfs';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GENERATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

async function isAlreadyIngested(fileName) {
  const { data, error } = await supabase
    .from('theses')
    .select('file_name')
    .eq('file_name', fileName)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.file_name);
}

async function callGeminiGenerate(prompt) {
  let lastErr = null;

  for (const modelName of GENERATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        console.log(`   ↳ Berhasil pakai model: ${modelName}`);
        return JSON.parse(cleaned);
      }

      const errMsg = `Gemini [${modelName}] [${res.status}]: ${JSON.stringify(data.error || data)}`;
      if (res.status === 503 || res.status === 404) {
        console.warn(`⚠️ ${modelName} tidak tersedia (${res.status}), mencoba model berikutnya...`);
        lastErr = new Error(errMsg);
        continue;
      }
      throw new Error(errMsg);
    } catch (err) {
      lastErr = err;
      if (String(err.message).includes('429') || String(err.message).includes('RESOURCE_EXHAUSTED')) {
        throw err;
      }
      console.warn(`⚠️ ${modelName} error: ${err.message}. Mencoba model berikutnya...`);
    }
  }

  throw lastErr || new Error('Semua model Gemini gagal merespons.');
}

async function generateEmbedding(text) {
  const candidates = ['gemini-embedding-001'];
  let lastErr = null;

  for (const modelName of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] }, outputDimensionality: 768,
      }),
    });

    const data = await res.json();
    if (res.ok && data?.embedding?.values) {
      return data.embedding.values;
    }
    lastErr = new Error(`Embedding [${modelName}] [${res.status}]: ${JSON.stringify(data.error || data)}`);
  }

  throw lastErr;
}

async function extractTextFromPdf(dataBuffer) {
  if (typeof pdfParseModule === 'function') {
    const res = await pdfParseModule(dataBuffer);
    return res.text || '';
  }
  if (typeof pdfParseModule?.default === 'function') {
    const res = await pdfParseModule.default(dataBuffer);
    return res.text || '';
  }
  if (typeof pdfParseModule?.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
    if (typeof parser.getText === 'function') {
      const res = await parser.getText();
      return typeof res === 'string' ? res : (res?.text || '');
    }
    if (typeof parser.parse === 'function') {
      const res = await parser.parse();
      return res?.text || '';
    }
  }
  throw new Error('Struktur export pdf-parse tidak dikenali: ' + Object.keys(pdfParseModule || {}).join(', '));
}

async function extractEntities(text) {
  const trimmedText = text.length > 25000
    ? text.slice(0, 15000) + '\n...\n' + text.slice(-10000)
    : text;

  const prompt = `
    Analyze this Indonesian undergraduate Informatics thesis text and extract the following structured fields in English (concise, academic tone).
    Return strictly JSON with these keys:
    {
      "title": "Thesis title",
      "author": "Author name",
      "year": 2024,
      "problem": "Core research problem (2 sentences)",
      "method": "Main algorithm/method used (e.g., YOLOv8, Random Forest, Next.js)",
      "dataset": "Dataset used and its source/size",
      "limitation": "Stated weaknesses or bottlenecks",
      "future_work": "Recommendations for future research"
    }

    Text:
    ${trimmedText}
  `;

  return callGeminiGenerate(prompt);
}

async function run() {
  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Ditemukan ${files.length} file PDF. Memulai ekstraksi...`);

  for (const file of files) {
    try {
      if (await isAlreadyIngested(file)) {
        console.log(`⏭️ Melewati ${file} (sudah ada di tabel theses).`);
        continue;
      }

      console.log(`Memproses: ${file}...`);
      const dataBuffer = fs.readFileSync(path.join(PDF_DIR, file));
      const pdfText = await extractTextFromPdf(dataBuffer);

      const extracted = await extractEntities(pdfText);

      const textToEmbed = `${extracted.title}. Problem: ${extracted.problem}. Method: ${extracted.method}. Dataset: ${extracted.dataset}. Future Work: ${extracted.future_work}`;
      const embedding = await generateEmbedding(textToEmbed);

      const { error } = await supabase.from('theses').upsert({
        file_name: file,
        title: extracted.title,
        author: extracted.author,
        year: extracted.year || 2024,
        problem: extracted.problem,
        method: extracted.method,
        dataset: extracted.dataset,
        limitation: extracted.limitation,
        future_work: extracted.future_work,
        embedding
      }, { onConflict: 'file_name' });

      if (error) throw error;
      console.log(`✅ Berhasil masuk DB: ${extracted.title}`);

      await sleep(2000);
    } catch (err) {
      console.error(`❌ Gagal memproses ${file}:`, err.message);
      if (String(err?.message || '').includes('429') || String(err?.message || '').includes('RESOURCE_EXHAUSTED')) {
        console.error('🛑 Kuota API habis (429). Menghentikan proses.');
        break;
      }
    }
  }
}

run();

