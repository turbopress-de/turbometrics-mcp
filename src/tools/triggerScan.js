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

// Die Regionen der API (config/plans.php allowed_regions). Bis 1.5.0 bot das
// Werkzeug 'eu', 'us' und 'asia' an — die API kennt keine davon und wies jeden
// Aufruf mit Region als Validierungsfehler ab.
export const SCAN_REGIONS = ['de-fsn1', 'de-nbg1', 'fi-hel1'];

export const triggerScan = {
  name: 'trigger_scan',
  title: 'Start a scan',
  description: 'Starts a performance scan of any public website, including domains the user does not monitor yet. turbometrics fetches the page from its own servers (desktop and mobile), so this reaches out to the given third-party site. If a recent result for the same URL exists it is reused instead (cached: true) unless force is true; such a reused result may not be readable from this account, see the returned message. Each call counts toward the plan\'s hourly scan limit. Returns a scan_id (a public_id). The scan runs in the background; check its status with list_scans and read the result with get_findings once it is finished.',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      domain_url: {
        type: 'string',
        description: 'URL to scan, e.g. https://example.com or example.com (http and https only)',
      },
      region: {
        type: 'string',
        enum: SCAN_REGIONS,
        description: 'Scan location: de-fsn1 (Falkenstein), de-nbg1 (Nuremberg) or fi-hel1 (Helsinki). Optional; which regions are available depends on the plan.',
      },
      force: {
        type: 'boolean',
        description: 'Run a fresh scan even if a recent cached result exists (default: false)',
      },
      auth: {
        type: 'object',
        description: 'Optional access credentials for a protected site, e.g. a staging site behind HTTP Basic Auth. Only pass credentials the user explicitly provided for this site. Requires a plan with authenticated scans.',
        properties: {
          type: {
            type: 'string',
            enum: ['basic', 'header'],
            description: 'basic = HTTP Basic Auth with username and password; header = one custom request header',
          },
          username: { type: 'string', description: 'Basic Auth username (type basic)' },
          password: { type: 'string', description: 'Basic Auth password (type basic)' },
          header_name: { type: 'string', description: 'Header name, e.g. X-Access-Token (type header)' },
          header_value: { type: 'string', description: 'Header value (type header)' },
        },
        required: ['type'],
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

    // Ein Treffer aus dem Zwischenspeicher kann ein oeffentlicher Scan eines
    // anderen Nutzers sein (ScanCacheService). Den liefern get_findings und
    // list_scans nicht aus, weil die API dort auf user_id filtert.
    return {
      scan_id: result.id ?? result.scan_id,
      status: result.status,
      cached: result.cached ?? false,
      message: result.cached
        ? 'A recent result for this URL already exists and was reused. It may come from a public scan that is not stored in this account; if get_findings cannot find this scan_id, call trigger_scan again with force: true to run a fresh scan for the account.'
        : 'Scan queued. Check the status with list_scans and read the result with get_findings(scan_id) once it is finished.',
    };
  },
};
