import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const OAI_URL = 'http://etheses.uin-malang.ac.id/cgi/oai2';
const TARGET_COUNT = 20;
const KEYWORD = '';
const MAX_OAI_PAGES = 10;
const GEMINI_DELAY_MS = 5000;
const isDryRun = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeXml(input) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
    .replace(/\s+/g, ' ')
    .trim();
}

function getTags(xml, tag) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<(?:[a-z0-9_-]+:)?${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${escapedTag}\\s*>`,
    'gi'
  );
  const values = [];
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const value = decodeXml(match[1]);
    if (value) values.push(value);
  }
  return values;
}

async function fetchOaiTheses() {
  const endpoint = new URL(OAI_URL);
  endpoint.search = '';
  const items = [];
  const seenIds = new Set();
  let resumptionToken = '';

  for (let page = 0; page < MAX_OAI_PAGES && items.length < TARGET_COUNT; page++) {
    const requestUrl = new URL(endpoint);
    requestUrl.searchParams.set('verb', 'ListRecords');
    if (resumptionToken) {
      requestUrl.searchParams.set('resumptionToken', resumptionToken);
    } else {
      requestUrl.searchParams.set('metadataPrefix', 'oai_dc');
    }

    const response = await fetch(requestUrl, {
      headers: { Accept: 'application/xml, text/xml' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`OAI-PMH returned HTTP ${response.status}.`);
    }

    const xml = await response.text();
    const records = xml.match(/<record\b[\s\S]*?<\/record>/gi) || [];
    if (records.length === 0 && page === 0) {
      throw new Error('OAI-PMH response did not contain any records.');
    }

    for (const record of records) {
      if (/<header[^>]*status="deleted"/i.test(record)) continue;

      const title = getTags(record, 'title')[0];
      const descriptions = getTags(record, 'description');
      const abstract = descriptions.sort((a, b) => b.length - a.length)[0] || '';
      if (!title || abstract.length < 80) continue;
      if (KEYWORD && !`${title} ${abstract}`.toLowerCase().includes(KEYWORD.toLowerCase())) {
        continue;
      }

      const identifiers = getTags(record, 'identifier');
      const identifier = identifiers.find((value) => value.startsWith('oai:'));
      const pdfIdentifier = identifiers.find((value) =>
        /^https?:\/\/.+\.pdf(\?.*)?$/i.test(value)
      );
      const urlIdentifier =
        pdfIdentifier || identifiers.find((value) => /^https?:\/\//i.test(value));
      const key = identifier || title.toLowerCase();
      if (seenIds.has(key)) continue;
      seenIds.add(key);

      const yearMatch = (getTags(record, 'date')[0] || '').match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
      items.push({
        identifier,
        sourceUrl: urlIdentifier,
        title,
        author: getTags(record, 'creator').slice(0, 2).join(', ') || 'UIN Malang Thesis Author',
        year,
        abstract,
      });

      if (items.length >= TARGET_COUNT) break;
    }

    const tokenMatch = xml.match(
      /<resumptionToken(?:\s[^>]*)?>([\s\S]*?)<\/resumptionToken>/i
    );
    resumptionToken = tokenMatch ? decodeXml(tokenMatch[1]) : '';
    if (!resumptionToken) break;
  }

  return items;
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

async function callGemini(model, method, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': requireEnvironment('GEMINI_API_KEY'),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Gemini HTTP ${response.status}: ${data?.error?.message || 'Request failed.'}`
    );
  }

  await sleep(GEMINI_DELAY_MS);
  return data;
}

async function extractEntities(item) {
  const prompt = `Extract five concise academic research entities in English from this Indonesian thesis abstract. Return only valid JSON with keys: problem, method, dataset, key_findings, future_work.
Title: ${item.title}
Abstract: ${item.abstract.slice(0, 4000)}`;
  const data = await callGemini('gemini-2.5-flash', 'generateContent', {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new Error('Gemini returned no structured entity response.');
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Gemini returned invalid JSON for thesis entities.');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function embedText(text) {
  const data = await callGemini('gemini-embedding-001', 'embedContent', {
    content: { parts: [{ text: text.slice(0, 8000) }] },
    outputDimensionality: 768,
  });
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) {
    throw new Error('Gemini returned an invalid 768-dimensional embedding.');
  }
  return values;
}

async function fetchExistingTitles(supabase) {
  const titles = new Set();
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from('theses')
      .select('title')
      .range(start, start + pageSize - 1);
    if (error) throw error;

    for (const row of data || []) {
      if (row.title) titles.add(row.title.trim().toLowerCase());
    }
    if (!data || data.length < pageSize) break;
  }
  return titles;
}

async function main() {
  console.log('Fetching OAI-PMH thesis records...');
  const items = await fetchOaiTheses();
  console.log(`Found ${items.length} thesis records with abstracts.`);

  if (isDryRun) {
    for (const [index, item] of items.entries()) {
      console.log(`${index + 1}. ${item.title} (${item.year})`);
    }
    console.log('Dry run complete; nothing was written to Supabase.');
    return;
  }

  const supabase = createClient(
    requireEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  );
  const existingTitles = await fetchExistingTitles(supabase);

  for (const [index, item] of items.entries()) {
    const normalizedTitle = item.title.trim().toLowerCase();
    if (existingTitles.has(normalizedTitle)) {
      console.log(`Skipping existing thesis: ${item.title}`);
      continue;
    }

    try {
      console.log(`[${index + 1}/${items.length}] Processing: ${item.title}`);
      const entities = await extractEntities(item);
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
      const embedding = await embedText(embeddingText);
      const slug =
        item.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 45) || 'thesis';
      const sourceUrl =
        item.sourceUrl ||
        (item.identifier
          ? `${OAI_URL}?verb=GetRecord&metadataPrefix=oai_dc&identifier=${encodeURIComponent(item.identifier)}`
          : OAI_URL);

      const { error } = await supabase.from('theses').insert({
        file_name: `${slug}-${item.year}.pdf`,
        title: item.title,
        author: item.author,
        year: item.year,
        problem: entities.problem || item.abstract.slice(0, 200),
        method: entities.method || 'Research methodology described in the abstract.',
        dataset: entities.dataset || 'UIN Malang thesis repository',
        limitation: entities.key_findings || 'Limited to the repository abstract.',
        key_findings: entities.key_findings || null,
        future_work: entities.future_work || 'Further empirical validation recommended.',
        is_verified: false,
        embedding,
        source_url: sourceUrl,
        source_type: 'campus_repo',
        university: 'UIN Malang E-Theses',
      });
      if (error) throw error;

      existingTitles.add(normalizedTitle);
      console.log(`Inserted: ${item.title}`);
    } catch (error) {
      console.error(`Failed to process "${item.title}":`, error.message);
      if (/429|RESOURCE_EXHAUSTED/i.test(error.message)) {
        console.error('Gemini rate limit reached; stopping the seeding run.');
        break;
      }
    }
  }

  console.log('Seeding run complete.');
}

main().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
});
