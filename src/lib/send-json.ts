// Browser-side JSON request to the app's own API. `result` is the parsed body for both success and error
// responses, so callers can read `result.error` and `result.fields` when `ok` is false.
export async function sendJson(url: string, method: "POST" | "PATCH", data: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(data),
  });
  return { ok: response.ok, result: await response.json() };
}
