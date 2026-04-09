import fetch from 'node-fetch';

const BASE_URL = process.env.API_BASE_URL || 'https://turbometrics.de/api/v1';

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
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody.message || errBody.error || JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`API error ${response.status} on ${method} ${path}: ${detail}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  get: (token, path) => apiRequest(token, 'GET', path),
  post: (token, path, body) => apiRequest(token, 'POST', path, body),
};
