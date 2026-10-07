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
 * Vergleichsform eines Hosts: ohne fuehrendes "www.". So behandelt auch das
 * Backend Domains (RumSite::findForDomain, RumController).
 */
export function siteKey(host) {
  return String(host).toLowerCase().replace(/^www\./, '');
}

/** Gehoeren beide Angaben zum selben Host (www egal)? Unlesbares zaehlt als nein. */
export function sameSite(a, b) {
  try {
    return siteKey(hostOf(a)) === siteKey(hostOf(b));
  } catch {
    return false;
  }
}

// So viele Scans werden durchsucht, um den passenden Host zu finden.
const SCAN_LOOKUP_LIMIT = 50;

/**
 * Der neueste fertige Scan genau dieser Domain.
 *
 * /scans?domain= sucht per LIKE '%…%' in normalized_url. "example.com" trifft
 * damit auch www.myexample.com, shop.example.com oder example.com.au — und
 * limit=1 nahm den neuesten davon. Das Modell bekam still den Scan einer
 * fremden Seite. Deshalb mehr Treffer holen und auf den Host filtern.
 */
export async function latestFinishedScan(token, domain_url) {
  const host = hostOf(domain_url);
  const data = await api.get(
    token,
    `/scans?domain=${encodeURIComponent(siteKey(host))}&status=finished&limit=${SCAN_LOOKUP_LIMIT}`
  );
  const scans = Array.isArray(data) ? data : (data.data ?? []);
  const scan = scans.find((s) => sameSite(s.submitted_url, host));

  if (!scan) {
    throw new Error(`No finished scan found for ${host}. Start one with trigger_scan.`);
  }

  return scan;
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
    const site = (data.data ?? []).find((s) => siteKey(s.domain) === siteKey(host));

    if (site) return { site, host };
    if (page >= (data.meta?.last_page ?? 1)) break;
    page++;
  }

  throw new Error(
    `No RUM site found for ${host}. Real User Monitoring has to be set up for this domain in turbometrics first.`
  );
}
