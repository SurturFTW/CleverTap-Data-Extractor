import { sleep } from "./pool";

/**
 * POST JSON to one of our API routes and parse the reply.
 *
 * When the host kills a slow function (e.g. a 504 gateway timeout) it answers
 * with its own plain-text/HTML page, not our JSON. That used to surface as
 * "Unexpected token 'A', "An error o"... is not valid JSON"; now it becomes a
 * readable error, and idempotent calls are retried a couple of times first.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { signal?: AbortSignal; step?: string; retries?: number } = {},
): Promise<T> {
  const { signal, step = "Request", retries = 0 } = opts;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      // not JSON: fall through to retry / error
    }

    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      await sleep(2000 * (attempt + 1));
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      continue;
    }
    throw new Error(
      res.status === 504
        ? `${step}: the server timed out (HTTP 504) before CleverTap answered. Try a shorter date range or a more specific filter (for Phone, "equals" with the country code is fastest).`
        : `${step}: unexpected server response (HTTP ${res.status}): ${text.slice(0, 120)}`,
    );
  }
}
