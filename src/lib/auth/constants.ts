// Split out from session.ts so proxy.ts (which only needs the cookie name)
// doesn't pull in crypto/db/schema just to check whether a cookie exists.
export const SESSION_COOKIE_NAME = "session";
