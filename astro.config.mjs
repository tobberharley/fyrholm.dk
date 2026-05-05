// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tobberharley.github.io/fyrholm.dk',
  base: '/fyrholm.dk',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true },
  build: {
    format: 'directory'
  }
});
