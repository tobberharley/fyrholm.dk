// Centralised internal-URL helper.
//
// When the site is hosted on a sub-path (e.g. https://<user>.github.io/fyrholm.dk/)
// `import.meta.env.BASE_URL` is "/fyrholm.dk/". When hosted on a custom domain
// at root, it is "/". Always go through `link("/foo")` for internal hrefs
// in .astro files so switching deployment targets is a one-line change in
// astro.config.mjs.

const baseRaw = import.meta.env.BASE_URL || '/';
export const base = baseRaw.endsWith('/') ? baseRaw.slice(0, -1) : baseRaw;

export function link(path: string): string {
  if (!path) return base + '/';
  if (/^([a-z]+:)?\/\//i.test(path)) return path; // absolute URL
  if (path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('#')) return path;
  const normalised = path.startsWith('/') ? path : '/' + path;
  return base + normalised;
}
