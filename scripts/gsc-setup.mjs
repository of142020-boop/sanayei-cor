import fs from 'node:fs';
import crypto from 'node:crypto';

const property = 'sc-domain:sanayeicor.com';
const sitemap = 'https://sanayeicor.com/sitemap.xml';
const keyPath = new URL('../secrets/gsc-key.json', import.meta.url);

if (!fs.existsSync(keyPath)) {
  throw new Error('Missing secrets/gsc-key.json. Keep the Service Account key outside Git.');
}

const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Google authentication failed (${response.status}).`);
  return data.access_token;
}

const token = await accessToken();
const headers = { Authorization: `Bearer ${token}` };
const encodedProperty = encodeURIComponent(property);
const encodedSitemap = encodeURIComponent(sitemap);

const sitesResponse = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers, signal: AbortSignal.timeout(20_000) });
const sites = await sitesResponse.json();
const site = (sites.siteEntry ?? []).find((entry) => entry.siteUrl === property);
if (!site) throw new Error(`The Service Account does not have access to ${property}. Add it in Search Console users and permissions.`);

const submitResponse = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedProperty}/sitemaps/${encodedSitemap}`, {
  method: 'PUT', headers, signal: AbortSignal.timeout(20_000),
});
if (submitResponse.status !== 204) throw new Error(`Sitemap submission failed (${submitResponse.status}).`);

const sitemapResponse = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedProperty}/sitemaps/${encodedSitemap}`, { headers, signal: AbortSignal.timeout(20_000) });
const sitemapData = sitemapResponse.ok ? await sitemapResponse.json() : null;

console.log(JSON.stringify({
  property,
  permission: site.permissionLevel,
  sitemap,
  sitemapSubmitted: true,
  sitemapStatus: sitemapData?.isPending ? 'pending' : 'accepted',
  lastDownloaded: sitemapData?.lastDownloaded ?? null,
  warnings: sitemapData?.warnings ?? null,
  errors: sitemapData?.errors ?? null,
}, null, 2));
