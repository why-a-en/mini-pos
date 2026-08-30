// Split out so proxy.ts (which only needs to know whether a cookie exists)
// doesn't pull in better-auth, the db client and the schema just to check.

// better-auth's default cookie prefix. Over HTTPS it also applies the
// __Secure- prefix, so the proxy has to accept either form — checking only
// the bare name would make every production request look signed-out.
export const SESSION_COOKIE_NAME = "better-auth.session_token";
export const SECURE_SESSION_COOKIE_NAME = `__Secure-${SESSION_COOKIE_NAME}`;
