# Ejerforeningen Fyrholm — hjemmeside

Statisk hjemmeside for E/F Fyrholm. Bygget med [Astro](https://astro.build), søgning via [Pagefind](https://pagefind.app), redigering via [Decap CMS](https://decapcms.org), hostet på GitHub Pages på `https://fyrholm.dk`.

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
| `npm run cms` | Start lokal Decap proxy (med `local_backend: true` i `public/admin/config.yml`) |

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
└── admin/            # Decap CMS UI
```

## Redigér indhold

### Mulighed 1 — Decap CMS via fyrholm.dk/admin

1. Åbn `https://fyrholm.dk/admin/`.
2. Login med din GitHub-konto (Device Flow — du får en kode at indtaste på `github.com/login/device`).
3. Vælg en collection, redigér, og publicer. Ændringen committes til `main` og er live efter ~1–2 min.

**Forudsætning**: Du skal være tilføjet som collaborator på GitHub-repoet.

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

1. Push dette repo til GitHub som fx `<owner>/fyrholm`.
2. I repo Settings → Pages → Source: "GitHub Actions".

### 2. DNS for fyrholm.dk

Hos din DNS-udbyder, opret følgende records på `fyrholm.dk`:

```
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
CNAME www   <owner>.github.io.
```

Når DNS er propageret: repo Settings → Pages → aktivér "Enforce HTTPS".

### 3. Decap CMS — GitHub OAuth App

1. På github.com → Settings → Developer settings → OAuth Apps → "New OAuth App".
2. **Application name**: `Fyrholm CMS`
3. **Homepage URL**: `https://fyrholm.dk`
4. **Authorization callback URL**: `https://fyrholm.dk/admin/` (ikke brugt af Device Flow, men feltet er påkrævet)
5. Opret app, klik derefter **"Enable Device Flow"** (vigtigt!).
6. Kopiér Client ID.
7. Erstat `REPLACE_ME_OWNER/fyrholm` og `REPLACE_ME_CLIENT_ID` i `public/admin/config.yml` med dine værdier.

### 4. Tilføj redaktører

Repo Settings → Collaborators → tilføj GitHub-brugernavne på dem der skal kunne redigere via CMS'et.

## Søgning

Pagefind indekserer hele sitet ved `npm run build` og lægger filer i `dist/pagefind/`. Søgesiden er på `/sog`. Søgefeltet i hero'en sender også til `/sog?q=...`.

## Brand / design

Designet er bevidst neutralt med CSS custom properties i `src/styles/tokens.css`. Skift `--color-accent` og typografi-tokens for at re-brande hele sitet.
