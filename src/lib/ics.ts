// Minimal RFC 5545 iCalendar helpers for Fyrholm-events.
// Tider i src/content/events er angivet i lokal tid (Europe/Copenhagen),
// så vi medsender en VTIMEZONE-blok og bruger TZID=Europe/Copenhagen.

export interface IcsEvent {
  uid: string;
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  description?: string;
  url?: string;
}

const CRLF = '\r\n';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Format a Date som "lokal tid" (de tal der står i frontmatter).
// Vi læser UTC-komponenter — Astro parser ISO uden TZ som UTC, så
// "2026-06-13T15:00" bliver til 15:00 UTC i Date-objektet, og det
// stemmer overens med den lokale tid vi vil have i ICS'en.
function fmtLocal(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function fmtUtc(d: Date): string {
  return `${fmtLocal(d)}Z`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Folder lange linjer ved 75 oktetter med CRLF + space (RFC 5545 §3.1).
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  out.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    out.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return out.join(CRLF);
}

const VTIMEZONE_CPH = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Copenhagen',
  'X-LIC-LOCATION:Europe/Copenhagen',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join(CRLF);

function buildVEvent(e: IcsEvent, dtstamp: Date): string {
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`UID:${e.uid}`);
  lines.push(`DTSTAMP:${fmtUtc(dtstamp)}`);
  lines.push(`DTSTART;TZID=Europe/Copenhagen:${fmtLocal(e.start)}`);
  if (e.end) lines.push(`DTEND;TZID=Europe/Copenhagen:${fmtLocal(e.end)}`);
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push('END:VEVENT');
  return lines.join(CRLF);
}

export function buildIcs(opts: {
  name: string;
  description?: string;
  events: IcsEvent[];
}): string {
  const dtstamp = new Date();
  const parts: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ejerforeningen Fyrholm//Kalender//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    'X-WR-TIMEZONE:Europe/Copenhagen',
  ];
  if (opts.description) parts.push(`X-WR-CALDESC:${escapeText(opts.description)}`);
  parts.push(VTIMEZONE_CPH);
  for (const e of opts.events) parts.push(buildVEvent(e, dtstamp));
  parts.push('END:VCALENDAR');
  // Fold per linje (ikke per multi-linje blok)
  return parts
    .join(CRLF)
    .split(CRLF)
    .map(fold)
    .join(CRLF) + CRLF;
}
