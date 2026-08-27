import { api } from '../api.js';

// Dieselbe Grenze wie die API (validate 'url' => max:2048). Frueher abgewiesen
// spart einen Umlauf und eine unverstaendliche Validierungsmeldung.
const MAX_URL_CHARS = 2048;

// Genau die Felder, die ApiScanController entgegennimmt — je Typ.
const AUTH_FIELDS = {
  basic: ['username', 'password'],
  header: ['header_name', 'header_value'],
};

/**
 * Bewusst nachsichtig: die API ergaenzt ein fehlendes Schema selbst
 * (Services\Scan\UrlNormalizer), und "scanne example.com" ist ein
 * alltaeglicher Fall. Wer hier auf https:// besteht, nimmt ihn dem Nutzer weg.
 *
 * Abgewiesen wird nur, was sicher kein Web-Ziel ist — file:, javascript:,
 * data:. Die Ausnahme fuer Ziffern nach dem Doppelpunkt haelt "example.com:8080"
 * offen, das sonst wie ein fremdes Schema aussaehe.
 */
function checkUrl(value) {
  const url = String(value ?? '').trim();

  if (url === '') {
    throw new Error('domain_url is required.');
  }

  if (url.length > MAX_URL_CHARS) {
    throw new Error(`domain_url must not exceed ${MAX_URL_CHARS} characters.`);
  }

  if (!/^https?:\/\//i.test(url) && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)) {
    throw new Error('domain_url must be an http or https address.');
  }

  return url;
}

/**
 * Das Schema fuehrte 'auth' als type: 'object', und der Umsetzer in server.js
 * macht daraus z.any() — es gab also gar keine Pruefung, und beliebige
 * Schluessel aus der Modelleingabe wanderten in den API-Aufruf.
 */
function checkAuth(auth) {
  if (auth === undefined || auth === null) {
    return undefined;
  }

  if (typeof auth !== 'object' || Array.isArray(auth)) {
    throw new Error('auth must be an object.');
  }

  const fields = AUTH_FIELDS[auth.type];

  if (!fields) {
    throw new Error("auth.type must be either 'basic' or 'header'.");
  }

  const clean = { type: auth.type };

  for (const field of fields) {
    if (auth[field] !== undefined) {
      clean[field] = String(auth[field]);
    }
  }

  return clean;
}

export const triggerScan = {
  name: 'trigger_scan',
  description: 'Starts an immediate scan for any URL — including completely new domains not yet monitored. Returns a scan_id usable with get_findings once the scan completes.',
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL to scan (e.g. https://example.com)',
      },
      region: {
        type: 'string',
        enum: ['eu', 'us', 'asia'],
        description: 'Scan region (optional)',
      },
      force: {
        type: 'boolean',
        description: 'Force a fresh scan even if a recent cached result exists',
      },
      auth: {
        type: 'object',
        description: 'Optional authentication: {type: "basic", username, password} or {type: "header", header_name, header_value}',
      },
    },
    required: ['domain_url'],
  },
  async handler(token, { domain_url, region, force, auth }) {
    const body = { url: checkUrl(domain_url) };
    const checkedAuth = checkAuth(auth);

    if (region !== undefined) body.region = region;
    if (force !== undefined) body.force = force;
    if (checkedAuth !== undefined) body.auth = checkedAuth;

    const response = await api.post(token, '/scans', body);
    const result = response.data ?? response;

    return {
      scan_id: result.id ?? result.scan_id,
      status: result.status,
      cached: result.cached ?? false,
      message: result.cached
        ? 'Cached result returned — use force:true to trigger a fresh scan.'
        : 'Scan queued. Use get_findings(scan_id) or get_latest_scan(url) once complete.',
    };
  },
};
