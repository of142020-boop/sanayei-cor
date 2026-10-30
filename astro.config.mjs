import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://sanayeicor.com',
  trailingSlash: 'always',
  redirects: {
    '/تخريم-خرسانة': '/خدماتنا/تخريم-خرسانة/',
    '/قص-خرسانة': '/خدماتنا/قص-الخرسانة-بالمنشار/',
    '/خدماتنا/فتحات-غاز': '/خدماتنا/فتحات-الغاز-والشفاطات/',
  },
});
