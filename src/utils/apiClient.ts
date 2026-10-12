/**
 * Resilient API client for 8 MINUTES Studio.
 * Safely handles non-JSON responses (HTML error pages, 404s, Vercel timeouts)
 * preventing "Unexpected token 'T', 'The page c'... is not valid JSON" parse exceptions.
 */

export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Network connection error: ${netErr.message || 'Unable to reach server.'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    let rawText = '';
    try {
      rawText = await res.text();
    } catch {
      rawText = '';
    }

    if (!res.ok) {
      if (
        rawText.includes('The page could not be found') ||
        rawText.includes('The page cannot be found') ||
        res.status === 404
      ) {
        throw new Error(
          'API endpoint not found (HTTP 404). If deployed on Vercel, verify that GEMINI_API_KEY is configured in your Vercel Environment Variables.'
        );
      }
      if (res.status === 504 || rawText.includes('Gateway Timeout')) {
        throw new Error('Server timed out (HTTP 504). Please try processing fewer clips or shorter clips.');
      }
      if (res.status === 413 || rawText.includes('Payload Too Large')) {
        throw new Error('Video frames payload too large (HTTP 413). Please upload fewer clips at once.');
      }
      const preview = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
      throw new Error(`Server returned error (${res.status}): ${preview || 'Unexpected error'}`);
    }

    // Try parsing in case server returned JSON without explicit content-type header
    try {
      return JSON.parse(rawText) as T;
    } catch {
      throw new Error('Expected JSON response, but received non-JSON text from server.');
    }
  }

  let data: any;
  try {
    data = await res.json();
  } catch (jsonErr: any) {
    throw new Error('Server returned malformed JSON response.');
  }

  if (!res.ok || (data && data.error)) {
    throw new Error(data?.error || `Request failed with HTTP ${res.status}`);
  }

  return data as T;
}
