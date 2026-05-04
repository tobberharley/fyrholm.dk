# Ejerforeningen Fyrholm — hjemmeside

Statisk hjemmeside for E/F Fyrholm. Bygget med [Astro](https://astro.build), søgning via [Pagefind](https://pagefind.app), redigering via [Sveltia CMS](https://sveltiacms.app/), hostet på GitHub Pages.

**Aktuel URL**: <https://tobberharley.github.io/fyrholm.dk/>
**Planlagt URL**: <https://fyrholm.dk> (når DNS er sat op)

Alt indhold (nyheder, beboerinfo, dokumenter, sider) ligger som markdown- og JSON-filer i `src/content/` og `src/data/` — ændringer committet til `main` deployes automatisk via GitHub Actions.

## Kom i gang

```bash
nvm use            # Node 20 (se .nvmrc)
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Kommando | Beskrivelse |
| --- | --- |
| `npm run dev` | Start lokal udviklings-server med live reload |
| `npm run build` | Byg statisk site til `dist/` og generér Pagefind-søge-indeks |
| `npm run preview` | Server `dist/` lokalt (test prod-build) |
| `npm run cms` | (Valgfrit) Start lokal CMS-proxy til lokal redigering |

## Indholdsstruktur

```
src/
├── content/
│   ├── news/         # Nyheder (markdown)
│   ├── events/       # "Det sker" (markdown)
│   ├── info/         # "Godt at vide" / beboerinfo (markdown)
│   ├── documents/    # Dokument-poster der peger på PDF'er i public/docs/
│   └── pages/        # Indhold til om-os, kontakt, ny-beboer (markdown)
├── data/
│   └── site.json     # Foreningens info, hero, footer-links
public/
├── docs/             # PDF-filer (vedtægter, husorden, referater osv.)
├── uploads/          # Billeder uploadet via CMS
└── admin/            # Sveltia CMS UI
```

## Redigér indhold

### Mulighed 1 — Sveltia CMS via /admin

1. Åbn `https://tobberharley.github.io/fyrholm.dk/admin/`.
2. Klik **"Sign in with Token"** (ikke "Sign in with GitHub" — den kræver en OAuth-server vi ikke hoster).
3. Følg dialogen: klik linket til GitHub, generér en Personal Access Token (PAT) med pre-udfyldte scopes, paste tilbage i CMS.
4. Vælg en collection, redigér, og publicer. Ændringen committes til `main` af din GitHub-bruger og er live efter ~1–2 min.

**Forudsætning**: Du skal være tilføjet som collaborator (Write-adgang) på GitHub-repoet. Tokenet gemmes kun i din egen browser.

Se også brugervenlig guide til redaktører: [`src/pages/bestyrelse/redaktoer-guide.astro`](src/pages/bestyrelse/redaktoer-guide.astro).

### Mulighed 2 — Direkte i GitHub

Naviger til filen i GitHub-webinterface, klik "Edit", commit til `main`. Build og deploy køres automatisk.

### Mulighed 3 — Lokalt

Klon repo, redigér filer, commit og push. Brug `npm run dev` til preview.

## Tilføj en nyhed

Opret `src/content/news/YYYY-MM-DD-slug.md`:

```markdown
---
title: Min nyhed
date: 2026-05-09T10:00
summary: Kort beskrivelse vist på forside og listevisning.
---

Brødtekst i markdown her.
```

Samme princip for `events/`, `info/` og `documents/`.

### Skjul en begivenhed på forsiden

Tilføj `showOnHome: false` i frontmatter — så vises begivenheden kun på `/kalender` og i ICS-feedet, ikke i forsidens "Det sker"-blok:

```markdown
---
title: Bestyrelsesmøde
date: 2026-08-15T19:00
showOnHome: false
---
```

## Tilføj et dokument

1. Læg PDF'en i `public/docs/` — fx `public/docs/2026-referat.pdf`.
2. Opret en markdown-fil i `src/content/documents/`:
   ```markdown
   ---
   title: Referat af generalforsamling 2026
   category: generalforsamling-referat
   date: 2026-09-22
   file: /docs/2026-referat.pdf
   ---
   ```
3. Gyldige kategorier: `generalforsamling-indkaldelse`, `generalforsamling-referat`, `regnskab`, `vedtaegter`, `husorden`.

> **Bestyrelsesreferater må IKKE uploades** — alt i repoet er offentligt på fyrholm.dk.

## Første-gangs-opsætning

### 1. GitHub-repo

1. Push dette repo til GitHub som `tobberharley/fyrholm.dk`.
2. I repo Settings → Pages → Source: "GitHub Actions".
3. Push til `main` → Actions kører → sitet er live på <https://tobberharley.github.io/fyrholm.dk/>.

### 2. Senere: skift til fyrholm.dk (custom domain)

Når I er klar til at flytte til selve `fyrholm.dk`-domænet:

1. Hos jeres DNS-udbyder, opret records på `fyrholm.dk`:
   ```
   A     @     185.199.108.153
   A     @     185.199.109.153
   A     @     185.199.110.153
   A     @     185.199.111.153
   CNAME www   tobberharley.github.io.
   ```
2. Opret filen `public/CNAME` med indholdet `fyrholm.dk`.
3. I [astro.config.mjs](astro.config.mjs), skift til:
   ```js
   site: 'https://fyrholm.dk',
   base: '/',
   ```
4. Søg-erstat `/fyrholm.dk/` → `/` i `src/content/**/*.md` (markdown internal links).
5. Push → GitHub Actions bygger igen, og sitet er live på `https://fyrholm.dk`.

### 3. Sveltia CMS — ingen OAuth-app nødvendig

CMS'et bruger Personal Access Tokens (PAT). Der skal **ikke** oprettes en OAuth App, og der er ingen `app_id` i `config.yml`. Hver redaktør laver sin egen PAT på github.com når de logger ind første gang.

**PAT-rettigheder (classic token):** scopes `repo` og `user`. Sveltia's "Sign in using GitHub Access Token" link åbner GitHub med disse allerede valgt — redaktøren skal bare give tokenet et navn, vælge en udløbsdato og klikke *Generate*.

> ℹ️ Login-skærmen i Sveltia viser normalt også en GitHub OAuth-knap. Den er skjult med CSS i `public/admin/index.html`, fordi den kræver en server vi ikke driver. Kun token-knappen er synlig.

### 4. Tilføj redaktører

Repo Settings → Collaborators → tilføj GitHub-brugernavne på dem der skal kunne redigere via CMS'et med **Write**-adgang. Send dem så linket til guiden: `https://tobberharley.github.io/fyrholm.dk/bestyrelse/redaktoer-guide/`

## Søgning

Pagefind indekserer hele sitet ved `npm run build` og lægger filer i `dist/pagefind/`. Søgesiden er på `/sog`. Søgefeltet i hero'en sender også til `/sog?q=...`.

## Brand / design

Designet er bevidst neutralt med CSS custom properties i `src/styles/tokens.css`. Skift `--color-accent` og typografi-tokens for at re-brande hele sitet.
