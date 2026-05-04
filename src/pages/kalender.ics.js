import { getCollection } from 'astro:content';
import { buildIcs } from '../lib/ics';
import site from '../data/site.json';

export async function GET() {
  const all = await getCollection('events');
  const sorted = all.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
  const baseUrl = (import.meta.env.SITE ?? '') + (import.meta.env.BASE_URL ?? '/');

  const ics = buildIcs({
    name: `${site.name} – Kalender`,
    description: 'Begivenheder og arrangementer i Ejerforeningen Fyrholm.',
    events: sorted.map((e) => ({
      uid: `${e.id}@fyrholm.dk`,
      title: e.data.title,
      start: e.data.date,
      end: e.data.endDate,
      location: e.data.location,
      description: e.data.summary,
      url: `${baseUrl.replace(/\/$/, '')}/kalender/`,
    })),
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="fyrholm-kalender.ics"',
    },
  });
}
