#!/usr/bin/env node
/**
 * Post-build translator.
 *
 * Walks every .html file in dist/, extracts user-visible text nodes,
 * translates them via DeepL (batched + cached), and writes a parallel
 * /en/ mirror with translated content + internal links rewritten to /en/.
 *
 * Skip rules:
 *  - <script>, <style>, <code>, <pre>, <noscript>
 *  - any element with class="notranslate" or translate="no"
 *  - any element under [lang="..."] that is not Danish
 *
 * Cache: scripts/.translation-cache.json (committed) keyed by SHA-1
 * of the source string. Lets repeat builds run with zero API calls
 * if content is unchanged.
 *
 * If DEEPL_API_KEY is missing, the script no-ops silently — useful for
 * local dev and PR builds without the secret.
 */

import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const EN_DIR = path.join(DIST, 'en');
const CACHE_FILE = path.join(ROOT, 'scripts', '.translation-cache.json');
const SITE_BASE = '/fyrholm.dk';
const API_KEY = process.env.DEEPL_API_KEY;
const API_HOST = process.env.DEEPL_API_HOST || (API_KEY && API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com'
  : 'https://api.deepl.com');

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'code', 'pre', 'textarea']);

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

async function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the /en/ output of a previous run + Pagefind index
      if (full === EN_DIR) continue;
      if (entry.name === 'pagefind') continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function shouldSkip($, el) {
  let cur = el;
  while (cur && cur.type !== 'root') {
    if (cur.type === 'tag') {
      const name = cur.name?.toLowerCase();
      if (SKIP_TAGS.has(name)) return true;
      const $cur = $(cur);
      if ($cur.attr('translate') === 'no') return true;
      const cls = ($cur.attr('class') || '').split(/\s+/);
      if (cls.includes('notranslate')) return true;
    }
    cur = cur.parent;
  }
  return false;
}

function collectTexts($) {
  const texts = new Set();
  $('*')
    .contents()
    .each(function () {
      if (this.type !== 'text') return;
      const raw = this.data;
      if (!raw) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (shouldSkip($, this.parent)) return;
      texts.add(trimmed);
    });

  // Translate-worthy attributes
  $('[alt], [title], [placeholder], [aria-label], meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[name="twitter:description"], meta[name="twitter:title"]').each(function () {
    const $el = $(this);
    if (shouldSkip($, this)) return;
    for (const attr of ['alt', 'title', 'placeholder', 'aria-label']) {
      const v = $el.attr(attr);
      if (v && v.trim()) texts.add(v.trim());
    }
    if (this.name === 'meta') {
      const v = $el.attr('content');
      if (v && v.trim()) texts.add(v.trim());
    }
  });

  // <title>
  const titleText = $('title').text();
  if (titleText && titleText.trim()) texts.add(titleText.trim());

  return [...texts];
}

async function translateBatch(strings, cache) {
  const missing = strings.filter((s) => !(sha1(s) in cache));
  if (!missing.length) return;
  if (!API_KEY) {
    // No key — just copy source to "translated" (effectively skip).
    for (const s of missing) cache[sha1(s)] = s;
    return;
  }
  // DeepL accepts up to 50 text params per request and recommends batching.
  const CHUNK = 50;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const slice = missing.slice(i, i + CHUNK);
    const params = new URLSearchParams();
    params.append('source_lang', 'DA');
    params.append('target_lang', 'EN-GB');
    params.append('preserve_formatting', '1');
    params.append('tag_handling', 'xml');
    params.append('ignore_tags', 'span,code,kbd');
    for (const s of slice) params.append('text', s);
    const res = await fetch(`${API_HOST}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DeepL ${res.status}: ${body}`);
    }
    const json = await res.json();
    json.translations.forEach((t, idx) => {
      cache[sha1(slice[idx])] = t.text;
    });
    process.stdout.write(`  · translated ${Math.min(i + CHUNK, missing.length)}/${missing.length}\r`);
  }
  process.stdout.write('\n');
}

