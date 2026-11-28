import { NextRequest, NextResponse } from 'next/server';
import type { HarvestCandidate } from '@/types';

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXmlTagValues(xmlBlock: string, tagName: string): string[] {
  const escaped = tagName.replace(':', '\\:');
  const regex = new RegExp(
    `<(?:[a-z0-9_-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${escaped}>`,
    'gi'
  );
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlBlock)) !== null) {
    const cleaned = decodeXmlEntities(match[1]);
    if (cleaned) values.push(cleaned);
  }
  return values;
}

function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [token, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = token;
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

function matchesAbstractKeywords(
  title: string,
  abstract: string,
  terms: string[]
): boolean {
  if (abstract.length < 40) return false;
  if (terms.length === 0) return true;
  const hay = `${title} ${abstract}`.toLowerCase();
  return terms.every((term) => hay.includes(term));
}

async function fetchOpenAlexWorks(
  searchTerm: string,
  filter: string,
  perPage: number,
  terms: string[],
  seenIds: Set<string>,
  maxTake: number
): Promise<HarvestCandidate[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(
    searchTerm
  )}&per-page=${perPage}&filter=${filter}&select=id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index,open_access`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'NexusGraph-Hackathon/1.0 (mailto:research@nexusgraph.app)',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`OpenAlex API returned HTTP ${res.status}.`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      doi?: string;
      title?: string;
      publication_year?: number;
      authorships?: Array<{
        author?: { display_name?: string };
        institutions?: Array<{ display_name?: string }>;
      }>;
      primary_location?: {
        landing_page_url?: string;
        pdf_url?: string;
        source?: { display_name?: string };
      };
      open_access?: { oa_url?: string };
      abstract_inverted_index?: Record<string, number[]>;
    }>;
  };

  const works = Array.isArray(data.results) ? data.results : [];
  const results: HarvestCandidate[] = [];

  for (let idx = 0; idx < works.length; idx++) {
    const w = works[idx];
    if (!w.title) continue;
    const extId = w.id || w.doi || w.title.trim().toLowerCase();
    if (seenIds.has(extId)) continue;

    const abstract = reconstructOpenAlexAbstract(w.abstract_inverted_index);
    if (!matchesAbstractKeywords(w.title, abstract, terms)) continue;

    const authors = (w.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    const university =
      w.authorships?.[0]?.institutions?.[0]?.display_name ||
      w.primary_location?.source?.display_name ||
      'OpenAlex Repository';
    const sourceUrl =
      w.primary_location?.pdf_url ||
      w.open_access?.oa_url ||
      w.doi ||
      w.primary_location?.landing_page_url ||
      w.id ||
      '';

    seenIds.add(extId);
    results.push({
      externalId: extId,
      title: w.title.trim(),
      author: authors || 'OpenAlex Contributor',
      year: w.publication_year || new Date().getFullYear(),
      university,
      abstract,
      sourceUrl,
      sourceType: 'open_access',
    });

    if (results.length >= maxTake) break;
  }

  return results;
}

async function harvestOpenAlex(
  query: string,
  limit: number
): Promise<HarvestCandidate[]> {
  const searchTerm = query.trim();
  if (!searchTerm) {
    throw new Error('Please enter a search keyword to harvest matching abstracts.');
  }

  const perPage = Math.min(Math.max(limit * 2, 50), 100);
  const terms = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  const seenIds = new Set<string>();

  const indonesiaResults = await fetchOpenAlexWorks(
    searchTerm,
    'has_abstract:true,type:dissertation,authorships.institutions.country_code:ID',
    perPage,
    terms,
    seenIds,
    limit
  );
  if (indonesiaResults.length >= limit) {
    return indonesiaResults.slice(0, limit);
  }

  const globalResults = await fetchOpenAlexWorks(
    searchTerm,
    'has_abstract:true,type:dissertation',
    perPage,
    terms,
    seenIds,
    limit - indonesiaResults.length
  );

  return [...indonesiaResults, ...globalResults].slice(0, limit);
}

function parseOaiRecords(xml: string, baseUrl: string): HarvestCandidate[] {
  const recordMatches = xml.match(/<record\b[\s\S]*?<\/record>/gi) || [];
  const results: HarvestCandidate[] = [];

  for (const block of recordMatches) {
    if (/<header[^>]*status="deleted"/i.test(block)) continue;

    const identifierVals = extractXmlTagValues(block, 'identifier');
    const titleVals = extractXmlTagValues(block, 'title');
    const creatorVals = extractXmlTagValues(block, 'creator');
    const dateVals = extractXmlTagValues(block, 'date');
    const descVals = extractXmlTagValues(block, 'description');
    const publisherVals = extractXmlTagValues(block, 'publisher');

    const title = titleVals[0];
    if (!title) continue;

    const abstract = descVals.sort((a, b) => b.length - a.length)[0] || '';
    const yearMatch = (dateVals[0] || '').match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    const pdfIdentifier = identifierVals.find((val) =>
      /^https?:\/\/.+\.pdf(\?.*)?$/i.test(val)
    );
    const urlIdentifier =
      pdfIdentifier || identifierVals.find((val) => /^https?:\/\//i.test(val));
    const oaiIdentifier = identifierVals.find((val) => val.startsWith('oai:'));
    const sourceUrl =
      urlIdentifier ||
      (oaiIdentifier
        ? `${baseUrl.split('?')[0]}?verb=GetRecord&metadataPrefix=oai_dc&identifier=${encodeURIComponent(oaiIdentifier)}`
        : baseUrl.split('?')[0]);

    let hostUniversity = 'Indonesian Campus Repository';
    try {
      const parsedHost = new URL(baseUrl).hostname.replace(/^www\./i, '');
      hostUniversity = publisherVals[0] || parsedHost;
    } catch {
      hostUniversity = publisherVals[0] || 'Indonesian Campus Repository';
    }

    results.push({
      externalId: oaiIdentifier || urlIdentifier || `oai-${results.length + 1}`,
      title,
      author: creatorVals.slice(0, 3).join(', ') || 'Campus Repository Author',
      year,
      university: hostUniversity,
      abstract,
      sourceUrl,
      sourceType: 'campus_repo',
    });
  }

  return results;
}

async function harvestOaiPmh(
  rawUrl: string,
  query: string,
  limit: number
): Promise<HarvestCandidate[]> {
  const cleanedBase = (rawUrl || 'http://etheses.uin-malang.ac.id/cgi/oai2')
    .trim()
    .split('?')[0];

  if (!/^https?:\/\/.+/i.test(cleanedBase)) {
    throw new Error('Campus OAI-PMH URL must begin with http:// or https://.');
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const matched: HarvestCandidate[] = [];
  const seenIds = new Set<string>();
  let resumptionToken: string | null = null;
  const MAX_PAGES = 3;

  for (let page = 0; page < MAX_PAGES && matched.length < limit; page++) {
    const fetchUrl: string = resumptionToken
      ? `${cleanedBase}?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
      : `${cleanedBase}?verb=ListRecords&metadataPrefix=oai_dc`;

    const res: Response = await fetch(fetchUrl, {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'NexusGraph-OAI-Harvester/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (page === 0) throw new Error(`Campus repository returned HTTP ${res.status}.`);
      break;
    }

    const xml: string = await res.text();
    if (!xml.includes('<record')) {
      if (page === 0) {
        throw new Error('The OAI-PMH endpoint did not return Dublin Core (<record>) entries.');
      }
      break;
    }

    const pageRecords = parseOaiRecords(xml, cleanedBase);
    for (const item of pageRecords) {
      if (seenIds.has(item.externalId)) continue;
      if (!matchesAbstractKeywords(item.title, item.abstract, terms)) continue;

      seenIds.add(item.externalId);
      matched.push(item);
      if (matched.length >= limit) break;
    }

    const tokenMatch: RegExpMatchArray | null =
      xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/i);
    resumptionToken = tokenMatch?.[1]?.trim() || null;
    if (!resumptionToken) break;
  }

  return matched.slice(0, limit);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sourceType = body?.sourceType === 'oai_pmh' ? 'oai_pmh' : 'openalex';
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const oaiUrl = typeof body?.oaiUrl === 'string' ? body.oaiUrl.trim() : '';
    const limitRaw = typeof body?.limit === 'number' ? body.limit : 30;
    const limit = Math.min(Math.max(Math.round(limitRaw), 1), 50);

    const items =
      sourceType === 'oai_pmh'
        ? await harvestOaiPmh(oaiUrl, query, limit)
        : await harvestOpenAlex(query, limit);

    return NextResponse.json({
      sourceType,
      count: items.length,
      items,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          (err as Error).message ||
          'Failed to harvest records from external academic source.',
      },
      { status: 500 }
    );
  }
}