import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
export const GET: APIRoute = async ({ site }) => {
  const pages = Object.keys(import.meta.glob('./**/*.astro'))
    .filter(path => !path.includes('[') && path !== './404.astro')
    .map(path => path.replace(/^\.\//, '/').replace(/(?:index)?\.astro$/, '').replace(/\/?$/, '/'));
  const posts = await getCollection('blog');
  const urls = [...new Set([...pages, ...posts.map(post => `/مقالات/${post.id}/`)])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path => `<url><loc>${new URL(path, site).href.replaceAll('&', '&amp;')}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
