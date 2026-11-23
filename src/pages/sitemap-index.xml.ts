import type { APIRoute } from 'astro';

const SITE_LASTMOD = '2026-11-23';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://sanayeicor.com';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    `<sitemap><loc>${origin}/sitemap.xml</loc><lastmod>${SITE_LASTMOD}</lastmod></sitemap>` +
    `</sitemapindex>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
