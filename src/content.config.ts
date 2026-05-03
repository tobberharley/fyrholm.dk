import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string().optional(),
      image: image().optional(),
      imageAlt: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
  }),
});

const info = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/info' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: z.string().default('Beboerinfo'),
      date: z.coerce.date(),
      image: image().optional(),
      imageAlt: z.string().optional(),
      summary: z.string().optional(),
      order: z.number().default(0),
    }),
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/documents' }),
  schema: z.object({
    title: z.string(),
    category: z.enum([
      'generalforsamling-indkaldelse',
      'generalforsamling-referat',
      'regnskab',
      'vedtaegter',
      'husorden',
    ]),
    date: z.coerce.date(),
    file: z.string(), // path under public/, e.g. /docs/2025-referat.pdf
    summary: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

const facilities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/facilities' }),
  schema: z.object({
    title: z.string(),
    icon: z.string().default('✦'),
    summary: z.string(),
    order: z.number().default(0),
    link: z.string().optional(), // optional external link (e.g. Facebook group)
    membersOnly: z.boolean().default(false),
    badge: z.string().optional(),
  }),
});

export const collections = { news, events, info, documents, pages, facilities };
