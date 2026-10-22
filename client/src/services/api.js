const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function api(path, options = {}) {
  const token = sessionStorage.getItem('cafeteriaToken');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the server. Check that the API is running.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error?.message || result.message || 'Request failed.');
  }
  return result;
}

export const jsonBody = (value) => JSON.stringify(value);

export function createIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}
