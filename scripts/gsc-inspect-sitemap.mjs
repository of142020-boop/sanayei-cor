import fs from 'node:fs';
import crypto from 'node:crypto';

const property = 'sc-domain:sanayeicor.com';
const sitemapUrl = 'https://sanayeicor.com/sitemap.xml';
const keyPath = new URL('../secrets/gsc-key.json', import.meta.url);

console.log('Starting Search Console sitemap inspection...');

if (!fs.existsSync(keyPath)) throw new Error('Missing secrets/gsc-key.json.');
const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google authentication failed (${response.status}).`);
  return data.access_token;
}

const sitemapResponse = await fetch(sitemapUrl, { signal: AbortSignal.timeout(20_000) });
if (!sitemapResponse.ok) throw new Error(`Could not fetch sitemap (${sitemapResponse.status}).`);
const sitemap = await sitemapResponse.text();
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
if (!urls.length) throw new Error('No URLs found in sitemap.');
const limit = Math.min(Number(process.env.GSC_LIMIT ?? urls.length), urls.length);
const inspectionUrls = urls.slice(0, limit);
const concurrency = Math.min(Number(process.env.GSC_CONCURRENCY ?? 3), inspectionUrls.length);
console.log(`Found ${urls.length} URLs in sitemap; inspecting ${inspectionUrls.length}.`);

const token = await accessToken();
let nextIndex = 0;
const results = [];

async function inspect(url) {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'ar' }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (!response.ok) return { url, error: data.error?.message ?? `HTTP ${response.status}` };
  const status = data.inspectionResult?.indexStatusResult;
  return {
    url,
    verdict: status?.verdict ?? 'UNKNOWN',
    coverageState: status?.coverageState ?? 'Unknown',
    indexingState: status?.indexingState ?? 'Unknown',
    lastCrawlTime: status?.lastCrawlTime ?? null,
  };
}

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (nextIndex < inspectionUrls.length) {
    const url = inspectionUrls[nextIndex++];
    results.push(await inspect(url));
  }
}));

const indexed = results.filter((result) => result.verdict === 'PASS');
const needsAttention = results.filter((result) => result.verdict !== 'PASS' && !result.error);
const errors = results.filter((result) => result.error);
const report = {
  inspected: results.length,
  indexed: indexed.length,
  needsAttention,
  errors,
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/gsc-latest-inspection.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ inspected: report.inspected, indexed: report.indexed, needsAttention: report.needsAttention.length, errors: report.errors.length }, null, 2));
