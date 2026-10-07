import { api } from '../api.js';

/**
 * Hostname aus einer Eingabe wie "https://example.com/", "example.com" oder
 * "Example.com/pfad". Bisher stand dort new URL(domain_url) — und "example.com"
 * ohne Schema warf einen nackten TypeError "Invalid URL", obwohl genau das die
 * Form ist, in der Nutzer eine Domain nennen.
 */
export function hostOf(domain_url) {
  const raw = String(domain_url ?? '').trim();

  if (raw === '') {
    throw new Error('domain_url is required.');
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    throw new Error(`Not a valid domain or URL: ${raw}`);
  }
}

/**
 * Die RUM-Site zu einer Domain. Stand vorher dreimal gleich in den drei
 * RUM-Werkzeugen.
 */
export async function findRumSite(token, domain_url) {
  const host = hostOf(domain_url);
  let page = 1;

  while (true) {
    const data = await api.get(token, `/rum/sites?page=${page}&limit=50`);
    const site = (data.data ?? []).find((s) => String(s.domain).toLowerCase() === host);

    if (site) return { site, host };
    if (page >= (data.meta?.last_page ?? 1)) break;
    page++;
  }

  throw new Error(
    `No RUM site found for ${host}. Real User Monitoring has to be set up for this domain in turbometrics first.`
  );
}
