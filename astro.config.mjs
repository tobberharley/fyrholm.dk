// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tobberharley.github.io',
  base: '/fyrholm.dk',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  build: {
    format: 'directory'
  }
});
