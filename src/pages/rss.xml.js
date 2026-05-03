import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import site from '../data/site.json';

export async function GET(context) {
  const news = (await getCollection('news', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  );

  return rss({
    title: `${site.name} – Nyheder`,
    description: site.description,
    site: context.site,
    items: news.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.date,
      description: entry.data.summary ?? '',
      link: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/nyheder/${entry.id}/`,
    })),
  });
}
