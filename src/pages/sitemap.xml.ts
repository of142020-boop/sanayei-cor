import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const DEFAULT_LASTMOD = '2026-11-23';

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.origin || 'https://sanayeicor.com';
  const pages = Object.keys(import.meta.glob('./**/*.astro'))
    .filter(path => !path.includes('[') && path !== './404.astro')
    .map(path => path.replace(/^\.\//, '/').replace(/(?:index)?\.astro$/, '').replace(/\/?$/, '/'));

  const posts = await getCollection('blog');
  const postLastModified = new Map(
    posts.map(post => [
      `/مقالات/${post.id}/`,
      (post.data.updatedDate || post.data.date).toISOString().slice(0, 10),
    ]),
  );

  const urls = [...new Set([...pages, ...posts.map(post => `/مقالات/${post.id}/`)])].sort();
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(path => {
        const loc = new URL(path, origin).href.replaceAll('&', '&amp;');
        const lastmod = postLastModified.get(path) || DEFAULT_LASTMOD;
        return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
      })
      .join('') +
    `</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
