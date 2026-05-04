#!/usr/bin/env node
/**
 * Post-build translator.
 *
 * Walks every .html file in dist/, extracts user-visible text nodes,
 * translates them via MyMemory (free, no signup required) and writes
 * a parallel /en/ mirror with translated content + internal links
 * rewritten to /en/.
 *
 * MyMemory free quota:
 *   - anonymous:  ~5,000 words/day
 *   - with email: ~50,000 words/day (set TRANSLATE_EMAIL env var)
 *
 * Skip rules:
 *  - <script>, <style>, <code>, <pre>, <noscript>
 *  - any element with class="notranslate" or translate="no"
 *
 * Cache: scripts/.translation-cache.json (committed) keyed by SHA-1
 * of the source string. Lets repeat builds run with zero API calls
 * if content is unchanged.
 *
 * Set TRANSLATE_DISABLE=1 to skip translation entirely.
 */

import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const EN_DIR = path.join(DIST, 'en');
const CACHE_FILE = path.join(ROOT, 'scripts', '.translation-cache.json');
const SITE_BASE = '/fyrholm.dk';
const EMAIL = process.env.TRANSLATE_EMAIL || '';
const DISABLED = process.env.TRANSLATE_DISABLE === '1';
const MAX_LEN = 500; // MyMemory per-request limit

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

  const titleText = $('title').text();
  if (titleText && titleText.trim()) texts.add(titleText.trim());

  return [...texts];
}

async function translateOne(text) {
  // MyMemory: GET https://api.mymemory.translated.net/get?q=...&langpair=da|en-GB&de=email
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'da|en-GB');
  if (EMAIL) url.searchParams.set('de', EMAIL);

  const res = await fetch(url, { headers: { 'User-Agent': 'fyrholm-build/1.0' } });
  if (!res.ok) throw new Error(`MyMemory ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const status = json?.responseStatus;
  if (status && status !== 200 && String(status) !== '200') {
    const msg = json?.responseDetails || JSON.stringify(json);
    throw new Error(`MyMemory error ${status}: ${msg}`);
  }
  const out = json?.responseData?.translatedText;
  if (typeof out !== 'string') throw new Error('MyMemory: missing translatedText');
  return out;
}

async function translateChunked(text) {
  if (text.length <= MAX_LEN) return translateOne(text);
  // Split on sentence boundaries to stay within 500 chars
  const parts = [];
  const segments = text.split(/(?<=[.!?…])\s+|\n+/);
  let buf = '';
  for (const seg of segments) {
    if ((buf + ' ' + seg).trim().length > MAX_LEN) {
      if (buf) parts.push(buf.trim());
      buf = seg;
    } else {
      buf = buf ? buf + ' ' + seg : seg;
    }
  }
  if (buf) parts.push(buf.trim());

  const out = [];
  for (const p of parts) {
    if (p.length <= MAX_LEN) {
      out.push(await translateOne(p));
    } else {
      // hard split for very long single words/strings
      for (let i = 0; i < p.length; i += MAX_LEN) {
        out.push(await translateOne(p.slice(i, i + MAX_LEN)));
      }
    }
  }
  return out.join(' ');
}

async function translateAll(strings, cache) {
  const missing = strings.filter((s) => !(sha1(s) in cache));
  if (!missing.length) return;
  console.log(`  · translating ${missing.length} new strings via MyMemory${EMAIL ? ` (as ${EMAIL})` : ' (anonymous)'}`);
  let done = 0;
  let quotaHit = false;
  for (const s of missing) {
    if (quotaHit) break;
    try {
      cache[sha1(s)] = await translateChunked(s);
    } catch (err) {
      console.warn(`    ! failed (${s.slice(0, 60)}…): ${err.message}`);
      // On quota / rate-limit: stop calling, leave the rest for next build.
      if (/429|quota|rate/i.test(err.message)) {
        quotaHit = true;
        console.warn('    ! rate limit reached — stopping. Remaining strings retry next build.');
        break;
      }
      // Other errors: skip this one, try next. Don't poison cache.
    }
    done += 1;
    if (done % 20 === 0 || done === missing.length) {
      process.stdout.write(`    · ${done}/${missing.length}\r`);
      await saveCache(cache);
    }
    await new Promise((r) => setTimeout(r, 120));
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
  const rewrite = (val) => {
    if (!val) return val;
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('mailto:') || val.startsWith('tel:') || val.startsWith('#')) return val;
    if (!val.startsWith(SITE_BASE)) return val;
    if (val.startsWith(`${SITE_BASE}/en/`) || val === `${SITE_BASE}/en`) return val;
    if (/\.(pdf|jpg|jpeg|png|webp|gif|svg|ico|xml|json|txt|css|js|woff2?)(\?|$|#)/i.test(val)) return val;
    const after = val.slice(SITE_BASE.length);
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

async function main() {
  if (!existsSync(DIST)) {
    console.error('No dist/ directory — run astro build first.');
    process.exit(1);
  }
  if (DISABLED) {
    console.log('translate-build: TRANSLATE_DISABLE=1 — skipping.');
    return;
  }
  console.log('translate-build: generating /en/ mirror via MyMemory …');

  const cache = await loadCache();

  const htmlFiles = [];
  for await (const f of walk(DIST)) {
    if (f.endsWith('.html')) htmlFiles.push(f);
  }
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
  await translateAll([...allTexts], cache);
  await saveCache(cache);

  for (const { file, $ } of docs) {
    applyTranslations($, cache);
    rewriteLinks($);
    const rel = path.relative(DIST, file);
    const out = path.join(EN_DIR, rel);
    await ensureDir(path.dirname(out));
    await writeFile(out, $.html());
  }

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