function applyTranslations($, cache) {
  $('*')
    .contents()
    .each(function () {
      if (this.type !== 'text') return;
      const raw = this.data;
      if (!raw) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (shouldSkip($, this.parent)) return;
      const t = cache[sha1(trimmed)];
      if (t == null) return;
      // Preserve leading/trailing whitespace
      const leading = raw.match(/^\s*/)[0];
      const trailing = raw.match(/\s*$/)[0];
      this.data = leading + t + trailing;
    });

  $('[alt], [title], [placeholder], [aria-label]').each(function () {
    if (shouldSkip($, this)) return;
    const $el = $(this);
    for (const attr of ['alt', 'title', 'placeholder', 'aria-label']) {
      const v = $el.attr(attr);
      if (!v) continue;
      const trimmed = v.trim();
      if (!trimmed) continue;
      const t = cache[sha1(trimmed)];
      if (t != null) $el.attr(attr, t);
    }
  });

  $('meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[name="twitter:description"], meta[name="twitter:title"]').each(function () {
    const $el = $(this);
    const v = $el.attr('content');
    if (!v) return;
    const trimmed = v.trim();
    if (!trimmed) return;
    const t = cache[sha1(trimmed)];
    if (t != null) $el.attr('content', t);
  });

  const $title = $('title');
  const tt = $title.text().trim();
  if (tt) {
    const t = cache[sha1(tt)];
    if (t != null) $title.text(t);
  }

  $('html').attr('lang', 'en');
}

function rewriteLinks($) {
  // Rewrite internal links to point at /fyrholm.dk/en/...
  const rewrite = (val) => {
    if (!val) return val;
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:') || val.startsWith('tel:') || val.startsWith('#')) return val;
    if (!val.startsWith(SITE_BASE)) return val;
    if (val.startsWith(`${SITE_BASE}/en/`) || val === `${SITE_BASE}/en`) return val;
    // skip files (images, PDFs, RSS)
    if (/\.(pdf|jpg|jpeg|png|webp|gif|svg|ico|xml|json|txt|css|js|woff2?)(\?|$|#)/i.test(val)) return val;
    const after = val.slice(SITE_BASE.length); // starts with /
    return `${SITE_BASE}/en${after}`;
  };

  $('a[href]').each(function () {
    const $el = $(this);
    $el.attr('href', rewrite($el.attr('href')));
  });
  $('link[rel="canonical"]').remove();
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function copyAssets() {
  // We don't duplicate static assets — /en/ pages reference the originals at /fyrholm.dk/...
  // Pagefind (run after) indexes both /…/index.html and /en/…/index.html
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('No dist/ directory — run astro build first.');
    process.exit(1);
  }
  if (!API_KEY) {
    console.log('translate-build: DEEPL_API_KEY not set — skipping (DA-only build).');
    return;
  }
  console.log('translate-build: generating /en/ mirror via DeepL …');

  const cache = await loadCache();

  // Collect all HTML files
  const htmlFiles = [];
  for await (const f of walk(DIST)) {
    if (f.endsWith('.html')) htmlFiles.push(f);
  }

  // First pass: gather every unique source string
  console.log(`  · scanning ${htmlFiles.length} pages`);
  const allTexts = new Set();
  const docs = [];
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });
    docs.push({ file, $ });
    for (const t of collectTexts($)) allTexts.add(t);
  }

  console.log(`  · ${allTexts.size} unique strings`);
  await translateBatch([...allTexts], cache);
  await saveCache(cache);

  // Second pass: emit translated copy under /en/
  for (const { file, $ } of docs) {
    applyTranslations($, cache);
    rewriteLinks($);
    const rel = path.relative(DIST, file);
    const out = path.join(EN_DIR, rel);
    await ensureDir(path.dirname(out));
    await writeFile(out, $.html());
  }

  // 404 fallback inside /en (lets GH Pages serve /en/ paths)
  const en404 = path.join(EN_DIR, '404.html');
  if (existsSync(path.join(DIST, '404.html')) && !existsSync(en404)) {
    await copyFile(path.join(DIST, '404.html'), en404);
  }

  console.log(`translate-build: wrote ${htmlFiles.length} translated pages to ${path.relative(ROOT, EN_DIR)}/`);
}

main().catch((err) => {
  console.error('translate-build failed:', err);
  process.exit(1);
});
