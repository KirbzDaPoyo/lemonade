export type LocationFailure =
  | "unavailable"
  | "invalid"
  | "moved"
  | "timeout"
  | "provider"
  | "configuration"
  | "user_quota"
  | "project_quota"
  | "quota"
  | "authentication"
  | "network";
export type LocationResult =
  | { id: string; latitude: number; longitude: number }
  | { id: string; failure: LocationFailure };
export const positionValid = (lat: unknown, lng: unknown) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;
export function parseLocationIds(body: unknown): string[] {
  const value = body as { ids?: unknown };
  if (
    !value ||
    Object.keys(value).some((k) => k !== "ids") ||
    !Array.isArray(value.ids) ||
    !value.ids.length ||
    value.ids.length > 20 ||
    value.ids.some(
      (id) => typeof id !== "string" || !id.trim() || id.length > 200,
    )
  )
    throw new Error("invalid");
  return [...new Set((value.ids as string[]).map((id) => id.trim()))];
}
export const downwardLimit = (raw: string | undefined, max: number) =>
  raw && /^\d+$/.test(raw) ? Math.min(max, Number(raw)) : max;
export type ResolverDependencies = {
  authenticate: (request: Request) => Promise<string>;
  owned: (
    ids: string[],
    userId: string,
    request: Request,
  ) => Promise<{ id: string; place_id: string | null }[]>;
  reserve: (userId: string, count: number) => Promise<string>;
  apiKey: string | undefined;
  fetch: typeof fetch;
  timeoutMs?: number;
};
export function createLocationHandler(deps: ResolverDependencies) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  return async (request: Request) => {
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return reply({ error: "invalid" }, 405);
    let userId: string;
    try {
      userId = await deps.authenticate(request);
      if (!userId) throw new Error();
    } catch {
      return reply({ error: "authentication" }, 401);
    }
    let ids: string[];
    try {
      const text = await request.text();
      if (text.length > 8192) throw new Error();
      ids = parseLocationIds(JSON.parse(text));
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    let rows: { id: string; place_id: string | null }[];
    try {
      rows = await deps.owned(ids, userId, request);
    } catch {
      return reply({ error: "unavailable" }, 503);
    }
    // Reject the whole request without revealing which submitted records exist.
    if (ids.some((id) => !rows.some((row) => row.id === id)))
      return reply({ error: "unavailable" }, 404);
    const eligible = rows.filter((row) => row.place_id?.trim());
    if (eligible.length && !deps.apiKey)
      return reply({ error: "configuration" }, 503);
    if (eligible.length) {
      try {
        const quota = await deps.reserve(userId, eligible.length);
        if (quota !== "ok")
          return reply(
            {
              error:
                quota === "user_quota" || quota === "project_quota"
                  ? quota
                  : "quota",
            },
            429,
          );
      } catch {
        return reply({ error: "quota" }, 503);
      }
    }
    const results: LocationResult[] = rows
      .filter((r) => !r.place_id?.trim())
      .map((r) => ({ id: r.id, failure: "unavailable" }));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, eligible.length) }, async () => {
        while (next < eligible.length) {
          const row = eligible[next++];
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            deps.timeoutMs ?? 8000,
          );
          try {
            const response = await deps.fetch(
              `https://places.googleapis.com/v1/places/${encodeURIComponent(row.place_id!.trim())}`,
              {
                headers: {
                  "X-Goog-Api-Key": deps.apiKey!,
                  "X-Goog-FieldMask": "id,location",
                },
                signal: controller.signal,
              },
            );
            if (!response.ok) {
              results.push({
                id: row.id,
                failure:
                  response.status === 404
                    ? "invalid"
                    : response.status === 429
                      ? "quota"
                      : "provider",
              });
              continue;
            }
            const data = await response.json();
            if (data.id !== row.place_id!.trim()) {
              results.push({ id: row.id, failure: "moved" });
              continue;
            }
            if (
              !positionValid(data.location?.latitude, data.location?.longitude)
            ) {
              results.push({ id: row.id, failure: "invalid" });
              continue;
            }
            results.push({
              id: row.id,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
            });
          } catch {
            results.push({
              id: row.id,
              failure: controller.signal.aborted ? "timeout" : "provider",
            });
          } finally {
            clearTimeout(timer);
          }
        }
      }),
    );
    return reply({ results });
  };
}
