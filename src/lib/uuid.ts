const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Any `[id]`-style dynamic segment that gets used straight in a uuid-column
 *  query needs this first — a non-UUID segment (a stale link, a typo, a bot
 *  probing routes) would otherwise crash the query with a raw Postgres
 *  "invalid input syntax for type uuid" error instead of a normal 404. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
