import { getCollection } from 'astro:content';
import { buildIcs } from '../../lib/ics';

export async function getStaticPaths() {
  const events = await getCollection('events');
  return events.map((e) => ({ params: { slug: e.id.replace(/\.md$/, '') }, props: { event: e } }));
}

export async function GET({ props }) {
  const e = props.event;
  const baseUrl = (import.meta.env.SITE ?? '') + (import.meta.env.BASE_URL ?? '/');

  const ics = buildIcs({
    name: e.data.title,
    events: [
      {
        uid: `${e.id}@fyrholm.dk`,
        title: e.data.title,
        start: e.data.date,
        end: e.data.endDate,
        location: e.data.location,
        description: e.data.summary,
        url: `${baseUrl.replace(/\/$/, '')}/kalender/`,
      },
    ],
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${e.id.replace(/\.md$/, '')}.ics"`,
    },
  });
}
