import fetch from 'node-fetch';

const BASE_URL = process.env.API_BASE_URL || 'https://turbometrics.io/api/v1';

export async function apiRequest(token, method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(`Network error calling ${method} ${path}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `API error ${response.status} on ${method} ${path}: ${await errorDetail(response)}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Der Fehlertext wird als Werkzeugantwort an das Modell zurueckgegeben und
// landet damit im Verlauf des Nutzers.
const MAX_DETAIL_CHARS = 500;

/**
 * Bei 4xx ist die Meldung der API genau das, was dem Nutzer weiterhilft
 * ("The url field is required") — die bleibt unveraendert.
 *
 * Bei 5xx sagt sie nichts ueber die Eingabe, kann aber alles Moegliche
 * enthalten: Stacktrace, Datenbankfehler, interne Hostnamen. Dort steht
 * deshalb nur noch, dass die API gestolpert ist.
 */
async function errorDetail(response) {
  if (response.status >= 500) {
    return 'upstream error';
  }

  let detail = '';

  try {
    const errBody = await response.json();
    detail = errBody.message || errBody.error || JSON.stringify(errBody);
  } catch {
    detail = await response.text().catch(() => '');
  }

  detail = String(detail);

  return detail.length > MAX_DETAIL_CHARS ? `${detail.slice(0, MAX_DETAIL_CHARS)}…` : detail;
}

export const api = {
  get: (token, path) => apiRequest(token, 'GET', path),
  post: (token, path, body) => apiRequest(token, 'POST', path, body),
};
